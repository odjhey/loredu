import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TYPESCRIPT_LIB = dirname(fileURLToPath(import.meta.resolve("typescript")));
const TSC = resolve(TYPESCRIPT_LIB, "..", "bin", "tsc");
const temporaryRoots: string[] = [];
const decoder = new TextDecoder();

function isolatedKernel(extraSource?: string): string {
  const root = mkdtempSync(join(tmpdir(), "loredu-kernel-types-"));
  temporaryRoots.push(root);
  mkdirSync(join(root, "packages"), { recursive: true });
  cpSync(join(REPO_ROOT, "tsconfig.base.json"), join(root, "tsconfig.base.json"));
  cpSync(join(REPO_ROOT, "packages", "kernel"), join(root, "packages", "kernel"), {
    recursive: true,
  });
  if (extraSource !== undefined) {
    writeFileSync(join(root, "packages", "kernel", "src", "synthetic-violation.ts"), extraSource);
  }
  return root;
}

function typecheck(root: string): { exitCode: number; output: string } {
  const result = Bun.spawnSync([process.execPath, TSC, "-p", join(root, "packages", "kernel")], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: result.exitCode,
    output: `${decoder.decode(result.stdout)}${decoder.decode(result.stderr)}`,
  };
}

function expectTypecheckRed(source: string, diagnosticToken: string): void {
  const result = typecheck(isolatedKernel(source));
  expect(result.exitCode).not.toBe(0);
  expect(result.output).toContain(diagnosticToken);
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("kernel default-deny type environment", () => {
  test("the unmodified isolated kernel typechecks", () => {
    expect(typecheck(isolatedKernel())).toMatchObject({ exitCode: 0 });
  });

  test("process is unavailable", () => {
    expectTypecheckRed("export const value = process.env.HOME;\n", "process");
  });

  test("Bun globals are unavailable", () => {
    expectTypecheckRed('export const value = Bun.file("x");\n', "Bun");
  });

  test("Buffer is unavailable", () => {
    expectTypecheckRed('export const value = Buffer.from("x");\n', "Buffer");
  });

  test("__dirname is unavailable", () => {
    expectTypecheckRed("export const value = __dirname;\n", "__dirname");
  });

  test("node:* modules are unavailable", () => {
    expectTypecheckRed('export { readFile } from "node:fs";\n', "node:fs");
  });

  test("bun:* modules are unavailable", () => {
    expectTypecheckRed('export { test } from "bun:test";\n', "bun:test");
  });
});
