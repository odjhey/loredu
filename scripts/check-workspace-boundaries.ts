import { type Dirent, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export interface Violation {
  readonly path: string;
  readonly rule: string;
  readonly detail: string;
}

/** Stable production check identities. Tests mutate execution, never returned diagnostics. */
export const BOUNDARY_CHECK_IDS = [
  "G0-A-INVENTORY",
  "G0-B-SYNTAX",
  "G0-C-REFERENCES",
  "G0-C-SOURCE-PARSE",
  "G0-D-CAPABILITY-FLOW",
  "G0-E-COMPILER",
  "G0-E-CONFIG-GRAPH",
  "G0-F-MANIFEST-EXPORTS",
] as const;
export type BoundaryCheckId = (typeof BOUNDARY_CHECK_IDS)[number];
interface ScanMutation {
  readonly disabled?: ReadonlySet<BoundaryCheckId>;
  readonly replaceScan?: (root: string) => Violation[];
}
function enabled(mutation: ScanMutation | undefined, id: BoundaryCheckId): boolean {
  return !mutation?.disabled?.has(id);
}
interface Manifest {
  readonly name?: string;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
  readonly exports?: Record<string, string>;
}

const PACKAGES = ["kernel", "store-plainfile", "cli"] as const;
type PackageName = (typeof PACKAGES)[number];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);
const EXECUTABLE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs"]);
const EXPECTED_NAMES: Record<PackageName, string> = {
  kernel: "@loredu/kernel",
  "store-plainfile": "@loredu/store-plainfile",
  cli: "@loredu/cli",
};
const REQUIRED_WORKSPACE_EDGES: Record<PackageName, readonly string[]> = {
  kernel: [],
  "store-plainfile": ["@loredu/kernel"],
  cli: ["@loredu/kernel", "@loredu/store-plainfile"],
};
const ALLOWED_WORKSPACE_EDGES: Record<PackageName, readonly string[]> = REQUIRED_WORKSPACE_EDGES;
const EXPECTED_EXPORTS: Record<PackageName, Readonly<Record<string, string>>> = {
  kernel: { ".": "./src/index.ts", "./testing": "./testing/index.ts" },
  "store-plainfile": { ".": "./src/index.ts" },
  cli: { ".": "./src/index.ts" },
};
const BUILTINS = new Set(
  builtinModules.flatMap((name) => {
    const bare = name.replace(/^node:/, "");
    return [bare, `node:${bare}`];
  }),
);

