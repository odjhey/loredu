import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKER = join(REPO_ROOT, "scripts", "check-workspace-boundaries.ts");
const temporaryRoots: string[] = [];
const decoder = new TextDecoder();

const MANIFESTS = {
  "packages/kernel/package.json": {
    name: "@loredu/kernel",
    exports: { ".": "./src/index.ts", "./testing": "./testing/index.ts" },
  },
  "packages/store-plainfile/package.json": {
    name: "@loredu/store-plainfile",
    exports: { ".": "./src/index.ts" },
  },
  "packages/cli/package.json": {
    name: "@loredu/cli",
    exports: { ".": "./src/index.ts" },
  },
} as const;

function fixture(overrides: Readonly<Record<string, string>> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "loredu-workspace-boundary-"));
  temporaryRoots.push(root);
  const files: Record<string, string> = {
    "packages/kernel/src/index.ts": "export const kernel = 1;\n",
    "packages/kernel/testing/index.ts": "export const testing = 1;\n",
    "packages/store-plainfile/src/index.ts": "export const store = 1;\n",
    "packages/cli/src/index.ts": "export const cli = 1;\n",
    "packages/cli/bin/lor.ts": "export const bin = 1;\n",
    ...overrides,
  };
  for (const [file, source] of Object.entries(files)) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
  }
  for (const [file, manifest] of Object.entries(MANIFESTS)) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return root;
}

function run(root: string): { exitCode: number; output: string } {
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

function expectRed(root: string, rule: string): void {
  const result = run(root);
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`[${rule}]`);
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("workspace import boundary guard", () => {
  test("the clean production workspace passes", () => {
    const result = run(REPO_ROOT);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("workspace import boundary: clean");
  });

  test("allowed workspace edges resolve through package exports", () => {
    const root = fixture({
      "packages/store-plainfile/src/index.ts":
        'import { kernel } from "@loredu/kernel"; export { kernel };\n',
      "packages/cli/src/index.ts": `
        import { kernel } from "@loredu/kernel";
        import { store } from "@loredu/store-plainfile";
        export { kernel, store };
      `,
    });
    expect(run(root)).toMatchObject({ exitCode: 0 });
  });

  test("a relative re-export of kernel testing fails red", () => {
    expectRed(
      fixture({
        "packages/kernel/src/index.ts": 'export { testing } from "../testing";\n',
      }),
      "boundary-testing",
    );
  });

  test("a workspace-subpath import of kernel testing fails red", () => {
    expectRed(
      fixture({
        "packages/store-plainfile/src/index.ts":
          'import { testing } from "@loredu/kernel/testing"; export { testing };\n',
      }),
      "boundary-testing",
    );
  });

  test("a reverse-DAG relative re-export from kernel to store fails red", () => {
    expectRed(
      fixture({
        "packages/kernel/src/index.ts":
          'export { target } from "../../store-plainfile/src/reverse-target";\n',
        "packages/store-plainfile/src/reverse-target.ts": "export const target = 1;\n",
      }),
      "boundary-dag",
    );
  });

  test("a reverse-DAG workspace import from kernel to store fails red", () => {
    expectRed(
      fixture({
        "packages/kernel/src/index.ts":
          'import { store } from "@loredu/store-plainfile"; export { store };\n',
      }),
      "boundary-dag",
    );
  });

  test("a reverse-DAG relative import from store to CLI fails red", () => {
    expectRed(
      fixture({
        "packages/store-plainfile/src/index.ts": 'export { target } from "../../cli/src/reverse-target";\n',
        "packages/cli/src/reverse-target.ts": "export const target = 1;\n",
      }),
      "boundary-dag",
    );
  });

  test("a static dynamic import is resolved and checked", () => {
    expectRed(
      fixture({
        "packages/kernel/src/index.ts":
          'export async function load() { return import("../../store-plainfile/src/index"); }\n',
      }),
      "boundary-dag",
    );
  });

  test("a dynamic import into kernel testing fails red", () => {
    expectRed(
      fixture({
        "packages/cli/src/index.ts":
          'export async function load() { return import("../../kernel/testing"); }\n',
      }),
      "boundary-testing",
    );
  });

  test("a computed dynamic import fails closed", () => {
    expectRed(
      fixture({
        "packages/cli/src/index.ts": "export async function load(path: string) { return import(path); }\n",
      }),
      "boundary-dynamic",
    );
  });

  test("an unresolved relative import fails closed", () => {
    expectRed(
      fixture({
        "packages/store-plainfile/src/index.ts": 'export { missing } from "./missing";\n',
      }),
      "boundary-resolution",
    );
  });

  test("kernel external and environment imports fail red", () => {
    expectRed(
      fixture({
        "packages/kernel/src/index.ts": 'export { readFile } from "node:fs";\n',
      }),
      "boundary-external",
    );
  });

  test("comments and strings that look like imports do not create edges", () => {
    const root = fixture({
      "packages/kernel/src/index.ts": `
        // export { store } from "../../store-plainfile/src/index";
        export const documentation = 'import("../testing")';
      `,
    });
    expect(run(root)).toMatchObject({ exitCode: 0 });
  });
});
