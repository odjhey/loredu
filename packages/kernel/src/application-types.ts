import type { Basis } from "./domain/basis";
import type {
  Actor,
  ClaimId,
  ClaimKey,
  Confidence,
  JsonObject,
  JsonValue,
  PersistedRecord,
  RecordId,
  RecordKind,
  RelationType,
  ResolutionDecision,
  Scope,
  VerificationResult,
} from "./domain/entry";
import type { StreamPosition } from "./ports/capabilities";

export interface Affordance {
  readonly rel: "show" | "history" | "list" | "status" | "continue" | "init";
  readonly action:
    | "record.show"
    | "record.history"
    | "claims.list"
    | "history.list"
    | "status.read"
    | "store.init";
  readonly params: JsonObject;
  readonly why: string;
}

export interface Page {
  readonly returned: number;
  readonly total: number;
  readonly cursor?: string;
}

export interface RecordHandle {
  readonly id: RecordId;
  readonly kind: RecordKind;
  readonly affordances: readonly Affordance[];
}

export type ReconciliationFeedback =
  | { readonly state: "not-applicable"; readonly related: readonly [] }
  | { readonly state: "new-key"; readonly key: ClaimKey; readonly related: readonly [] }
  | {
      readonly state: "corroboration" | "conflict-candidate" | "coexisting";
      readonly key: ClaimKey;
      readonly related_count: number;
      readonly related: readonly [RecordHandle];
      readonly claims: Affordance;
    }
  | {
      readonly state: "unavailable";
      readonly key: ClaimKey;
      readonly reason: "post-commit-read-failed";
      readonly related: readonly [];
    };

export interface ApplicationResponse<R> {
  readonly ok: true;
  readonly result: R;
  readonly reconciliation: ReconciliationFeedback;
  readonly advice: readonly Affordance[];
  readonly basis: Basis;
}

export interface ApplicationListResponse<I> extends ApplicationResponse<readonly I[]> {
  readonly page: Page;
}

export interface ApplicationStatusResponse extends ApplicationResponse<StatusResult> {
  readonly page: Page;
}

export interface AddedRecordResult<R extends PersistedRecord = PersistedRecord> {
  readonly id: R["id"];
  readonly kind: R["kind"];
  readonly position: StreamPosition;
  readonly handle: RecordHandle;
}

export interface ShownRecordResult {
  readonly record: PersistedRecord;
  readonly position: StreamPosition;
  readonly handles: readonly RecordHandle[];
}

export type RecordSummary =
  | { readonly kind: "entry"; readonly title?: string; readonly entry_type?: string }
  | {
      readonly kind: "claim";
      readonly key: ClaimKey;
      readonly value: JsonValue;
      readonly confidence: Confidence;
    }
  | { readonly kind: "relation"; readonly relation_type: RelationType }
  | {
      readonly kind: "resolution";
      readonly decision: ResolutionDecision;
      readonly reason: string;
      readonly effective_at?: string;
    }
  | { readonly kind: "verification"; readonly result: VerificationResult };

export interface HistoryItem {
  readonly id: RecordId;
  readonly position: StreamPosition;
  readonly recorded_at: string;
  readonly actor: Actor;
  readonly scope: Scope;
  readonly summary: RecordSummary;
  readonly handles: readonly RecordHandle[];
}

export interface ClaimItem {
  readonly id: ClaimId;
  readonly position: StreamPosition;
  readonly recorded_at: string;
  readonly actor: Actor;
  readonly key: ClaimKey;
  readonly value: JsonValue;
  readonly confidence: Confidence;
  readonly handles: readonly RecordHandle[];
}

export interface HeadResult {
  readonly stream_position: StreamPosition;
}

export interface ClaimFilters {
  readonly scope?: Scope;
  readonly scope_match?: "subset" | "exact";
  readonly subject_type?: string;
  readonly subject?: string;
  readonly predicate?: string;
  readonly perspective?: string | null;
  readonly value?: JsonValue;
  readonly actor?: Actor;
  readonly since?: string;
}

export type ClaimQuery =
  | (ClaimFilters & { readonly limit?: number; readonly cursor?: never })
  | { readonly cursor: string; readonly limit?: number };
export type HistoryQuery =
  | { readonly id: RecordId; readonly limit?: number; readonly cursor?: never }
  | { readonly cursor: string; readonly limit?: number; readonly id?: never };
export type StatusQuery =
  | { readonly limit?: number; readonly cursor?: never }
  | { readonly cursor: string; readonly limit?: number };

export interface UnresolvedExclusiveGroup {
  readonly kind: "unresolved-exclusive-group";
  readonly key: ClaimKey;
  readonly claim_count: number;
  readonly representative: RecordHandle;
  readonly claims: Affordance;
}

export interface DanglingRecordReference {
  readonly kind: "dangling-record-reference";
  readonly record: RecordHandle;
  readonly path: string;
  readonly target: RecordId;
}

export type HealthItem = UnresolvedExclusiveGroup | DanglingRecordReference;

export interface KeyDivergenceAdvisory {
  readonly kind: "key-divergence";
  readonly scope: Scope;
  readonly value: JsonValue;
  readonly component_count: number;
  readonly representatives: readonly [RecordHandle, RecordHandle];
  readonly claims: Affordance;
}

export interface StatusResult {
  readonly healthy: boolean;
  readonly health: {
    readonly unresolved_exclusive_groups: number;
    readonly dangling_record_references: number;
  };
  readonly advisory_count: number;
  readonly attention: readonly HealthItem[];
  readonly advisories: readonly KeyDivergenceAdvisory[];
}
