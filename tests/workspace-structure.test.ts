import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanWorkspace } from "../scripts/check-workspace-boundaries";

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const temporaryRoots: string[] = [];

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "loredu-boundary-"));
  temporaryRoots.push(root);
  mkdirSync(join(root, "packages"), { recursive: true });
  for (const packageName of ["kernel", "store-plainfile", "cli"]) {
    cpSync(
      join(REPO_ROOT, "packages", packageName, "package.json"),
      join(root, "packages", packageName, "package.json"),
      { recursive: true },
    );
    mkdirSync(join(root, "packages", packageName, "src"), { recursive: true });
  }
  mkdirSync(join(root, "packages", "cli", "bin"), { recursive: true });
  return root;
}

function plant(root: string, relativePath: string, content: string): void {
  const path = join(root, relativePath);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}

function rules(root: string): string[] {
  return scanWorkspace(root).map((violation) => `${violation.path}:${violation.rule}:${violation.detail}`);
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("authoritative workspace boundary guard", () => {
  test("the real workspace is clean", () => {
    expect(scanWorkspace(REPO_ROOT)).toEqual([]);
  });

  test.each([
    ["node protocol", 'import "node:fs";'],
    ["bare Node builtin", 'import "crypto";'],
    ["Bun module", 'import "bun:sqlite";'],
    ["adapter", 'import "@loredu/store-plainfile";'],
    ["CLI", 'import "@loredu/cli";'],
    ["database SDK", 'import "@prisma/client";'],
    ["model SDK", 'import "openai";'],
  ])("rejects a kernel %s import", (_label, source) => {
    const root = fixture();
    plant(root, "packages/kernel/src/nested/new-feature.ts", source);
    expect(rules(root)).toContainEqual(expect.stringContaining("kernel-import"));
  });

  test.each([
    ["Date.now", "export const value = Date.now();"],
    ["zero-argument Date", "export const value = new Date();"],
    ["Math.random", "export const value = Math.random();"],
    ["Bun ambient", "export const value = Bun.version;"],
    ["process ambient", "export const value = process.pid;"],
    ["Buffer ambient", 'export const value = Buffer.from("x");'],
  ])("rejects production ambient capability use: %s", (_label, source) => {
    const root = fixture();
    plant(root, "packages/kernel/src/deep/capability.ts", source);
    expect(rules(root)).toContainEqual(expect.stringContaining("ambient-capability"));
  });

  test("allows explicit-value temporal construction", () => {
    const root = fixture();
    plant(
      root,
      "packages/kernel/src/deep/time.ts",
      'export const value = new Date("2026-01-01T00:00:00.000Z");',
    );
    expect(scanWorkspace(root)).toEqual([]);
  });

  test("rejects the testing seam from every production package but allows test surfaces", () => {
    const root = fixture();
    plant(root, "packages/store-plainfile/src/nested/bad.ts", 'import "@loredu/kernel/testing";');
    plant(root, "packages/cli/bin/bad.ts", 'import "@loredu/kernel/testing";');
    plant(root, "packages/kernel/testing/helper.ts", 'import "@loredu/kernel/testing";');
    plant(root, "packages/store-plainfile/src/accepted.test.ts", 'import "@loredu/kernel/testing";');
    const found = rules(root).filter((line) => line.includes("testing-import"));
    expect(found).toHaveLength(2);
    expect(found.join("\n")).toContain("store-plainfile/src/nested/bad.ts");
    expect(found.join("\n")).toContain("cli/bin/bad.ts");
  });

  test("fails closed on an unrecognized package source location", () => {
    const root = fixture();
    plant(root, "packages/kernel/lib/new-production.ts", "export const nested = true;");
    expect(rules(root)).toContainEqual(expect.stringContaining("source-location"));
  });

  test("discovers manifest dependency and new-package boundary violations", () => {
    const root = fixture();
    const kernelManifest = join(root, "packages/kernel/package.json");
    const manifest = JSON.parse(readFileSync(kernelManifest, "utf8"));
    manifest.dependencies = { openai: "1.0.0" };
    writeFileSync(kernelManifest, JSON.stringify(manifest));
    plant(root, "packages/unclassified/package.json", JSON.stringify({ name: "@loredu/unclassified" }));
    const found = rules(root);
    expect(found).toContainEqual(expect.stringContaining("runtime-dependencies"));
    expect(found).toContainEqual(expect.stringContaining("package-location"));
  });

  test("the kernel compiler boundary rejects Bun, process, Buffer, and node imports", async () => {
    const root = mkdtempSync(join(tmpdir(), "loredu-type-isolation-"));
    temporaryRoots.push(root);
    plant(
      root,
      "fixture.ts",
      'import { readFileSync } from "node:fs";\nreadFileSync("x");\nBun.version;\nprocess.pid;\nBuffer.from("x");\n',
    );
    plant(
      root,
      "tsconfig.json",
      JSON.stringify({ extends: join(REPO_ROOT, "tsconfig.base.json"), include: ["fixture.ts"] }),
    );
    const process = Bun.spawn([join(REPO_ROOT, "node_modules/.bin/tsc"), "-p", root], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ]);
    expect(exitCode).not.toBe(0);
    const diagnostics = `${stdout}\n${stderr}`;
    for (const name of ["node:fs", "Bun", "process", "Buffer"]) expect(diagnostics).toContain(name);
  });
});
