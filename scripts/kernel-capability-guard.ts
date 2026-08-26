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
  const dateSymbol = values.find((symbol) => symbol.name === "Date");
  const mathSymbol = values.find((symbol) => symbol.name === "Math");
  const globalThisSymbol = values.find((symbol) => symbol.name === "globalThis");
  return dateSymbol && mathSymbol && globalThisSymbol
    ? { Date: dateSymbol, Math: mathSymbol, globalThis: globalThisSymbol }
    : undefined;
}

function ambientObject(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  globals: AmbientSymbols,
): AmbientObject | undefined {
  const current = unwrap(expression);
  if (ts.isIdentifier(current)) {
    const symbol = checker.getSymbolAtLocation(current);
    if (symbol === globals.Date) return "Date";
    if (symbol === globals.Math) return "Math";
    if (symbol === globals.globalThis) return "globalThis";
    return undefined;
  }

  const member = staticMember(current);
  if (member && ambientObject(member.object, checker, globals) === "globalThis") {
    if (member.property === "Date") return "Date";
    if (member.property === "Math") return "Math";
  }
  return undefined;
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

function scanSource(
  source: ts.SourceFile,
  displayFile: string,
  checker: ts.TypeChecker,
  globals: AmbientSymbols,
): CapabilityProblem[] {
  const problems: CapabilityProblem[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isTypeNode(node)) return;

    if (ts.isCallExpression(node) && ambientObject(node.expression, checker, globals) === "Date") {
      problems.push(
        problemAt(
          source,
          displayFile,
          node,
          "new Date",
          "calling ambient Date reads ambient time even with arguments; inject Clock",
        ),
      );
      return;
    }

    if (ts.isNewExpression(node) && ambientObject(node.expression, checker, globals) === "Date") {
      const args = node.arguments;
      if (!args || args.length === 0) {
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            "new Date",
            "zero-argument new Date is forbidden because it reads ambient time; pass an explicit value",
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
            "spread arguments to new Date cannot prove an explicit value; pass an explicit non-spread value",
          ),
        );
        return;
      }
    }

    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const member = staticMember(node);
      const object = member && ambientObject(member.object, checker, globals);
      if (object === "Date" && member?.property === "now") {
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            "Date.now",
            "ambient time read Date.now is forbidden; inject Clock",
          ),
        );
        return;
      }
      if (object === "Math" && member?.property === "random") {
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            "Math.random",
            "ambient randomness read Math.random is forbidden; inject RandomSource",
          ),
        );
        return;
      }
      if (object && member?.property === undefined) {
        const capability =
          object === "Date" ? "Date escape" : object === "Math" ? "Math escape" : "globalThis escape";
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            capability,
            `dynamic member access on ambient ${object} cannot prove the capability boundary; use a static deterministic member or an injected port`,
          ),
        );
        return;
      }
      if (object === "Date" && !ALLOWED_DATE_MEMBERS.has(member?.property ?? "")) {
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            "Date escape",
            `ambient Date member ${member?.property} is not a permitted deterministic operation; use Date.parse, Date.UTC, or an injected Clock`,
          ),
        );
        return;
      }
      if (object === "Math" && !ALLOWED_MATH_MEMBERS.has(member?.property ?? "")) {
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            "Math escape",
            `ambient Math member ${member?.property} is not a permitted deterministic operation; use a known deterministic Math operation or an injected RandomSource`,
          ),
        );
        return;
      }
      if (object === "globalThis" && !["Date", "Math"].includes(member?.property ?? "")) {
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            "globalThis escape",
            "ambient globalThis access escapes capability inspection; use an injected port",
          ),
        );
        return;
      }
    }

    if (
      (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      !(ts.isIdentifier(node) && ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
    ) {
      const object = ambientObject(node, checker, globals);
      if (object && !objectUseIsInspected(node, object)) {
        const capability =
          object === "Date" ? "Date escape" : object === "Math" ? "Math escape" : "globalThis escape";
        problems.push(
          problemAt(
            source,
            displayFile,
            node,
            capability,
            `ambient ${object} object escapes static capability inspection; use an injected port instead of aliasing or destructuring it`,
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
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2023,
    types: [],
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
        problems.push(...scanSource(source, displayFile, checker, globals));
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
