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

/** Copy the identity-bearing basis, deliberately excluding display-only `computed_at`. */
export function basisIdentityOf(value: BasisBearing): BasisIdentity {
  return Object.freeze({
    stream_position: value.basis.stream_position,
    ruleset: value.basis.ruleset,
    query: canonicalizeJsonValue(value.basis.query, "basis.query"),
  });
}

export function basisIdentitiesEqual(left: BasisBearing, right: BasisBearing): boolean {
  const a = basisIdentityOf(left);
  const b = basisIdentityOf(right);
  return (
    a.stream_position === b.stream_position && a.ruleset === b.ruleset && jsonValuesEqual(a.query, b.query)
  );
}
