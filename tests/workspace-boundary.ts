import { existsSync, readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

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
type PackageDirectory = keyof typeof PACKAGE_NAMES;

const BARE_BUILTINS = new Set(
  builtinModules.map((name) => (name.startsWith("node:") ? name.slice("node:".length) : name)),
);

function manifest(root: string, pkg: PackageDirectory): Manifest {
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

function stringLiteral(node: ts.Node | undefined): string | undefined {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;
}

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function member(objectName: string, propertyName: string, expression: ts.Expression): boolean {
  const current = unwrap(expression);
  if (ts.isPropertyAccessExpression(current)) {
    const object = unwrap(current.expression);
    return ts.isIdentifier(object) && object.text === objectName && current.name.text === propertyName;
  }
  if (ts.isElementAccessExpression(current)) {
    const object = unwrap(current.expression);
    return (
      ts.isIdentifier(object) &&
      object.text === objectName &&
      stringLiteral(current.argumentExpression) === propertyName
    );
  }
  return false;
}

interface SourceFacts {
  readonly specifiers: readonly string[];
  readonly ambientUses: readonly string[];
}

function sourceFacts(file: string, text: string): SourceFacts {
  // createSourceFile is bounded and returns parse diagnostics rather than throwing for malformed input.
  // The mandatory TypeScript gate owns syntax rejection; this checker analyzes the recoverable tree.
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specifiers: string[] = [];
  const ambientUses = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = stringLiteral(node.moduleSpecifier);
      if (specifier) specifiers.push(specifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const specifier = stringLiteral(node.moduleReference.expression);
      if (specifier) specifiers.push(specifier);
    } else if (ts.isCallExpression(node)) {
      const expression = unwrap(node.expression);
      const specifier =
        expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(expression) && expression.text === "require")
          ? stringLiteral(node.arguments[0])
          : undefined;
      if (specifier) specifiers.push(specifier);
      if (member("Date", "now", node.expression)) ambientUses.add("Date.now()");
      if (member("Math", "random", node.expression)) ambientUses.add("Math.random()");
    } else if (ts.isNewExpression(node)) {
      const expression = unwrap(node.expression);
      if (ts.isIdentifier(expression) && expression.text === "Date" && (node.arguments?.length ?? 0) === 0) {
        ambientUses.add("new Date()");
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return { specifiers, ambientUses: [...ambientUses] };
}

function packageForSpecifier(root: string, file: string, specifier: string): PackageDirectory | undefined {
  for (const [pkg, packageName] of Object.entries(PACKAGE_NAMES)) {
    if (specifier === packageName || specifier.startsWith(`${packageName}/`)) {
      return pkg as PackageDirectory;
    }
  }
  if (!specifier.startsWith(".")) return undefined;
  const target = resolve(dirname(file), specifier);
  for (const pkg of Object.keys(PACKAGE_NAMES) as PackageDirectory[]) {
    const packageRoot = resolve(root, "packages", pkg);
    if (target === packageRoot || target.startsWith(`${packageRoot}${sep}`)) return pkg;
  }
  return undefined;
}

function targetsKernelTesting(root: string, file: string, specifier: string): boolean {
  if (specifier === "@loredu/kernel/testing" || specifier.startsWith("@loredu/kernel/testing/")) {
    return true;
  }
  if (!specifier.startsWith(".")) return false;
  const target = resolve(dirname(file), specifier);
  const testingRoot = resolve(root, "packages/kernel/testing");
  return target === testingRoot || target.startsWith(`${testingRoot}${sep}`);
}

function environmentModule(specifier: string): boolean {
  if (specifier.startsWith("node:") || specifier.startsWith("bun:")) return true;
  const root = specifier.split("/")[0] ?? specifier;
  return BARE_BUILTINS.has(specifier) || BARE_BUILTINS.has(root);
}

export function boundaryViolations(root: string): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];
  const manifests = Object.fromEntries(
    Object.keys(PACKAGE_NAMES).map((pkg) => [pkg, manifest(root, pkg as PackageDirectory)]),
  ) as Record<PackageDirectory, Manifest>;

  for (const [pkg, expected] of Object.entries(PACKAGE_NAMES)) {
    if (manifests[pkg as PackageDirectory].name !== expected) {
      violations.push({ rule: "manifest-name", detail: `${pkg} must be named ${expected}` });
    }
  }

  if (runtimeDeps(manifests.kernel).length > 0) {
    violations.push({
      rule: "kernel-runtime-dependency",
      detail: runtimeDeps(manifests.kernel).join(", "),
    });
  }

  const workspaceDeps = (pkg: PackageDirectory): Set<string> =>
    new Set(
      runtimeDeps(manifests[pkg]).filter((dependency) =>
        Object.values(PACKAGE_NAMES).includes(dependency as never),
      ),
    );
  const storeDeps = workspaceDeps("store-plainfile");
  const cliDeps = workspaceDeps("cli");
  if (!storeDeps.has("@loredu/kernel") || storeDeps.has("@loredu/cli")) {
    violations.push({
      rule: "package-dag-manifest",
      detail: `store-plainfile: ${[...storeDeps].sort().join(", ")}`,
    });
  }
  if (!cliDeps.has("@loredu/kernel") || !cliDeps.has("@loredu/store-plainfile")) {
    violations.push({ rule: "package-dag-manifest", detail: `cli: ${[...cliDeps].sort().join(", ")}` });
  }

  if (JSON.stringify(Object.keys(manifests.kernel.exports ?? {}).sort()) !== '[".","./testing"]') {
    violations.push({ rule: "kernel-exports", detail: "kernel exports must be . and ./testing" });
  }

  const productionDirs = ["kernel/src", "store-plainfile/src", "cli/src", "cli/bin"] as const;
  for (const dir of productionDirs) {
    const pkg = dir.split("/")[0] as PackageDirectory;
    for (const file of sourceFiles(join(root, "packages", dir))) {
      const display = relative(root, file);
      const facts = sourceFacts(file, readFileSync(file, "utf8"));
      for (const specifier of facts.specifiers) {
        if (targetsKernelTesting(root, file, specifier)) {
          violations.push({ rule: "production-testing-import", detail: `${display} imports ${specifier}` });
        }
        const targetPackage = packageForSpecifier(root, file, specifier);
        if (
          (pkg === "kernel" && (targetPackage === "store-plainfile" || targetPackage === "cli")) ||
          (pkg === "store-plainfile" && targetPackage === "cli")
        ) {
          violations.push({ rule: "package-dag-import", detail: `${display} imports ${specifier}` });
        }
        if (pkg === "kernel" && environmentModule(specifier)) {
          violations.push({ rule: "environment-import", detail: `${display} imports ${specifier}` });
        }
      }
      if (pkg === "kernel") {
        for (const label of facts.ambientUses) {
          violations.push({ rule: "ambient-capability", detail: `${display} uses ${label}` });
        }
      }
    }
  }

  return violations;
}
