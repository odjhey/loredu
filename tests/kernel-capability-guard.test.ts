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
