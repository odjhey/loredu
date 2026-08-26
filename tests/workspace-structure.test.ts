/**
 * Structural guardrails for the workspace scaffold itself.
 *
 * These assert the dependency law and the kernel boundary from
 * ADR 0011 as facts about the repository, not behavior of the product, so they
 * claim no catalog T-number. They are deliberately narrow: manifest edges plus a
 * source scan for environment imports. The full import/dependency checker
 * (dependency-cruiser or a purpose-built scanner) is a separate spike — issue #9
 * Phase C — and supersedes the scanning half of this file when it lands.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const PACKAGES = join(REPO_ROOT, "packages");

interface Manifest {
  readonly name?: string;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
  readonly exports?: Record<string, string>;
}

function manifest(pkgDir: string): Manifest {
  return JSON.parse(readFileSync(join(PACKAGES, pkgDir, "package.json"), "utf8")) as Manifest;
}

function runtimeDeps(m: Manifest): string[] {
  return [
    ...Object.keys(m.dependencies ?? {}),
    ...Object.keys(m.peerDependencies ?? {}),
    ...Object.keys(m.optionalDependencies ?? {}),
  ].sort();
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => join(dir, entry));
}

/** Every `import`/`export ... from "…"` specifier in a source file. */
function importSpecifiers(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [
    ...text.matchAll(/\bfrom\s+["']([^"']+)["']/g),
    ...text.matchAll(/\bimport\s+["']([^"']+)["']/g),
  ].map((match) => match[1] as string);
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

  test("the kernel publishes the test-only /testing subpath separately from its runtime export", () => {
    const exports = manifest("kernel").exports ?? {};
    expect(Object.keys(exports).sort()).toEqual([".", "./testing"]);
  });
});

describe("kernel boundary", () => {
  const kernelProduction = sourceFiles(join(PACKAGES, "kernel", "src"));

  test("the kernel has production sources to check", () => {
    expect(kernelProduction.length).toBeGreaterThan(0);
  });

  test("no kernel production source imports an environment module", () => {
    const offenders: string[] = [];
    for (const file of kernelProduction) {
      for (const specifier of importSpecifiers(file)) {
        const environmentModule =
          specifier.startsWith("node:") ||
          specifier.startsWith("bun:") ||
          ["fs", "path", "os", "crypto", "child_process", "util", "url", "process", "buffer"].includes(
            specifier,
          );
        if (environmentModule) offenders.push(`${relative(REPO_ROOT, file)} imports ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("no production source in any package imports @loredu/kernel/testing", () => {
    const offenders: string[] = [];
    for (const pkg of ["kernel/src", "store-plainfile/src", "cli/src", "cli/bin"]) {
      for (const file of sourceFiles(join(PACKAGES, pkg))) {
        if (importSpecifiers(file).some((s) => s.includes("@loredu/kernel/testing"))) {
          offenders.push(relative(REPO_ROOT, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
