import type { RecordKind } from "./record-kind";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type ActorType = "human" | "agent" | "program" | "system";
export type RelationType =
  | "supports"
  | "contradicts"
  | "duplicates"
  | "supersedes"
  | "derived_from"
  | "related_to";
export type ResolutionDecision = "prefer" | "supersede" | "retract" | "leave_disputed";
export type VerificationResult = "confirmed" | "contradicted" | "unchanged" | "needs_revalidation";
export type Confidence = "candidate" | "observed" | "corroborated" | "confirmed" | "authoritative";
export type Instant = string;
export type RecordId = string;

export interface Actor {
  readonly type: ActorType;
  readonly id: string;
}
export interface Scope {
  readonly [key: string]: string;
}
export interface Metadata {
  readonly [key: string]: JsonValue;
}
export interface SourceRef {
  readonly ref: string;
  readonly locator?: string;
  readonly snapshot?: string;
}
export interface SubjectRef {
  readonly type: string;
  readonly id: string;
}
export interface VerificationBasis {
  readonly source: string;
  readonly snapshot?: string;
}

interface DraftEnvelope<K extends RecordKind> {
  readonly kind: K;
  readonly actor: Actor;
  readonly scope?: Scope;
  readonly metadata?: Metadata;
}
interface SourceBearing {
  readonly sources?: readonly SourceRef[];
}

export interface EntryDraft extends DraftEnvelope<"entry">, SourceBearing {
  readonly body: string;
  readonly title?: string;
  readonly entry_type?: string;
}
export interface ClaimDraft extends DraftEnvelope<"claim">, SourceBearing {
  readonly derived_from?: readonly RecordId[];
  readonly subject: SubjectRef;
  readonly predicate: string;
  readonly value: JsonValue;
  readonly claim_class?: string;
  readonly perspective?: string;
  readonly confidence: Confidence;
  readonly valid_from?: Instant;
  readonly valid_until?: Instant;
}
export interface RelationDraft extends DraftEnvelope<"relation">, SourceBearing {
  readonly from: RecordId;
  readonly to: RecordId;
  readonly relation_type: RelationType;
}
export interface ResolutionDraft extends DraftEnvelope<"resolution">, SourceBearing {
  readonly targets: readonly RecordId[];
  readonly decision: ResolutionDecision;
  readonly replacement?: RecordId;
  readonly effective_at?: Instant;
  readonly reason: string;
}
export interface VerificationDraft extends DraftEnvelope<"verification"> {
  readonly targets: readonly RecordId[];
  readonly verified_against: readonly VerificationBasis[];
  readonly result: VerificationResult;
}

export type LoreduDraft = EntryDraft | ClaimDraft | RelationDraft | ResolutionDraft | VerificationDraft;
interface PersistedEnvelope {
  readonly schema: "loredu.record/v1";
  readonly id: RecordId;
  readonly recorded_at: Instant;
}
export type Entry = EntryDraft & PersistedEnvelope;
export type Claim = ClaimDraft & PersistedEnvelope;
export type Relation = RelationDraft & PersistedEnvelope;
export type Resolution = ResolutionDraft & PersistedEnvelope;
export type Verification = VerificationDraft & PersistedEnvelope;
export type LoreduRecord = Entry | Claim | Relation | Resolution | Verification;

export interface ClaimKeyInput {
  readonly scope?: Scope;
  readonly subject: SubjectRef;
  readonly predicate: string;
  readonly perspective?: string;
}
export interface ClaimKey {
  readonly scope: readonly (readonly [string, string])[];
  readonly subject: SubjectRef;
  readonly predicate: string;
  readonly perspective?: string;
}
