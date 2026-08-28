#!/usr/bin/env node

// check-selftest.mjs — proves the docs and catalog gates actually fail.
//
// A guardrail that has never fired is not a guardrail (issue #9). This copies
// the corpus to a temp directory, injects one synthetic violation at a time,
// and asserts the checker exits nonzero for the expected reason — then asserts
// the unmutated copy is clean. Runs in CI alongside the checks themselves, so
// a gate that silently stops working fails the build.
//
// Usage: check-selftest.mjs [--verbose]
// Exit code: 0 all proofs pass, 1 a gate failed to fire.

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const verbose = process.argv.includes("--verbose");

const edit = (root, rel, fn) => {
  const p = join(root, rel);
  writeFileSync(p, fn(readFileSync(p, "utf8")));
};
const write = (root, rel, text) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const editJson = (root, rel, fn) => {
  const p = join(root, rel);
  const data = JSON.parse(readFileSync(p, "utf8"));
  fn(data);
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
};

const A_DOC = "docs/architecture/product-architecture.md";
const STATUS = "docs/v0.x/execution/catalog-status.json";
const T40_TEST = "tests/cli-conformance/compiled-binary.test.ts";

const CASES = [
  {
    name: "clean corpus passes",
    script: "check-docs.mjs",
    expect: null,
    mutate: () => {},
  },
  {
    // Regression: an indented fence is still a fence. A regex like
    // `^[a-z0-9]([a-z0-9._-]*)$` inside one is not a markdown link.
    name: "link-like syntax inside an indented code fence is not a link",
    script: "check-docs.mjs",
    expect: null,
    mutate: (root) =>
      edit(
        root,
        A_DOC,
        (t) => `${t}\n- a rule:\n\n  \`\`\`text\n  ^[a-z0-9]([a-z0-9._:/-]*[a-z0-9])?$\n  \`\`\`\n`,
      ),
  },
  {
    name: "broken relative link",
    script: "check-docs.mjs",
    expect: "link",
    mutate: (root) => edit(root, A_DOC, (t) => `${t}\n[gone](./no-such-doc.md)\n`),
  },
  {
    name: "anchor with no matching heading",
    script: "check-docs.mjs",
    expect: "anchor",
    mutate: (root) => edit(root, A_DOC, (t) => `${t}\n[nowhere](./ubiquitous-language.md#not-a-heading)\n`),
  },
  {
    name: "missing required frontmatter field",
    script: "check-docs.mjs",
    expect: "frontmatter",
    mutate: (root) => edit(root, A_DOC, (t) => t.replace(/^type: .*$/m, "")),
  },
  {
    name: "updated_at reintroduced",
    script: "check-docs.mjs",
    expect: "frontmatter",
    mutate: (root) =>
      edit(root, A_DOC, (t) => t.replace(/^created_at: (.*)$/m, "created_at: $1\nupdated_at: $1")),
  },
  {
    name: "status outside the vocabulary",
    script: "check-docs.mjs",
    expect: "status",
    mutate: (root) => edit(root, A_DOC, (t) => t.replace(/^type: (.*)$/m, "type: $1\nstatus: wip")),
  },
  {
    name: "duplicate frontmatter name",
    script: "check-docs.mjs",
    expect: "name",
    mutate: (root) => edit(root, A_DOC, (t) => t.replace(/^name: .*$/m, "name: docs_guide")),
  },
  {
    name: "orphaned doc nothing links to",
    script: "check-docs.mjs",
    expect: "orphan",
    mutate: (root) =>
      write(
        root,
        "docs/architecture/floating.md",
        '---\nname: floating\ndescription: "Nothing links here."\ntype: reference\n---\n\n# Floating\n',
      ),
  },
  {
    name: "clean catalog accounting passes",
    script: "check-catalog.mjs",
    expect: null,
    mutate: () => {},
  },
  {
    name: "T-number accounted for nowhere",
    script: "check-catalog.mjs",
    expect: "unaccounted",
    mutate: (root) => edit(root, T40_TEST, (t) => t.replace(" — @covers T40", "")),
  },
  {
    name: "T-number both implemented and deferred",
    script: "check-catalog.mjs",
    expect: "double-counted",
    mutate: (root) =>
      editJson(root, STATUS, (d) => {
        d.deferred.T40 = { milestone: "M3-E", reason: "synthetic duplicate" };
      }),
  },
  {
    name: "status file invents an unknown T-number",
    script: "check-catalog.mjs",
    expect: "unknown",
    mutate: (root) =>
      editJson(root, STATUS, (d) => {
        d.deferred.T99 = { milestone: "M9", reason: "invented" };
      }),
  },
  {
    name: "test claims coverage with no assertion",
    script: "check-catalog.mjs",
    expect: "placeholder",
    mutate: (root) => {
      edit(root, T40_TEST, (t) => t.replace(" — @covers T40", ""));
      write(
        root,
        "tests/records/entry.test.ts",
        'import { test } from "bun:test"\n\n// @covers T40\ntest("store conformance", () => {})\n',
      );
    },
  },
  {
    name: "skipped test claims coverage",
    script: "check-catalog.mjs",
    expect: "placeholder",
    mutate: (root) => {
      edit(root, T40_TEST, (t) => t.replace(" — @covers T40", ""));
      write(
        root,
        "tests/records/entry.test.ts",
        'import { test, expect } from "bun:test"\n\n// @covers T40\ntest.skip("store conformance", () => { expect(1).toBe(1) })\n',
      );
    },
  },
  {
    name: "deferred entry with no milestone",
    script: "check-catalog.mjs",
    expect: "status",
    mutate: (root) =>
      editJson(root, STATUS, (d) => {
        d.deferred.T40 = { reason: "no milestone given" };
      }),
  },
];

