import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import ts from "typescript";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx"]);

export interface CapabilityProblem {
  readonly capability: "Date.now" | "new Date" | "Math.random" | "source-parse" | "source-tree";
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
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

function staticMember(expression: ts.Expression): { object: ts.Expression; property: string } | undefined {
  const current = unwrap(expression);
  if (ts.isPropertyAccessExpression(current)) {
    return { object: current.expression, property: current.name.text };
  }
  if (ts.isElementAccessExpression(current) && current.argumentExpression) {
    const argument = unwrap(current.argumentExpression);
    if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
      return { object: current.expression, property: argument.text };
    }
  }
  return undefined;
}

function isAmbientObject(expression: ts.Expression, name: "Date" | "Math"): boolean {
  const current = unwrap(expression);
  if (ts.isIdentifier(current)) return current.text === name;

  const member = staticMember(current);
  return (
    member?.property === name &&
    ts.isIdentifier(unwrap(member.object)) &&
    (unwrap(member.object) as ts.Identifier).text === "globalThis"
  );
}

function isAmbientMember(
  expression: ts.Expression,
  object: "Date" | "Math",
  property: "now" | "random",
): boolean {
  const member = staticMember(expression);
  return member?.property === property && isAmbientObject(member.object, object);
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

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

export function scanKernelSource(text: string, file = "kernel-source.ts"): CapabilityProblem[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  const parseDiagnostics = (source as ts.SourceFile & { readonly parseDiagnostics: readonly ts.Diagnostic[] })
    .parseDiagnostics;
  const problems: CapabilityProblem[] = parseDiagnostics.map((diagnostic) => {
    const start = diagnostic.start ?? 0;
    const position = source.getLineAndCharacterOfPosition(start);
    return {
      capability: "source-parse",
      file,
      line: position.line + 1,
      column: position.character + 1,
      message: `cannot prove the capability boundary because the source does not parse: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
    };
  });

  const visit = (node: ts.Node): void => {
    if (
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      isAmbientMember(node, "Date", "now")
    ) {
      problems.push(
        problemAt(source, file, node, "Date.now", "ambient time read Date.now is forbidden; inject Clock"),
      );
      return;
    }

    if (
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      isAmbientMember(node, "Math", "random")
    ) {
      problems.push(
        problemAt(
          source,
          file,
          node,
          "Math.random",
          "ambient randomness read Math.random is forbidden; inject RandomSource",
        ),
      );
      return;
    }

    if (ts.isNewExpression(node) && isAmbientObject(node.expression, "Date")) {
      const args = node.arguments;
      if (!args || args.length === 0) {
        problems.push(
          problemAt(
            source,
            file,
            node,
            "new Date",
            "zero-argument new Date is forbidden because it reads ambient time; pass an explicit value",
          ),
        );
      } else if (args.some(ts.isSpreadElement)) {
        problems.push(
          problemAt(
            source,
            file,
            node,
            "new Date",
            "spread arguments to new Date cannot prove an explicit value; pass an explicit non-spread value",
          ),
        );
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(source);
  return problems;
}

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  const visit = (current: string): void => {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`symbolic link in kernel production tree cannot be checked safely: ${path}`);
      }
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path);
    }
  };
  visit(dir);
  return files.sort();
}

export function scanKernelProduction(repoRoot: string): CapabilityProblem[] {
  const productionRoot = join(repoRoot, "packages", "kernel", "src");
  let files: string[];
  try {
    files = sourceFiles(productionRoot);
  } catch (error) {
    return [
      {
        capability: "source-tree",
        file: relative(repoRoot, productionRoot) || productionRoot,
        line: 1,
        column: 1,
        message: `cannot prove the kernel capability boundary: ${error instanceof Error ? error.message : String(error)}`,
      },
    ];
  }

  if (files.length === 0) {
    return [
      {
        capability: "source-tree",
        file: relative(repoRoot, productionRoot),
        line: 1,
        column: 1,
        message: "cannot prove the kernel capability boundary: no production source files found",
      },
    ];
  }

  return files.flatMap((file) =>
    scanKernelSource(readFileSync(file, "utf8"), relative(repoRoot, file).replaceAll("\\", "/")),
  );
}
