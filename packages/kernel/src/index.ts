export type { ClaimKey, ClaimKeyInput, ScopePair } from "./domain/claim-key";
export {
  canonicalizeScope,
  claimKeyOf,
  claimKeysEqual,
  createClaimKey,
  scopesEqual,
} from "./domain/claim-key";
export type { JsonArray, JsonObject, JsonPrimitive, JsonValue } from "./domain/json-value";
export { canonicalizeJsonValue, jsonValuesEqual } from "./domain/json-value";
export type {
  ClaimId,
  EntryId,
  RecordId,
  RecordIdByKind,
  RecordIdFor,
  RelationId,
  ResolutionId,
  VerificationId,
} from "./domain/record-id";
export {
  assertRecordIdForKind,
  encodeRecordIdSuffix,
  isRecordIdForKind,
  RECORD_ID_ENTROPY_BYTES,
  RECORD_ID_SUFFIX_ALPHABET,
  RECORD_ID_SUFFIX_LENGTH,
  recordIdFromBytes,
  recordKindOfId,
} from "./domain/record-id";
export type { RecordIdPrefix, RecordKind } from "./domain/record-kind";
export {
  RECORD_ID_PREFIX,
  RECORD_SCHEMA_ID,
  recordKindOfIdPrefix,
} from "./domain/record-kind";
export type {
  Actor,
  ActorType,
  Claim,
  ClaimConfidence,
  ClaimDraft,
  DraftEnvelope,
  Entry,
  EntryDraft,
  Metadata,
  PersistedEnvelope,
  PersistedRecord,
  RecordDraft,
  Relation,
  RelationDraft,
  RelationEndpoint,
  RelationType,
  Resolution,
  ResolutionDecision,
  ResolutionDraft,
  Scope,
  SourceRef,
  Subject,
  Verification,
  VerificationBasis,
  VerificationDraft,
  VerificationResult,
} from "./domain/records";
export {
  ACTOR_TYPES,
  CLAIM_CONFIDENCES,
  parsePersistedRecord,
  parseRecordDraft,
  RELATION_TYPES,
  RESOLUTION_DECISIONS,
  VERIFICATION_RESULTS,
} from "./domain/records";
export { RecordValidationError } from "./domain/validation-error";
export type {
  AppendResult,
  RecordRef,
  RecordStore,
  StreamPosition,
} from "./ports/record-store";
