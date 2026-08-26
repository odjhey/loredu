import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { discoverExecutableSources, scriptKindFor } from "./source-policy";

type AmbientObject = "Date" | "Math" | "globalThis";

const ALLOWED_DATE_MEMBERS = new Set(["parse", "UTC"]);
const ALLOWED_MATH_MEMBERS = new Set([
  "E",
  "LN10",
  "LN2",
  "LOG10E",
  "LOG2E",
  "PI",
  "SQRT1_2",
  "SQRT2",
  "abs",
  "acos",
  "acosh",
  "asin",
  "asinh",
  "atan",
  "atan2",
  "atanh",
  "cbrt",
  "ceil",
  "clz32",
  "cos",
  "cosh",
  "exp",
  "expm1",
  "floor",
  "fround",
  "hypot",
  "imul",
  "log",
  "log10",
  "log1p",
  "log2",
  "max",
  "min",
  "pow",
  "round",
  "sign",
  "sin",
  "sinh",
  "sqrt",
  "tan",
  "tanh",
  "trunc",
]);

export interface CapabilityProblem {
  readonly capability:
    | "Date.now"
    | "new Date"
    | "Date escape"
    | "Math.random"
    | "Math escape"
    | "globalThis escape"
    | "source-analysis"
    | "source-parse"
    | "source-read"
    | "source-tree";
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

export interface CapabilityScanOptions {
  readonly readFile?: (file: string) => string;
}

interface AmbientSymbols {
  readonly Date: ts.Symbol;
  readonly Math: ts.Symbol;
  readonly globalThis: ts.Symbol;
}

type EmissionState = "runtime" | "erased" | "uncertain";

interface EmissionClassification {
  readonly state: EmissionState;
  readonly reason: string;
}

interface DeclarationClassification extends EmissionClassification {
  readonly category: string;
}

interface AmbientResolution {
  readonly object?: AmbientObject;
  readonly erasedReason?: string;
  readonly uncertainty?: string;
}

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function outerExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    current.parent &&
    (ts.isParenthesizedExpression(current.parent) ||
      ts.isAsExpression(current.parent) ||
      ts.isTypeAssertionExpression(current.parent) ||
      ts.isNonNullExpression(current.parent) ||
      ts.isSatisfiesExpression(current.parent)) &&
    current.parent.expression === current
  ) {
    current = current.parent;
  }
  return current;
}

function staticMember(expression: ts.Expression): { object: ts.Expression; property?: string } | undefined {
  const current = unwrap(expression);
  if (ts.isPropertyAccessExpression(current)) {
    return { object: current.expression, property: current.name.text };
  }
  if (ts.isElementAccessExpression(current)) {
    const argument = current.argumentExpression && unwrap(current.argumentExpression);
    return {
      object: current.expression,
      ...(argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
        ? { property: argument.text }
        : {}),
    };
  }
  return undefined;
}

function ambientSymbols(program: ts.Program, checker: ts.TypeChecker): AmbientSymbols | undefined {
  const library = program
    .getSourceFiles()
    .find((source) => source.isDeclarationFile && /lib\.es5\.d\.ts$/.test(source.fileName));
  if (!library) return undefined;
  const values = checker.getSymbolsInScope(library, ts.SymbolFlags.Value);
  const exactlyOne = (name: string): ts.Symbol | undefined => {
    const matches = values.filter((symbol) => symbol.name === name);
    return matches.length === 1 ? matches[0] : undefined;
  };
  const dateSymbol = exactlyOne("Date");
  const mathSymbol = exactlyOne("Math");
  const globalThisSymbol = exactlyOne("globalThis");
  return dateSymbol && mathSymbol && globalThisSymbol
    ? { Date: dateSymbol, Math: mathSymbol, globalThis: globalThisSymbol }
    : undefined;
}

function hasDeclareModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword) ?? false)
  );
}

