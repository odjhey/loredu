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
});
