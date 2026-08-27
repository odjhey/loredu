import { claimKeyOf } from "./domain/claim-key";
import {
  type PersistedRecord,
  type PersistedRecordFor,
  RECORD_SCHEMA_ID,
  type RecordDraft,
  type RecordId,
  type RecordKind,
} from "./domain/entry";
import { compareUnicodeScalars, makeIssue } from "./domain/portable-json";
import { RECORD_ID_PREFIX, recordKindOfIdPrefix } from "./domain/record-kind";
import { decodePersistedRecord, decodeRecordDraft, decodeReferencedRecord } from "./domain/records";
import { LoreduError, type LoreduIssue } from "./errors";
import {
  type Clock,
  createInstant,
  createStreamPosition,
  type RandomSource,
  type RecordStore,
  type StreamPosition,
} from "./ports/capabilities";
import {
  type ClaimPolicy,
  DEFAULT_CLAIM_POLICY,
  type ValidatedClaimPolicy,
  validateClaimForAppend,
  validateClaimPolicy,
} from "./ports/claim-policy";

export type { LoreduErrorCode, LoreduIssue, LoreduIssueCode } from "./errors";
export { LoreduError } from "./errors";
export interface AppendRecordResult<R extends PersistedRecord = PersistedRecord> {
  readonly record: R;
  readonly position: StreamPosition;
}
export interface LoreduApplicationDependencies {
  readonly store: RecordStore;
  readonly clock: Clock;
  readonly randomSource: RandomSource;
  readonly claimPolicy?: ClaimPolicy;
}
export interface LoreduApplication {
  append<D extends RecordDraft>(draft: D): Promise<AppendRecordResult<PersistedRecordFor<D>>>;
}

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const intrinsicUint8Array = Uint8Array;
const intrinsicReflectApply = Reflect.apply;
const typedArrayPrototype = Object.getPrototypeOf(intrinsicUint8Array.prototype);
const typedArrayTag = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)?.get;
const typedArrayLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, "length")?.get;
const typedArraySet = Object.getOwnPropertyDescriptor(typedArrayPrototype, "set")?.value;

type Reference = {
  readonly id: RecordId;
  readonly path: string;
  readonly kinds: readonly RecordKind[];
};

function applyIntrinsic(target: (...args: never[]) => unknown, receiver: unknown, argumentsList: unknown[]) {
  return intrinsicReflectApply(target, receiver, argumentsList);
}

function idFrom(bytes: unknown, kind: RecordKind): RecordId {
  try {
    if (!typedArrayTag || !typedArrayLength || !typedArraySet) throw new TypeError("missing intrinsic");
    if (applyIntrinsic(typedArrayTag, bytes, []) !== "Uint8Array") throw new TypeError("not Uint8Array");
    if (applyIntrinsic(typedArrayLength, bytes, []) !== 10) throw new RangeError("wrong length");

    const owned = new intrinsicUint8Array(10);
    applyIntrinsic(typedArraySet, owned, [bytes]);
    if (applyIntrinsic(typedArrayLength, owned, []) !== 10) throw new RangeError("wrong snapshot length");
    const ownedByte = (index: number) => {
      const byte = owned[index];
      if (byte === undefined) throw new RangeError("missing snapshot byte");
      return byte;
    };
    let suffix = "";
    for (let index = 0; index < 10; index += 5) {
      const value =
        ownedByte(index) * 2 ** 32 +
        ownedByte(index + 1) * 2 ** 24 +
        ownedByte(index + 2) * 2 ** 16 +
        ownedByte(index + 3) * 2 ** 8 +
        ownedByte(index + 4);
      for (let shift = 35; shift >= 0; shift -= 5) suffix += ALPHABET[Math.floor(value / 2 ** shift) & 31];
    }
    return `${RECORD_ID_PREFIX[kind]}_${suffix}` as RecordId;
  } catch {
    throw new LoreduError("RANDOM_SOURCE_FAILED", "RandomSource must return exactly 10 Uint8 bytes");
  }
}

