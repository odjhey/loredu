// biome-ignore-all lint/suspicious/noTemplateCurlyInString: fixtures intentionally contain TypeScript template syntax.
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type BoundaryRule, boundaryViolations } from "./workspace-boundary";

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const fixtureRoots: string[] = [];

function write(root: string, path: string, content: string): void {
  const target = join(root, path);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, content);
}

function fixture(): string {
  const root = join(REPO_ROOT, ".tmp-boundary-fixtures", crypto.randomUUID());
  fixtureRoots.push(root);
  write(
    root,
    "packages/kernel/package.json",
    JSON.stringify({
      name: "@loredu/kernel",
      exports: { ".": "./src/index.ts", "./testing": "./testing/index.ts" },
    }),
  );
  write(
    root,
    "packages/store-plainfile/package.json",
    JSON.stringify({
      name: "@loredu/store-plainfile",
      dependencies: { "@loredu/kernel": "workspace:*" },
    }),
  );
  write(
    root,
    "packages/cli/package.json",
    JSON.stringify({
      name: "@loredu/cli",
      dependencies: {
        "@loredu/kernel": "workspace:*",
        "@loredu/store-plainfile": "workspace:*",
      },
    }),
  );
  for (const path of [
    "kernel/src/index.ts",
    "store-plainfile/src/index.ts",
    "cli/src/index.ts",
    "cli/bin/lor.ts",
  ]) {
    write(root, `packages/${path}`, "export {};\n");
  }
  return root;
}

function rules(root: string): BoundaryRule[] {
  return boundaryViolations(root).map(({ rule }) => rule);
}

function scanSource(source: string, path = "packages/kernel/src/index.ts"): BoundaryRule[] {
  const root = fixture();
  write(root, path, source);
  return rules(root);
}

function expectRule(source: string, rule: BoundaryRule, path = "packages/kernel/src/index.ts"): void {
  const root = fixture();
  write(root, path, source);
  expect(rules(root)).toContain(rule);
  write(root, path, "export {};\n");
  expect(rules(root)).toEqual([]);
}