function portable(path: string): string {
  return path.split(sep).join("/");
}
function push(result: Violation[], root: string, path: string, rule: string, detail: string): void {
  result.push({ path: portable(relative(root, path)), rule, detail });
}
function manifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}
function inspect(path: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
}
function entries(root: string, path: string, result: Violation[]): Dirent[] | undefined {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    push(result, root, path, "source-tree", "directory could not be read");
    return undefined;
  }
}
function runtimeDependencies(value: Manifest): string[] {
  return [
    ...Object.keys(value.dependencies ?? {}),
    ...Object.keys(value.peerDependencies ?? {}),
    ...Object.keys(value.optionalDependencies ?? {}),
  ].sort();
}
function testSurface(packageRoot: string, file: string): boolean {
  const local = portable(relative(packageRoot, file));
  return local.startsWith("testing/") || /\.(?:test|spec)\.(?:ts|tsx|mts|cts)$/.test(local);
}
function sourceKind(file: string): ts.ScriptKind {
  const extension = extname(file);
  if (extension === ".tsx") return ts.ScriptKind.TSX;
  if (extension === ".js" || extension === ".mjs" || extension === ".cjs") return ts.ScriptKind.JS;
  if (extension === ".jsx") return ts.ScriptKind.JSX;
  return ts.ScriptKind.TS;
}
function location(source: ts.SourceFile, node: ts.Node): string {
  const point = source.getLineAndCharacterOfPosition(node.getStart(source));
  return `${point.line + 1}:${point.character + 1}`;
}
function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current)
  )
    current = current.expression;
  return current;
}
function staticText(expression: ts.Expression | undefined): string | undefined {
  if (!expression) return undefined;
  const value = unwrap(expression);
  return ts.isStringLiteralLike(value) ? value.text : undefined;
}
function propertyName(
  expression: ts.Expression,
): { readonly object: ts.Expression; readonly name?: string } | undefined {
  const value = unwrap(expression);
  if (ts.isPropertyAccessExpression(value))
    return { object: unwrap(value.expression), name: value.name.text };
  if (ts.isElementAccessExpression(value)) {
    const name = staticText(value.argumentExpression);
    return name === undefined
      ? { object: unwrap(value.expression) }
      : { object: unwrap(value.expression), name };
  }
  return undefined;
}
function identifier(expression: ts.Expression, name: string): boolean {
  const value = unwrap(expression);
  return ts.isIdentifier(value) && value.text === name;
}
interface Discovered {
  readonly production: Map<PackageName, string[]>;
  readonly tests: string[];
}
function discover(root: string, result: Violation[]): Discovered {
  const packagesRoot = join(root, "packages");
  const production = new Map<PackageName, string[]>(PACKAGES.map((name) => [name, []]));
  const tests: string[] = [];
  const packagesInfo = inspect(packagesRoot);
  if (!packagesInfo) {
    push(result, root, packagesRoot, "source-tree", "required packages directory is missing");
    return { production, tests };
  }
  if (packagesInfo.isSymbolicLink()) {
    push(result, root, packagesRoot, "source-tree", "symlinked packages directory is not inspectable");
    return { production, tests };
  }
  if (!packagesInfo.isDirectory()) {
    push(result, root, packagesRoot, "source-tree", "packages root is not a directory");
    return { production, tests };
  }
  for (const entry of entries(root, packagesRoot, result) ?? []) {
    const path = join(packagesRoot, entry.name);
    if (entry.isSymbolicLink()) {
      push(result, root, path, "source-tree", "symlinked package entry is not inspectable");
    } else if (entry.isDirectory()) {
      if (!PACKAGES.includes(entry.name as PackageName))
        push(result, root, path, "package-location", "new package is not classified by the dependency law");
    } else if (entry.name !== "README.md") {
      push(result, root, path, "source-tree", "file directly under packages is unclassified");
    }
  }
  for (const name of PACKAGES) {
    const packageRoot = join(packagesRoot, name);
    const roots = [join(packageRoot, "src"), ...(name === "cli" ? [join(packageRoot, "bin")] : [])];
    for (const sourceRoot of roots) {
      const sourceInfo = inspect(sourceRoot);
      if (!sourceInfo) {
        push(result, root, sourceRoot, "source-tree", "required production source root is missing");
        continue;
      }
      if (sourceInfo.isSymbolicLink() || !sourceInfo.isDirectory()) {
        push(
          result,
          root,
          sourceRoot,
          "source-tree",
          "required production source root is not an inspectable directory",
        );
        continue;
      }
      let count = 0;
      const visit = (directory: string): void => {
        for (const entry of entries(root, directory, result) ?? []) {
          const path = join(directory, entry.name);
          if (entry.isSymbolicLink()) {
            push(result, root, path, "source-tree", "symlinked source entry is not inspectable");
          } else if (entry.isDirectory()) {
            if (
              entry.name === "node_modules" ||
              entry.name === "dist" ||
              entry.name === "build" ||
              entry.name === "generated" ||
              entry.name.startsWith(".")
            )
              push(
                result,
                root,
                path,
                "source-tree",
                "ignored or hidden tree inside a source root is forbidden",
              );
            else visit(path);
          } else if (!entry.isFile()) push(result, root, path, "source-tree", "unsupported filesystem entry");
          else if (SOURCE_EXTENSIONS.has(extname(path))) {
            count++;
            if (testSurface(packageRoot, path)) tests.push(path);
            else production.get(name)?.push(path);
          } else {
            const kind = EXECUTABLE_EXTENSIONS.has(extname(path)) ? "executable" : "unrecognized";
            push(
              result,
              root,
              path,
              "source-tree",
              `${kind} production source extension ${extname(path) || "<none>"}`,
            );
          }
        }
      };
      visit(sourceRoot);
      if (count === 0)
        push(
          result,
          root,
          sourceRoot,
          "source-tree",
          "production source root contains no supported source files",
        );
    }
    const testingRoot = join(packageRoot, "testing");
    const testingInfo = inspect(testingRoot);
    if (testingInfo) {
      if (testingInfo.isSymbolicLink() || !testingInfo.isDirectory()) {
        push(result, root, testingRoot, "source-tree", "testing root is not an inspectable directory");
      } else {
        const visitTesting = (directory: string): void => {
          for (const entry of entries(root, directory, result) ?? []) {
            const path = join(directory, entry.name);
            if (entry.isSymbolicLink())
              push(result, root, path, "source-tree", "symlinked test entry is not inspectable");
            else if (entry.isDirectory()) visitTesting(path);
            else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(path))) tests.push(path);
            else push(result, root, path, "source-tree", "unrecognized test source entry");
          }
        };
        visitTesting(testingRoot);
      }
    }
    const packageEntries = entries(root, packageRoot, result);
    if (!packageEntries) continue;
    for (const entry of packageEntries) {
      if (
        entry.name === "src" ||
        entry.name === "testing" ||
        (name === "cli" && entry.name === "bin") ||
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "package.json" ||
        entry.name === "tsconfig.json" ||
        entry.name === "README.md"
      )
        continue;
      const path = join(packageRoot, entry.name);
      if (entry.isSymbolicLink()) {
        push(result, root, path, "source-tree", "symlinked unclassified package entry is not inspectable");
        continue;
      }
      if (
        entry.isFile() &&
        (SOURCE_EXTENSIONS.has(extname(path)) || EXECUTABLE_EXTENSIONS.has(extname(path)))
      )
        push(
          result,
          root,
          path,
          "source-location",
          "source file is outside a recognized production or test surface",
        );
      if (entry.isDirectory()) {
        const stack = [path];
        while (stack.length) {
          const current = stack.pop() as string;
          for (const child of entries(root, current, result) ?? []) {
            const childPath = join(current, child.name);
            if (child.isDirectory()) stack.push(childPath);
            else if (child.isSymbolicLink())
              push(result, root, childPath, "source-tree", "symlinked unclassified entry");
            else if (
              SOURCE_EXTENSIONS.has(extname(childPath)) ||
              EXECUTABLE_EXTENSIONS.has(extname(childPath))
            )
              push(
                result,
                root,
                childPath,
                "source-location",
                "source file is outside a recognized production or test surface",
              );
          }
        }
      }
    }
  }
  return { production, tests };
}

