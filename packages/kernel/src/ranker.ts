import type { Ranker, WorkingLoreRankContext } from "./application-types";
import { escapePointer, inspectArray, isScalarText, makeIssue, scalarLength } from "./domain/portable-json";
import { LoreduError, type LoreduIssue } from "./errors";

const TOKEN = /^[a-z0-9](?:[a-z0-9._:/-]*[a-z0-9])?$/;
const FIELDS = new Set(["id", "version", "rank"]);
const PROTOTYPE_LIMIT = 32;
const intrinsicReflectApply = Reflect.apply;

export interface ValidatedRanker {
  readonly id: string;
  readonly version: string;
  rank(context: WorkingLoreRankContext): unknown;
}

export const DEFAULT_RANKER: Ranker = Object.freeze({
  id: "loredu.baseline",
  version: "1",
  rank(context: WorkingLoreRankContext): readonly number[] {
    return context.candidates.map((candidate) => candidate.index);
  },
});

function token(value: unknown, path: string, issues: LoreduIssue[]): string | undefined {
  if (typeof value !== "string") {
    issues.push(makeIssue("TYPE", path, "must be a string"));
    return undefined;
  }
  if (!isScalarText(value) || scalarLength(value) > 128 || !TOKEN.test(value)) {
    issues.push(makeIssue("FORMAT", path, "must be an identifier-safe token of at most 128 scalars"));
    return undefined;
  }
  return value;
}

function readDataProperty(value: object, key: string, issues: LoreduIssue[]): unknown {
  try {
    let current: object | null = value;
    const seen = new Set<object>();
    let count = 0;
    while (current !== null) {
      if (seen.has(current) || count >= PROTOTYPE_LIMIT) throw new TypeError();
      seen.add(current);
      count++;
      const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
      if (descriptor) {
        if (!("value" in descriptor)) {
          issues.push(makeIssue("TYPE", `/${key}`, "must be a data property"));
          return undefined;
        }
        return descriptor.value;
      }
      current = Reflect.getPrototypeOf(current);
    }
  } catch {
    issues.push(makeIssue("TYPE", `/${key}`, "could not inspect Ranker field"));
  }
  return undefined;
}

export function validateRanker(value: unknown): ValidatedRanker {
  const issues: LoreduIssue[] = [];
  if ((typeof value !== "object" && typeof value !== "function") || value === null)
    throw new LoreduError(
      "VALIDATION_FAILED",
      "Ranker validation failed",
      Object.freeze([makeIssue("TYPE", "", "must be a Ranker object")]),
    );
  try {
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === "symbol") issues.push(makeIssue("UNKNOWN_FIELD", "", "must not have symbol fields"));
      else if (!FIELDS.has(key))
        issues.push(makeIssue("UNKNOWN_FIELD", `/${escapePointer(key)}`, "is not part of Ranker"));
    }
  } catch {
    issues.push(makeIssue("TYPE", "", "could not inspect Ranker fields"));
  }
  const id = token(readDataProperty(value, "id", issues), "/id", issues);
  const version = token(readDataProperty(value, "version", issues), "/version", issues);
  const rank = readDataProperty(value, "rank", issues);
  if (typeof rank !== "function") issues.push(makeIssue("TYPE", "/rank", "must be a function"));
  if (issues.length > 0 || !id || !version || typeof rank !== "function")
    throw new LoreduError("VALIDATION_FAILED", "Ranker validation failed", Object.freeze(issues));
  const receiver = value;
  return Object.freeze({
    id,
    version,
    rank(context: WorkingLoreRankContext): unknown {
      return intrinsicReflectApply(rank, receiver, [context]);
    },
  });
}

function invalidOutput(message: string): never {
  throw new LoreduError(
    "VALIDATION_FAILED",
    "Ranker output validation failed",
    Object.freeze([makeIssue("TYPE", "/rank", message)]),
  );
}

export function invokeRanker(ranker: ValidatedRanker, context: WorkingLoreRankContext): readonly number[] {
  let returned: unknown;
  try {
    returned = ranker.rank(context);
  } catch {
    invalidOutput("Ranker callback failed");
  }
  const issues: LoreduIssue[] = [];
  const array = inspectArray(returned, "/rank", issues);
  if (!array || issues.length > 0) invalidOutput("must return a dense ordinary array without excess fields");
  if (array.length !== context.candidates.length)
    invalidOutput("must return every candidate index exactly once");
  const seen = new Set<number>();
  const output: number[] = [];
  for (const value of array) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value >= array.length)
      invalidOutput("must contain only in-range safe integer indexes");
    if (seen.has(value)) invalidOutput("must not duplicate or omit candidate indexes");
    seen.add(value);
    output.push(value);
  }
  return Object.freeze(output);
}
