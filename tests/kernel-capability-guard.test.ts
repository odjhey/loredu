import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKER = join(REPO_ROOT, "scripts", "check-kernel-capabilities.ts");
const temporaryRoots: string[] = [];
const decoder = new TextDecoder();

interface RunResult {
  readonly exitCode: number;
  readonly output: string;
}

function fixture(source?: string): string {
  const root = mkdtempSync(join(tmpdir(), "loredu-kernel-capability-"));
  temporaryRoots.push(root);
  const sourceRoot = join(root, "packages", "kernel", "src");
  mkdirSync(sourceRoot, { recursive: true });
  if (source !== undefined) writeFileSync(join(sourceRoot, "fixture.ts"), source);
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
    const root = fixture(`
      const value = 1_700_000_000_000;
      const dates = [new Date(0), new Date(value), new globalThis.Date("2026-01-01")];
      const deterministic = [Date.parse("2026-01-01"), Math.abs(-1)];
      const documentation = "Date.now() new Date() Math.random()";
      // Date.now(); new Date(); Math.random();
      export { dates, deterministic, documentation };
    `);
    expect(run(root)).toMatchObject({ exitCode: 0 });
  });

  test("Date.now() fails red", () => {
    const root = fixture("export const value = Date.now();\n");
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[Date.now]");
  });

  test("zero-argument new Date fails red", () => {
    const root = fixture("export const value = new Date();\n");
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[new Date]");
  });

  test("Math.random() fails red", () => {
    const root = fixture("export const value = Math.random();\n");
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[Math.random]");
  });

  test("forbidden static capabilities cannot escape through extraction or static element access", () => {
    const root = fixture(`
      const now = Date.now;
      export const values = [now(), globalThis.Math["random"]()];
    `);
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[Date.now]");
    expect(result.output).toContain("[Math.random]");
  });

  test("a spread Date argument fails closed because it may contain zero values", () => {
    const root = fixture("export const value = new Date(...([] as []));\n");
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("cannot prove an explicit value");
  });

  test("unparseable production source fails closed", () => {
    const root = fixture("export const = ;\n");
    const result = run(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[source-parse]");
  });

  test("an empty production source tree fails closed", () => {
    const result = run(fixture());
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("no production source files found");
  });
});