let failures = 0;
for (const testCase of CASES) {
  const root = mkdtempSync(join(tmpdir(), "loredu-selftest-"));
  try {
    // Copy everything the corpus links into, so a clean copy really is clean.
    for (const dir of ["docs", ".github", ".agents", "tests"]) {
      cpSync(join(REPO_ROOT, dir), join(root, dir), { recursive: true });
    }
    for (const rootFile of ["AGENTS.md", "README.md"]) {
      cpSync(join(REPO_ROOT, rootFile), join(root, rootFile));
    }
    testCase.mutate(root);
    const script = join(root, "docs/scripts", testCase.script);
    const run = spawnSync(process.execPath, [script, "--json"], { encoding: "utf8" });
    let problems = [];
    try {
      problems = JSON.parse(run.stdout).problems ?? [];
    } catch {
      console.error(`✗ ${testCase.name}: ${testCase.script} produced no parseable JSON\n${run.stderr}`);
      failures++;
      continue;
    }
    const rules = problems.map((p) => p.rule);
    if (testCase.expect === null) {
      if (problems.length) {
        console.error(`✗ ${testCase.name}: expected a clean run, got ${rules.join(", ")}`);
        failures++;
      } else if (verbose) console.error(`✓ ${testCase.name}`);
    } else if (!rules.includes(testCase.expect)) {
      console.error(
        `✗ ${testCase.name}: gate did not fire — expected rule \`${testCase.expect}\`, got [${rules.join(", ") || "none"}]`,
      );
      failures++;
    } else if (run.status === 0) {
      console.error(`✗ ${testCase.name}: reported \`${testCase.expect}\` but exited 0`);
      failures++;
    } else if (verbose) {
      console.error(`✓ ${testCase.name} → ${testCase.expect}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.error(
  failures
    ? `\n${failures} of ${CASES.length} proof(s) failed`
    : `\n${CASES.length} proofs passed — every gate fires on its synthetic violation`,
);
process.exit(failures ? 1 : 0);
