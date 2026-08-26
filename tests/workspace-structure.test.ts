/**
 * Structural guardrails for the workspace scaffold itself.
 *
 * These assert the manifest, export, and type-configuration facts from ADR 0011
 * and ADR 0016. Import resolution and package ownership are enforced separately
 * by the purpose-built workspace boundary guard and its synthetic tests.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scanWorkspaceBoundaries } from "../scripts/workspace-boundary-guard";

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const PACKAGES = join(REPO_ROOT, "packages");

interface Manifest {
  readonly name?: string;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
  readonly exports?: Record<string, string>;
}

interface TypeConfig {
  readonly compilerOptions?: {
    readonly lib?: readonly string[];
    readonly types?: readonly string[];
  };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function manifest(pkgDir: string): Manifest {
  return readJson<Manifest>(join(PACKAGES, pkgDir, "package.json"));
}

function typeConfig(path: string): TypeConfig {
  return readJson<TypeConfig>(path);
}

function runtimeDeps(m: Manifest): string[] {
  return [
    ...Object.keys(m.dependencies ?? {}),
    ...Object.keys(m.peerDependencies ?? {}),
    ...Object.keys(m.optionalDependencies ?? {}),
  ].sort();
}

describe("package manifests", () => {
  test("packages are named per ADR 0011", () => {
    expect(manifest("kernel").name).toBe("@loredu/kernel");
    expect(manifest("store-plainfile").name).toBe("@loredu/store-plainfile");
    expect(manifest("cli").name).toBe("@loredu/cli");
  });

  test("the kernel declares zero runtime dependencies", () => {
    expect(runtimeDeps(manifest("kernel"))).toEqual([]);
  });

  test("runtime dependencies form the one-way DAG kernel <- store-plainfile <- cli", () => {
    expect(runtimeDeps(manifest("store-plainfile"))).toEqual(["@loredu/kernel"]);
    expect(runtimeDeps(manifest("cli"))).toEqual(["@loredu/kernel", "@loredu/store-plainfile"]);
  });

  test("package exports are TypeScript sources and kernel testing is a separate subpath", () => {
    expect(manifest("kernel").exports).toEqual({
      ".": "./src/index.ts",
      "./testing": "./testing/index.ts",
    });
    expect(manifest("store-plainfile").exports).toEqual({ ".": "./src/index.ts" });
    expect(manifest("cli").exports).toEqual({ ".": "./src/index.ts" });
  });

  test("resolved production imports preserve package direction and testing isolation", () => {
    expect(scanWorkspaceBoundaries(REPO_ROOT)).toEqual([]);
  });

  test("the kernel type environment stays default-deny while adapters opt in explicitly", () => {
    expect(typeConfig(join(REPO_ROOT, "tsconfig.base.json")).compilerOptions).toMatchObject({
      lib: ["ES2023"],
      types: [],
    });
    expect(typeConfig(join(PACKAGES, "kernel", "tsconfig.json")).compilerOptions).toMatchObject({
      lib: ["ES2023"],
      types: [],
    });
    expect(typeConfig(join(PACKAGES, "store-plainfile", "tsconfig.json")).compilerOptions?.types).toEqual([
      "bun",
    ]);
    expect(typeConfig(join(PACKAGES, "cli", "tsconfig.json")).compilerOptions?.types).toEqual(["bun"]);
  });
});