function isAmbientContext(node: ts.Node): boolean {
  let current: ts.Node | undefined = node;
  while (current) {
    if (current.getSourceFile().isDeclarationFile) return true;
    if (
      (ts.canHaveModifiers(current) &&
        (ts.getCombinedModifierFlags(current as ts.Declaration) & ts.ModifierFlags.Ambient) !== 0) ||
      hasDeclareModifier(current)
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function enclosingRuntimeBinding(node: ts.Node): ts.Node | undefined {
  let current: ts.Node | undefined = node;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isParameter(current) || ts.isVariableDeclaration(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function functionLikeHasBody(node: ts.Node): boolean {
  let current: ts.Node | undefined = node;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isFunctionLike(current)) return "body" in current && current.body !== undefined;
    current = current.parent;
  }
  return false;
}

function importIsTypeOnly(declaration: ts.Declaration): boolean {
  if (ts.isImportClause(declaration)) return declaration.isTypeOnly;
  if (ts.isImportSpecifier(declaration)) {
    return declaration.isTypeOnly || declaration.parent.parent.isTypeOnly;
  }
  if (ts.isNamespaceImport(declaration)) return declaration.parent.isTypeOnly;
  if (ts.isImportEqualsDeclaration(declaration)) return declaration.isTypeOnly;
  if (ts.isExportSpecifier(declaration)) {
    return declaration.isTypeOnly || declaration.parent.parent.isTypeOnly;
  }
  return false;
}

function isAliasDeclaration(declaration: ts.Declaration): boolean {
  return (
    ts.isImportClause(declaration) ||
    ts.isImportSpecifier(declaration) ||
    ts.isNamespaceImport(declaration) ||
    ts.isImportEqualsDeclaration(declaration) ||
    ts.isExportSpecifier(declaration) ||
    ts.isNamespaceExport(declaration)
  );
}

function declarationClassification(declaration: ts.Declaration): DeclarationClassification {
  if (ts.isSourceFile(declaration)) {
    return declaration.isDeclarationFile
      ? { state: "erased", category: "source-module", reason: "declaration-file module is erased" }
      : { state: "runtime", category: "source-module", reason: "concrete source module is emitted" };
  }

  if (isAmbientContext(declaration)) {
    return {
      state: "erased",
      category: "ambient",
      reason: "ambient or declaration-file declaration is erased",
    };
  }
  if (
    ts.isInterfaceDeclaration(declaration) ||
    ts.isTypeAliasDeclaration(declaration) ||
    ts.isTypeParameterDeclaration(declaration)
  ) {
    return { state: "erased", category: "type-only", reason: "type-only declaration is erased" };
  }
  if (ts.isVariableDeclaration(declaration)) {
    return { state: "runtime", category: "variable", reason: "ordinary variable binding is emitted" };
  }
  if (ts.isBindingElement(declaration)) {
    const owner = enclosingRuntimeBinding(declaration);
    if (!owner) {
      return { state: "uncertain", category: "binding", reason: "binding element has no runtime owner" };
    }
    if (ts.isParameter(owner) && !functionLikeHasBody(owner)) {
      return { state: "erased", category: "parameter", reason: "parameter belongs to a body-less signature" };
    }
    return { state: "runtime", category: "binding", reason: "destructuring binding is emitted" };
  }
  if (ts.isParameter(declaration)) {
    return functionLikeHasBody(declaration)
      ? { state: "runtime", category: "parameter", reason: "function parameter binding is emitted" }
      : { state: "erased", category: "parameter", reason: "parameter belongs to a body-less signature" };
  }
  if (ts.isClassDeclaration(declaration) || ts.isClassExpression(declaration)) {
    return { state: "runtime", category: "class", reason: "ordinary class declaration is emitted" };
  }
  if (
    ts.isFunctionDeclaration(declaration) ||
    ts.isFunctionExpression(declaration) ||
    ts.isArrowFunction(declaration)
  ) {
    return declaration.body
      ? { state: "runtime", category: "function", reason: "body-bearing function is emitted" }
      : { state: "erased", category: "function", reason: "body-less function signature is erased" };
  }
  if (ts.isModuleDeclaration(declaration)) {
    return declaration.body
      ? { state: "runtime", category: "namespace", reason: "ordinary namespace/module body is emitted" }
      : { state: "uncertain", category: "namespace", reason: "namespace/module declaration has no body" };
  }
  if (ts.isEnumDeclaration(declaration)) {
    const isConst = (ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Const) !== 0;
    return isConst
      ? { state: "erased", category: "enum", reason: "const enum is erased with preserveConstEnums false" }
      : { state: "runtime", category: "enum", reason: "ordinary enum is emitted" };
  }
  if (isAliasDeclaration(declaration)) {
    return importIsTypeOnly(declaration)
      ? { state: "erased", category: "alias", reason: "type-only import/export alias is erased" }
      : { state: "runtime", category: "alias", reason: "ordinary import/export alias is emitted" };
  }

  return {
    state: "uncertain",
    category: ts.SyntaxKind[declaration.kind] ?? "unknown",
    reason: `unsupported declaration kind ${ts.SyntaxKind[declaration.kind] ?? declaration.kind}`,
  };
}

class EmissionClassifier {
  readonly #memo = new Map<ts.Symbol, EmissionClassification>();
  readonly #visiting = new Set<ts.Symbol>();

  constructor(
    readonly checker: ts.TypeChecker,
    readonly globals: AmbientSymbols,
  ) {}

  classify(symbol: ts.Symbol): EmissionClassification {
    const memoized = this.#memo.get(symbol);
    if (memoized) return memoized;
    if (this.#visiting.has(symbol)) {
      return { state: "uncertain", reason: `alias/declaration cycle at ${symbol.name}` };
    }

    this.#visiting.add(symbol);
    let result: EmissionClassification;
    try {
      result =
        (symbol.flags & ts.SymbolFlags.Alias) !== 0
          ? this.#classifyAlias(symbol)
          : this.#classifyDeclarations(symbol);
    } catch (error) {
      result = {
        state: "uncertain",
        reason: `binding analysis threw for ${symbol.name}: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      this.#visiting.delete(symbol);
    }
    this.#memo.set(symbol, result);
    return result;
  }

  #declarations(symbol: ts.Symbol): ts.Declaration[] {
    const declarations = new Set<ts.Declaration>(symbol.declarations ?? []);
    if (symbol.valueDeclaration) declarations.add(symbol.valueDeclaration);
    return [...declarations];
  }

  #classifyAlias(symbol: ts.Symbol): EmissionClassification {
    const declarations = this.#declarations(symbol);
    if (declarations.length === 0) {
      return { state: "uncertain", reason: `alias ${symbol.name} has no declaration set` };
    }
    if (declarations.some((declaration) => !isAliasDeclaration(declaration))) {
      return {
        state: "uncertain",
        reason: `alias ${symbol.name} has a mixed or unsupported declaration set`,
      };
    }
    const local = declarations.map(declarationClassification);
    if (local.some((classification) => classification.state === "uncertain")) {
      return {
        state: "uncertain",
        reason: `alias ${symbol.name} has unsupported local declarations: ${local.map((item) => item.reason).join("; ")}`,
      };
    }
    if (local.some((classification) => classification.state === "erased")) {
      return { state: "erased", reason: `type-only/declaration-only alias ${symbol.name} is erased` };
    }

    let target: ts.Symbol;
    try {
      target = this.checker.getAliasedSymbol(symbol);
    } catch (error) {
      return {
        state: "uncertain",
        reason: `cannot resolve alias ${symbol.name}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    if (
      !target ||
      target === symbol ||
      (target.name === "unknown" && !target.valueDeclaration && (target.declarations?.length ?? 0) === 0)
    ) {
      return { state: "uncertain", reason: `alias ${symbol.name} is unresolved or cyclic` };
    }
    if (target === this.globals.Date || target === this.globals.Math || target === this.globals.globalThis) {
      return { state: "erased", reason: `alias ${symbol.name} resolves to a canonical ambient binding` };
    }

    const targetClassification = this.classify(target);
    return targetClassification.state === "runtime"
      ? { state: "runtime", reason: `ordinary alias ${symbol.name} resolves to emitted runtime code` }
      : {
          state: targetClassification.state,
          reason: `alias ${symbol.name} target is ${targetClassification.state}: ${targetClassification.reason}`,
        };
  }

  #classifyDeclarations(symbol: ts.Symbol): EmissionClassification {
    const declarations = this.#declarations(symbol);
    if (declarations.length === 0) {
      return { state: "uncertain", reason: `symbol ${symbol.name} has no declaration set` };
    }

    if (declarations.every(ts.isFunctionDeclaration)) {
      const bodies = declarations.filter((declaration) => declaration.body !== undefined);
      if (bodies.length === 0) {
        return { state: "erased", reason: `all declarations for ${symbol.name} are body-less signatures` };
      }
      if (bodies.length !== 1) {
        return { state: "uncertain", reason: `function ${symbol.name} has ${bodies.length} implementations` };
      }
      if (isAmbientContext(bodies[0] as ts.FunctionDeclaration)) {
        return { state: "uncertain", reason: `function ${symbol.name} implementation is ambient` };
      }
      const signatures = declarations.filter((declaration) => declaration.body === undefined);
      if (signatures.some(isAmbientContext)) {
        return {
          state: "uncertain",
          reason: `function ${symbol.name} mixes ambient signatures with an implementation`,
        };
      }
      return { state: "runtime", reason: `function ${symbol.name} has one emitted implementation` };
    }

    const classified = declarations.map(declarationClassification);
    const uncertain = classified.find((classification) => classification.state === "uncertain");
    if (uncertain) {
      return { state: "uncertain", reason: `${symbol.name}: ${uncertain.reason}` };
    }
    const states = new Set(classified.map((classification) => classification.state));
    if (states.size > 1) {
      return {
        state: "uncertain",
        reason: `${symbol.name} mixes emitted and erased declarations: ${classified.map((item) => item.reason).join("; ")}`,
      };
    }
    if (states.has("erased")) {
      return {
        state: "erased",
        reason: `${symbol.name} is declaration-only: ${classified.map((item) => item.reason).join("; ")}`,
      };
    }
    const categories = new Set(classified.map((classification) => classification.category));
    return categories.size === 1
      ? {
          state: "runtime",
          reason: `${symbol.name} has definitely emitted ${[...categories][0]} declarations`,
        }
      : {
          state: "uncertain",
          reason: `${symbol.name} has unsupported mixed runtime declarations: ${[...categories].join(", ")}`,
        };
  }
}

function dangerousName(identifier: ts.Identifier): AmbientObject | undefined {
  return identifier.text === "Date" || identifier.text === "Math" || identifier.text === "globalThis"
    ? identifier.text
    : undefined;
}

function ambientObject(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  globals: AmbientSymbols,
  classifier: EmissionClassifier,
): AmbientResolution {
  const current = unwrap(expression);
  if (ts.isIdentifier(current)) {
    const name = dangerousName(current);
    if (!name) return {};
    const symbol = ts.isShorthandPropertyAssignment(current.parent)
      ? checker.getShorthandAssignmentValueSymbol(current.parent)
      : checker.getSymbolAtLocation(current);
    if (!symbol) return { uncertainty: `cannot resolve value binding for ${name}` };
    if (symbol === globals[name]) return { object: name };

    const classification = classifier.classify(symbol);
    if (classification.state === "runtime") return {};
    if (classification.state === "uncertain") {
      return { uncertainty: `${name} binding is uncertain: ${classification.reason}` };
    }
    return { object: name, erasedReason: `${name} binding is erased: ${classification.reason}` };
  }

  const member = staticMember(current);
  if (member) {
    const object = ambientObject(member.object, checker, globals, classifier);
    if (object.uncertainty) return object;
    if (object.object === "globalThis") {
      if (member.property === "Date") {
        return { object: "Date", ...(object.erasedReason ? { erasedReason: object.erasedReason } : {}) };
      }
      if (member.property === "Math") {
        return { object: "Math", ...(object.erasedReason ? { erasedReason: object.erasedReason } : {}) };
      }
    }
  }
  return {};
}

function problemAt(
  source: ts.SourceFile,
  file: string,
  node: ts.Node,
  capability: CapabilityProblem["capability"],
  message: string,
): CapabilityProblem {
  const position = source.getLineAndCharacterOfPosition(node.getStart(source));
  return {
    capability,
    file,
    line: position.line + 1,
    column: position.character + 1,
    message,
  };
}

function objectUseIsInspected(expression: ts.Expression, object: AmbientObject): boolean {
  const outer = outerExpression(expression);
  const parent = outer.parent;
  if (
    (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
    parent.expression === outer
  ) {
    return true;
  }
  if (object === "Date" && ts.isNewExpression(parent) && parent.expression === outer) return true;
  if (
    object === "Date" &&
    ts.isBinaryExpression(parent) &&
    parent.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
    parent.right === outer
  ) {
    return true;
  }
  if (object === "Date" && ts.isTypeOfExpression(parent) && parent.expression === outer) return true;
  return false;
}

function identifierIsNonValuePosition(identifier: ts.Identifier): boolean {
  const parent = identifier.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === identifier) return true;
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) return true;
  if (ts.isImportClause(parent) || ts.isNamespaceImport(parent) || ts.isImportEqualsDeclaration(parent)) {
    return true;
  }
  if (
    (ts.isLabeledStatement(parent) || ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) &&
    parent.label === identifier
  ) {
    return true;
  }
  if (ts.isBindingElement(parent) && parent.propertyName === identifier) return true;
  if (!ts.isShorthandPropertyAssignment(parent)) {
    const named = parent as ts.NamedDeclaration;
    if (named.name === identifier) return true;
  }
  return false;
}

function scanSource(
  source: ts.SourceFile,
  displayFile: string,
  checker: ts.TypeChecker,
  globals: AmbientSymbols,
  classifier: EmissionClassifier,
): CapabilityProblem[] {
  const problems: CapabilityProblem[] = [];

  const resolveAmbient = (expression: ts.Expression): AmbientResolution =>
    ambientObject(expression, checker, globals, classifier);
  const failOnUncertainty = (node: ts.Node, resolution: AmbientResolution): boolean => {
    if (!resolution.uncertainty) return false;
    problems.push(
      problemAt(
        source,
        displayFile,
        node,
        "source-analysis",
        `cannot prove whether a dangerous binding is emitted: ${resolution.uncertainty}`,
      ),
    );
    return true;
  };
  const withBindingReason = (message: string, resolution: AmbientResolution): string =>
    resolution.erasedReason ? `${message}; ${resolution.erasedReason}` : message;

  const visit = (node: ts.Node): void => {
    if (ts.isTypeNode(node)) return;

    if (ts.isCallExpression(node)) {
      const callee = resolveAmbient(node.expression);
      if (failOnUncertainty(node.expression, callee)) return;
      if (callee.object === "Date") {
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            "new Date",
            withBindingReason(
              "calling ambient Date reads ambient time even with arguments; inject Clock",
              callee,
            ),
          ),
        );
        return;
      }
    }

    if (ts.isNewExpression(node)) {
      const constructorResolution = resolveAmbient(node.expression);
      if (failOnUncertainty(node.expression, constructorResolution)) return;
      if (constructorResolution.object === "Date") {
        const args = node.arguments;
        if (!args || args.length === 0) {
          problems.push(
            problemAt(
              source,
              displayFile,
              node,
              "new Date",
              withBindingReason(
                "zero-argument new Date is forbidden because it reads ambient time; pass an explicit value",
                constructorResolution,
              ),
            ),
          );
          return;
        }
        if (args.some(ts.isSpreadElement)) {
          problems.push(
            problemAt(
              source,
              displayFile,
              node,
              "new Date",
              withBindingReason(
                "spread arguments to new Date cannot prove an explicit value; pass an explicit non-spread value",
                constructorResolution,
              ),
            ),
          );
          return;
        }
      }
    }

    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const member = staticMember(node);
      const object = member ? resolveAmbient(member.object) : {};
      if (member && failOnUncertainty(member.object, object)) return;
      if (object.object === "Date" && member?.property === "now") {
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            "Date.now",
            withBindingReason("ambient time read Date.now is forbidden; inject Clock", object),
          ),
        );
        return;
      }
      if (object.object === "Math" && member?.property === "random") {
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            "Math.random",
            withBindingReason(
              "ambient randomness read Math.random is forbidden; inject RandomSource",
              object,
            ),
          ),
        );
        return;
      }
      if (object.object && member?.property === undefined) {
        const capability =
          object.object === "Date"
            ? "Date escape"
            : object.object === "Math"
              ? "Math escape"
              : "globalThis escape";
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            capability,
            withBindingReason(
              `dynamic member access on ambient ${object.object} cannot prove the capability boundary; use a static deterministic member or an injected port`,
              object,
            ),
          ),
        );
        return;
      }
      if (object.object === "Date" && !ALLOWED_DATE_MEMBERS.has(member?.property ?? "")) {
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            "Date escape",
            withBindingReason(
              `ambient Date member ${member?.property} is not a permitted deterministic operation; use Date.parse, Date.UTC, or an injected Clock`,
              object,
            ),
          ),
        );
        return;
      }
      if (object.object === "Math" && !ALLOWED_MATH_MEMBERS.has(member?.property ?? "")) {
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            "Math escape",
            withBindingReason(
              `ambient Math member ${member?.property} is not a permitted deterministic operation; use a known deterministic Math operation or an injected RandomSource`,
              object,
            ),
          ),
        );
        return;
      }
      if (object.object === "globalThis" && !["Date", "Math"].includes(member?.property ?? "")) {
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            "globalThis escape",
            withBindingReason(
              "ambient globalThis access escapes capability inspection; use an injected port",
              object,
            ),
          ),
        );
        return;
      }
    }

    if (
      (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      !(ts.isIdentifier(node) && identifierIsNonValuePosition(node))
    ) {
      const object = resolveAmbient(node);
      if (failOnUncertainty(node, object)) return;
      if (object.object && !objectUseIsInspected(node, object.object)) {
        const capability =
          object.object === "Date"
            ? "Date escape"
            : object.object === "Math"
              ? "Math escape"
              : "globalThis escape";
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            capability,
            withBindingReason(
              `ambient ${object.object} object escapes static capability inspection; use an injected port instead of aliasing or destructuring it`,
              object,
            ),
          ),
        );
        return;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return problems;
}

