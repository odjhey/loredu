import { canonicalizeJsonValue, type JsonValue, jsonValuesEqual } from "../domain/json-value";
import type { StreamPosition } from "../ports/record-store";

export interface BasisIdentity {
  readonly stream_position: StreamPosition;
  readonly ruleset: string;
  readonly query: JsonValue;
}

export interface BasisBearing {
  readonly basis: BasisIdentity;
  readonly computed_at?: string;
}

export const M0_CORE_RULESET_VERSION = "loredu.core-ruleset/m0-v1" as const;

/** Compose the exact M0 core and active ClaimPolicy identities. */
export function composeM0RulesetVersion(policyVersion: string): string {
  return `${M0_CORE_RULESET_VERSION}+claim-policy/${policyVersion}`;
}

/** Construct and deeply freeze one opaque-query basis identity. */
export function createBasisIdentity(
  streamPosition: StreamPosition,
  ruleset: string,
  query: JsonValue,
): BasisIdentity {
  return Object.freeze({
    stream_position: streamPosition,
    ruleset,
    query: canonicalizeJsonValue(query, "basis.query"),
  });
}

/** Copy the identity-bearing basis, deliberately excluding display-only `computed_at`. */
export function basisIdentityOf(value: BasisBearing): BasisIdentity {
  return createBasisIdentity(value.basis.stream_position, value.basis.ruleset, value.basis.query);
}

export function basisIdentitiesEqual(left: BasisBearing, right: BasisBearing): boolean {
  const a = basisIdentityOf(left);
  const b = basisIdentityOf(right);
  return (
    a.stream_position === b.stream_position && a.ruleset === b.ruleset && jsonValuesEqual(a.query, b.query)
  );
}
