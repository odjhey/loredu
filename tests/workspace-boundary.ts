import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

export type BoundaryRule =
  | "manifest-name"
  | "kernel-runtime-dependency"
  | "package-dag-manifest"
  | "kernel-exports"
  | "package-dag-import"
  | "environment-import"
  | "production-testing-import"
  | "ambient-capability";

export interface BoundaryViolation {
  readonly rule: BoundaryRule;
  readonly detail: string;
}

interface Manifest {
  readonly name?: string;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
  readonly exports?: Record<string, string>;
}

const PACKAGE_NAMES = {
  kernel: "@loredu/kernel",
  "store-plainfile": "@loredu/store-plainfile",
  cli: "@loredu/cli",
} as const;

const ENVIRONMENT_MODULES = new Set([
  "fs",
  "path",
  "os",
  "crypto",
  "child_process",
  "util",
  "url",
  "process",
  "buffer",
]);

function manifest(root: string, pkg: keyof typeof PACKAGE_NAMES): Manifest {
  return JSON.parse(readFileSync(join(root, "packages", pkg, "package.json"), "utf8")) as Manifest;
}

function runtimeDeps(value: Manifest): string[] {
  return [
    ...Object.keys(value.dependencies ?? {}),
    ...Object.keys(value.peerDependencies ?? {}),
    ...Object.keys(value.optionalDependencies ?? {}),
  ].sort();
}

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => join(dir, entry));
}

interface ScanResult {
  readonly i: number;
  readonly withoutComments: string;
  readonly executableCode: string;
}

function scanRegion(text: string, start: number, stopAtBrace: boolean): ScanResult {
  let withoutComments = "";
  let executableCode = "";
  const n = text.length;
  let i = start;
  let depth = 0;
  while (i < n) {
    const ch = text[i];
    const next = text[i + 1];
    if (stopAtBrace) {
      if (ch === "{") depth++;
      if (ch === "}") {
        if (depth === 0) {
          i++;
          break;
        }
        depth--;
      }
    }
    if (ch === "/" && next === "/") {
      let j = i + 2;
      while (j < n && text[j] !== "\n" && text[j] !== "\r") j++;
      withoutComments += " ";
      executableCode += " ";
      i = j;
      continue;
    }
    if (ch === "/" && next === "*") {
      let j = i + 2;
      while (j < n && !(text[j] === "*" && text[j + 1] === "/")) j++;
      j = Math.min(j + 2, n);
      withoutComments += " ";
      executableCode += " ";
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let raw = ch;
      let j = i + 1;
      while (j < n) {
        if (text[j] === "\\") {
          raw += text[j] + (text[j + 1] ?? "");
          j += 2;
          continue;
        }
        if (text[j] === quote) {
          raw += text[j];
          j++;
          break;
        }
        raw += text[j];
        j++;
      }
      withoutComments += raw;
      executableCode += " VALUE ";
      i = j;
      continue;
    }
    if (ch === "`") {
      const template = scanTemplate(text, i);
      withoutComments += template.withoutComments;
      executableCode += template.executableCode;
      i = template.i;
      continue;
    }
    withoutComments += ch;
    executableCode += ch;
    i++;
  }
  return { i, withoutComments, executableCode };
}

function scanTemplate(text: string, start: number): ScanResult {
  let withoutComments = "`";
  let executableCode = " VALUE ";
  const n = text.length;
  let i = start + 1;
  while (i < n) {
    if (text[i] === "\\") {
      withoutComments += text[i] + (text[i + 1] ?? "");
      i += 2;
      continue;
    }
    if (text[i] === "`") {
      withoutComments += "`";
      i++;
      return { i, withoutComments, executableCode };
    }
    if (text[i] === "$" && text[i + 1] === "{") {
      withoutComments += "${";
      i += 2;
      const inner = scanRegion(text, i, true);
      withoutComments += `${inner.withoutComments}}`;
      executableCode += `${inner.executableCode} VALUE `;
      i = inner.i;
      continue;
    }
    withoutComments += text[i];
    i++;
  }
  return { i, withoutComments, executableCode };
}

