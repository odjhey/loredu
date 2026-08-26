import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanKernelProduction } from "../scripts/kernel-capability-guard";
import { EXECUTABLE_SOURCE_EXTENSIONS } from "../scripts/source-policy";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKER = join(REPO_ROOT, "scripts", "check-kernel-capabilities.ts");
const temporaryRoots: string[] = [];
const decoder = new TextDecoder();

interface RunResult {
  readonly exitCode: number;
  readonly output: string;
}

function emptyRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "loredu-kernel-capability-"));
  temporaryRoots.push(root);
  return root;
}

function fixture(
  files: Readonly<Record<string, string>> = { "fixture.ts": "export const safe = 1;\n" },
): string {
  const root = emptyRoot();
  const sourceRoot = join(root, "packages", "kernel", "src");
  mkdirSync(sourceRoot, { recursive: true });
  for (const [file, source] of Object.entries(files)) {
    const path = join(sourceRoot, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
  }
  return root;
}

function run(root: string): RunResult {
  const result = Bun.spawnSync([process.execPath, CHECKER, "--root", root], {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: result.exitCode,
    output: `${decoder.decode(result.stdout)}${decoder.decode(result.stderr)}`,
  };
}

function expectRed(root: string, diagnostic: string): void {
  const result = run(root);
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(diagnostic);
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("kernel ambient capability guard", () => {
  test("the clean production kernel passes", () => {
    const result = run(REPO_ROOT);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("kernel capability boundary: clean");
  });

  test("explicit-value Date construction passes without comment or string false positives", () => {
    const root = fixture({
      "fixture.ts": `
        const value = 1_700_000_000_000;
        const dates = [new Date(0), new Date(value), new globalThis.Date("2026-01-01")];
        const deterministic = [Date.parse("2026-01-01"), Date.UTC(2026, 0), Math.abs(-1)];
        const documentation = "Date.now() new Date() Math.random()";
        // Date.now(); new Date(); Math.random();
        export { dates, deterministic, documentation };
      `,
    });
    expect(run(root)).toMatchObject({ exitCode: 0 });
  });

  test("lexical Date, Math, and globalThis shadows pass in nested scopes", () => {
    const root = fixture({
      "fixture.ts": `
        export function deterministic(
          Date: { now(): number },
          globalThis: { Date: { new(value: number): unknown } },
        ) {
          const outer = Date.now();
          {
            const Math = { random: () => 11 };
            return [outer, Math.random(), globalThis.Date];
          }
        }
      `,
    });
    expect(run(root)).toMatchObject({ exitCode: 0 });
  });

  test("a nested lexical shadow does not hide an ambient use in its outer scope", () => {
    const root = fixture({
      "fixture.ts": `
        function safe(Date: { now(): number }) { return Date.now(); }
        export const values = [safe({ now: () => 1 }), Date.now()];
      `,
    });
    expectRed(root, "[Date.now]");
  });

  test("imported Date, Math, and globalThis shadows pass", () => {
    const root = fixture({
      "shadows.ts": `
        export const Date = { now: () => 7 };
        export const Math = { random: () => 11 };
        export const globalThis = { Date };
      `,
      "fixture.ts": `
        import { Date, Math, globalThis } from "./shadows";
        export const deterministic = [Date.now(), Math.random(), globalThis.Date.now()];
      `,
    });
    expect(run(root)).toMatchObject({ exitCode: 0 });
  });

  test("an aliased import does not hide a separate ambient binding", () => {
    const root = fixture({
      "shadows.ts": "export const Date = { now: () => 7 };\n",
      "fixture.ts": `
        import { Date as LocalDate } from "./shadows";
        export const values = [LocalDate.now(), Date.now()];
      `,
    });
    expectRed(root, "[Date.now]");
  });

  test("declaration-only Date, Math, and globalThis bindings remain ambient red", () => {
    const root = fixture({
      "fixture.ts": `
        declare const Date: DateConstructor;
        declare const Math: Math;
        declare const globalThis: typeof globalThis;
        export const values = [Date.now(), Math.random(), globalThis.Date];
      `,
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[Date.now]");
    expect(result.output).toContain("[Math.random]");
    expect(result.output).toContain("binding is erased");
  });

  test("nested declaration-only dangerous bindings remain red", () => {
    const root = fixture({
      "fixture.ts": `
        export function read() {
          declare const Date: DateConstructor;
          declare const Math: Math;
          declare const globalThis: typeof globalThis;
          return [Date.now(), Math.random(), globalThis.Date];
        }
      `,
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[Date.now]");
    expect(result.output).toContain("[Math.random]");
    expect(result.output).toContain("declaration-only");
  });

  for (const [name, source, diagnostic] of [
    ["declare var", "declare var Date: DateConstructor; Date.now();", "[Date.now]"],
    ["declare let", "declare let Date: DateConstructor; Date.now();", "[Date.now]"],
    ["declare function", "declare function Date(): string; Date();", "[new Date]"],
    ["declare class", "declare class Date { static now(): number } Date.now();", "[Date.now]"],
    [
      "declare namespace",
      "declare namespace Math { function random(): number } Math.random();",
      "[Math.random]",
    ],
    ["declare enum", "declare enum Math { random } Math.random;", "[Math.random]"],
  ] as const) {
    test(`${name} does not establish a runtime shadow`, () => {
      expectRed(fixture({ "fixture.ts": source }), diagnostic);
    });
  }

  test("declaration-file imports do not establish runtime shadows", () => {
    const root = fixture({
      "ambient.d.ts": `
        export declare const Date: DateConstructor;
        export declare const Math: Math;
        export declare const globalThis: typeof globalThis;
      `,
      "fixture.ts": `
        import { Date, Math, globalThis } from "./ambient";
        export const values = [Date.now(), Math.random(), globalThis.Date];
      `,
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("declaration-file");
  });

  test("interfaces and type aliases used as values remain ambient red", () => {
    const root = fixture({
      "fixture.ts": `
        interface Date { marker: true }
        type Math = { marker: true };
        export const values = [Date.now(), Math.random()];
      `,
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[Date.now]");
    expect(result.output).toContain("[Math.random]");
  });

  test("every type-only import form remains ambient red", () => {
    const root = fixture({
      "runtime.ts": `
        export const Date = { now: () => 1 };
        export const Math = { random: () => 2 };
        export const marker = 3;
      `,
      "fixture.ts": `
        import type { Date } from "./runtime";
        import { type Math } from "./runtime";
        import type * as globalThis from "./runtime";
        export const values = [Date.now(), Math.random(), globalThis.Date];
      `,
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("type-only/declaration-only alias");
  });

  test("ambient overload signatures with no implementation remain red", () => {
    expectRed(
      fixture({
        "fixture.ts": `
          declare function Date(value: string): string;
          declare function Date(value: number): string;
          export const value = Date("x");
        `,
      }),
      "[new Date]",
    );
  });

  test("a chained ambient re-export remains red", () => {
    const root = fixture({
      "ambient.d.ts": "export declare const Date: DateConstructor;\n",
      "bridge.ts": 'export { Date } from "./ambient";\n',
      "fixture.ts": 'import { Date } from "./bridge"; export const value = Date.now();\n',
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[Date.now]");
    expect(result.output).toContain("target is erased");
  });

  test("an unresolved dangerous import alias fails closed", () => {
    const root = fixture({
      "fixture.ts": 'import { Date } from "./missing"; export const value = Date.now();\n',
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[source-analysis]");
    expect(result.output).toContain("unresolved");
  });

  test("const enums cannot masquerade as runtime shadows", () => {
    const root = fixture({
      "fixture.ts": `
        const enum Date { now }
        const enum Math { random }
        export const values = [Date.now, Math.random];
      `,
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("const enum is erased");
  });

  test("mixed ambient and runtime declaration sets fail closed", () => {
    const root = fixture({
      "fixture.ts": `
        function Date(value: string): string;
        function Date(value: unknown): string { return String(value); }
        declare namespace Date { function now(): number }
        export const value = Date.now();
      `,
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[source-analysis]");
    expect(result.output).toContain("mixes emitted and erased declarations");
  });

  test("cyclic dangerous aliases fail closed", () => {
    const root = fixture({
      "a.ts": 'export { Date } from "./b";\n',
      "b.ts": 'export { Date } from "./a";\n',
      "fixture.ts": 'import { Date } from "./a"; export const value = Date.now();\n',
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[source-analysis]");
    expect(result.output).toMatch(/cyclic|cycle|unresolved/);
  });

  test("unsupported declaration kinds fail closed", () => {
    const root = fixture({
      "unsupported.ts": "export default { now: () => 1 };\n",
      "fixture.ts": 'import Date from "./unsupported"; export const value = Date.now();\n',
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[source-analysis]");
    expect(result.output).toContain("unsupported declaration kind ExportAssignment");
  });

  test("unsupported mixed runtime declaration sets fail closed", () => {
    const root = fixture({
      "fixture.ts": `
        class Date { static now() { return 1; } }
        namespace Date { export const marker = true; }
        export const value = Date.now();
      `,
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[source-analysis]");
    expect(result.output).toContain("unsupported mixed runtime declarations");
  });

  test("ordinary const, let, and var shadows are emitted and green", () => {
    const root = fixture({
      "fixture.ts": `
        const Date = { now: () => 1 };
        let Math = { random: () => 2 };
        var globalThis = { Date };
        export const values = [Date.now(), Math.random(), globalThis.Date.now()];
      `,
    });
    expect(run(root)).toMatchObject({ exitCode: 0 });
  });

  for (const [name, source] of [
    ["class", "class Date { static now() { return 1; } } export const value = Date.now();"],
    ["function", "function Date() { return 'local'; } export const value = Date();"],
    ["namespace", "namespace Date { export const now = () => 1; } export const value = Date.now();"],
    ["non-const enum", "enum Date { now } export const value = Date.now;"],
  ] as const) {
    test(`ordinary emitted ${name} shadows are green`, () => {
      expect(run(fixture({ "fixture.ts": source }))).toMatchObject({ exitCode: 0 });
    });
  }

  test("default and namespace imports from concrete runtime sources are green", () => {
    const root = fixture({
      "runtime.ts": `
        const LocalDate = { now: () => 1 };
        export default LocalDate;
        export const random = () => 2;
      `,
      "fixture.ts": `
        import Date from "./runtime";
        import * as Math from "./runtime";
        export const values = [Date.now(), Math.random()];
      `,
    });
    expect(run(root)).toMatchObject({ exitCode: 0 });
  });

  test("ordinary variable destructuring bindings are emitted and green", () => {
    const root = fixture({
      "fixture.ts": `
        const source = {
          Date: { now: () => 1 },
          Math: { random: () => 2 },
          globalThis: { Date: { now: () => 3 } },
        };
        const { Date, Math, globalThis } = source;
        export const values = [Date.now(), Math.random(), globalThis.Date.now()];
      `,
    });
    expect(run(root)).toMatchObject({ exitCode: 0 });
  });

  test("ordinary import-equals aliases to concrete runtime code are green", () => {
    const root = fixture({
      "runtime.ts": "const LocalDate = { now: () => 1 }; export = LocalDate;\n",
      "fixture.ts": 'import Date = require("./runtime"); export const value = Date.now();\n',
    });
    expect(run(root)).toMatchObject({ exitCode: 0 });
  });

  test("parameter, rest, destructured, catch, loop, and nested bindings are green", () => {
    const root = fixture({
      "fixture.ts": `
        export function parameters(Date: any, ...Math: any[]) {
          return [Date.now(), Math.random()];
        }
        export function destructured({ Date, Math }: any) {
          return [Date.now(), Math.random()];
        }
        export function caught() {
          try { throw { Date: {} }; } catch (globalThis) { return globalThis.Date; }
        }
        export function loop(values: any[]) {
          for (const Date of values) { Date.now(); }
        }
      `,
    });
    expect(run(root)).toMatchObject({ exitCode: 0 });
  });

  test("an ordinary overload set with one implementation is green", () => {
    const root = fixture({
      "fixture.ts": `
        function Date(value: string): string;
        function Date(value: number): string;
        function Date(value: unknown): string { return String(value); }
        export const value = Date("local");
      `,
    });
    expect(run(root)).toMatchObject({ exitCode: 0 });
  });

  test("Date.now() fails red", () => {
    expectRed(fixture({ "fixture.ts": "export const value = Date.now();\n" }), "[Date.now]");
  });

  test("zero-argument new Date fails red", () => {
    expectRed(fixture({ "fixture.ts": "export const value = new Date();\n" }), "[new Date]");
  });

  test("calling Date as a function fails red even with an argument", () => {
    expectRed(fixture({ "fixture.ts": "export const value = Date(0);\n" }), "[new Date]");
  });

  test("Math.random() fails red", () => {
    expectRed(fixture({ "fixture.ts": "export const value = Math.random();\n" }), "[Math.random]");
  });

  test("ambient object aliases and destructuring fail at the escape", () => {
    const root = fixture({
      "fixture.ts": `
        const { now } = Date;
        const M = Math;
        const globals = globalThis;
        export const values = [now(), M.random(), globals.Date];
      `,
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[Date escape]");
    expect(result.output).toContain("[Math escape]");
    expect(result.output).toContain("[globalThis escape]");
  });

  test("globalThis Date/Math aliases and static capability extraction fail", () => {
    const root = fixture({
      "fixture.ts": `
        const D = globalThis.Date;
        const now = Date.now;
        const random = globalThis.Math["random"];
        export { D, now, random };
      `,
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[Date escape]");
    expect(result.output).toContain("[Date.now]");
    expect(result.output).toContain("[Math.random]");
  });

  test("inherited object helpers cannot turn Date or Math into an unchecked alias", () => {
    const root = fixture({
      "fixture.ts": `
        const D = Date.bind(undefined);
        const M = Math.valueOf();
        export { D, M };
      `,
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[Date escape]");
    expect(result.output).toContain("[Math escape]");
  });

  test("dynamic Date, Math, and globalThis member access fails closed", () => {
    const root = fixture({
      "fixture.ts": `
        const key: string = "now";
        export const values = [Date[key], Math[key], globalThis[key]];
      `,
    });
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[Date escape]");
    expect(result.output).toContain("[Math escape]");
    expect(result.output).toContain("[globalThis escape]");
  });

  test("a spread Date argument fails closed because it may contain zero values", () => {
    expectRed(
      fixture({ "fixture.ts": "export const value = new Date(...([] as []));\n" }),
      "cannot prove an explicit value",
    );
  });

  for (const extension of EXECUTABLE_SOURCE_EXTENSIONS) {
    test(`discovers and rejects a capability violation in ${extension}`, () => {
      const prefix = extension === ".jsx" || extension === ".tsx" ? "const view = <div />;\n" : "";
      expectRed(fixture({ [`violation${extension}`]: `${prefix}Date.now();\n` }), "[Date.now]");
    });
  }

  test("an unrecognized production source extension fails closed", () => {
    expectRed(fixture({ "violation.vue": "Date.now();\n" }), "unrecognized production source extension .vue");
  });

  test("unparseable production source fails closed", () => {
    expectRed(fixture({ "fixture.ts": "export const = ;\n" }), "[source-parse]");
  });

  test("a read failure is returned as an actionable diagnostic", () => {
    const root = fixture();
    const problems = scanKernelProduction(root, {
      readFile: () => {
        throw new Error("synthetic EACCES");
      },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ capability: "source-read" });
    expect(problems[0]?.message).toContain("synthetic EACCES");
  });

  test("a source symlink fails closed", () => {
    const root = fixture();
    symlinkSync(
      join(root, "packages", "kernel", "src", "fixture.ts"),
      join(root, "packages", "kernel", "src", "linked.ts"),
    );
    expectRed(root, "symbolic link");
  });

  test("an empty production source tree fails closed", () => {
    expectRed(fixture({}), "no production source files found");
  });

  test("a missing production source tree fails closed", () => {
    expectRed(emptyRoot(), "ENOENT");
  });

  test("the default reader still reads fixture sources", () => {
    const root = fixture();
    expect(readFileSync(join(root, "packages", "kernel", "src", "fixture.ts"), "utf8")).toContain("safe");
  });
});
