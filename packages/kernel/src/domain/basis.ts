import { LoreduError, type LoreduIssue } from "../errors";
import type { StreamPosition } from "../ports/capabilities";
import {
  type ClaimPolicy,
  DEFAULT_CLAIM_POLICY,
  type ValidatedClaimPolicy,
  validateClaimPolicy,
} from "../ports/claim-policy";
import type { JsonObject } from "./entry";
import {
  compareUnicodeScalars,
  copyJsonObject,
  type DescriptorMap,
  dataValue,
  escapePointer,
  hasOwnDescriptor,
  inspectObject,
  isScalarText,
  jsonValuesEqual,
  makeIssue,
  scalarLength,
} from "./portable-json";

export const CORE_RULESET_ID = "loredu.reconciliation/v1" as const;
const TOKEN = /^[a-z0-9](?:[a-z0-9._:/-]*[a-z0-9])?$/;

export interface RulesetIdentity {
  readonly core: typeof CORE_RULESET_ID;
  readonly claim_policy: {
    readonly id: string;
    readonly version: string;
  };
}

export interface Basis {
  readonly stream_position: StreamPosition;
  readonly ruleset: RulesetIdentity;
  readonly query: JsonObject;
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

function parseRuleset(value: unknown, issues: LoreduIssue[]): RulesetIdentity | undefined {
  const data = inspectObject(value, "/ruleset", issues);
  if (!data) return undefined;
  rejectUnknown(data, new Set(["core", "claim_policy"]), "/ruleset", issues);

  const core = requiredValue(data, "core", "/ruleset/core", issues);
  if (typeof core !== "string") issues.push(makeIssue("TYPE", "/ruleset/core", "must be a string"));
  else if (core !== CORE_RULESET_ID)
    issues.push(makeIssue("FORMAT", "/ruleset/core", `must equal ${CORE_RULESET_ID}`));

  const policyData = inspectObject(
    requiredValue(data, "claim_policy", "/ruleset/claim_policy", issues),
    "/ruleset/claim_policy",
    issues,
  );
  let id: string | undefined;
  let version: string | undefined;
  if (policyData) {
    rejectUnknown(policyData, new Set(["id", "version"]), "/ruleset/claim_policy", issues);
    id = token(
      requiredValue(policyData, "id", "/ruleset/claim_policy/id", issues),
      "/ruleset/claim_policy/id",
      issues,
    );
    version = token(
      requiredValue(policyData, "version", "/ruleset/claim_policy/version", issues),
      "/ruleset/claim_policy/version",
      issues,
    );
  }
  if (core !== CORE_RULESET_ID || !id || !version) return undefined;
  return Object.freeze({
    core: CORE_RULESET_ID,
    claim_policy: Object.freeze({ id, version }),
  });
}

export function rulesetIdentityFromValidatedPolicy({
  id,
  version,
}: ValidatedClaimPolicy): RulesetIdentity {
  return Object.freeze({
    core: CORE_RULESET_ID,
    claim_policy: Object.freeze({ id, version }),
  });
}

export function createRulesetIdentity(policy: ClaimPolicy): RulesetIdentity {
  return rulesetIdentityFromValidatedPolicy(validateClaimPolicy(policy));
}

export const DEFAULT_RULESET_IDENTITY: RulesetIdentity = createRulesetIdentity(DEFAULT_CLAIM_POLICY);

export function createBasis(input: Basis): Basis {
  const issues: LoreduIssue[] = [];
  const data = inspectObject(input, "", issues);
  if (!data) throw new LoreduError("VALIDATION_FAILED", "Basis validation failed", orderedIssues(issues));
  rejectUnknown(data, new Set(["stream_position", "ruleset", "query"]), "", issues);

  const rawPosition = requiredValue(data, "stream_position", "/stream_position", issues);
  let position: StreamPosition | undefined;
  if (typeof rawPosition !== "number") issues.push(makeIssue("TYPE", "/stream_position", "must be a number"));
  else if (!Number.isSafeInteger(rawPosition) || rawPosition < 0)
    issues.push(makeIssue("RANGE", "/stream_position", "must be a nonnegative safe integer"));
  else position = rawPosition as StreamPosition;

  const ruleset = parseRuleset(requiredValue(data, "ruleset", "/ruleset", issues), issues);
  const query = copyJsonObject(requiredValue(data, "query", "/query", issues), "/query", issues);
  const ordered = orderedIssues(issues);
  if (ordered.length > 0 || position === undefined || !ruleset || !query)
    throw new LoreduError("VALIDATION_FAILED", "Basis validation failed", ordered);
  return Object.freeze({ stream_position: position, ruleset, query });
}

export function basisEquals(left: Basis, right: Basis): boolean {
  return (
    left.stream_position === right.stream_position &&
    left.ruleset.core === right.ruleset.core &&
    left.ruleset.claim_policy.id === right.ruleset.claim_policy.id &&
    left.ruleset.claim_policy.version === right.ruleset.claim_policy.version &&
    jsonValuesEqual(left.query, right.query)
  );
}
