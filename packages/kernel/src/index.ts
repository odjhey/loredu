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
  ClaimDraft,
  ClaimKey,
  ClaimKeyInput,
  Confidence,
  Entry,
  EntryDraft,
  Instant,
  JsonPrimitive,
  JsonValue,
  LoreduDraft,
  LoreduRecord,
  Metadata,
  RecordId,
  Relation,
  RelationDraft,
  RelationType,
  Resolution,
  ResolutionDecision,
  ResolutionDraft,
  Scope,
  SourceRef,
  SubjectRef,
  Verification,
  VerificationBasis,
  VerificationDraft,
  VerificationResult,
} from "./domain/records";
export type { ValidationCode, ValidationError, ValidationResult } from "./domain/validation";
export {
  canonicalClaimKey,
  canonicalizeJsonValue,
  claimKeysEqual,
  jsonValuesEqual,
  validateDraft,
  validateRecord,
  validateRecordId,
} from "./domain/validation";
export type {
  AppendResult,
  RecordRef,
  RecordStore,
  StreamPosition,
} from "./ports/record-store";
