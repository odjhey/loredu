import type { Claim, ClaimDraft, ClaimKey, Scope } from "./entry";
import { compareUnicodeScalars } from "./portable-json";
import { decodePersistedRecord, decodeRecordDraft } from "./records";

function detachedScope(scope: Scope | undefined): Scope {
  const output = Object.create(null) as Record<string, string>;
  for (const key of Object.keys(scope ?? {}).sort(compareUnicodeScalars)) {
    Object.defineProperty(output, key, {
      value: (scope as Scope)[key],
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return Object.freeze(output);
}

export function claimKeyOf(input: Claim | ClaimDraft): ClaimKey {
  let schema: PropertyDescriptor | undefined;
  try {
    schema = Object.getOwnPropertyDescriptor(input, "schema");
  } catch {
    // The public decoder produces the structured validation failure.
  }
  const decoded = (schema && "value" in schema ? decodePersistedRecord(input) : decodeRecordDraft(input)) as
    | Claim
    | ClaimDraft;
  if (decoded.kind !== "claim") throw new TypeError("claimKeyOf requires a Claim or ClaimDraft");
  return Object.freeze({
    scope: detachedScope(decoded.scope),
    subject: Object.freeze({ type: decoded.subject.type, id: decoded.subject.id }),
    predicate: decoded.predicate,
    ...(decoded.perspective === undefined ? {} : { perspective: decoded.perspective }),
  });
}

export function claimKeysEqual(left: ClaimKey, right: ClaimKey): boolean {
  if (
    left.subject.type !== right.subject.type ||
    left.subject.id !== right.subject.id ||
    left.predicate !== right.predicate ||
    left.perspective !== right.perspective
  )
    return false;
  const leftKeys = Object.keys(left.scope).sort(compareUnicodeScalars);
  const rightKeys = Object.keys(right.scope).sort(compareUnicodeScalars);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && left.scope[key] === right.scope[key])
  );
}
