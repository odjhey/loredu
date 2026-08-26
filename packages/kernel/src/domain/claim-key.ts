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

/** Canonical pair-set representation used only for scope identity. */
export function canonicalizeScope(scope: unknown = {}): readonly ScopePair[] {
  if (typeof scope !== "object" || scope === null || Array.isArray(scope)) {
    throw new RecordValidationError("scope", "must be a flat object of identifier-safe string pairs");
  }
  const prototype = Object.getPrototypeOf(scope);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RecordValidationError("scope", "must be a plain object");
  }
  const object = scope as { [key: string]: unknown };
  if (Object.getOwnPropertySymbols(object).length > 0) {
    throw new RecordValidationError("scope", "must not contain symbol-keyed fields");
  }
  const pairs = Object.keys(object)
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
  if (typeof input !== "object" || input === null) {
    throw new RecordValidationError("claim_key", "must be an object");
  }
  if (typeof input.subject !== "object" || input.subject === null || Array.isArray(input.subject)) {
    throw new RecordValidationError("subject", "must be an object with type and id");
  }
  assertIdentifierSafeToken(input.subject.type, "subject.type");
  assertIdentifierSafeToken(input.subject.id, "subject.id");
  assertIdentifierSafeToken(input.predicate, "predicate");
  if (input.perspective !== undefined) assertIdentifierSafeToken(input.perspective, "perspective");
  const subject = Object.freeze({ type: input.subject.type, id: input.subject.id });
  return Object.freeze({
    scope: canonicalizeScope(input.scope),
    subject,
    predicate: input.predicate,
    ...(input.perspective === undefined ? {} : { perspective: input.perspective }),
  });
}

export function claimKeyOf(claim: ClaimDraft | Claim): ClaimKey {
  return createClaimKey(claim);
}

export function claimKeysEqual(left: ClaimKey, right: ClaimKey): boolean {
  return (
    left.subject.type === right.subject.type &&
    left.subject.id === right.subject.id &&
    left.predicate === right.predicate &&
    left.perspective === right.perspective &&
    left.scope.length === right.scope.length &&
    left.scope.every(
      ([key, value], index) => key === right.scope[index]?.[0] && value === right.scope[index]?.[1],
    )
  );
}
