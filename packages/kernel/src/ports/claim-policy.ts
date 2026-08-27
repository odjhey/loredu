import type { ClaimKey } from "../domain/entry";
import {
  compareUnicodeScalars,
  type DescriptorMap,
  dataValue,
  escapePointer,
  hasOwnDescriptor,
  inspectObject,
  isScalarText,
  makeIssue,
  scalarLength,
} from "../domain/portable-json";
import { LoreduError, type LoreduIssue } from "../errors";

const TOKEN = /^[a-z0-9](?:[a-z0-9._:/-]*[a-z0-9])?$/;
const POLICY_FIELDS = new Set(["id", "version", "validateClaimKey", "semantics"]);
const FORBIDDEN_POLICY_FIELDS = ["identity", "advise", "advisories"] as const;

export type ClaimSemantics = "exclusive" | "coexisting";

export interface ClaimPolicy {
  readonly id: string;
  readonly version: string;
  validateClaimKey(key: ClaimKey): readonly LoreduIssue[];
  semantics(key: ClaimKey): ClaimSemantics;
}

function orderedIssues(issues: readonly LoreduIssue[]): readonly LoreduIssue[] {
  const unique = new Map<string, LoreduIssue>();
  for (const item of issues) unique.set(`${item.path}\u0000${item.code}`, item);
  return Object.freeze(
    [...unique.values()].sort(
      (left, right) =>
        compareUnicodeScalars(left.path, right.path) || compareUnicodeScalars(left.code, right.code),
    ),
  );
}

function requiredValue(data: DescriptorMap, key: string, path: string, issues: LoreduIssue[]): unknown {
  if (!hasOwnDescriptor(data, key)) {
    issues.push(makeIssue("REQUIRED", path, "is required"));
    return undefined;
  }
  return dataValue(data, key);
}

function validateToken(value: unknown, path: string, issues: LoreduIssue[]): string | undefined {
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

function rejectUnknown(
  data: DescriptorMap,
  allowed: ReadonlySet<string>,
  path: string,
  issues: LoreduIssue[],
): void {
  for (const key of Object.keys(data)) {
    if (!allowed.has(key))
      issues.push(makeIssue("UNKNOWN_FIELD", `${path}/${escapePointer(key)}`, "is not part of this object"));
  }
}

function readDataProperty(value: object, key: string, path: string, issues: LoreduIssue[]): unknown {
  try {
    let current: object | null = value;
    while (current !== null) {
      const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
      if (descriptor) {
        if (!("value" in descriptor)) {
          issues.push(makeIssue("TYPE", path, "must be a data property"));
          return undefined;
        }
        return descriptor.value;
      }
      current = Reflect.getPrototypeOf(current);
    }
    return undefined;
  } catch {
    issues.push(makeIssue("TYPE", path, "could not inspect ClaimPolicy field"));
    return undefined;
  }
}

function validateClaimKey(key: unknown): readonly LoreduIssue[] {
  const issues: LoreduIssue[] = [];
  const data = inspectObject(key, "", issues);
  if (!data) return orderedIssues(issues);
  rejectUnknown(data, new Set(["scope", "subject", "predicate", "perspective"]), "", issues);

  const scope = inspectObject(requiredValue(data, "scope", "/scope", issues), "/scope", issues);
  if (scope) {
    for (const name of Object.keys(scope).sort(compareUnicodeScalars)) {
      validateToken(name, `/scope/${escapePointer(name)}`, issues);
      validateToken(dataValue(scope, name), `/scope/${escapePointer(name)}`, issues);
    }
  }

  const subject = inspectObject(requiredValue(data, "subject", "/subject", issues), "/subject", issues);
  if (subject) {
    rejectUnknown(subject, new Set(["type", "id"]), "/subject", issues);
    validateToken(requiredValue(subject, "type", "/subject/type", issues), "/subject/type", issues);
    validateToken(requiredValue(subject, "id", "/subject/id", issues), "/subject/id", issues);
  }

  validateToken(requiredValue(data, "predicate", "/predicate", issues), "/predicate", issues);
  if (hasOwnDescriptor(data, "perspective"))
    validateToken(dataValue(data, "perspective"), "/perspective", issues);
  return orderedIssues(issues);
}

const EMPTY_ISSUES: readonly LoreduIssue[] = Object.freeze([]);

export const DEFAULT_CLAIM_POLICY: ClaimPolicy = Object.freeze({
  id: "loredu.default",
  version: "1",
  validateClaimKey(key: ClaimKey): readonly LoreduIssue[] {
    const issues = validateClaimKey(key);
    return issues.length === 0 ? EMPTY_ISSUES : issues;
  },
  semantics(_key: ClaimKey): ClaimSemantics {
    return "exclusive";
  },
});

export interface ValidatedClaimPolicy {
  readonly policy: ClaimPolicy;
  readonly id: string;
  readonly version: string;
}

/** Internal runtime boundary shared by assembly and structural ruleset construction. */
export function validateClaimPolicy(policy: unknown): ValidatedClaimPolicy {
  const issues: LoreduIssue[] = [];
  if ((typeof policy !== "object" && typeof policy !== "function") || policy === null) {
    throw new LoreduError(
      "VALIDATION_FAILED",
      "ClaimPolicy validation failed",
      Object.freeze([makeIssue("TYPE", "", "must be a ClaimPolicy object")]),
    );
  }

  let ownKeys: readonly (string | symbol)[] = [];
  try {
    ownKeys = Reflect.ownKeys(policy);
  } catch {
    issues.push(makeIssue("TYPE", "", "could not inspect ClaimPolicy fields"));
  }
  for (const key of ownKeys) {
    if (typeof key === "symbol") issues.push(makeIssue("UNKNOWN_FIELD", "", "must not have symbol fields"));
    else if (!POLICY_FIELDS.has(key))
      issues.push(makeIssue("UNKNOWN_FIELD", `/${escapePointer(key)}`, "is not part of ClaimPolicy"));
  }
  for (const key of FORBIDDEN_POLICY_FIELDS) {
    try {
      if (key in policy)
        issues.push(
          makeIssue(
            "UNKNOWN_FIELD",
            `/${key}`,
            key === "identity"
              ? "ClaimPolicy validates declared identity and cannot remap it"
              : "policy advice is not part of the M0 ClaimPolicy port",
          ),
        );
    } catch {
      issues.push(makeIssue("TYPE", `/${key}`, "could not inspect ClaimPolicy field"));
    }
  }

  const id = readDataProperty(policy, "id", "/id", issues);
  const version = readDataProperty(policy, "version", "/version", issues);
  const validator = readDataProperty(policy, "validateClaimKey", "/validateClaimKey", issues);
  const semantics = readDataProperty(policy, "semantics", "/semantics", issues);
  const parsedId = validateToken(id, "/id", issues);
  const parsedVersion = validateToken(version, "/version", issues);
  if (typeof validator !== "function")
    issues.push(makeIssue("TYPE", "/validateClaimKey", "must be a function"));
  if (typeof semantics !== "function") issues.push(makeIssue("TYPE", "/semantics", "must be a function"));

  const ordered = orderedIssues(issues);
  if (ordered.length > 0 || !parsedId || !parsedVersion)
    throw new LoreduError("VALIDATION_FAILED", "ClaimPolicy validation failed", ordered);
  return Object.freeze({ policy: policy as ClaimPolicy, id: parsedId, version: parsedVersion });
}