function scanSource(text: string): { withoutComments: string; executableCode: string } {
  const { withoutComments, executableCode } = scanRegion(text, 0, false);
  return { withoutComments, executableCode };
}

function importSpecifiers(code: string): string[] {
  return [
    ...code.matchAll(/\bfrom\s+["']([^"']+)["']/g),
    ...code.matchAll(/\bimport\s+["']([^"']+)["']/g),
  ].map((match) => match[1] as string);
}

export function boundaryViolations(root: string): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];
  const manifests = Object.fromEntries(
    Object.keys(PACKAGE_NAMES).map((pkg) => [pkg, manifest(root, pkg as keyof typeof PACKAGE_NAMES)]),
  ) as Record<keyof typeof PACKAGE_NAMES, Manifest>;

  for (const [pkg, expected] of Object.entries(PACKAGE_NAMES)) {
    if (manifests[pkg as keyof typeof PACKAGE_NAMES].name !== expected) {
      violations.push({ rule: "manifest-name", detail: `${pkg} must be named ${expected}` });
    }
  }

  if (runtimeDeps(manifests.kernel).length > 0) {
    violations.push({ rule: "kernel-runtime-dependency", detail: runtimeDeps(manifests.kernel).join(", ") });
  }

  const expectedDeps = {
    "store-plainfile": ["@loredu/kernel"],
    cli: ["@loredu/kernel", "@loredu/store-plainfile"],
  } as const;
  for (const pkg of ["store-plainfile", "cli"] as const) {
    if (JSON.stringify(runtimeDeps(manifests[pkg])) !== JSON.stringify(expectedDeps[pkg])) {
      violations.push({
        rule: "package-dag-manifest",
        detail: `${pkg}: ${runtimeDeps(manifests[pkg]).join(", ")}`,
      });
    }
  }

  if (JSON.stringify(Object.keys(manifests.kernel.exports ?? {}).sort()) !== '[".","./testing"]') {
    violations.push({ rule: "kernel-exports", detail: "kernel exports must be . and ./testing" });
  }

  const productionDirs = ["kernel/src", "store-plainfile/src", "cli/src", "cli/bin"];
  for (const dir of productionDirs) {
    for (const file of sourceFiles(join(root, "packages", dir))) {
      const text = readFileSync(file, "utf8");
      const display = relative(root, file);
      const { withoutComments, executableCode: code } = scanSource(text);
      for (const specifier of importSpecifiers(withoutComments)) {
        if (specifier === "@loredu/kernel/testing" || specifier.startsWith("@loredu/kernel/testing/")) {
          violations.push({ rule: "production-testing-import", detail: `${display} imports ${specifier}` });
        }
        const pkg = dir.split("/")[0];
        const importsPackage = (name: string): boolean =>
          specifier === name || specifier.startsWith(`${name}/`);
        if (
          (pkg === "kernel" && ["@loredu/store-plainfile", "@loredu/cli"].some(importsPackage)) ||
          (pkg === "store-plainfile" && importsPackage("@loredu/cli"))
        ) {
          violations.push({ rule: "package-dag-import", detail: `${display} imports ${specifier}` });
        }
        if (
          pkg === "kernel" &&
          (specifier.startsWith("node:") ||
            specifier.startsWith("bun:") ||
            ENVIRONMENT_MODULES.has(specifier))
        ) {
          violations.push({ rule: "environment-import", detail: `${display} imports ${specifier}` });
        }
      }

      if (dir === "kernel/src") {
        for (const [label, pattern] of [
          ["Date.now()", /\bDate\s*\.\s*now\s*\(\s*\)/g],
          ["new Date()", /\bnew\s+Date\s*\(\s*\)/g],
          ["Math.random()", /\bMath\s*\.\s*random\s*\(\s*\)/g],
        ] as const) {
          if (pattern.test(code)) {
            violations.push({ rule: "ambient-capability", detail: `${display} uses ${label}` });
          }
        }
      }
    }
  }

  return violations;
}