function owningPackage(root: string, path: string): PackageName | undefined {
  const local = portable(relative(join(root, "packages"), path));
  return PACKAGES.find((name) => local === name || local.startsWith(`${name}/`));
}
function compilerOptions(root: string, owner: PackageName): ts.CompilerOptions {
  const configPath = join(root, "packages", owner, "tsconfig.json");
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  if (loaded.error) return {};
  return ts.parseJsonConfigFileContent(loaded.config, ts.sys, dirname(configPath)).options;
}
function resolveModule(from: string, specifier: string, options: ts.CompilerOptions): string | undefined {
  return ts.resolveModuleName(specifier, from, options, ts.sys).resolvedModule?.resolvedFileName;
}
function ignoredTarget(root: string, target: string): boolean {
  const owner = owningPackage(root, target);
  if (!owner) return false;
  const local = portable(relative(join(root, "packages", owner), target));
  return local.split("/").some((part) => part === "node_modules" || part === "dist" || part.startsWith("."));
}
function workspaceSpecifier(specifier: string): PackageName | undefined {
  return PACKAGES.find(
    (name) => specifier === EXPECTED_NAMES[name] || specifier.startsWith(`${EXPECTED_NAMES[name]}/`),
  );
}
function checkReference(
  root: string,
  owner: PackageName,
  _packageRoot: string,
  file: string,
  source: ts.SourceFile,
  node: ts.Node,
  specifier: string,
  result: Violation[],
  options: ts.CompilerOptions,
): void {
  const at = location(source, node);
  const embeddedSkill = resolve(dirname(file), specifier);
  if (owner === "cli" && portable(relative(root, embeddedSkill)) === "docs/v0.x/execution/agent-skill.md") {
    const asset = inspect(embeddedSkill);
    if (!asset?.isFile() || asset.isSymbolicLink()) {
      push(result, root, file, "boundary-unresolved", `${at} embedded skill source is not a regular file`);
    }
    return;
  }
  // Workspace identity is a property of source syntax. It is deliberately
  // decided before configured resolution so `paths` cannot launder an edge.
  const workspace = workspaceSpecifier(specifier);
  if (!workspace && specifier.startsWith("@loredu/")) {
    push(result, root, file, "boundary-unresolved", `${at} unknown workspace package: ${specifier}`);
    return;
  }
  if (workspace) {
    if (specifier === "@loredu/kernel/testing" || specifier.startsWith("@loredu/kernel/testing/")) {
      push(result, root, file, "testing-import", `${at} production imports ${specifier}`);
      return;
    }
    const packageName = EXPECTED_NAMES[workspace];
    const subpath = specifier === packageName ? "." : `./${specifier.slice(packageName.length + 1)}`;
    if (!(subpath in EXPECTED_EXPORTS[workspace])) {
      push(result, root, file, "boundary-unresolved", `${at} package subpath is not exported: ${specifier}`);
      return;
    }
    if (workspace !== owner && !ALLOWED_WORKSPACE_EDGES[owner].includes(packageName))
      push(result, root, file, "workspace-edge", `${at} forbidden ${owner} -> ${workspace} via ${specifier}`);
    return;
  }
  if (
    owner === "kernel" &&
    !specifier.startsWith(".") &&
    !specifier.startsWith("/") &&
    (BUILTINS.has(specifier) ||
      specifier.startsWith("node:") ||
      specifier.startsWith("bun:") ||
      !resolveModule(file, specifier, options) ||
      portable(resolveModule(file, specifier, options) ?? "").includes("/node_modules/"))
  ) {
    const kind =
      BUILTINS.has(specifier) || specifier.startsWith("node:") || specifier.startsWith("bun:")
        ? "environment module"
        : "external package";
    push(result, root, file, "kernel-import", `${at} kernel imports ${kind} ${specifier}`);
    return;
  }
  const configuredTarget = resolveModule(file, specifier, options);
  const relativeReference = specifier.startsWith(".") || specifier.startsWith("/");
  if (relativeReference || (configuredTarget && !portable(configuredTarget).includes("/node_modules/"))) {
    const target = configuredTarget;
    if (!target) {
      push(result, root, file, "boundary-unresolved", `${at} cannot resolve ${specifier}`);
      return;
    }
    const targetOwner = owningPackage(root, target);
    if (!targetOwner)
      push(result, root, file, "boundary-target", `${at} resolves outside the workspace: ${specifier}`);
    else if (ignoredTarget(root, target))
      push(result, root, file, "boundary-target", `${at} resolves into an ignored source tree: ${specifier}`);
    else if (portable(relative(join(root, "packages", targetOwner), target)).startsWith("testing/"))
      push(
        result,
        root,
        file,
        "testing-import",
        `${at} production resolves to ${targetOwner}/testing via ${specifier}`,
      );
    else if (!ALLOWED_WORKSPACE_EDGES[owner].includes(EXPECTED_NAMES[targetOwner]) && targetOwner !== owner)
      push(
        result,
        root,
        file,
        "workspace-edge",
        `${at} forbidden ${owner} -> ${targetOwner} via ${specifier}`,
      );
    return;
  }
  if (owner === "kernel")
    push(result, root, file, "kernel-import", `${at} kernel imports external package ${specifier}`);
}