export function scanKernelProduction(
  repoRoot: string,
  options: CapabilityScanOptions = {},
): CapabilityProblem[] {
  const productionRoot = join(repoRoot, "packages", "kernel", "src");
  const discovery = discoverExecutableSources(productionRoot, repoRoot);
  const problems: CapabilityProblem[] = discovery.problems.map((problem) => ({
    capability: "source-tree",
    file: problem.file,
    line: 1,
    column: 1,
    message: `cannot prove the kernel capability boundary: ${problem.message}`,
  }));
  if (problems.length > 0) return problems;

  const readFile = options.readFile ?? ((file: string) => readFileSync(file, "utf8"));
  const sourceTexts = new Map<string, string>();
  for (const file of discovery.files) {
    try {
      sourceTexts.set(resolve(file), readFile(file));
    } catch (error) {
      problems.push({
        capability: "source-read",
        file: relative(repoRoot, file).replaceAll("\\", "/"),
        line: 1,
        column: 1,
        message: `cannot read production source: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
  if (problems.length > 0) return problems;

  const compilerOptions: ts.CompilerOptions = {
    allowJs: true,
    checkJs: true,
    module: ts.ModuleKind.ESNext,
    moduleDetection: ts.ModuleDetectionKind.Force,
    isolatedModules: true,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    preserveConstEnums: false,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2023,
    types: [],
    verbatimModuleSyntax: true,
  };
  const host = ts.createCompilerHost(compilerOptions, true);
  const defaultGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const text = sourceTexts.get(resolve(fileName));
    return text === undefined
      ? defaultGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
      : ts.createSourceFile(fileName, text, languageVersion, true, scriptKindFor(fileName));
  };

  try {
    const program = ts.createProgram([...sourceTexts.keys()], compilerOptions, host);
    const checker = program.getTypeChecker();
    const globals = ambientSymbols(program, checker);
    if (!globals) {
      return [
        {
          capability: "source-analysis",
          file: "packages/kernel/src",
          line: 1,
          column: 1,
          message: "cannot resolve the ambient Date, Math, and globalThis bindings",
        },
      ];
    }
    const classifier = new EmissionClassifier(checker, globals);

    for (const file of sourceTexts.keys()) {
      const source = program.getSourceFile(file);
      const displayFile = relative(repoRoot, file).replaceAll("\\", "/");
      if (!source) {
        problems.push({
          capability: "source-analysis",
          file: displayFile,
          line: 1,
          column: 1,
          message: "TypeScript did not include a discovered production source",
        });
        continue;
      }
      for (const diagnostic of program.getSyntacticDiagnostics(source)) {
        const start = diagnostic.start ?? 0;
        const position = source.getLineAndCharacterOfPosition(start);
        problems.push({
          capability: "source-parse",
          file: displayFile,
          line: position.line + 1,
          column: position.character + 1,
          message: `cannot prove the capability boundary because the source does not parse: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
        });
      }
      if (
        !problems.some((problem) => problem.file === displayFile && problem.capability === "source-parse")
      ) {
        problems.push(...scanSource(source, displayFile, checker, globals, classifier));
      }
    }
  } catch (error) {
    problems.push({
      capability: "source-analysis",
      file: "packages/kernel/src",
      line: 1,
      column: 1,
      message: `cannot analyze production sources: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return problems;
}