async function proveRedThenGreen(rule: BoundaryRule, path: string, invalid: string): Promise<void> {
  const root = fixture();
  const original = await Bun.file(join(root, path)).text();
  write(root, path, invalid);
  expect(rules(root)).toContain(rule);
  write(root, path, original);
  expect(rules(root)).toEqual([]);
}

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("configured workspace boundary", () => {
  test("the actual production tree satisfies every boundary rule", () => {
    expect(boundaryViolations(REPO_ROOT)).toEqual([]);
  });

  test("manifest package names have a synthetic RED and removal is GREEN", async () => {
    await proveRedThenGreen(
      "manifest-name",
      "packages/kernel/package.json",
      JSON.stringify({
        name: "kernel",
        exports: { ".": "x", "./testing": "y" },
      }),
    );
  });

  test("kernel runtime dependencies have a synthetic RED and removal is GREEN", async () => {
    await proveRedThenGreen(
      "kernel-runtime-dependency",
      "packages/kernel/package.json",
      JSON.stringify({
        name: "@loredu/kernel",
        exports: { ".": "x", "./testing": "y" },
        dependencies: { vendor: "1.0.0" },
      }),
    );
  });

  test("manifest DAG violations have a synthetic RED and removal is GREEN", async () => {
    await proveRedThenGreen(
      "package-dag-manifest",
      "packages/store-plainfile/package.json",
      JSON.stringify({
        name: "@loredu/store-plainfile",
        dependencies: { "@loredu/cli": "workspace:*" },
      }),
    );
  });

  test("kernel export violations have a synthetic RED and removal is GREEN", async () => {
    await proveRedThenGreen(
      "kernel-exports",
      "packages/kernel/package.json",
      JSON.stringify({
        name: "@loredu/kernel",
        exports: { ".": "x" },
      }),
    );
  });

  test("source DAG imports have a synthetic RED and removal is GREEN", async () => {
    await proveRedThenGreen(
      "package-dag-import",
      "packages/kernel/src/index.ts",
      'export { Store } from "@loredu/store-plainfile";\n',
    );
  });

  test("environment imports have a synthetic RED and removal is GREEN", async () => {
    await proveRedThenGreen(
      "environment-import",
      "packages/kernel/src/index.ts",
      'import { readFile } from "node:fs";\n',
    );
  });

  test("production testing imports have a synthetic RED and removal is GREEN", async () => {
    await proveRedThenGreen(
      "production-testing-import",
      "packages/cli/src/index.ts",
      'import "@loredu/kernel/testing";\n',
    );
  });

  for (const [name, source] of [
    ["Date.now()", "export const value = Date.now();\n"],
    ["zero-argument new Date()", "export const value = new Date();\n"],
    ["Math.random()", "export const value = Math.random();\n"],
  ] as const) {
    test(`${name} has a synthetic RED and removal is GREEN`, async () => {
      await proveRedThenGreen("ambient-capability", "packages/kernel/src/index.ts", source);
    });
  }

  test("comments, strings, test support, and explicit-value dates do not cause false positives", () => {
    const root = fixture();
    write(
      root,
      "packages/kernel/src/index.ts",
      [
        "// Date.now(); new Date(); Math.random(); import 'node:fs'",
        'export const examples = ["Date.now()", new Date(0), new Date("2020-01-01"), Date.parse("2020-01-01")];',
      ].join("\n"),
    );
    write(root, "packages/kernel/testing/index.ts", "export const now = Date.now();\n");
    expect(boundaryViolations(root)).toEqual([]);
  });

  test("adapter manifests may declare third-party runtime dependencies", () => {
    const root = fixture();
    write(
      root,
      "packages/store-plainfile/package.json",
      JSON.stringify({
        name: "@loredu/store-plainfile",
        dependencies: { "@loredu/kernel": "workspace:*", vendor: "1.0.0" },
      }),
    );
    write(
      root,
      "packages/cli/package.json",
      JSON.stringify({
        name: "@loredu/cli",
        dependencies: {
          "@loredu/kernel": "workspace:*",
          "@loredu/store-plainfile": "workspace:*",
          vendor: "1.0.0",
        },
      }),
    );
    expect(boundaryViolations(root)).toEqual([]);
  });
});

describe("governed import spellings and paths", () => {
  for (const [name, source] of [
    ["static import", 'import "node:fs";'],
    ["static export", 'export * from "node:fs/promises";'],
    ["dynamic import", 'export const value = import("fs/promises");'],
    ["TypeScript import-equals", 'import value = require("path/posix");'],
    ["require call", 'export const value = require("crypto/webcrypto");'],
  ] as const) {
    test(`environment rule covers ${name}`, () => {
      expectRule(`${source}\n`, "environment-import");
    });
  }

  for (const [name, source, path] of [
    ["static package root", 'export * from "@loredu/store-plainfile";', "packages/kernel/src/index.ts"],
    ["static package subpath", 'import "@loredu/cli/internal";', "packages/kernel/src/index.ts"],
    [
      "dynamic package subpath",
      'import("@loredu/store-plainfile/internal");',
      "packages/kernel/src/index.ts",
    ],
    [
      "import-equals package",
      'import value = require("@loredu/cli/internal");',
      "packages/store-plainfile/src/index.ts",
    ],
    ["require package", 'require("@loredu/cli/internal");', "packages/store-plainfile/src/index.ts"],
    [
      "relative kernel to store",
      'import "../../store-plainfile/src/internal";',
      "packages/kernel/src/index.ts",
    ],
    ["relative kernel to CLI", 'export * from "../../cli/src/internal";', "packages/kernel/src/index.ts"],
    [
      "relative store to CLI",
      'import value = require("../../cli/src/internal");',
      "packages/store-plainfile/src/index.ts",
    ],
  ] as const) {
    test(`source DAG rule covers ${name}`, () => {
      expectRule(`${source}\n`, "package-dag-import", path);
    });
  }

  for (const [name, source] of [
    ["static type import", 'import type { Value } from "@loredu/kernel/testing/helpers";'],
    ["dynamic import", 'import("@loredu/kernel/testing/helpers");'],
    ["import-equals", 'import value = require("@loredu/kernel/testing/helpers");'],
    ["require call", 'require("@loredu/kernel/testing/helpers");'],
    ["relative deep import", 'import "../../kernel/testing/helpers";'],
  ] as const) {
    test(`production testing rule covers ${name}`, () => {
      expectRule(`${source}\n`, "production-testing-import", "packages/cli/src/index.ts");
    });
  }
});

