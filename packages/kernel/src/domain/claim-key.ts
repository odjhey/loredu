import { assertExactOwnDataProperties, copyDenseDataArray, enumerableOwnDataKeys } from "./own-properties";
import type { Claim, ClaimDraft, Scope, Subject } from "./records";
import { assertIdentifierSafeToken } from "./records";
import { RecordValidationError } from "./validation-error";

export type ScopePair = readonly [key: string, value: string];

export interface ClaimKey {
  readonly scope: readonly ScopePair[];
  readonly subject: Subject;
  readonly predicate: string;
  readonly perspective?: string;
}

function expectPlainObject(value: unknown, field: string): { [key: string]: unknown } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RecordValidationError(field, "must be a plain object");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RecordValidationError(field, "must be a plain object");
  }
  return value as { [key: string]: unknown };
}

/** Canonical pair-set representation used only for scope identity. */
export function canonicalizeScope(scope: unknown = {}): readonly ScopePair[] {
  const object = expectPlainObject(scope, "scope");
  const pairs = enumerableOwnDataKeys(object, "scope")
    .map((key): ScopePair => {
      assertIdentifierSafeToken(key, `scope key ${JSON.stringify(key)}`);
      const value = object[key];
      assertIdentifierSafeToken(value, `scope.${key}`);
      return Object.freeze([key, value]) as ScopePair;
    })
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return Object.freeze(pairs);
}

export function scopesEqual(left: unknown, right: unknown): boolean {
  const canonicalLeft = canonicalizeScope(left);
  const canonicalRight = canonicalizeScope(right);
  return (
    canonicalLeft.length === canonicalRight.length &&
    canonicalLeft.every(
      ([key, value], index) => key === canonicalRight[index]?.[0] && value === canonicalRight[index]?.[1],
    )
  );
}

/** Fields callers declare as one claim identity. */
export interface ClaimKeyInput {
  readonly scope?: Scope;
  readonly subject: Subject;
  readonly predicate: string;
  readonly perspective?: string;
}

/** Build a declared key without interpreting or normalizing consumer vocabulary. */
export function createClaimKey(input: ClaimKeyInput): ClaimKey {
  const object = expectPlainObject(input, "claim_key");
  assertExactOwnDataProperties(object, ["scope", "subject", "predicate", "perspective"], "claim_key");
  const subjectObject = expectPlainObject(object.subject, "subject");
  assertExactOwnDataProperties(subjectObject, ["type", "id"], "subject");
  const subjectType = subjectObject.type;
  const subjectId = subjectObject.id;
  assertIdentifierSafeToken(subjectType, "subject.type");
  assertIdentifierSafeToken(subjectId, "subject.id");
  assertIdentifierSafeToken(object.predicate, "predicate");

  let perspective: string | undefined;
  if (Object.hasOwn(object, "perspective")) {
    assertIdentifierSafeToken(object.perspective, "perspective");
    perspective = object.perspective;
  }
  const subject = Object.freeze({ type: subjectType, id: subjectId });
  const suppliedScope = Object.hasOwn(object, "scope") ? object.scope : {};
  if (suppliedScope === undefined) {
    throw new RecordValidationError("scope", "must be a flat object when supplied");
  }
  return Object.freeze({
    scope: canonicalizeScope(suppliedScope),
    subject,
    predicate: object.predicate,
    ...(perspective === undefined ? {} : { perspective }),
  });
}

export function claimKeyOf(claim: ClaimDraft | Claim): ClaimKey {
  return createClaimKey({
    ...(claim.scope === undefined ? {} : { scope: claim.scope }),
    subject: claim.subject,
    predicate: claim.predicate,
    ...(claim.perspective === undefined ? {} : { perspective: claim.perspective }),
  });
}

function canonicalizeClaimScopePairs(value: unknown, field: string): readonly ScopePair[] {
  const suppliedPairs = copyDenseDataArray(value, field);
  const keys = new Set<string>();
  const pairs: ScopePair[] = [];
  for (let index = 0; index < suppliedPairs.length; index += 1) {
    const path = `${field}[${index}]`;
    const pair = copyDenseDataArray(suppliedPairs[index], path);
    if (pair.length !== 2) {
      throw new RecordValidationError(path, "must contain exactly one scope key and value");
    }
    const key = pair[0];
    const item = pair[1];
    assertIdentifierSafeToken(key, `${path}[0]`);
    assertIdentifierSafeToken(item, `${path}[1]`);
    if (keys.has(key)) {
      throw new RecordValidationError(`${path}[0]`, `duplicates scope key ${JSON.stringify(key)}`);
    }
    keys.add(key);
    pairs[index] = Object.freeze([key, item]) as ScopePair;
  }
  pairs.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return Object.freeze(pairs);
}

function validateStructuralClaimKey(value: ClaimKey, field: string): ClaimKey {
  const object = expectPlainObject(value, field);
  assertExactOwnDataProperties(object, ["scope", "subject", "predicate", "perspective"], field);
  if (!Object.hasOwn(object, "scope")) throw new RecordValidationError(`${field}.scope`, "is required");
  if (!Object.hasOwn(object, "subject")) throw new RecordValidationError(`${field}.subject`, "is required");
  if (!Object.hasOwn(object, "predicate")) {
    throw new RecordValidationError(`${field}.predicate`, "is required");
  }

  const subjectObject = expectPlainObject(object.subject, `${field}.subject`);
  assertExactOwnDataProperties(subjectObject, ["type", "id"], `${field}.subject`);
  const subjectType = subjectObject.type;
  const subjectId = subjectObject.id;
  assertIdentifierSafeToken(subjectType, `${field}.subject.type`);
  assertIdentifierSafeToken(subjectId, `${field}.subject.id`);
  assertIdentifierSafeToken(object.predicate, `${field}.predicate`);

  let perspective: string | undefined;
  if (Object.hasOwn(object, "perspective")) {
    assertIdentifierSafeToken(object.perspective, `${field}.perspective`);
    perspective = object.perspective;
  }
  return Object.freeze({
    scope: canonicalizeClaimScopePairs(object.scope, `${field}.scope`),
    subject: Object.freeze({ type: subjectType, id: subjectId }),
    predicate: object.predicate,
    ...(perspective === undefined ? {} : { perspective }),
  });
}

export function claimKeysEqual(left: ClaimKey, right: ClaimKey): boolean {
  const canonicalLeft = validateStructuralClaimKey(left, "left");
  const canonicalRight = validateStructuralClaimKey(right, "right");
  return (
    canonicalLeft.subject.type === canonicalRight.subject.type &&
    canonicalLeft.subject.id === canonicalRight.subject.id &&
    canonicalLeft.predicate === canonicalRight.predicate &&
    canonicalLeft.perspective === canonicalRight.perspective &&
    canonicalLeft.scope.length === canonicalRight.scope.length &&
    canonicalLeft.scope.every(
      ([key, value], index) =>
        key === canonicalRight.scope[index]?.[0] && value === canonicalRight.scope[index]?.[1],
    )
  );
}
