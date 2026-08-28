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
import type { ClaimSemantics } from "./ports/claim-policy";
import type { CurrentKnowledgeState, DerivedRelation, PolicyAdvisory } from "./reconciliation";

export interface Affordance {
  readonly rel: "show" | "history" | "list" | "status" | "current" | "continue" | "init";
  readonly action:
    | "record.show"
    | "record.history"
    | "claims.list"
    | "history.list"
    | "status.read"
    | "current.read"
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
      readonly state:
        | "duplicate"
        | "corroboration"
        | "support"
        | "conflict-candidate"
        | "coexisting"
        | "temporal-succession";
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

export type ProjectionFilters = {
  readonly scope?: Scope;
  readonly as_of?: string;
  readonly valid_at?: string;
};
export type CurrentQuery =
  | (ProjectionFilters & { readonly limit?: number; readonly cursor?: never })
  | { readonly cursor: string; readonly limit?: number };

export interface CurrentValue {
  readonly value: JsonValue;
  readonly representative: RecordHandle;
  readonly claim_count: number;
}
export interface ProjectionHistorySummary {
  readonly claim_count: number;
  readonly derived_relation_count: number;
  readonly explicit_relation_count: number;
  readonly resolution_count: number;
  readonly relations: readonly [] | readonly [DerivedRelation] | readonly [DerivedRelation, DerivedRelation];
  readonly latest_resolution?: RecordHandle;
}
export interface ProjectionEvidenceSummary {
  readonly entry_count: number;
  readonly source_count: number;
  readonly verification: {
    readonly confirmed: number;
    readonly contradicted: number;
    readonly unchanged: number;
    readonly needs_revalidation: number;
  };
}
export interface CurrentKnowledgeItem {
  readonly kind: "knowledge";
  readonly key: ClaimKey;
  readonly semantics: ClaimSemantics;
  readonly state: CurrentKnowledgeState;
  readonly value_count: number;
  readonly values: readonly [] | readonly [CurrentValue] | readonly [CurrentValue, CurrentValue];
  readonly history: ProjectionHistorySummary;
  readonly evidence: ProjectionEvidenceSummary;
  readonly claims: Affordance;
}
export type CurrentProjectionItem = CurrentKnowledgeItem | PolicyAdvisory;
export interface CurrentProjectionResult {
  readonly computed_at: string;
  readonly items: readonly CurrentProjectionItem[];
}
export interface ProjectionReconciliationSummary {
  readonly state: "projection";
  readonly relations: {
    readonly duplicate: number;
    readonly corroboration: number;
    readonly support: number;
    readonly conflict: number;
    readonly coexistence: number;
    readonly temporal_succession: number;
  };
  readonly knowledge: {
    readonly preferred: number;
    readonly coexisting: number;
    readonly disputed: number;
    readonly retracted: number;
  };
  readonly policy_advisories: number;
  readonly related: readonly [];
}
export type ApplicationCurrentResponse = Omit<
  ApplicationResponse<CurrentProjectionResult>,
  "reconciliation"
> & {
  readonly reconciliation: ProjectionReconciliationSummary;
  readonly page: Page;
};

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