function analyzeFile(
  root: string,
  owner: PackageName,
  file: string,
  result: Violation[],
  options: ts.CompilerOptions,
  program: ts.Program,
  mutation?: ScanMutation,
): void {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    push(result, root, file, "source-read", "source could not be read");
    return;
  }
  const source =
    program.getSourceFile(file) ??
    ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, sourceKind(file));
  const checker = program.getTypeChecker();
  const parseDiagnostics = (source as ts.SourceFile & { readonly parseDiagnostics: readonly ts.Diagnostic[] })
    .parseDiagnostics;
  for (const diagnostic of enabled(mutation, "G0-C-SOURCE-PARSE") ? parseDiagnostics : []) {
    const point =
      diagnostic.start === undefined
        ? "?:?"
        : (() => {
            const position = source.getLineAndCharacterOfPosition(diagnostic.start);
            return `${position.line + 1}:${position.character + 1}`;
          })();
    push(
      result,
      root,
      file,
      "source-parse",
      `${point} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
    );
  }
  if (enabled(mutation, "G0-C-SOURCE-PARSE") && parseDiagnostics.length) return;
  if (owner === "kernel" && enabled(mutation, "G0-E-COMPILER")) {
    const directiveLocation = (position: number): string => {
      const point = source.getLineAndCharacterOfPosition(position);
      return `${point.line + 1}:${point.character + 1}`;
    };
    for (const directive of source.libReferenceDirectives)
      push(
        result,
        root,
        file,
        "kernel-reference",
        `${directiveLocation(directive.pos)} triple-slash lib reference is forbidden: ${directive.fileName}`,
      );
    for (const directive of source.typeReferenceDirectives)
      push(
        result,
        root,
        file,
        "kernel-reference",
        `${directiveLocation(directive.pos)} triple-slash types reference is forbidden: ${directive.fileName}`,
      );
    for (const directive of source.referencedFiles)
      push(
        result,
        root,
        file,
        "kernel-reference",
        `${directiveLocation(directive.pos)} triple-slash path reference is forbidden: ${directive.fileName}`,
      );
  }
  const packageRoot = join(root, "packages", owner);
  const claimedSpecifiers = new Set<string>();
  const aliases = new Map<ts.Symbol, string>();
  const locallyBound = (node: ts.Identifier): boolean =>
    checker
      .getSymbolAtLocation(node)
      ?.declarations?.some(
        (declaration) =>
          declaration.getSourceFile() === source && !ts.isShorthandPropertyAssignment(declaration),
      ) ?? false;
  const expressionCapability = (expression: ts.Expression): string | undefined => {
    const value = unwrap(expression);
    if (ts.isIdentifier(value)) {
      if (value.text === "globalThis" && !locallyBound(value)) return "globalThis";
      if (["Date", "Math", "Bun", "process", "Buffer"].includes(value.text) && !locallyBound(value))
        return value.text;
      const symbol = checker.getSymbolAtLocation(value);
      return symbol ? aliases.get(symbol) : undefined;
    }
    const member = propertyName(value);
    if (!member) return undefined;
    const base = identifier(member.object, "globalThis") ? "globalThis" : expressionCapability(member.object);
    if (
      base === "globalThis" &&
      member.name &&
      ["Date", "Math", "Bun", "process", "Buffer"].includes(member.name)
    )
      return member.name;
    return base && member.name ? `${base}.${member.name}` : undefined;
  };
  // Facts are populated in execution order below; pre-collecting aliases would let
  // future writes affect earlier uses and is deliberately forbidden.
  const isGlobal = (expression: ts.Expression, name: string): boolean =>
    expressionCapability(expression) === name;
  const taintedFact = (fact: string | undefined): fact is string =>
    fact !== undefined &&
    (fact === "globalThis" ||
      fact === "Date" ||
      fact === "Math" ||
      fact === "Bun" ||
      fact === "process" ||
      fact === "Buffer" ||
      fact === "Date.now" ||
      fact.startsWith("Date.now.") ||
      fact === "Math.random" ||
      fact.startsWith("Math.random.") ||
      fact === "UnknownCapabilityDerived");
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node)) {
      const initial = node.initializer && unwrap(node.initializer);
      if (ts.isIdentifier(node.name)) {
        const symbol = checker.getSymbolAtLocation(node.name);
        const fact = initial && expressionCapability(initial);
        if (symbol) {
          if (fact) aliases.set(symbol, fact);
          else aliases.delete(symbol);
        }
      } else if (ts.isObjectBindingPattern(node.name) && initial) {
        const base = expressionCapability(initial);
        for (const element of node.name.elements) {
          if (!ts.isIdentifier(element.name)) continue;
          const symbol = checker.getSymbolAtLocation(element.name);
          const property = element.propertyName?.getText(source) ?? element.name.text;
          if (symbol && base) aliases.set(symbol, `${base}.${property}`.replace(/^globalThis\./, ""));
        }
      }
    }
    // Forward writes update the reaching fact. A definitely clean assignment
    // removes an earlier capability fact; branch-local writes are conservatively
    // not used to clean the outer binding.
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(unwrap(node.left))
    ) {
      const target = unwrap(node.left) as ts.Identifier;
      const symbol = checker.getSymbolAtLocation(target);
      if (symbol) {
        const fact = expressionCapability(node.right);
        const conditional = ts.findAncestor(
          node,
          (ancestor) =>
            ts.isIfStatement(ancestor) ||
            ts.isConditionalExpression(ancestor) ||
            ts.isSwitchStatement(ancestor) ||
            ts.isForStatement(ancestor) ||
            ts.isForInStatement(ancestor) ||
            ts.isForOfStatement(ancestor) ||
            ts.isWhileStatement(ancestor) ||
            ts.isDoStatement(ancestor),
        );
        if (taintedFact(fact)) aliases.set(symbol, fact);
        else if (!conditional) aliases.delete(symbol);
      }
    }
    let reference: string | undefined;
    let referenceNode: ts.Node = node;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) {
        reference = staticText(node.moduleSpecifier);
        referenceNode = node.moduleSpecifier;
      }
    } else if (ts.isJSDocImportTag(node)) {
      reference = staticText(node.moduleSpecifier);
      referenceNode = node.moduleSpecifier;
      if (reference === undefined && enabled(mutation, "G0-C-REFERENCES"))
        push(
          result,
          root,
          file,
          "boundary-ast-uncertain",
          `${location(source, node)} JSDoc import is not one static string`,
        );
    } else if (ts.isImportTypeNode(node)) {
      reference =
        ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)
          ? node.argument.literal.text
          : undefined;
      referenceNode = node.argument;
      if (reference === undefined && enabled(mutation, "G0-C-REFERENCES"))
        push(
          result,
          root,
          file,
          "boundary-ast-uncertain",
          `${location(source, node)} import type is not one static string`,
        );
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      reference = staticText(node.moduleReference.expression);
      referenceNode = node.moduleReference;
    } else if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression);
      const loader = propertyName(callee);
      const ambientRequireResolve =
        loader?.name === "resolve" &&
        ts.isIdentifier(loader.object) &&
        loader.object.text === "require" &&
        !locallyBound(loader.object);
      const ambientModuleRequire =
        loader?.name === "require" &&
        ts.isIdentifier(loader.object) &&
        loader.object.text === "module" &&
        !locallyBound(loader.object);
      if (
        callee.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(callee) && callee.text === "require" && !locallyBound(callee)) ||
        ambientRequireResolve ||
        ambientModuleRequire
      ) {
        reference = staticText(node.arguments[0]);
        referenceNode = node;
        const importCall = callee.kind === ts.SyntaxKind.ImportKeyword;
        if (
          enabled(mutation, "G0-C-REFERENCES") &&
          ((!importCall && node.arguments.length !== 1) ||
            (importCall && ![1, 2].includes(node.arguments.length)) ||
            reference === undefined)
        )
          push(
            result,
            root,
            file,
            "boundary-dynamic",
            `${location(source, node)} module reference is not one static string`,
          );
      }
      if (owner === "kernel" && enabled(mutation, "G0-D-CAPABILITY-FLOW")) {
        for (const argument of node.arguments) {
          const escaped = expressionCapability(argument);
          if (escaped && escaped !== "Clean")
            push(
              result,
              root,
              file,
              "ambient-capability",
              `${location(source, argument)} ambient capability escapes`,
            );
        }
      }
      const calleeCapability = expressionCapability(callee);
      const directDate = calleeCapability === "Date";
      const dateNow = calleeCapability === "Date.now" || calleeCapability?.startsWith("Date.now.") === true;
      const mathRandom =
        calleeCapability === "Math.random" || calleeCapability?.startsWith("Math.random.") === true;
      if (
        owner === "kernel" &&
        enabled(mutation, "G0-D-CAPABILITY-FLOW") &&
        (directDate || dateNow || mathRandom)
      )
        push(
          result,
          root,
          file,
          "ambient-capability",
          `${location(source, node)} ambient ${directDate ? "Date call" : dateNow ? "Date.now" : "Math.random"}`,
        );
    } else if (ts.isNewExpression(node)) {
      const constructorExpression = unwrap(node.expression);
      const date = isGlobal(constructorExpression, "Date");
      if (
        owner === "kernel" &&
        enabled(mutation, "G0-D-CAPABILITY-FLOW") &&
        date &&
        (!node.arguments || node.arguments.length === 0 || node.arguments.some(ts.isSpreadElement))
      )
        push(
          result,
          root,
          file,
          "ambient-capability",
          `${location(source, node)} zero-or-uncertain-argument new Date`,
        );
    }
    if (reference !== undefined && enabled(mutation, "G0-C-REFERENCES")) {
      claimedSpecifiers.add(reference);
      if (enabled(mutation, "G0-B-SYNTAX"))
        checkReference(root, owner, packageRoot, file, source, referenceNode, reference, result, options);
    }
    if (
      owner === "kernel" &&
      enabled(mutation, "G0-D-CAPABILITY-FLOW") &&
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      expressionCapability(node.initializer) === "globalThis"
    ) {
      for (const element of node.name.elements) {
        const name = element.propertyName?.getText(source) ?? element.name.getText(source);
        if (["Bun", "process", "Buffer"].includes(name))
          push(
            result,
            root,
            file,
            "ambient-capability",
            `${location(source, element)} ambient global ${name}`,
          );
      }
    }
    if (
      owner === "kernel" &&
      enabled(mutation, "G0-D-CAPABILITY-FLOW") &&
      ts.isShorthandPropertyAssignment(node)
    ) {
      const valueSymbol = checker.getShorthandAssignmentValueSymbol(node);
      if (taintedFact(valueSymbol ? aliases.get(valueSymbol) : undefined))
        push(
          result,
          root,
          file,
          "ambient-capability",
          `${location(source, node.name)} ambient capability escapes`,
        );
    }
    if (
      owner === "kernel" &&
      enabled(mutation, "G0-D-CAPABILITY-FLOW") &&
      ts.isReturnStatement(node) &&
      node.expression
    ) {
      const escaped = expressionCapability(node.expression);
      if (escaped === "Date.now" || escaped === "Math.random" || escaped === "UnknownCapabilityDerived")
        push(
          result,
          root,
          file,
          "ambient-capability",
          `${location(source, node)} ambient capability escapes`,
        );
    }
    if (owner === "kernel" && enabled(mutation, "G0-D-CAPABILITY-FLOW") && ts.isExpression(node)) {
      const escaped = expressionCapability(node);
      const parent = node.parent;
      const isCapability =
        escaped === "Date.now" || escaped === "Math.random" || escaped === "UnknownCapabilityDerived";
      const escapes =
        (ts.isArrayLiteralExpression(parent) && parent.elements.includes(node as ts.Expression)) ||
        (ts.isPropertyAssignment(parent) && parent.initializer === node) ||
        (ts.isShorthandPropertyAssignment(parent) && parent.name === node) ||
        (ts.isConditionalExpression(parent) && (parent.whenTrue === node || parent.whenFalse === node)) ||
        (ts.isParameter(parent) && parent.initializer === node) ||
        (ts.isBinaryExpression(parent) && parent.right === node && !ts.isIdentifier(unwrap(parent.left)));
      if (isCapability && escapes)
        push(
          result,
          root,
          file,
          "ambient-capability",
          `${location(source, node)} ambient capability escapes`,
        );
    }
    if (
      owner === "kernel" &&
      enabled(mutation, "G0-D-CAPABILITY-FLOW") &&
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
    ) {
      const member = propertyName(node);
      const capability = expressionCapability(node);
      if (member && member.name === undefined && expressionCapability(member.object) === "globalThis")
        push(
          result,
          root,
          file,
          "ambient-capability",
          `${location(source, node)} unknown globalThis capability access`,
        );
      if (["Bun", "process", "Buffer"].includes(capability ?? ""))
        push(
          result,
          root,
          file,
          "ambient-capability",
          `${location(source, node)} ambient global ${capability}`,
        );
    }
    const parent = node.parent;
    const propertyNameOnly =
      !!parent &&
      ((ts.isLabeledStatement(parent) && parent.label === node) ||
        ((ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === node) ||
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) ||
        (ts.isPropertySignature(parent) && parent.name === node) ||
        (ts.isMethodDeclaration(parent) && parent.name === node) ||
        (ts.isMethodSignature(parent) && parent.name === node));
    if (
      owner === "kernel" &&
      enabled(mutation, "G0-D-CAPABILITY-FLOW") &&
      ts.isIdentifier(node) &&
      ["Bun", "process", "Buffer"].includes(node.text) &&
      !locallyBound(node) &&
      !propertyNameOnly &&
      (!parent || (!ts.isTypeReferenceNode(parent) && !ts.isTypeAliasDeclaration(parent)))
    )
      push(result, root, file, "ambient-capability", `${location(source, node)} ambient global ${node.text}`);
    ts.forEachChild(node, visit);
  };
  visit(source);
  // TypeScript only materializes JSDoc import tags/types on JavaScript-kind source
  // files. Parse the same bytes in that documented mode so .ts policy files do
  // not gain a comment-based module-reference bypass.
  if (enabled(mutation, "G0-C-REFERENCES") && text.includes("/**")) {
    const jsDocSource = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const visitJsDoc = (node: ts.Node): void => {
      if (ts.isJSDocImportTag(node)) {
        const specifier = staticText(node.moduleSpecifier);
        if (specifier) {
          claimedSpecifiers.add(specifier);
          if (enabled(mutation, "G0-B-SYNTAX"))
            checkReference(
              root,
              owner,
              packageRoot,
              file,
              jsDocSource,
              node.moduleSpecifier,
              specifier,
              result,
              options,
            );
        } else
          push(
            result,
            root,
            file,
            "boundary-ast-uncertain",
            `${location(jsDocSource, node)} JSDoc import is not one static string`,
          );
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        const literal = node.argument.literal;
        if (ts.isStringLiteralLike(literal)) {
          claimedSpecifiers.add(literal.text);
          if (enabled(mutation, "G0-B-SYNTAX"))
            checkReference(
              root,
              owner,
              packageRoot,
              file,
              jsDocSource,
              literal,
              literal.text,
              result,
              options,
            );
        }
      }
      ts.forEachChild(node, visitJsDoc);
    };
    visitJsDoc(jsDocSource);
    for (const comment of text.matchAll(/\/\*\*[\s\S]*?\*\//g)) {
      for (const match of comment[0].matchAll(/\bimport\s*(?:\(\s*)?["']([^"']+)["']/g)) {
        const specifier = match[1];
        if (!specifier) continue;
        claimedSpecifiers.add(specifier);
        if (enabled(mutation, "G0-B-SYNTAX"))
          checkReference(root, owner, packageRoot, file, source, source, specifier, result, options);
      }
    }
  }
  // Reconcile our AST claims with TypeScript's public preprocessing inventory.
  // A compiler upgrade or future reference-bearing form therefore fails closed.
  const preprocessed = ts.preProcessFile(text, true, true);
  for (const item of enabled(mutation, "G0-C-REFERENCES") ? preprocessed.importedFiles : [])
    if (!claimedSpecifiers.has(item.fileName))
      push(
        result,
        root,
        file,
        "boundary-ast-uncertain",
        `${item.pos} TypeScript module reference was not claimed: ${item.fileName}`,
      );
}

function checkConfigGraph(root: string, result: Violation[]): void {
  const paths = [
    join(root, "tsconfig.base.json"),
    ...PACKAGES.map((name) => join(root, "packages", name, "tsconfig.json")),
  ];
  for (const configPath of paths) {
    const info = inspect(configPath);
    if (!info) {
      push(result, root, configPath, "project-config", "required project config is absent");
      continue;
    }
    if (info.isSymbolicLink() || !info.isFile()) {
      push(result, root, configPath, "project-config", "project config is not a regular file");
      continue;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(configPath, "utf8"));
    } catch {
      push(result, root, configPath, "project-config", "project config is unreadable or malformed JSON");
      continue;
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      push(result, root, configPath, "project-config", "project config must be a JSON object");
      continue;
    }
    const config = raw as Record<string, unknown>;
    const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = loaded.error
      ? undefined
      : ts.parseJsonConfigFileContent(loaded.config, ts.sys, dirname(configPath));
    if (loaded.error || parsed?.errors.length)
      push(result, root, configPath, "project-config", "project config or extends graph cannot be resolved");
    const references = config.references;
    if (references !== undefined && !Array.isArray(references))
      push(result, root, configPath, "project-config", "references must be an array");
    for (const reference of Array.isArray(references) ? references : []) {
      const target =
        reference && typeof reference === "object" ? (reference as Record<string, unknown>).path : undefined;
      if (typeof target !== "string") {
        push(result, root, configPath, "project-config", "project reference must have a string path");
        continue;
      }
      const owner = owningPackage(root, configPath);
      const resolvedOwner = owningPackage(root, join(dirname(configPath), target));
      if (
        owner &&
        resolvedOwner &&
        owner !== resolvedOwner &&
        !ALLOWED_WORKSPACE_EDGES[owner].includes(EXPECTED_NAMES[resolvedOwner])
      )
        push(
          result,
          root,
          configPath,
          "workspace-edge",
          `forbidden project reference ${owner} -> ${resolvedOwner}`,
        );
    }
  }
}

function checkKernelCompiler(root: string, result: Violation[]): void {
  const configPath = join(root, "packages/kernel/tsconfig.json");
  const configInfo = inspect(configPath);
  if (!configInfo) {
    push(result, root, configPath, "kernel-tsconfig", "kernel project config is missing");
    return;
  }
  if (configInfo.isSymbolicLink() || !configInfo.isFile()) {
    push(result, root, configPath, "kernel-tsconfig", "kernel project config is not a regular file");
    return;
  }
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  if (loaded.error) {
    push(
      result,
      root,
      configPath,
      "kernel-tsconfig",
      ts.flattenDiagnosticMessageText(loaded.error.messageText, " "),
    );
    return;
  }
  const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, dirname(configPath));
  if (parsed.errors.length) {
    push(result, root, configPath, "kernel-tsconfig", "kernel project config cannot be resolved");
    return;
  }
  if (JSON.stringify(parsed.options.types ?? []) !== "[]")
    push(result, root, configPath, "kernel-tsconfig", "effective compilerOptions.types must be []");
  const libraries = (parsed.options.lib ?? []).map((value) =>
    value.toLowerCase().replace(/^lib\.|\.d\.ts$/g, ""),
  );
  if (JSON.stringify(libraries) !== JSON.stringify(["es2023"]))
    push(
      result,
      root,
      configPath,
      "kernel-tsconfig",
      "effective compilerOptions.lib must be exactly [ES2023]",
    );
}

function scan(root: string, mutation?: ScanMutation): Violation[] {
  if (mutation?.replaceScan) return mutation.replaceScan(root);
  const result: Violation[] = [];
  const packagesRoot = join(root, "packages");
  const discovered = enabled(mutation, "G0-A-INVENTORY")
    ? discover(root, result)
    : { production: new Map<PackageName, string[]>(PACKAGES.map((name) => [name, []])), tests: [] };
  for (const name of PACKAGES) {
    const packageRoot = join(packagesRoot, name);
    const options = compilerOptions(root, name);
    const files = discovered.production.get(name) ?? [];
    const program = ts.createProgram([...files], options);
    for (const file of files) analyzeFile(root, name, file, result, options, program, mutation);
    if (!enabled(mutation, "G0-F-MANIFEST-EXPORTS")) continue;
    const manifestPath = join(packageRoot, "package.json");
    const manifestInfo = inspect(manifestPath);
    if (!manifestInfo) {
      push(result, root, manifestPath, "package-location", "package has no package.json");
      continue;
    }
    if (manifestInfo.isSymbolicLink() || !manifestInfo.isFile()) {
      push(result, root, manifestPath, "package-manifest", "manifest is not a regular file");
      continue;
    }
    let value: Manifest;
    try {
      const parsed: unknown = manifest(manifestPath);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new TypeError("shape");
      value = parsed as Manifest;
    } catch {
      push(result, root, manifestPath, "package-manifest", "manifest is not a valid JSON object");
      continue;
    }
    if (value.name !== EXPECTED_NAMES[name])
      push(result, root, manifestPath, "package-name", `expected ${EXPECTED_NAMES[name]}`);
    for (const field of ["dependencies", "peerDependencies", "optionalDependencies"] as const) {
      const candidate = value[field];
      if (
        candidate !== undefined &&
        (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      )
        push(result, root, manifestPath, "package-manifest", `${field} must be an object when present`);
    }
    const dependencies = runtimeDependencies({
      ...value,
      dependencies:
        value.dependencies && typeof value.dependencies === "object" && !Array.isArray(value.dependencies)
          ? value.dependencies
          : undefined,
      peerDependencies:
        value.peerDependencies &&
        typeof value.peerDependencies === "object" &&
        !Array.isArray(value.peerDependencies)
          ? value.peerDependencies
          : undefined,
      optionalDependencies:
        value.optionalDependencies &&
        typeof value.optionalDependencies === "object" &&
        !Array.isArray(value.optionalDependencies)
          ? value.optionalDependencies
          : undefined,
    } as Manifest);
    if (name === "kernel" && dependencies.length)
      push(
        result,
        root,
        manifestPath,
        "runtime-dependencies",
        `kernel must have none; found [${dependencies.join(", ")}]`,
      );
    const workspaceDependencies = dependencies.filter((dependency) => dependency.startsWith("@loredu/"));
    for (const dependency of workspaceDependencies)
      if (!ALLOWED_WORKSPACE_EDGES[name].includes(dependency))
        push(
          result,
          root,
          manifestPath,
          "workspace-edge",
          `forbidden manifest edge ${name} -> ${dependency}`,
        );
    for (const required of REQUIRED_WORKSPACE_EDGES[name])
      if (!workspaceDependencies.includes(required))
        push(
          result,
          root,
          manifestPath,
          "workspace-edge",
          `missing required manifest edge ${name} -> ${required}`,
        );
    const expected = EXPECTED_EXPORTS[name];
    const actualExports = value.exports ?? {};
    const sameExports =
      actualExports !== null &&
      typeof actualExports === "object" &&
      !Array.isArray(actualExports) &&
      JSON.stringify(Object.entries(actualExports).sort(([left], [right]) => left.localeCompare(right))) ===
        JSON.stringify(Object.entries(expected).sort(([left], [right]) => left.localeCompare(right)));
    if (!sameExports)
      push(result, root, manifestPath, "package-exports", `exports must equal ${JSON.stringify(expected)}`);
    for (const [key, target] of Object.entries(expected)) {
      const targetPath = join(packageRoot, target);
      const targetInfo = inspect(targetPath);
      if (!targetInfo || targetInfo.isSymbolicLink() || !targetInfo.isFile())
        push(result, root, manifestPath, "package-exports", `export ${key} target does not exist: ${target}`);
    }
  }
  if (enabled(mutation, "G0-E-CONFIG-GRAPH")) checkConfigGraph(root, result);
  if (enabled(mutation, "G0-E-COMPILER")) checkKernelCompiler(root, result);
  return result.sort((left, right) =>
    `${left.path}:${left.rule}:${left.detail}`.localeCompare(`${right.path}:${right.rule}:${right.detail}`),
  );
}
export function scanWorkspace(root: string): Violation[] {
  return scan(root);
}

/** Test-only pre-execution mutation seam; the CLI always calls the complete registry. */
export function scanWorkspaceWithDisabledCheckForTest(root: string, disabled: BoundaryCheckId): Violation[] {
  return scan(root, { disabled: new Set([disabled]) });
}
export function scanWorkspaceWithTrivialMutantForTest(root: string): Violation[] {
  return scan(root, { replaceScan: () => [] });
}

export function formatViolations(violations: readonly Violation[]): string {
  return violations.map((item) => `${item.path}: [${item.rule}] ${item.detail}`).join("\n");
}

const invokedPath = process.argv[1];
if (invokedPath && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(invokedPath)) {
  const root = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "..");
  const violations = scanWorkspace(root);
  if (violations.length) {
    console.error(formatViolations(violations));
    process.exit(1);
  }
  console.log("workspace boundaries: ok");
}
