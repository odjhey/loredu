import { afterEach, describe, expect, test } from "bun:test";
import {
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BOUNDARY_CHECK_IDS,
  type BoundaryCheckId,
  scanWorkspace,
  scanWorkspaceWithDisabledCheckForTest,
  scanWorkspaceWithTrivialMutantForTest,
  type Violation,
} from "../scripts/check-workspace-boundaries";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const temporaryRoots: string[] = [];
function fixture(parent = tmpParent()): string {
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "loredu-boundary-"));
  temporaryRoots.push(root);
  mkdirSync(join(root, "packages"));
  cpSync(join(REPO_ROOT, "tsconfig.base.json"), join(root, "tsconfig.base.json"));
  plant(root, "docs/v0.x/execution/agent-skill.md", "fixture\n");
  // Keep mutation fixtures independent of growth in the production source corpus.
  for (const name of ["kernel", "store-plainfile", "cli"] as const) {
    const packageRoot = join(root, "packages", name);
    mkdirSync(join(packageRoot, "src"), { recursive: true });
    for (const file of ["package.json", "tsconfig.json"])
      cpSync(join(REPO_ROOT, "packages", name, file), join(packageRoot, file));
    plant(root, `packages/${name}/src/index.ts`, "export {};\n");
  }
  plant(root, "packages/kernel/testing/index.ts", "export {};\n");
  plant(root, "packages/cli/bin/lor.ts", "export {};\n");
  plant(
    root,
    "packages/cli/src/embedded-skill.ts",
    'import source from "../../../docs/v0.x/execution/agent-skill.md" with { type: "text" };\n',
  );
  return root;
}
function tmpParent(): string {
  return join(fileURLToPath(new URL("file:///tmp/")), "loredu-boundary-fixtures");
}
function plant(root: string, path: string, content: string): void {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}
function mutateJson(root: string, path: string, mutate: (value: Record<string, unknown>) => void): void {
  const absolute = join(root, path);
  const value = JSON.parse(readFileSync(absolute, "utf8")) as Record<string, unknown>;
  mutate(value);
  writeFileSync(absolute, JSON.stringify(value));
}
function violation(path: string, rule: string, detail: string): Violation {
  return { path, rule, detail };
}
function expectViolation(root: string, expected: Violation): void {
  expect(scanWorkspace(root)).toContainEqual(expected);
}
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("authoritative workspace boundary guard", () => {
  test("the real workspace is clean", () => expect(scanWorkspace(REPO_ROOT)).toEqual([]));

  test("the CLI embedded-skill import is restricted to its regular canonical source", () => {
    const missing = fixture();
    rmSync(join(missing, "docs/v0.x/execution/agent-skill.md"));
    expect(scanWorkspace(missing)).toContainEqual(
      violation(
        "packages/cli/src/embedded-skill.ts",
        "boundary-unresolved",
        "1:20 embedded skill source is not a regular file",
      ),
    );

    const linked = fixture();
    const external = mkdtempSync(join(tmpParent(), "loredu-boundary-skill-"));
    temporaryRoots.push(external);
    cpSync(join(linked, "docs/v0.x/execution/agent-skill.md"), join(external, "agent-skill.md"));
    rmSync(join(linked, "docs/v0.x/execution"), { recursive: true });
    symlinkSync(external, join(linked, "docs/v0.x/execution"), "dir");
    expect(scanWorkspace(linked)).toContainEqual(
      violation(
        "packages/cli/src/embedded-skill.ts",
        "boundary-unresolved",
        "1:20 embedded skill source is outside its canonical workspace path",
      ),
    );
  });

  test.each([
    ["node protocol", 'import "node:fs";', "1:8 kernel imports environment module node:fs"],
    [
      "bare builtin subpath",
      'import "stream/promises";',
      "1:8 kernel imports environment module stream/promises",
    ],
    ["Bun module", 'import "bun:sqlite";', "1:8 kernel imports environment module bun:sqlite"],
    ["unknown bare external", 'import "lodash";', "1:8 kernel imports external package lodash"],
    ["unknown scoped external", 'import "@evil/thing";', "1:8 kernel imports external package @evil/thing"],
    [
      "adapter",
      'import "@loredu/store-plainfile";',
      "1:8 forbidden kernel -> store-plainfile via @loredu/store-plainfile",
    ],
    ["CLI", 'import "@loredu/cli";', "1:8 forbidden kernel -> cli via @loredu/cli"],
    [
      "commented static import",
      'import {x} from /* c */ "node:fs";',
      "1:25 kernel imports environment module node:fs",
    ],
    [
      "commented export",
      'export {x} from /* c */ "node:fs";',
      "1:25 kernel imports environment module node:fs",
    ],
    ["commented dynamic", 'import(/* c */ "node:fs");', "1:1 kernel imports environment module node:fs"],
    ["commented require", 'require /* c */ ("node:fs");', "1:1 kernel imports environment module node:fs"],
    ["type-only", 'import type {Stats} from "node:fs";', "1:26 kernel imports environment module node:fs"],
    ["import equals", 'import fs = require("node:fs");', "1:13 kernel imports environment module node:fs"],
  ])("parses and rejects %s", (_label, source, detail) => {
    const root = fixture();
    plant(root, "packages/kernel/src/probe.ts", source);
    expectViolation(
      root,
      violation(
        "packages/kernel/src/probe.ts",
        detail.includes("forbidden") ? "workspace-edge" : "kernel-import",
        detail,
      ),
    );
  });

  test("covers every runtime-reported bare builtin and representative subpaths", () => {
    const root = fixture();
    const names = [
      ...new Set([
        ...builtinModules.map((name) => name.replace(/^node:/, "")),
        "dns/promises",
        "inspector/promises",
        "readline/promises",
        "stream/consumers",
        "stream/promises",
        "stream/web",
        "timers/promises",
        "util/types",
        "_http_agent",
      ]),
    ];
    plant(root, "packages/kernel/src/builtins.ts", names.map((name) => `import "${name}";`).join("\n"));
    const found = scanWorkspace(root).filter(
      (item) => item.path.endsWith("builtins.ts") && item.rule === "kernel-import",
    );
    expect(found).toHaveLength(names.length);
    for (const [index, name] of names.entries())
      expect(found).toContainEqual(
        violation(
          "packages/kernel/src/builtins.ts",
          "kernel-import",
          `${index + 1}:8 kernel imports environment module ${name}`,
        ),
      );
  });

  test.each([
    ["nonstatic import", 'const name = "node:fs"; import(name);'],
    ["nonstatic require", 'const name = "node:fs"; require(name);'],
    ["concatenated import", 'import("node:" + "fs");'],
  ])("fails closed for %s", (_label, source) => {
    const root = fixture();
    plant(root, "packages/kernel/src/dynamic.ts", source);
    expect(
      scanWorkspace(root).filter(
        (item) => item.path.endsWith("dynamic.ts") && item.rule === "boundary-dynamic",
      ),
    ).toHaveLength(1);
  });

  test("reports parse uncertainty and ignores inert import-like text", () => {
    const broken = fixture();
    plant(broken, "packages/kernel/src/broken.ts", "import {");
    expect(scanWorkspace(broken).filter((item) => item.rule === "source-parse")).toHaveLength(1);
    const clean = fixture();
    plant(
      clean,
      "packages/kernel/src/inert.ts",
      '// import "node:fs";\nconst a = "import node:fs Date.now()"; const r = /Math.random()/; export {a,r};',
    );
    expect(scanWorkspace(clean)).toEqual([]);
  });

  test("resolves relative workspace DAG and testing-seam paths", () => {
    const root = fixture();
    plant(root, "packages/kernel/src/adapter.ts", 'export * from "../../store-plainfile/src/index";');
    plant(root, "packages/store-plainfile/src/cli.ts", 'export * from "../../cli/src/index";');
    plant(root, "packages/cli/src/testing.ts", 'export * from "../../kernel/testing/index";');
    expectViolation(
      root,
      violation(
        "packages/kernel/src/adapter.ts",
        "workspace-edge",
        "1:15 forbidden kernel -> store-plainfile via ../../store-plainfile/src/index",
      ),
    );
    expectViolation(
      root,
      violation(
        "packages/store-plainfile/src/cli.ts",
        "workspace-edge",
        "1:15 forbidden store-plainfile -> cli via ../../cli/src/index",
      ),
    );
    expectViolation(
      root,
      violation(
        "packages/cli/src/testing.ts",
        "testing-import",
        "1:15 production resolves to kernel/testing via ../../kernel/testing/index",
      ),
    );
  });

  test("reports unresolved and out-of-workspace relative targets", () => {
    const root = fixture();
    plant(root, "outside.ts", "export {};\n");
    plant(root, "packages/kernel/src/targets.ts", 'import "./missing";\nimport "../../../outside";');
    plant(root, "packages/cli/src/private.ts", 'import "@loredu/kernel/private";');
    expectViolation(
      root,
      violation("packages/kernel/src/targets.ts", "boundary-unresolved", "1:8 cannot resolve ./missing"),
    );
    expectViolation(
      root,
      violation(
        "packages/kernel/src/targets.ts",
        "boundary-target",
        "2:8 resolves outside the workspace: ../../../outside",
      ),
    );
    expectViolation(
      root,
      violation(
        "packages/cli/src/private.ts",
        "boundary-unresolved",
        "1:8 package subpath is not exported: @loredu/kernel/private",
      ),
    );
  });

  test.each([
    ["Date call", "Date();", "1:1 ambient Date call"],
    ["Date now", "Date.now();", "1:1 ambient Date.now"],
    ["computed Date now", 'Date["now"]();', "1:1 ambient Date.now"],
    ["optional Date now", "Date?.now();", "1:1 ambient Date.now"],
    ["commented Date now", "Date /* c */ . now();", "1:1 ambient Date.now"],
    ["parenthesized Date", "new (Date)();", "1:1 zero-or-uncertain-argument new Date"],
    ["commented Date", "new Date(/* c */);", "1:1 zero-or-uncertain-argument new Date"],
    ["spread Date", "new Date(...[]);", "1:1 zero-or-uncertain-argument new Date"],
    ["Math random", "Math.random();", "1:1 ambient Math.random"],
    ["optional Math random", "Math?.random();", "1:1 ambient Math.random"],
    ["global Date", "globalThis.Date.now();", "1:1 ambient Date.now"],
    ["global Math", "globalThis.Math.random();", "1:1 ambient Math.random"],
    ["Date alias", "const D = Date; D.now();", "1:17 ambient Date.now"],
    ["method alias", "const now = Date.now; now();", "1:23 ambient Date.now"],
    ["Date destructure", "const {now} = Date; now();", "1:21 ambient Date.now"],
    ["Math destructure", "const {random: draw} = Math; draw();", "1:30 ambient Math.random"],
    ["Bun global", "Bun.version;", "1:1 ambient global Bun"],
    ["process global", "process.pid;", "1:1 ambient global process"],
    ["Buffer global", 'Buffer.from("x");', "1:1 ambient global Buffer"],
  ])("rejects ambient capability syntax: %s", (_label, source, detail) => {
    const root = fixture();
    plant(root, "packages/kernel/src/capability.ts", source);
    expectViolation(root, violation("packages/kernel/src/capability.ts", "ambient-capability", detail));
  });

  test("allows deterministic temporal/math code and inert/local names", () => {
    const root = fixture();
    plant(
      root,
      "packages/kernel/src/clean.ts",
      'const marker = "Date.now() " + "Math.random()"; const object = { process: 1, Buffer: 2 }; type Bun = string; const process = 1; const Date = class { constructor(value: string) {} }; new Date("x"); Math.max(1, 2); export {marker, object, process};',
    );
    expect(scanWorkspace(root)).toEqual([]);
  });

  test("test surfaces are narrow, relative, and independent of a parent tests path", () => {
    const root = fixture(join(tmpParent(), "tests", "with space"));
    plant(root, "packages/kernel/src/testing/bypass.ts", 'import "node:fs";');
    plant(root, "packages/cli/src/bad.ts", 'import "@loredu/kernel/testing";');
    plant(root, "packages/kernel/src/accepted.test.ts", 'import "node:fs";');
    expectViolation(
      root,
      violation(
        "packages/kernel/src/testing/bypass.ts",
        "kernel-import",
        "1:8 kernel imports environment module node:fs",
      ),
    );
    expectViolation(
      root,
      violation("packages/cli/src/bad.ts", "testing-import", "1:8 production imports @loredu/kernel/testing"),
    );
    expect(scanWorkspace(root).some((item) => item.path.endsWith("accepted.test.ts"))).toBe(false);
  });

  test("fails closed on unsupported, missing, empty, symlinked, and unclassified source trees", () => {
    const unsupported = fixture();
    plant(unsupported, "packages/kernel/src/x.js", 'import "node:fs";');
    expectViolation(
      unsupported,
      violation("packages/kernel/src/x.js", "source-tree", "executable production source extension .js"),
    );
    const unknown = fixture();
    plant(unknown, "packages/kernel/src/x.wat", "code");
    expectViolation(
      unknown,
      violation("packages/kernel/src/x.wat", "source-tree", "unrecognized production source extension .wat"),
    );
    const missing = fixture();
    rmSync(join(missing, "packages/kernel/src"), { recursive: true });
    expectViolation(
      missing,
      violation("packages/kernel/src", "source-tree", "required production source root is missing"),
    );
    const empty = fixture();
    rmSync(join(empty, "packages/kernel/src"), { recursive: true });
    mkdirSync(join(empty, "packages/kernel/src"));
    expectViolation(
      empty,
      violation(
        "packages/kernel/src",
        "source-tree",
        "production source root contains no supported source files",
      ),
    );
    const linked = fixture();
    symlinkSync(join(linked, "packages/kernel/src/index.ts"), join(linked, "packages/kernel/src/link.ts"));
    expect(lstatSync(join(linked, "packages/kernel/src/link.ts")).isSymbolicLink()).toBe(true);
    expectViolation(
      linked,
      violation("packages/kernel/src/link.ts", "source-tree", "symlinked source entry is not inspectable"),
    );
    const top = fixture();
    plant(top, "packages/rogue.ts", "export {};");
    expectViolation(
      top,
      violation("packages/rogue.ts", "source-tree", "file directly under packages is unclassified"),
    );
    const outside = fixture();
    plant(outside, "packages/kernel/lib/production.test.ts", "export {};");
    expectViolation(
      outside,
      violation(
        "packages/kernel/lib/production.test.ts",
        "source-location",
        "source file is outside a recognized production or test surface",
      ),
    );
  }, 15_000);

  test("validates workspace edges separately from adapter external dependencies", () => {
    const green = fixture();
    mutateJson(green, "packages/store-plainfile/package.json", (value) => {
      (value.dependencies as Record<string, string>).vendor = "1.0.0";
    });
    mutateJson(green, "packages/cli/package.json", (value) => {
      (value.dependencies as Record<string, string>).chalk = "1.0.0";
    });
    expect(scanWorkspace(green)).toEqual([]);
    const red = fixture();
    mutateJson(red, "packages/store-plainfile/package.json", (value) => {
      (value.dependencies as Record<string, string>)["@loredu/cli"] = "workspace:*";
    });
    mutateJson(red, "packages/cli/package.json", (value) => {
      delete (value.dependencies as Record<string, string>)["@loredu/kernel"];
    });
    expectViolation(
      red,
      violation(
        "packages/store-plainfile/package.json",
        "workspace-edge",
        "forbidden manifest edge store-plainfile -> @loredu/cli",
      ),
    );
    expectViolation(
      red,
      violation(
        "packages/cli/package.json",
        "workspace-edge",
        "missing required manifest edge cli -> @loredu/kernel",
      ),
    );
  });

  test("validates exact export maps, targets, and target existence for every package", () => {
    const root = fixture();
    mutateJson(root, "packages/kernel/package.json", (value) => {
      value.exports = { ".": "./testing/index.ts", "./testing": "./src/index.ts" };
    });
    mutateJson(root, "packages/store-plainfile/package.json", (value) => {
      value.exports = { ".": "./src/missing.ts" };
    });
    mutateJson(root, "packages/cli/package.json", (value) => {
      value.exports = { ".": "./src/index.ts", "./extra": "./src/index.ts" };
    });
    expectViolation(
      root,
      violation(
        "packages/kernel/package.json",
        "package-exports",
        'exports must equal {".":"./src/index.ts","./testing":"./testing/index.ts"}',
      ),
    );
    expectViolation(
      root,
      violation(
        "packages/store-plainfile/package.json",
        "package-exports",
        'exports must equal {".":"./src/index.ts"}',
      ),
    );
    expectViolation(
      root,
      violation("packages/cli/package.json", "package-exports", 'exports must equal {".":"./src/index.ts"}'),
    );
    rmSync(join(root, "packages/kernel/testing/index.ts"));
    expectViolation(
      root,
      violation(
        "packages/kernel/package.json",
        "package-exports",
        "export ./testing target does not exist: ./testing/index.ts",
      ),
    );
  });

  test("proves exact effective kernel project types and lib and catches project mutation", () => {
    const root = fixture();
    mutateJson(root, "packages/kernel/tsconfig.json", (value) => {
      (value.compilerOptions as Record<string, unknown>).types = ["bun"];
      (value.compilerOptions as Record<string, unknown>).lib = ["ES2023", "DOM"];
    });
    expectViolation(
      root,
      violation(
        "packages/kernel/tsconfig.json",
        "kernel-tsconfig",
        "effective compilerOptions.types must be []",
      ),
    );
    expectViolation(
      root,
      violation(
        "packages/kernel/tsconfig.json",
        "kernel-tsconfig",
        "effective compilerOptions.lib must be exactly [ES2023]",
      ),
    );
  });

  test("fails closed for package-root and unclassified symlinks and malformed roots", () => {
    const linkedRoot = fixture();
    const external = `${linkedRoot}-packages`;
    temporaryRoots.push(external);
    cpSync(join(linkedRoot, "packages"), external, { recursive: true });
    rmSync(join(linkedRoot, "packages"), { recursive: true });
    symlinkSync(external, join(linkedRoot, "packages"));
    expect(scanWorkspace(linkedRoot)).toContainEqual(
      violation("packages", "source-tree", "symlinked packages directory is not inspectable"),
    );

    const unclassified = fixture();
    symlinkSync(join(unclassified, "packages/kernel/src"), join(unclassified, "packages/kernel/hidden"));
    expectViolation(
      unclassified,
      violation(
        "packages/kernel/hidden",
        "source-tree",
        "symlinked unclassified package entry is not inspectable",
      ),
    );

    const missingPackage = fixture();
    rmSync(join(missingPackage, "packages/kernel"), { recursive: true });
    expect(() => scanWorkspace(missingPackage)).not.toThrow();
    expectViolation(
      missingPackage,
      violation("packages/kernel", "source-tree", "directory could not be read"),
    );

    const testingFile = fixture();
    rmSync(join(testingFile, "packages/kernel/testing"), { recursive: true });
    plant(testingFile, "packages/kernel/testing", "not a directory");
    expectViolation(
      testingFile,
      violation("packages/kernel/testing", "source-tree", "testing root is not an inspectable directory"),
    );
  });

  test("uses TypeScript resolution and rejects ignored and unknown workspace targets", () => {
    const root = fixture();
    plant(root, "packages/kernel/src/substituted.ts", "export {};\n");
    plant(root, "packages/kernel/src/declaration.d.ts", "export {};\n");
    plant(root, "packages/kernel/src/alias.ts", "export {};\n");
    mutateJson(root, "packages/kernel/tsconfig.json", (value) => {
      const options = value.compilerOptions as Record<string, unknown>;
      options.baseUrl = ".";
      options.paths = { "@internal/*": ["src/*"] };
    });
    plant(
      root,
      "packages/kernel/src/resolution.ts",
      'import "./substituted.js"; import "./declaration"; import "@internal/alias";',
    );
    expect(scanWorkspace(root)).toEqual([]);

    const ignored = fixture();
    plant(ignored, "packages/kernel/node_modules/evil/index.ts", "export {};\n");
    plant(ignored, "packages/kernel/src/ignored.ts", 'import "../node_modules/evil/index";');
    expectViolation(
      ignored,
      violation(
        "packages/kernel/src/ignored.ts",
        "boundary-target",
        "1:8 resolves into an ignored source tree: ../node_modules/evil/index",
      ),
    );
    const unknown = fixture();
    plant(unknown, "packages/store-plainfile/src/unknown.ts", 'import "@loredu/unknown";');
    expectViolation(
      unknown,
      violation(
        "packages/store-plainfile/src/unknown.ts",
        "boundary-unresolved",
        "1:8 unknown workspace package: @loredu/unknown",
      ),
    );
  });

  test("supports static import attributes and retains dynamic uncertainty", () => {
    const root = fixture();
    plant(
      root,
      "packages/store-plainfile/src/attributes.ts",
      'import("vendor", { with: { type: "json" } });',
    );
    expect(scanWorkspace(root)).toEqual([]);
    plant(
      root,
      "packages/store-plainfile/src/attributes.ts",
      'const name = "vendor"; import(name, { with: { type: "json" } });',
    );
    expectViolation(
      root,
      violation(
        "packages/store-plainfile/src/attributes.ts",
        "boundary-dynamic",
        "1:24 module reference is not one static string",
      ),
    );
  });

  test.each([
    ["lib", '/// <reference lib="dom" />', "1:21 triple-slash lib reference is forbidden: dom"],
    ["types", '/// <reference types="bun" />', "1:23 triple-slash types reference is forbidden: bun"],
    [
      "path",
      '/// <reference path="./index.ts" />',
      "1:22 triple-slash path reference is forbidden: ./index.ts",
    ],
  ])("rejects kernel triple-slash %s widening", (_label, source, detail) => {
    const root = fixture();
    plant(root, "packages/kernel/src/reference.ts", `${source}\nexport {};`);
    expectViolation(root, violation("packages/kernel/src/reference.ts", "kernel-reference", detail));
  });

  test("resolves ambient bindings lexically and follows capability aliases", () => {
    const red = fixture();
    plant(
      red,
      "packages/kernel/src/lexical.ts",
      "function f() { const Date = class {}; return new Date(); } Date.now(); const d = Date; const n = d.now; n(); globalThis.process.pid; globalThis['Buffer'].from('x');",
    );
    const violations = scanWorkspace(red).filter((item) => item.path.endsWith("lexical.ts"));
    for (const detail of [
      "1:60 ambient Date.now",
      "1:105 ambient Date.now",
      "1:110 ambient global process",
      "1:134 ambient global Buffer",
    ])
      expect(violations).toContainEqual(
        violation("packages/kernel/src/lexical.ts", "ambient-capability", detail),
      );

    const green = fixture();
    plant(
      green,
      "packages/kernel/src/locals.ts",
      "function f(process: unknown, Bun: unknown, Date: {(): void}) { Date(); return [process, Bun]; } const o = { process() {}, Buffer: 1 }; export {f,o};",
    );
    expect(scanWorkspace(green)).toEqual([]);
  });

  test("compares exact export maps independent of object key order", () => {
    const root = fixture();
    mutateJson(root, "packages/kernel/package.json", (value) => {
      value.exports = { "./testing": "./testing/index.ts", ".": "./src/index.ts" };
    });
    expect(scanWorkspace(root)).toEqual([]);
  });

  test("replacement blocker corpus is table-driven and exact", () => {
    const cases = [
      [
        "G0-REF-IMPORT-TYPE-NODE",
        ["CM-I43", "CM-I44"],
        "C",
        'type X = import("node:fs").Stats;',
        violation(
          "packages/kernel/src/probe.ts",
          "kernel-import",
          "1:17 kernel imports environment module node:fs",
        ),
        "g0-replan-1 FR-G0-01",
      ],
      [
        "G0-REF-IMPORT-TYPE-ADAPTER",
        ["CM-I43"],
        "B/C",
        'type X = import("@loredu/store-plainfile").Store;',
        violation(
          "packages/kernel/src/probe.ts",
          "workspace-edge",
          "1:17 forbidden kernel -> store-plainfile via @loredu/store-plainfile",
        ),
        "g0-replan-1 ImportTypeNode",
      ],
      [
        "G0-REF-IMPORT-TYPE-SEAM",
        ["CM-I41"],
        "B/C",
        'type X = import("@loredu/kernel/testing").X;',
        violation(
          "packages/kernel/src/probe.ts",
          "testing-import",
          "1:17 production imports @loredu/kernel/testing",
        ),
        "g0-replan-1 ImportTypeNode seam",
      ],
      [
        "G0-REF-IMPORT-TYPE-PRIVATE",
        ["CM-I43"],
        "B/C",
        'type X = import("@loredu/kernel/private").X;',
        violation(
          "packages/kernel/src/probe.ts",
          "boundary-unresolved",
          "1:17 package subpath is not exported: @loredu/kernel/private",
        ),
        "g0-replan-1 ImportTypeNode private",
      ],
      [
        "G0-FLOW-GLOBAL-ALIAS",
        ["CM-I44"],
        "D",
        "const g = globalThis as any; g['process'].exit();",
        violation("packages/kernel/src/probe.ts", "ambient-capability", "1:30 ambient global process"),
        "g0-final-review F-G0-01",
      ],
      [
        "G0-FLOW-SHORTHAND",
        ["CM-I44"],
        "D",
        "const x = { process };",
        violation("packages/kernel/src/probe.ts", "ambient-capability", "1:13 ambient global process"),
        "g0-replan-1 shorthand",
      ],
      [
        "G0-FLOW-CALL",
        ["CM-I45"],
        "D",
        "const d = Date; d.now.call(d);",
        violation("packages/kernel/src/probe.ts", "ambient-capability", "1:17 ambient Date.now"),
        "g0-replan-1 call/apply",
      ],
      [
        "G0-FLOW-APPLY",
        ["CM-I45"],
        "D",
        "const m = Math; m.random.apply(m);",
        violation("packages/kernel/src/probe.ts", "ambient-capability", "1:17 ambient Math.random"),
        "g0-replan-1 call/apply",
      ],
      [
        "G0-FLOW-BRANCH-JOIN",
        ["CM-I45"],
        "D",
        "let f = Date.now; if (flag) f = Math.max; f();",
        violation("packages/kernel/src/probe.ts", "ambient-capability", "1:43 ambient Date.now"),
        "g0-replan-1 branch join",
      ],
      [
        "G0-FLOW-ESCAPE",
        ["CM-I45"],
        "D",
        "function leak() { return Date.now; }",
        violation("packages/kernel/src/probe.ts", "ambient-capability", "1:19 ambient capability escapes"),
        "g0-replan-1 capability escape",
      ],
    ] as const;
    expect(new Set(cases.map((item) => item[0])).size).toBe(cases.length);
    for (const [id, rows, layer, source, expected, provenance] of cases) {
      expect(id).toStartWith("G0-");
      expect(rows.length).toBeGreaterThan(0);
      expect(layer).not.toBe("");
      expect(provenance).not.toBe("");
      const root = fixture();
      plant(root, "packages/kernel/src/probe.ts", source);
      expect(scanWorkspace(root)).toContainEqual(expected);
    }
  }, 15_000);

  test("keeps label and definitely-clean reassignment controls green", () => {
    const root = fixture();
    plant(
      root,
      "packages/kernel/src/probe.ts",
      "process: for (;;) { break process; } let d = Date; d = Math.max; d(1, 2);",
    );
    expect(scanWorkspace(root)).toEqual([]);
  });

  test("lstat-first rejects dangling and control-path symlinks", () => {
    const root = fixture();
    rmSync(join(root, "packages/kernel/testing"), { recursive: true });
    symlinkSync("missing", join(root, "packages/kernel/testing"));
    rmSync(join(root, "packages/kernel/tsconfig.json"));
    symlinkSync("missing-config", join(root, "packages/kernel/tsconfig.json"));
    expect(scanWorkspace(root)).toContainEqual(
      violation("packages/kernel/testing", "source-tree", "testing root is not an inspectable directory"),
    );
    expect(scanWorkspace(root)).toContainEqual(
      violation(
        "packages/kernel/tsconfig.json",
        "kernel-tsconfig",
        "kernel project config is not a regular file",
      ),
    );
  });

  test("kills every stable check-ID mutant", () => {
    const scenarios: Record<BoundaryCheckId, { mutate(root: string): void; rule: string }> = {
      "G0-A-INVENTORY": {
        mutate: (root) => plant(root, "packages/kernel/src/probe.txt", "unknown"),
        rule: "source-tree",
      },
      "G0-B-SYNTAX": {
        mutate: (root) => plant(root, "packages/kernel/src/probe.ts", 'import "@loredu/store-plainfile";'),
        rule: "workspace-edge",
      },
      "G0-C-REFERENCES": {
        mutate: (root) => plant(root, "packages/kernel/src/probe.ts", "import(name);"),
        rule: "boundary-dynamic",
      },
      "G0-C-SOURCE-PARSE": {
        mutate: (root) => plant(root, "packages/kernel/src/probe.ts", "import {"),
        rule: "source-parse",
      },
      "G0-D-CAPABILITY-FLOW": {
        mutate: (root) => plant(root, "packages/kernel/src/probe.ts", "process.exit();"),
        rule: "ambient-capability",
      },
      "G0-E-COMPILER": {
        mutate: (root) =>
          mutateJson(root, "packages/kernel/tsconfig.json", (value) => {
            (value.compilerOptions as Record<string, unknown>).types = ["bun"];
          }),
        rule: "kernel-tsconfig",
      },
      "G0-E-CONFIG-GRAPH": {
        mutate: (root) => rmSync(join(root, "packages/store-plainfile/tsconfig.json")),
        rule: "project-config",
      },
      "G0-F-MANIFEST-EXPORTS": {
        mutate: (root) =>
          mutateJson(root, "packages/kernel/package.json", (value) => {
            value.exports = {};
          }),
        rule: "package-exports",
      },
    };
    expect(Object.keys(scenarios).sort()).toEqual([...BOUNDARY_CHECK_IDS].sort());
    for (const id of BOUNDARY_CHECK_IDS) {
      const root = fixture();
      scenarios[id].mutate(root);
      const normal = scanWorkspace(root);
      expect(normal.some((item) => item.rule === scenarios[id].rule)).toBe(true);
      const mutant = scanWorkspaceWithDisabledCheckForTest(root, id);
      expect(mutant).not.toEqual(normal);
      expect(mutant.some((item) => item.rule === scenarios[id].rule)).toBe(false);
    }
    const root = fixture();
    plant(root, "packages/kernel/src/trivial-mutant.ts", 'import "node:fs";');
    expect(scanWorkspace(root)).not.toEqual([]);
    expect(scanWorkspaceWithTrivialMutantForTest(root)).toEqual([]);
    expect(scanWorkspaceWithTrivialMutantForTest(root)).not.toEqual(scanWorkspace(root));
  }, 20_000);

  test("closes independent reference, escape, config, and ignored-tree probes", () => {
    const root = fixture();
    plant(
      root,
      "packages/kernel/src/references.ts",
      'const a = require.resolve("node:fs"); const b = module.require("node:fs"); /** @type {import("node:fs").Stats} */ const c = null; export {a,b,c};',
    );
    plant(
      root,
      "packages/kernel/src/escapes.ts",
      "const now = Date.now; accept(now); const o = {now}; const a = [now]; const c = flag ? now : Math.max; function f(v = now) { return v; } const x: {v?: unknown} = {}; x.v = now;",
    );
    plant(root, "packages/kernel/src/dist/bypass.ts", 'import "node:fs";');
    rmSync(join(root, "packages/store-plainfile/tsconfig.json"));
    writeFileSync(join(root, "packages/kernel/package.json"), "null");
    const found = scanWorkspace(root);
    expect(
      found.filter((item) => item.path.endsWith("references.ts") && item.rule === "kernel-import"),
    ).toHaveLength(3);
    expect(
      found.filter(
        (item) => item.path.endsWith("escapes.ts") && item.detail.endsWith("ambient capability escapes"),
      ),
    ).toHaveLength(6);
    expect(found).toContainEqual(
      violation(
        "packages/kernel/src/dist",
        "source-tree",
        "ignored or hidden tree inside a source root is forbidden",
      ),
    );
    expect(found).toContainEqual(
      violation(
        "packages/store-plainfile/tsconfig.json",
        "project-config",
        "required project config is absent",
      ),
    );
    expect(found).toContainEqual(
      violation("packages/kernel/package.json", "package-manifest", "manifest is not a valid JSON object"),
    );
  });

  test("outer watchdog preserves failures and kills synchronous hangs", async () => {
    const watchdog = join(REPO_ROOT, "scripts/run-with-watchdog.ts");
    const success = Bun.spawn(["bun", watchdog, "2", "bun", "-e", "process.exit(0)"]);
    expect(await success.exited).toBe(0);
    const failure = Bun.spawn(["bun", watchdog, "2", "bun", "-e", "process.exit(7)"]);
    expect(await failure.exited).toBe(7);
    const hang = Bun.spawn(["bun", watchdog, "0.2", "bun", "-e", "while(true){}"], {
      stderr: "pipe",
    });
    expect(await hang.exited).not.toBe(0);
    expect(await new Response(hang.stderr).text()).toContain("watchdog: command exceeded");
  }, 5_000);

  test("the actual kernel project rejects node:fs, Bun, process, and Buffer", async () => {
    const root = fixture();
    plant(
      root,
      "packages/kernel/src/isolation-fixture.ts",
      'import {readFileSync} from "node:fs"; readFileSync("x"); Bun.version; process.pid; Buffer.from("x");',
    );
    const child = Bun.spawn([join(REPO_ROOT, "node_modules/.bin/tsc"), "-p", join(root, "packages/kernel")], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(code).not.toBe(0);
    const diagnostics = `${stdout}\n${stderr}`;
    for (const name of ["node:fs", "Bun", "process", "Buffer"]) expect(diagnostics).toContain(name);
  });
});
