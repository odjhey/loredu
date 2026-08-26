import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { discoverExecutableSources, EXECUTABLE_SOURCE_EXTENSIONS, scriptKindFor } from "./source-policy";

type PackageOwner = "kernel" | "store-plainfile" | "cli";

interface Manifest {
  readonly name?: string;
  readonly exports?: Record<string, string>;
}

interface ProductionArea {
  readonly owner: PackageOwner;
  readonly root: string;
}

interface ImportReference {
  readonly node: ts.Node;
  readonly specifier?: string;
  readonly dynamic: boolean;
}

export interface BoundaryProblem {
  readonly rule:
    | "boundary-dag"
    | "boundary-dynamic"
    | "boundary-external"
    | "boundary-resolution"
    | "boundary-testing"
    | "source-parse"
    | "source-read"
    | "source-tree";
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

interface WorkspacePackage {
  readonly owner: PackageOwner;
  readonly root: string;
  readonly manifest: Manifest;
}

const ALLOWED_TARGETS: Readonly<Record<PackageOwner, ReadonlySet<PackageOwner>>> = {
  kernel: new Set(["kernel"]),
  "store-plainfile": new Set(["kernel", "store-plainfile"]),
  cli: new Set(["kernel", "store-plainfile", "cli"]),
};

function isWithin(path: string, root: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

function packageOwner(path: string, packages: readonly WorkspacePackage[]): PackageOwner | undefined {
  return packages.find((pkg) => isWithin(path, pkg.root))?.owner;
}

function isKernelTesting(path: string, packages: readonly WorkspacePackage[]): boolean {
  const kernel = packages.find((pkg) => pkg.owner === "kernel");
  return kernel ? isWithin(path, join(kernel.root, "testing")) : false;
}

function fileCandidate(path: string): string | undefined {
  try {
    return existsSync(path) && statSync(path).isFile() ? resolve(path) : undefined;
  } catch {
    return undefined;
  }
}

function resolveFile(path: string): string | undefined {
  const direct = fileCandidate(path);
  if (direct) return direct;

  const extension = extname(path).toLowerCase();
  const candidates: string[] = [];
  if (extension === "") {
    for (const sourceExtension of EXECUTABLE_SOURCE_EXTENSIONS) {
      candidates.push(`${path}${sourceExtension}`, join(path, `index${sourceExtension}`));
    }
  } else if (extension === ".js") {
    candidates.push(`${path.slice(0, -3)}.ts`, `${path.slice(0, -3)}.tsx`);
  } else if (extension === ".mjs") {
    candidates.push(`${path.slice(0, -4)}.mts`);
  } else if (extension === ".cjs") {
    candidates.push(`${path.slice(0, -4)}.cts`);
  }
  return candidates.map(fileCandidate).find((candidate) => candidate !== undefined);
}

function workspaceSpecifier(
  specifier: string,
  packages: readonly WorkspacePackage[],
): { pkg: WorkspacePackage; subpath: string } | undefined {
  for (const pkg of packages) {
    const name = pkg.manifest.name;
    if (name && (specifier === name || specifier.startsWith(`${name}/`))) {
      return {
        pkg,
        subpath: specifier === name ? "." : `./${specifier.slice(name.length + 1)}`,
      };
    }
  }
  return undefined;
}

function importReferences(source: ts.SourceFile): ImportReference[] {
  const references: ImportReference[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
        references.push({ node: node.moduleSpecifier, specifier: node.moduleSpecifier.text, dynamic: false });
      }
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      references.push({
        node: node.moduleReference.expression,
        specifier: node.moduleReference.expression.text,
        dynamic: false,
      });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      references.push({
        node,
        ...(argument && ts.isStringLiteralLike(argument) ? { specifier: argument.text } : {}),
        dynamic: true,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return references;
}

function problemAt(
  source: ts.SourceFile,
  file: string,
  node: ts.Node,
  rule: BoundaryProblem["rule"],
  message: string,
): BoundaryProblem {
  const position = source.getLineAndCharacterOfPosition(node.getStart(source));
  return { rule, file, line: position.line + 1, column: position.character + 1, message };
}

function workspacePackages(repoRoot: string): WorkspacePackage[] {
  return [
    { owner: "kernel" as const, dir: "kernel" },
    { owner: "store-plainfile" as const, dir: "store-plainfile" },
    { owner: "cli" as const, dir: "cli" },
  ].map(({ owner, dir }) => {
    const root = join(repoRoot, "packages", dir);
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Manifest;
    return { owner, root, manifest };
  });
}

function productionAreas(repoRoot: string): ProductionArea[] {
  return [
    { owner: "kernel", root: join(repoRoot, "packages", "kernel", "src") },
    { owner: "store-plainfile", root: join(repoRoot, "packages", "store-plainfile", "src") },
    { owner: "cli", root: join(repoRoot, "packages", "cli", "src") },
    { owner: "cli", root: join(repoRoot, "packages", "cli", "bin") },
  ];
}

export function scanWorkspaceBoundaries(repoRoot: string): BoundaryProblem[] {
  const problems: BoundaryProblem[] = [];
  let packages: WorkspacePackage[];
  try {
    packages = workspacePackages(repoRoot);
  } catch (error) {
    return [
      {
        rule: "source-tree",
        file: "packages",
        line: 1,
        column: 1,
        message: `cannot read workspace package manifests: ${error instanceof Error ? error.message : String(error)}`,
      },
    ];
  }

  for (const area of productionAreas(repoRoot)) {
    const discovery = discoverExecutableSources(area.root, repoRoot);
    problems.push(
      ...discovery.problems.map((problem) => ({
        rule: "source-tree" as const,
        file: problem.file,
        line: 1,
        column: 1,
        message: `cannot prove workspace boundaries: ${problem.message}`,
      })),
    );

    for (const sourcePath of discovery.files) {
      const displayFile = relative(repoRoot, sourcePath).replaceAll("\\", "/");
      let source: ts.SourceFile;
      try {
        source = ts.createSourceFile(
          sourcePath,
          readFileSync(sourcePath, "utf8"),
          ts.ScriptTarget.Latest,
          true,
          scriptKindFor(sourcePath),
        );
      } catch (error) {
        problems.push({
          rule: "source-read",
          file: displayFile,
          line: 1,
          column: 1,
          message: `cannot read production source: ${error instanceof Error ? error.message : String(error)}`,
        });
        continue;
      }

      const parseDiagnostics = (
        source as ts.SourceFile & { readonly parseDiagnostics: readonly ts.Diagnostic[] }
      ).parseDiagnostics;
      for (const diagnostic of parseDiagnostics) {
        const position = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
        problems.push({
          rule: "source-parse",
          file: displayFile,
          line: position.line + 1,
          column: position.character + 1,
          message: `cannot inspect imports because the source does not parse: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
        });
      }
      if (parseDiagnostics.length > 0) continue;

      for (const reference of importReferences(source)) {
        if (!reference.specifier) {
          problems.push(
            problemAt(
              source,
              displayFile,
              reference.node,
              "boundary-dynamic",
              "dynamic import specifier is not a static string and cannot be resolved safely",
            ),
          );
          continue;
        }

        const specifier = reference.specifier;
        let target: string | undefined;
        const workspace = workspaceSpecifier(specifier, packages);
        if (workspace) {
          const exportTarget = workspace.pkg.manifest.exports?.[workspace.subpath];
          if (!exportTarget) {
            problems.push(
              problemAt(
                source,
                displayFile,
                reference.node,
                "boundary-resolution",
                `workspace import ${specifier} names an undeclared package export`,
              ),
            );
            continue;
          }
          target = resolveFile(join(workspace.pkg.root, exportTarget));
        } else if (specifier.startsWith(".") || isAbsolute(specifier)) {
          target = resolveFile(resolve(dirname(sourcePath), specifier));
        } else {
          if (area.owner === "kernel") {
            problems.push(
              problemAt(
                source,
                displayFile,
                reference.node,
                "boundary-external",
                `kernel production source imports external or environment module ${specifier}; use a port`,
              ),
            );
          }
          continue;
        }

        if (!target) {
          problems.push(
            problemAt(
              source,
              displayFile,
              reference.node,
              "boundary-resolution",
              `cannot resolve ${reference.dynamic ? "dynamic " : ""}import ${specifier}`,
            ),
          );
          continue;
        }
        if (isKernelTesting(target, packages)) {
          problems.push(
            problemAt(
              source,
              displayFile,
              reference.node,
              "boundary-testing",
              `production import ${specifier} resolves into test-only packages/kernel/testing`,
            ),
          );
          continue;
        }

        const targetOwner = packageOwner(target, packages);
        if (!targetOwner) {
          problems.push(
            problemAt(
              source,
              displayFile,
              reference.node,
              "boundary-resolution",
              `production import ${specifier} resolves outside the workspace packages`,
            ),
          );
        } else if (!ALLOWED_TARGETS[area.owner].has(targetOwner)) {
          problems.push(
            problemAt(
              source,
              displayFile,
              reference.node,
              "boundary-dag",
              `${area.owner} production source may not depend on ${targetOwner}; required DAG is kernel <- store-plainfile <- cli`,
            ),
          );
        }
      }
    }
  }

  return problems;
}
