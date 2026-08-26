import { RECORD_ID_PREFIX, type RecordKind } from "./record-kind";
import { RecordValidationError } from "./validation-error";

export const RECORD_ID_SUFFIX_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
export const RECORD_ID_SUFFIX_LENGTH = 16;
export const RECORD_ID_ENTROPY_BYTES = 10;

export type EntryId = `ent_${string}`;
export type ClaimId = `clm_${string}`;
export type RelationId = `rel_${string}`;
export type ResolutionId = `res_${string}`;
export type VerificationId = `ver_${string}`;

export interface RecordIdByKind {
  readonly entry: EntryId;
  readonly claim: ClaimId;
  readonly relation: RelationId;
  readonly resolution: ResolutionId;
  readonly verification: VerificationId;
}

export type RecordId = RecordIdByKind[RecordKind];
export type RecordIdFor<K extends RecordKind> = RecordIdByKind[K];

const ID_PATTERN = /^(ent|clm|rel|res|ver)_([0-9a-hjkmnp-tv-z]{16})$/;

/** Pure, deterministic Crockford-base32 encoding of exactly 80 entropy bits. */
export function encodeRecordIdSuffix(bytes: Uint8Array): string {
  if (bytes.length !== RECORD_ID_ENTROPY_BYTES) {
    throw new RecordValidationError("bytes", `must contain exactly ${RECORD_ID_ENTROPY_BYTES} bytes`);
  }

  let bits = 0;
  let bitCount = 0;
  let encoded = "";
  for (const byte of bytes) {
    bits = (bits << 8) | byte;
    bitCount += 8;
    while (bitCount >= 5) {
      bitCount -= 5;
      encoded += RECORD_ID_SUFFIX_ALPHABET[(bits >>> bitCount) & 31];
      bits &= (1 << bitCount) - 1;
    }
  }
  return encoded;
}

/** Apply the kernel-owned kind prefix to caller-supplied entropy bytes. */
export function recordIdFromBytes<K extends RecordKind>(kind: K, bytes: Uint8Array): RecordIdFor<K> {
  return `${RECORD_ID_PREFIX[kind]}_${encodeRecordIdSuffix(bytes)}` as RecordIdFor<K>;
}

export function isRecordIdForKind<K extends RecordKind>(value: unknown, kind: K): value is RecordIdFor<K> {
  return (
    typeof value === "string" && ID_PATTERN.test(value) && value.startsWith(`${RECORD_ID_PREFIX[kind]}_`)
  );
}

export function assertRecordIdForKind<K extends RecordKind>(
  value: unknown,
  kind: K,
  field = "id",
): asserts value is RecordIdFor<K> {
  if (!isRecordIdForKind(value, kind)) {
    throw new RecordValidationError(
      field,
      `must be a ${kind} id with prefix ${RECORD_ID_PREFIX[kind]}_ and a 16-symbol lowercase Crockford-base32 suffix`,
    );
  }
}

export function recordKindOfId(id: unknown): RecordKind | undefined {
  if (typeof id !== "string") return undefined;
  const match = ID_PATTERN.exec(id);
  if (!match) return undefined;
  switch (match[1]) {
    case "ent":
      return "entry";
    case "clm":
      return "claim";
    case "rel":
      return "relation";
    case "res":
      return "resolution";
    case "ver":
      return "verification";
    default:
      return undefined;
  }
}