function referencesOf(draft: RecordDraft): readonly Reference[] {
  if (draft.kind === "entry") return Object.freeze([]);
  if (draft.kind === "claim")
    return Object.freeze(
      (draft.derived_from ?? []).map((id, index) =>
        Object.freeze({ id, path: `/derived_from/${index}`, kinds: Object.freeze(["entry"] as const) }),
      ),
    );
  if (draft.kind === "relation") {
    const kinds =
      draft.relation_type === "derived_from"
        ? Object.freeze(["claim"] as const)
        : Object.freeze(["entry", "claim", "relation", "resolution", "verification"] as const);
    return Object.freeze([
      Object.freeze({ id: draft.from, path: "/from", kinds }),
      Object.freeze({ id: draft.to, path: "/to", kinds }),
    ]);
  }
  if (draft.kind === "resolution")
    return Object.freeze([
      ...draft.targets.map((id, index) =>
        Object.freeze({
          id,
          path: `/targets/${index}`,
          kinds: Object.freeze(["claim", "relation"] as const),
        }),
      ),
      ...(draft.replacement === undefined
        ? []
        : [
            Object.freeze({
              id: draft.replacement,
              path: "/replacement",
              kinds: Object.freeze(["claim"] as const),
            }),
          ]),
    ]);
  return Object.freeze(
    draft.targets.map((id, index) =>
      Object.freeze({ id, path: `/targets/${index}`, kinds: Object.freeze(["claim"] as const) }),
    ),
  );
}

async function checkReferences(store: RecordStore, references: readonly Reference[]): Promise<void> {
  const issues: LoreduIssue[] = [];
  for (const reference of references) {
    let found: PersistedRecord | undefined;
    try {
      const value = await store.get(reference.id);
      if (value !== undefined) found = decodeReferencedRecord(value);
    } catch {
      throw new LoreduError("REFERENCE_CHECK_FAILED", "Record reference read failed");
    }
    if (found === undefined) {
      issues.push(makeIssue("REFERENCE_NOT_FOUND", reference.path, `record does not exist: ${reference.id}`));
    } else if (found.id !== reference.id) {
      throw new LoreduError("REFERENCE_CHECK_FAILED", "Record reference read returned a different id");
    } else if (
      !reference.kinds.includes(found.kind) ||
      recordKindOfIdPrefix(reference.id.slice(0, 3)) !== found.kind
    ) {
      issues.push(
        makeIssue(
          "REFERENCE_KIND_MISMATCH",
          reference.path,
          `record kind ${found.kind} is not valid for this reference`,
        ),
      );
    }
  }
  if (issues.length > 0)
    throw new LoreduError(
      "REFERENCE_CHECK_FAILED",
      "Record reference validation failed",
      Object.freeze(issues),
    );
}

function validateDraft(input: unknown, policy: ValidatedClaimPolicy): RecordDraft {
  const draft = decodeRecordDraft(input);
  if (draft.kind !== "claim") return draft;
  const issues = validateClaimForAppend(policy, claimKeyOf(draft));
  if (issues.length > 0) {
    const ordered = Object.freeze(
      [...issues].sort(
        (left, right) =>
          compareUnicodeScalars(left.path, right.path) || compareUnicodeScalars(left.code, right.code),
      ),
    );
    throw new LoreduError("VALIDATION_FAILED", "Claim policy validation failed", ordered);
  }
  return draft;
}

function stamp(draft: RecordDraft, id: RecordId, recordedAt: string): PersistedRecord {
  return decodePersistedRecord({
    ...draft,
    schema: RECORD_SCHEMA_ID,
    id,
    recorded_at: recordedAt,
  });
}

export function createLoreduApplication({
  store,
  clock,
  randomSource,
  claimPolicy = DEFAULT_CLAIM_POLICY,
}: LoreduApplicationDependencies): LoreduApplication {
  const policy = validateClaimPolicy(claimPolicy);
  return Object.freeze({
    async append<D extends RecordDraft>(input: D) {
      const draft = validateDraft(input, policy);
      await checkReferences(store, referencesOf(draft));

      let id: RecordId;
      try {
        id = idFrom(randomSource.nextBytes(10), draft.kind);
      } catch {
        throw new LoreduError("RANDOM_SOURCE_FAILED", "RandomSource failed");
      }

      let recordedAt: string;
      try {
        const instant = createInstant(clock.now());
        recordedAt = new Date(instant).toISOString();
      } catch {
        throw new LoreduError("CLOCK_FAILED", "Clock failed");
      }

      const record = stamp(draft, id, recordedAt);
      try {
        const position = createStreamPosition(await store.append(record));
        if (position === 0) throw new RangeError("append position must be positive");
        return Object.freeze({ record, position }) as AppendRecordResult<PersistedRecordFor<D>>;
      } catch (error) {
        if (error instanceof LoreduError && error.code === "DUPLICATE_RECORD_ID") throw error;
        throw new LoreduError("STORE_APPEND_FAILED", `Store append failed for record ${id}`);
      }
    },
  });
}
