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
import { scanWorkspace, type Violation } from "../scripts/check-workspace-boundaries";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const temporaryRoots: string[] = [];
function fixture(parent = tmpParent()): string {
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "loredu-boundary-"));
  temporaryRoots.push(root);
  mkdirSync(join(root, "packages"));
  cpSync(join(REPO_ROOT, "tsconfig.base.json"), join(root, "tsconfig.base.json"));
  for (const name of ["kernel", "store-plainfile", "cli"])
    cpSync(join(REPO_ROOT, "packages", name), join(root, "packages", name), {
      recursive: true,
      filter: (path) => !path.includes("node_modules") && !path.includes("/dist"),
    });
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
  });

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
