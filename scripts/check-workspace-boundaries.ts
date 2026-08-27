import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export interface Violation {
  readonly path: string;
  readonly rule: string;
  readonly detail: string;
}

interface Manifest {
  readonly name?: string;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
  readonly exports?: Record<string, string>;
}

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);
const NODE_BUILTINS = new Set([
  "assert",
  "assert/strict",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "fs/promises",
  "http",
  "http2",
  "https",
  "module",
  "net",
  "os",
  "path",
  "path/posix",
  "path/win32",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
]);
const FORBIDDEN_KERNEL_PACKAGES = [
  "@loredu/store-plainfile",
  "@loredu/cli",
  "@aws-sdk/",
  "@google-cloud/",
  "@prisma/",
  "@anthropic-ai/",
  "@google/generative-ai",
  "openai",
  "prisma",
  "drizzle-orm",
  "mongoose",
  "mongodb",
  "pg",
  "mysql",
  "mysql2",
  "sqlite",
  "better-sqlite3",
  "sequelize",
  "typeorm",
];

function extension(path: string): string {
  const match = path.match(/(\.[^./]+)$/);
  return match?.[1] ?? "";
}

function filesBelow(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !path.split(sep).some((part) => part === "node_modules" || part === "dist"))
    .sort();
}

function sourceFiles(directory: string): string[] {
  return filesBelow(directory).filter((path) => SOURCE_EXTENSIONS.has(extension(path)));
}

function specifiers(text: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^;"']*?\s+from\s*)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) found.push(match[1] as string);
  return found;
}

function runtimeDeps(manifest: Manifest): string[] {
  return [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ].sort();
}

function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

function isTestFile(path: string): boolean {
  return (
    /(?:^|\/)(?:test|tests|testing|__tests__)(?:\/|$)/.test(path) || /\.(?:test|spec)\.[^.]+$/.test(path)
  );
}

function push(result: Violation[], root: string, path: string, rule: string, detail: string): void {
  result.push({ path: relative(root, path).split(sep).join("/"), rule, detail });
}

export function scanWorkspace(root: string): Violation[] {
  const result: Violation[] = [];
  const packages = join(root, "packages");
  const packageDirectories = existsSync(packages)
    ? readdirSync(packages, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];

  const expectedDependencies: Record<string, readonly string[]> = {
    kernel: [],
    "store-plainfile": ["@loredu/kernel"],
    cli: ["@loredu/kernel", "@loredu/store-plainfile"],
  };
  const expectedNames: Record<string, string> = {
    kernel: "@loredu/kernel",
    "store-plainfile": "@loredu/store-plainfile",
    cli: "@loredu/cli",
  };

  for (const directory of packageDirectories) {
    const packageRoot = join(packages, directory);
    const manifestPath = join(packageRoot, "package.json");
    if (!existsSync(manifestPath)) {
      push(result, root, packageRoot, "package-location", "package directory has no package.json");
      continue;
    }
    if (!(directory in expectedDependencies)) {
      push(
        result,
        root,
        manifestPath,
        "package-location",
        "new package is not classified by the dependency law",
      );
      continue;
    }
    const manifest = readManifest(manifestPath);
    if (manifest.name !== expectedNames[directory])
      push(result, root, manifestPath, "package-name", `expected ${expectedNames[directory]}`);
    const actual = runtimeDeps(manifest);
    const expected = [...(expectedDependencies[directory] ?? [])];
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      push(
        result,
        root,
        manifestPath,
        "runtime-dependencies",
        `expected [${expected.join(", ")}], found [${actual.join(", ")}]`,
      );

    for (const file of sourceFiles(packageRoot)) {
      const local = relative(packageRoot, file).split(sep).join("/");
      const recognized =
        local.startsWith("src/") || (directory === "cli" && local.startsWith("bin/")) || isTestFile(local);
      if (!recognized)
        push(
          result,
          root,
          file,
          "source-location",
          "source file is outside a recognized production or test surface",
        );
    }
  }

  const kernelManifestPath = join(packages, "kernel", "package.json");
  if (existsSync(kernelManifestPath)) {
    const exports = Object.keys(readManifest(kernelManifestPath).exports ?? {}).sort();
    if (JSON.stringify(exports) !== JSON.stringify([".", "./testing"]))
      push(result, root, kernelManifestPath, "kernel-exports", "exports must be exactly . and ./testing");
  }

  const productionRoots = packageDirectories.flatMap((directory) => {
    const roots = [join(packages, directory, "src")];
    if (directory === "cli") roots.push(join(packages, directory, "bin"));
    return roots;
  });
  for (const productionRoot of productionRoots) {
    for (const file of sourceFiles(productionRoot)) {
      if (isTestFile(file.split(sep).join("/"))) continue;
      const text = readFileSync(file, "utf8");
      for (const specifier of specifiers(text)) {
        if (specifier === "@loredu/kernel/testing" || specifier.startsWith("@loredu/kernel/testing/"))
          push(result, root, file, "testing-import", `production imports ${specifier}`);
      }
    }
  }

  const kernelSource = join(packages, "kernel", "src");
  for (const file of sourceFiles(kernelSource)) {
    if (isTestFile(file.split(sep).join("/"))) continue;
    const text = readFileSync(file, "utf8");
    for (const specifier of specifiers(text)) {
      const forbidden =
        specifier.startsWith("node:") ||
        specifier.startsWith("bun:") ||
        NODE_BUILTINS.has(specifier) ||
        FORBIDDEN_KERNEL_PACKAGES.some(
          (name) => specifier === name || specifier.startsWith(name.endsWith("/") ? name : `${name}/`),
        );
      if (forbidden)
        push(result, root, file, "kernel-import", `kernel imports forbidden module ${specifier}`);
    }
    const capabilities: Array<[RegExp, string]> = [
      [/\bDate\s*\.\s*now\s*\(/g, "Date.now"],
      [/\bnew\s+Date\s*\(\s*\)/g, "zero-argument new Date"],
      [/\bMath\s*\.\s*random\s*\(/g, "Math.random"],
      [/\b(?:Bun|process|Buffer)\b/g, "Bun/Node ambient global"],
    ];
    for (const [pattern, detail] of capabilities)
      if (pattern.test(text)) push(result, root, file, "ambient-capability", detail);
  }

  return result.sort((left, right) =>
    `${left.path}:${left.rule}:${left.detail}`.localeCompare(`${right.path}:${right.rule}:${right.detail}`),
  );
}

export function formatViolations(violations: readonly Violation[]): string {
  return violations.map((item) => `${item.path}: [${item.rule}] ${item.detail}`).join("\n");
}

const invokedPath = process.argv[1];
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  const root = process.argv[2] ?? join(import.meta.dir, "..");
  const violations = scanWorkspace(root);
  if (violations.length > 0) {
    console.error(formatViolations(violations));
    process.exit(1);
  }
  console.log("workspace boundaries: ok");
}