describe("ambient capability spellings", () => {
  for (const [name, source] of [
    ["direct Date.now", "Date.now();"],
    ["parenthesized Date.now", "(Date.now)();"],
    ["computed Date.now", 'Date["now"]();'],
    ["direct Math.random", "Math.random();"],
    ["parenthesized Math.random", "(Math.random)();"],
    ["computed Math.random", 'Math["random"]();'],
    ["direct new Date", "new Date();"],
    ["parenthesized new Date", "new (Date)();"],
    ["Date.now with ignored argument", "Date.now(1);"],
    ["Math.random with ignored argument", "Math.random(1);"],
  ] as const) {
    test(`rejects ${name}`, () => {
      expectRule(`${source}\n`, "ambient-capability");
    });
  }

  test("allows explicit-value Date construction and Date.parse", () => {
    expect(
      scanSource('new Date(0); new (Date)(value); new Date("2020-01-01"); Date.parse("2020-01-01");\n'),
    ).toEqual([]);
  });
});

describe("TypeScript lexical boundaries", () => {
  for (const [name, source] of [
    ["line-comment text in string", 'const marker = "//"; Date.now();'],
    ["block-comment text in string", 'const marker = "/* */"; Math.random();'],
    ["regex comment token", "const marker = /\\/\\//; Math.random();"],
    ["regex quote", 'const marker = /"/; Date.now();'],
    ["regex brace in interpolation", "const marker = `${/\\}/.test('}') ? Math.random() : 0}`;"],
    ["plain interpolation", "const marker = `${Date.now()}`;"],
    ["nested interpolation", "const marker = `${`${Math.random()}`}`;"],
  ] as const) {
    test(`${name} cannot hide executable ambient use`, () => {
      expectRule(`${source}\n`, "ambient-capability");
    });
  }

  for (const [name, source] of [
    ["ordinary ambient prose", 'export const value = "Date.now(); Math.random(); new Date()";'],
    ["ordinary import prose", "export const value = \"import 'node:fs'\";"],
    ["template raw ambient prose", "export const value = `Date.now(); Math.random(); new Date()`;"],
    ["template raw import prose", "export const value = `import 'node:fs'`;"],
    ["escaped interpolation prose", "export const value = `\\${Math.random()} is raw`;"],
    ["regex ambient prose", "export const value = /Date.now() Math.random()/;"],
    ["comments", "// import 'node:fs'; Date.now();\n/* Math.random(); new Date(); */"],
    ["legal nested template", "export const value = `${{ text: '}' }.text}:${new Date(0)}`;"],
  ] as const) {
    test(`${name} stays inert`, () => {
      expect(scanSource(`${source}\n`)).toEqual([]);
    });
  }

  test("recursively scans executable template interpolations", () => {
    expectRule(
      [
        "export const nested = `${(() => {",
        " const object = { outer: { text: '} inert' } };",
        " const inner = `raw Math.random() ${(() => { /* } */ return `${Date.now()}`; })()}`;",
        " return `${object.outer.text}:${inner}`;",
        "})()}`;",
      ].join("\n"),
      "ambient-capability",
    );
  });

  test("malformed lexical inputs are bounded and do not throw", () => {
    for (const source of [
      'export const value = "unterminated; Math.random();',
      "/* unterminated comment; Math.random();",
      "export const value = `unterminated raw Math.random();",
      "export const value = `unterminated ${Math.random()",
      "export const value = /unterminated[;/; Math.random();",
    ]) {
      expect(() => scanSource(source)).not.toThrow();
    }
  });
});
