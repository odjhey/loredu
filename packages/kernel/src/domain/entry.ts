export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export const RECORD_SCHEMA_ID = "loredu.record/v1" as const;
export type RecordSchemaId = typeof RECORD_SCHEMA_ID;

export type RecordKind = "entry" | "claim" | "relation" | "resolution" | "verification";
export type RecordIdPrefix = "ent" | "clm" | "rel" | "res" | "ver";
export type EntryId = Brand<string, "EntryId">;
export type ClaimId = Brand<string, "ClaimId">;
export type RelationId = Brand<string, "RelationId">;
export type ResolutionId = Brand<string, "ResolutionId">;
export type VerificationId = Brand<string, "VerificationId">;
export type RecordId = EntryId | ClaimId | RelationId | ResolutionId | VerificationId;

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export type ActorType = "human" | "agent" | "program" | "system";
export interface Actor {
  readonly type: ActorType;
  readonly id: string;
}
export type Scope = Readonly<Record<string, string>>;
export type Metadata = Readonly<Record<string, JsonValue>>;
export interface SourceRef {
  readonly ref: string;
  readonly locator?: string;
  readonly snapshot?: string;
}
export interface Subject {
  readonly type: string;
  readonly id: string;
}

interface DraftEnvelope<K extends RecordKind> {
  readonly kind: K;
  readonly actor: Actor;
  readonly scope?: Scope;
  readonly metadata?: Metadata;
  readonly sources?: readonly SourceRef[];
}
interface PersistedEnvelope<K extends RecordKind, I extends RecordId> {
  readonly schema: RecordSchemaId;
  readonly kind: K;
  readonly id: I;
  readonly recorded_at: string;
  readonly actor: Actor;
  readonly scope: Scope;
  readonly metadata: Metadata;
  readonly sources: readonly SourceRef[];
}

export interface EntryDraft extends DraftEnvelope<"entry"> {
  readonly body: string;
  readonly title?: string;
  readonly entry_type?: string;
}
export interface Entry extends PersistedEnvelope<"entry", EntryId> {
  readonly body: string;
  readonly title?: string;
  readonly entry_type?: string;
}

export type Confidence = "candidate" | "observed" | "corroborated" | "confirmed" | "authoritative";
export interface ClaimDraft extends DraftEnvelope<"claim"> {
  readonly subject: Subject;
  readonly predicate: string;
  readonly value: JsonValue;
  readonly confidence: Confidence;
  readonly claim_class?: string;
  readonly perspective?: string;
  readonly valid_from?: string;
  readonly valid_until?: string;
  readonly derived_from?: readonly EntryId[];
}
export interface Claim extends PersistedEnvelope<"claim", ClaimId> {
  readonly subject: Subject;
  readonly predicate: string;
  readonly value: JsonValue;
  readonly confidence: Confidence;
  readonly claim_class?: string;
  readonly perspective?: string;
  readonly valid_from?: string;
  readonly valid_until?: string;
  readonly derived_from: readonly EntryId[];
}

export type RelationType =
  | "supports"
  | "contradicts"
  | "duplicates"
  | "supersedes"
  | "derived_from"
  | "related_to";
export interface RelationDraft extends DraftEnvelope<"relation"> {
  readonly relation_type: RelationType;
  readonly from: RecordId;
  readonly to: RecordId;
}
export interface Relation extends PersistedEnvelope<"relation", RelationId> {
  readonly relation_type: RelationType;
  readonly from: RecordId;
  readonly to: RecordId;
}

export type ResolutionDecision = "prefer" | "supersede" | "retract" | "leave_disputed";
export interface ResolutionDraft extends DraftEnvelope<"resolution"> {
  readonly targets: readonly (ClaimId | RelationId)[];
  readonly decision: ResolutionDecision;
  readonly replacement?: ClaimId;
  readonly reason: string;
  readonly effective_at?: string;
}
export interface Resolution extends PersistedEnvelope<"resolution", ResolutionId> {
  readonly targets: readonly (ClaimId | RelationId)[];
  readonly decision: ResolutionDecision;
  readonly replacement?: ClaimId;
  readonly reason: string;
  readonly effective_at?: string;
}

export type VerificationResult = "confirmed" | "contradicted" | "unchanged" | "needs_revalidation";
export type VerificationSourceRef = SourceRef & { readonly snapshot: string };
export interface VerificationDraft extends DraftEnvelope<"verification"> {
  readonly targets: readonly ClaimId[];
  readonly verified_against: readonly VerificationSourceRef[];
  readonly result: VerificationResult;
}
export interface Verification extends PersistedEnvelope<"verification", VerificationId> {
  readonly targets: readonly ClaimId[];
  readonly verified_against: readonly VerificationSourceRef[];
  readonly result: VerificationResult;
}

export type RecordDraft = EntryDraft | ClaimDraft | RelationDraft | ResolutionDraft | VerificationDraft;
export type PersistedRecord = Entry | Claim | Relation | Resolution | Verification;
export type PersistedRecordFor<D extends RecordDraft> = D extends EntryDraft
  ? Entry
  : D extends ClaimDraft
    ? Claim
    : D extends RelationDraft
      ? Relation
      : D extends ResolutionDraft
        ? Resolution
        : D extends VerificationDraft
          ? Verification
          : never;

export interface ClaimKey {
  readonly scope: Scope;
  readonly subject: Subject;
  readonly predicate: string;
  readonly perspective?: string;
}
