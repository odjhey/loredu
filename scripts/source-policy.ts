import { readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import ts from "typescript";

export const EXECUTABLE_SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
] as const;

const executableExtensions = new Set<string>(EXECUTABLE_SOURCE_EXTENSIONS);

export interface SourceDiscoveryProblem {
  readonly file: string;
  readonly message: string;
}

export interface SourceDiscovery {
  readonly files: readonly string[];
  readonly problems: readonly SourceDiscoveryProblem[];
}

export function scriptKindFor(file: string): ts.ScriptKind {
  const extension = extname(file).toLowerCase();
  if (extension === ".tsx") return ts.ScriptKind.TSX;
  if (extension === ".jsx") return ts.ScriptKind.JSX;
  if ([".js", ".mjs", ".cjs"].includes(extension)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

export function discoverExecutableSources(
  sourceRoot: string,
  repoRoot: string,
  requireSource = true,
): SourceDiscovery {
  const files: string[] = [];
  const problems: SourceDiscoveryProblem[] = [];

  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      const displayPath = relative(repoRoot, path).replaceAll("\\", "/") || path;
      if (entry.isSymbolicLink()) {
        problems.push({
          file: displayPath,
          message: "symbolic link in a production source tree cannot be checked safely",
        });
      } else if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile()) {
        const extension = extname(entry.name).toLowerCase();
        if (executableExtensions.has(extension)) {
          files.push(path);
        } else {
          problems.push({
            file: displayPath,
            message: `unrecognized production source extension ${extension || "<none>"}; add it to the executable source policy or move the file out of production sources`,
          });
        }
      } else {
        problems.push({
          file: displayPath,
          message: "unsupported production source entry cannot be checked safely",
        });
      }
    }
  };

  try {
    visit(sourceRoot);
  } catch (error) {
    problems.push({
      file: relative(repoRoot, sourceRoot).replaceAll("\\", "/") || sourceRoot,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (requireSource && files.length === 0 && problems.length === 0) {
    problems.push({
      file: relative(repoRoot, sourceRoot).replaceAll("\\", "/") || sourceRoot,
      message: "no production source files found",
    });
  }

  return { files: files.sort(), problems };
}
