import {
  affordance,
  type CursorPayload,
  createCursor,
  decodeCursor,
  deduplicateAdvice,
  handle,
  keyClaimsAffordance,
  makeBasis,
  type OrderedResumeKey,
  page,
  pinnedSnapshot,
  readSnapshot,
  type Snapshot,
  scopeContains,
} from "./application-read";
import type {
  Affordance,
  ApplicationCurrentResponse,
  CurrentKnowledgeItem,
  CurrentProjectionItem,
  CurrentQuery,
  CurrentValue,
  ProjectionEvidenceSummary,
  ProjectionHistorySummary,
  ProjectionReconciliationSummary,
  RecordHandle,
} from "./application-types";
import type { RulesetIdentity } from "./domain/basis";
import { claimKeyOf } from "./domain/claim-key";
import type {
  Claim,
  ClaimId,
  ClaimKey,
  JsonObject,
  PersistedRecord,
  RecordId,
  Relation,
  Resolution,
  Scope,
  SourceRef,
  Verification,
} from "./domain/entry";
import {
  compareUnicodeScalars,
  copyJsonObject,
  dataValue,
  escapePointer,
  hasOwnDescriptor,
  inspectObject,
  isScalarText,
  jsonValuesEqual,
  makeIssue,
  scalarLength,
} from "./domain/portable-json";
import { normalizeTimestamp } from "./domain/records";
import { LoreduError, type LoreduIssue } from "./errors";
import type { Clock, PositionedRecord, RecordStore } from "./ports/capabilities";
import { createInstant } from "./ports/capabilities";
import { type ClaimSemantics, evaluateClaimPolicy, type ValidatedClaimPolicy } from "./ports/claim-policy";
import {
  type ClassifiedClaimPair,
  classifyClaimPair,
  createClaimPolicyAdviceContext,
  type DerivedRelation,
  type DerivedRelationType,
  evaluateClaimPolicyAdvice,
  type PolicyAdvisory,
  type PositionedClaim,
  type PositionedRelation,
  type PositionedResolution,
  reconcileApplicableClaimGroup,
} from "./reconciliation";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const TOKEN = /^[a-z0-9](?:[a-z0-9._:/-]*[a-z0-9])?$/;
const RELATION_ORDER: readonly DerivedRelationType[] = Object.freeze([
  "duplicate",
  "corroboration",
  "support",
  "conflict",
  "coexistence",
  "temporal-succession",
]);

type ParsedCurrent = {
  readonly limit: number;
  readonly filters: { readonly scope?: Scope; readonly as_of?: string; readonly valid_at?: string };
  readonly cursor?: CursorPayload;
};
type ProjectionGroup = {
  readonly key: ClaimKey;
  readonly members: readonly PositionedClaim[];
  readonly semantics: ClaimSemantics;
  readonly primary: number;
};
type CurrentComputedItem = {
  readonly key: OrderedResumeKey;
  readonly value: CurrentProjectionItem;
};

function validationFailed(issues: readonly LoreduIssue[]): never {
  throw new LoreduError(
    "VALIDATION_FAILED",
    "Current Knowledge query validation failed",
    Object.freeze([...issues]),
  );
}

function cursorMismatch(message = "Cursor does not match this operation or snapshot"): never {
  throw new LoreduError("CURSOR_MISMATCH", message);
}

function frozenJsonObject(value: unknown): JsonObject {
  const issues: LoreduIssue[] = [];
  const copied = copyJsonObject(value, "", issues);
  if (!copied || issues.length > 0) throw new TypeError("internal value is not portable JSON");
  return copied;
}

function ownValue(data: Readonly<Record<string, PropertyDescriptor>>, key: string): unknown {
  return hasOwnDescriptor(data, key) ? dataValue(data, key) : undefined;
}

function parseLimit(value: unknown, present: boolean, issues: LoreduIssue[]): number {
  if (!present) return DEFAULT_LIMIT;
  if (typeof value !== "number") {
    issues.push(makeIssue("TYPE", "/limit", "must be a number"));
    return DEFAULT_LIMIT;
  }
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_LIMIT) {
    issues.push(makeIssue("RANGE", "/limit", "must be a safe integer from 1 through 200"));
    return DEFAULT_LIMIT;
  }
  return value;
}

function parseToken(value: unknown, path: string, issues: LoreduIssue[]): string | undefined {
  if (typeof value !== "string") {
    issues.push(makeIssue("TYPE", path, "must be a string"));
    return undefined;
  }
  if (!isScalarText(value) || scalarLength(value) > 128 || !TOKEN.test(value)) {
    issues.push(makeIssue("FORMAT", path, "must be an identifier-safe token"));
    return undefined;
  }
  return value;
}

function parseScope(value: unknown, issues: LoreduIssue[]): Scope | undefined {
  const data = inspectObject(value, "/scope", issues);
  if (!data) return undefined;
  const output = Object.create(null) as Record<string, string>;
  for (const key of Object.keys(data).sort(compareUnicodeScalars)) {
    const parsedKey = parseToken(key, `/scope/${escapePointer(key)}`, issues);
    const parsedValue = parseToken(dataValue(data, key), `/scope/${escapePointer(key)}`, issues);
    if (parsedKey && parsedValue)
      Object.defineProperty(output, parsedKey, {
        value: parsedValue,
        enumerable: true,
        configurable: false,
        writable: false,
      });
  }
  return Object.freeze(output);
}

function parseTimestamp(value: unknown, path: string, issues: LoreduIssue[]): string | undefined {
  return normalizeTimestamp(value, path, issues);
}

function normalizedQuery(filters: ParsedCurrent["filters"], validAt: string): JsonObject {
  return frozenJsonObject({
    operation: "current",
    ...(filters.scope === undefined || Object.keys(filters.scope).length === 0
      ? {}
      : { scope: filters.scope }),
    ...(filters.as_of === undefined ? {} : { as_of: filters.as_of }),
    valid_at: validAt,
  });
}

function filtersFromCursorQuery(query: JsonObject): ParsedCurrent["filters"] {
  const issues: LoreduIssue[] = [];
  const data = inspectObject(query, "", issues);
  if (!data) cursorMismatch("Cursor query is not normalized");
  for (const key of Object.keys(data))
    if (key !== "operation" && key !== "scope" && key !== "as_of" && key !== "valid_at")
      issues.push(makeIssue("UNKNOWN_FIELD", `/${escapePointer(key)}`, "is not part of current query"));
  if (ownValue(data, "operation") !== "current") cursorMismatch("Cursor query is not normalized");
  let scope: Scope | undefined;
  if (hasOwnDescriptor(data, "scope")) {
    scope = parseScope(ownValue(data, "scope"), issues);
    if (scope && Object.keys(scope).length === 0)
      issues.push(makeIssue("FORMAT", "/scope", "empty scope must be omitted"));
  }
  const asOf = hasOwnDescriptor(data, "as_of")
    ? parseTimestamp(ownValue(data, "as_of"), "/as_of", issues)
    : undefined;
  if (!hasOwnDescriptor(data, "valid_at")) issues.push(makeIssue("REQUIRED", "/valid_at", "is required"));
  const validAt = parseTimestamp(ownValue(data, "valid_at"), "/valid_at", issues);
  if (issues.length > 0 || !validAt) cursorMismatch("Cursor query is not normalized");
  const filters = Object.freeze({
    ...(scope === undefined ? {} : { scope }),
    ...(asOf === undefined ? {} : { as_of: asOf }),
    valid_at: validAt,
  });
  if (!jsonValuesEqual(normalizedQuery(filters, validAt), query))
    cursorMismatch("Cursor query is not normalized");
  return filters;
}

function parseCurrentQuery(input: unknown): ParsedCurrent {
  const issues: LoreduIssue[] = [];
  const value = input === undefined ? {} : input;
  const data = inspectObject(value, "", issues);
  if (!data) validationFailed(issues);
  for (const key of Object.keys(data))
    if (key !== "scope" && key !== "as_of" && key !== "valid_at" && key !== "limit" && key !== "cursor")
      issues.push(makeIssue("UNKNOWN_FIELD", `/${escapePointer(key)}`, "is not part of current query"));
  const limit = parseLimit(ownValue(data, "limit"), hasOwnDescriptor(data, "limit"), issues);
  if (hasOwnDescriptor(data, "cursor")) {
    for (const key of Object.keys(data))
      if (key !== "cursor" && key !== "limit")
        issues.push(makeIssue("UNKNOWN_FIELD", `/${escapePointer(key)}`, "cannot accompany cursor"));
    const raw = ownValue(data, "cursor");
    if (typeof raw !== "string") issues.push(makeIssue("TYPE", "/cursor", "must be a string"));
    if (issues.length > 0) validationFailed(issues);
    const cursor = decodeCursor(raw as string);
    if (cursor.operation !== "current") cursorMismatch();
    return Object.freeze({ limit, filters: filtersFromCursorQuery(cursor.query), cursor });
  }

  let scope: Scope | undefined;
  if (hasOwnDescriptor(data, "scope")) scope = parseScope(ownValue(data, "scope"), issues);
  const asOf = hasOwnDescriptor(data, "as_of")
    ? parseTimestamp(ownValue(data, "as_of"), "/as_of", issues)
    : undefined;
  const validAt = hasOwnDescriptor(data, "valid_at")
    ? parseTimestamp(ownValue(data, "valid_at"), "/valid_at", issues)
    : undefined;
  if (issues.length > 0) validationFailed(issues);
  return Object.freeze({
    limit,
    filters: Object.freeze({
      ...(scope === undefined || Object.keys(scope).length === 0 ? {} : { scope }),
      ...(asOf === undefined ? {} : { as_of: asOf }),
      ...(validAt === undefined ? {} : { valid_at: validAt }),
    }),
  });
}

function policySemantics(policy: ValidatedClaimPolicy, key: ClaimKey): ClaimSemantics {
  const result = evaluateClaimPolicy(policy, key);
  if (result.issues.length > 0 || result.semantics === undefined) validationFailed(result.issues);
  return result.semantics;
}

function claimKeyIdentity(key: ClaimKey): string {
  return JSON.stringify([
    key.scope,
    key.subject.type,
    key.subject.id,
    key.predicate,
    key.perspective ?? null,
  ]);
}

function isApplicable(claim: Claim, validAt: string): boolean {
  return (
    (claim.valid_from === undefined || claim.valid_from <= validAt) &&
    (claim.valid_until === undefined || validAt <= claim.valid_until)
  );
}

function visibleRecords(snapshot: Snapshot, asOf: string | undefined): readonly PositionedRecord[] {
  if (asOf === undefined) return snapshot.records;
  return Object.freeze(snapshot.records.filter((item) => item.record.recorded_at <= asOf));
}

function positionedClaims(records: readonly PositionedRecord[]): readonly PositionedClaim[] {
  return Object.freeze(
    records
      .filter((item): item is PositionedRecord & { readonly record: Claim } => item.record.kind === "claim")
      .map((item) => Object.freeze({ position: item.position, record: item.record })),
  );
}

function backwardRelations(
  records: readonly PositionedRecord[],
  byId: ReadonlyMap<RecordId, PositionedRecord>,
): readonly PositionedRelation[] {
  return Object.freeze(
    records
      .filter(
        (item): item is PositionedRecord & { readonly record: Relation } => item.record.kind === "relation",
      )
      .filter((item) => {
        const from = byId.get(item.record.from);
        const to = byId.get(item.record.to);
        return (
          from !== undefined &&
          to !== undefined &&
          from.position < item.position &&
          to.position < item.position
        );
      })
      .map((item) => Object.freeze({ position: item.position, record: item.record })),
  );
}

function effectiveResolutions(
  records: readonly PositionedRecord[],
  byId: ReadonlyMap<RecordId, PositionedRecord>,
  validAt: string,
): readonly PositionedResolution[] {
  return Object.freeze(
    records
      .filter(
        (item): item is PositionedRecord & { readonly record: Resolution } =>
          item.record.kind === "resolution",
      )
      .filter(
        (item) =>
          (item.record.effective_at === undefined || item.record.effective_at <= validAt) &&
          item.record.targets.every((id) => {
            const target = byId.get(id);
            return target !== undefined && target.position < item.position;
          }) &&
          (item.record.replacement === undefined ||
            ((byId.get(item.record.replacement)?.position ?? item.position) < item.position &&
              byId.get(item.record.replacement)?.record.kind === "claim")),
      )
      .map((item) => Object.freeze({ position: item.position, record: item.record })),
  );
}

function buildGroups(
  claims: readonly PositionedClaim[],
  policy: ValidatedClaimPolicy,
): readonly ProjectionGroup[] {
  const builders = new Map<string, { key: ClaimKey; members: PositionedClaim[] }>();
  for (const claim of claims) {
    const key = claimKeyOf(claim.record);
    const identity = claimKeyIdentity(key);
    const found = builders.get(identity);
    if (found) found.members.push(claim);
    else builders.set(identity, { key, members: [claim] });
  }
  return Object.freeze(
    [...builders.values()].map((builder) =>
      Object.freeze({
        key: builder.key,
        members: Object.freeze(builder.members),
        semantics: policySemantics(policy, builder.key),
        primary: Number((builder.members[0] as PositionedClaim).position),
      }),
    ),
  );
}

function allDerived(group: ProjectionGroup): readonly ClassifiedClaimPair[] {
  const output: ClassifiedClaimPair[] = [];
  for (let later = 1; later < group.members.length; later++)
    for (let earlier = 0; earlier < later; earlier++) {
      const pair = classifyClaimPair(
        group.members[later] as PositionedClaim,
        group.members[earlier] as PositionedClaim,
        group.semantics,
      );
      if (pair) output.push(pair);
    }
  output.sort((left, right) => {
    const leftLow = Math.min(Number(left.from.position), Number(left.to.position));
    const rightLow = Math.min(Number(right.from.position), Number(right.to.position));
    const leftHigh = Math.max(Number(left.from.position), Number(left.to.position));
    const rightHigh = Math.max(Number(right.from.position), Number(right.to.position));
    return (
      leftLow - rightLow ||
      leftHigh - rightHigh ||
      RELATION_ORDER.indexOf(left.relation) - RELATION_ORDER.indexOf(right.relation)
    );
  });
  return Object.freeze(output);
}

function renderedRelation(pair: ClassifiedClaimPair): DerivedRelation {
  return Object.freeze({
    relation: pair.relation,
    from: handle(pair.from.record),
    to: handle(pair.to.record),
  });
}

function relationTouchesGroup(relation: PositionedRelation, ids: ReadonlySet<RecordId>): boolean {
  return ids.has(relation.record.from) || ids.has(relation.record.to);
}

function resolutionTouchesGroup(
  resolution: PositionedResolution,
  ids: ReadonlySet<RecordId>,
  relationIds: ReadonlySet<RecordId>,
): boolean {
  return resolution.record.targets.some((id) => ids.has(id) || relationIds.has(id));
}

function distinctSources(sources: readonly SourceRef[]): readonly SourceRef[] {
  const unique: SourceRef[] = [];
  for (const source of sources)
    if (!unique.some((existing) => jsonValuesEqual(existing as never, source as never))) unique.push(source);
  return Object.freeze(unique);
}

function evidenceDetails(
  contributing: readonly PositionedClaim[],
  visible: readonly PositionedRecord[],
  byId: ReadonlyMap<RecordId, PositionedRecord>,
): {
  readonly summary: ProjectionEvidenceSummary;
  readonly sources: readonly SourceRef[];
  readonly needs_revalidation_count: number;
} {
  const claimIds = new Set(contributing.map((claim) => claim.record.id));
  const entries = new Map<RecordId, PersistedRecord>();
  const sources: SourceRef[] = [];
  for (const claim of contributing) {
    sources.push(...claim.record.sources);
    for (const entryId of claim.record.derived_from) {
      const entry = byId.get(entryId);
      if (entry && entry.position < claim.position && entry.record.kind === "entry") {
        entries.set(entry.record.id, entry.record);
        sources.push(...entry.record.sources);
      }
    }
  }
  const counts = { confirmed: 0, contradicted: 0, unchanged: 0, needs_revalidation: 0 };
  for (const item of visible) {
    if (item.record.kind !== "verification") continue;
    const verification = item.record as Verification;
    if (!verification.targets.some((id) => claimIds.has(id))) continue;
    if (
      !verification.targets.every((id) => {
        const target = byId.get(id);
        return target !== undefined && target.position < item.position;
      })
    )
      continue;
    counts[verification.result]++;
    sources.push(...verification.verified_against);
  }
  const distinct = distinctSources(sources);
  return Object.freeze({
    summary: Object.freeze({
      entry_count: entries.size,
      source_count: distinct.length,
      verification: Object.freeze(counts),
    }),
    sources: distinct,
    needs_revalidation_count: counts.needs_revalidation,
  });
}

function evidenceSummary(
  contributing: readonly PositionedClaim[],
  visible: readonly PositionedRecord[],
  byId: ReadonlyMap<RecordId, PositionedRecord>,
): ProjectionEvidenceSummary {
  return evidenceDetails(contributing, visible, byId).summary;
}

function valuesTuple(
  groups: readonly { readonly claims: readonly PositionedClaim[] }[],
): readonly [] | readonly [CurrentValue] | readonly [CurrentValue, CurrentValue] {
  const values = groups.slice(0, 2).map((group) => {
    const representative = group.claims[0] as PositionedClaim;
    return Object.freeze({
      value: representative.record.value,
      representative: handle(representative.record),
      claim_count: group.claims.length,
    });
  });
  return Object.freeze(values) as
    | readonly []
    | readonly [CurrentValue]
    | readonly [CurrentValue, CurrentValue];
}

function historySummary(
  group: ProjectionGroup,
  derived: readonly ClassifiedClaimPair[],
  relations: readonly PositionedRelation[],
  resolutions: readonly PositionedResolution[],
): ProjectionHistorySummary {
  const claimIds = new Set<RecordId>(group.members.map((claim) => claim.record.id));
  const touchingRelations = relations.filter((relation) => relationTouchesGroup(relation, claimIds));
  const relationIds = new Set<RecordId>(touchingRelations.map((relation) => relation.record.id));
  const touchingResolutions = resolutions.filter((resolution) =>
    resolutionTouchesGroup(resolution, claimIds, relationIds),
  );
  const preview = Object.freeze(derived.slice(0, 2).map(renderedRelation)) as
    | readonly []
    | readonly [DerivedRelation]
    | readonly [DerivedRelation, DerivedRelation];
  const latest = touchingResolutions[touchingResolutions.length - 1];
  return Object.freeze({
    claim_count: group.members.length,
    derived_relation_count: derived.length,
    explicit_relation_count: touchingRelations.length,
    resolution_count: touchingResolutions.length,
    relations: preview,
    ...(latest === undefined ? {} : { latest_resolution: handle(latest.record) }),
  });
}

function advisoryItem(
  draft: ReturnType<typeof evaluateClaimPolicyAdvice>[number],
  policy: ValidatedClaimPolicy,
  claimsById: ReadonlyMap<ClaimId, PositionedClaim>,
): PolicyAdvisory {
  const handles = draft.claims.map((id) => handle((claimsById.get(id) as PositionedClaim).record));
  return Object.freeze({
    kind: "policy-advisory",
    code: draft.code,
    policy: Object.freeze({ id: policy.id, version: policy.version }),
    claims: Object.freeze(handles) as unknown as
      | readonly [RecordHandle]
      | readonly [RecordHandle, RecordHandle],
    details: draft.details,
  });
}

function sameKey(left: OrderedResumeKey, right: OrderedResumeKey): boolean {
  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

function computeProjection(
  snapshot: Snapshot,
  query: JsonObject,
  filters: ParsedCurrent["filters"],
  validAt: string,
  policy: ValidatedClaimPolicy,
): {
  readonly items: readonly CurrentComputedItem[];
  readonly summary: ProjectionReconciliationSummary;
} {
  const visible = visibleRecords(snapshot, filters.as_of);
  const byId = new Map<RecordId, PositionedRecord>(visible.map((item) => [item.record.id, item]));
  // Resolution reference eligibility is store-visible, while output identity remains query-selected.
  const visibleClaims = positionedClaims(visible);
  const requestedScope = filters.scope;
  const claims =
    requestedScope === undefined
      ? visibleClaims
      : Object.freeze(visibleClaims.filter((claim) => scopeContains(claim.record.scope, requestedScope)));
  const groups = buildGroups(claims, policy);
  const relations = backwardRelations(visible, byId);
  const resolutions = effectiveResolutions(visible, byId, validAt);
  const applicableClaims = Object.freeze(claims.filter((claim) => isApplicable(claim.record, validAt)));
  const context = createClaimPolicyAdviceContext({
    query,
    claims: applicableClaims,
    relations,
    resolutions,
    validAt,
  });

  const relationCounts: Record<DerivedRelationType, number> = {
    duplicate: 0,
    corroboration: 0,
    support: 0,
    conflict: 0,
    coexistence: 0,
    "temporal-succession": 0,
  };
  const knowledgeCounts = { preferred: 0, coexisting: 0, disputed: 0, retracted: 0 };
  const computed: CurrentComputedItem[] = [];
  for (const group of groups) {
    const derived = allDerived(group);
    for (const pair of derived) relationCounts[pair.relation]++;
    const applicable = group.members.filter((claim) => isApplicable(claim.record, validAt));
    if (applicable.length === 0) continue;
    const reconciled = reconcileApplicableClaimGroup({
      claims: applicable,
      visibleRecords: visible,
      relations,
      resolutions,
      semantics: group.semantics,
    });
    knowledgeCounts[reconciled.state]++;
    const valueTuple = valuesTuple(reconciled.values);
    const item: CurrentKnowledgeItem = Object.freeze({
      kind: "knowledge",
      key: group.key,
      semantics: group.semantics,
      state: reconciled.state,
      value_count: reconciled.values.length,
      values: valueTuple,
      history: historySummary(group, derived, relations, resolutions),
      evidence: evidenceSummary(
        reconciled.values.flatMap((value) => value.claims),
        visible,
        byId,
      ),
      claims: keyClaimsAffordance(group.key),
    });
    computed.push(
      Object.freeze({
        key: Object.freeze([0, group.primary, 0]) as OrderedResumeKey,
        value: item,
      }),
    );
  }

  const drafts = evaluateClaimPolicyAdvice(policy, context);
  const claimsById = new Map(context.claims.map((claim) => [claim.record.id, claim]));
  const advisoryOrdinals = new Map<number, number>();
  for (const draft of drafts) {
    const primary = Math.min(
      ...draft.claims.map((id) => Number((claimsById.get(id) as PositionedClaim).position)),
    );
    const ordinal = advisoryOrdinals.get(primary) ?? 0;
    advisoryOrdinals.set(primary, ordinal + 1);
    computed.push(
      Object.freeze({
        key: Object.freeze([1, primary, ordinal]) as OrderedResumeKey,
        value: advisoryItem(draft, policy, claimsById),
      }),
    );
  }

  return Object.freeze({
    items: Object.freeze(computed),
    summary: Object.freeze({
      state: "projection",
      relations: Object.freeze({
        duplicate: relationCounts.duplicate,
        corroboration: relationCounts.corroboration,
        support: relationCounts.support,
        conflict: relationCounts.conflict,
        coexistence: relationCounts.coexistence,
        temporal_succession: relationCounts["temporal-succession"],
      }),
      knowledge: Object.freeze(knowledgeCounts),
      policy_advisories: drafts.length,
      related: Object.freeze([]) as readonly [],
    }),
  });
}

export interface LoreKnowledgeProjection {
  readonly item: CurrentKnowledgeItem;
  readonly contributing: readonly PositionedClaim[];
  readonly primary: number;
  readonly values: readonly import("./domain/entry").JsonValue[];
  readonly sources: readonly SourceRef[];
  readonly needs_revalidation_count: number;
}

/** Internal M3 seam: complete M2 knowledge without invoking optional policy advice. */
export function computeLoreKnowledge(
  snapshot: Snapshot,
  validAt: string,
  requestedScope: Scope | undefined,
  policy: ValidatedClaimPolicy,
): readonly LoreKnowledgeProjection[] {
  const visible = snapshot.records;
  const byId = new Map<RecordId, PositionedRecord>(visible.map((item) => [item.record.id, item]));
  const visibleClaims = positionedClaims(visible);
  const claims =
    requestedScope === undefined
      ? visibleClaims
      : Object.freeze(visibleClaims.filter((claim) => scopeContains(claim.record.scope, requestedScope)));
  const groups = buildGroups(claims, policy);
  const relations = backwardRelations(visible, byId);
  const resolutions = effectiveResolutions(visible, byId, validAt);
  const output: LoreKnowledgeProjection[] = [];
  for (const group of groups) {
    const applicable = group.members.filter((claim) => isApplicable(claim.record, validAt));
    if (applicable.length === 0) continue;
    const reconciled = reconcileApplicableClaimGroup({
      claims: applicable,
      visibleRecords: visible,
      relations,
      resolutions,
      semantics: group.semantics,
    });
    const values = valuesTuple(reconciled.values);
    const details = evidenceDetails(reconciled.claims, visible, byId);
    const item: CurrentKnowledgeItem = Object.freeze({
      kind: "knowledge",
      key: group.key,
      semantics: group.semantics,
      state: reconciled.state,
      value_count: reconciled.values.length,
      values,
      history: historySummary(group, allDerived(group), relations, resolutions),
      evidence: details.summary,
      claims: keyClaimsAffordance(group.key),
    });
    output.push(
      Object.freeze({
        item,
        contributing: reconciled.claims,
        primary: Math.min(...reconciled.claims.map((claim) => Number(claim.position))),
        values: Object.freeze(
          reconciled.values.map((value) => (value.claims[0] as PositionedClaim).record.value),
        ),
        sources: details.sources,
        needs_revalidation_count: details.needs_revalidation_count,
      }),
    );
  }
  return Object.freeze(output);
}

function correctiveAdvice(items: readonly CurrentComputedItem[]): readonly Affordance[] {
  const corrective: Affordance[] = [];
  for (const { value: item } of items) {
    if (item.kind !== "knowledge" || item.state !== "disputed") continue;
    corrective.push(item.claims);
    for (const value of item.values) corrective.push(value.representative.affordances[0] as Affordance);
  }
  return deduplicateAdvice(corrective);
}

function clockSample(clock: Clock): string {
  try {
    return new Date(createInstant(clock.now())).toISOString();
  } catch {
    throw new LoreduError("CLOCK_FAILED", "Clock failed");
  }
}

export function createCurrentService(
  store: RecordStore,
  clock: Clock,
  policy: ValidatedClaimPolicy,
  ruleset: RulesetIdentity,
): (query?: CurrentQuery) => Promise<ApplicationCurrentResponse> {
  return async (input?: CurrentQuery): Promise<ApplicationCurrentResponse> => {
    const parsed = parseCurrentQuery(input);
    const computedAt = parsed.cursor?.computed_at ?? clockSample(clock);
    if (!computedAt) cursorMismatch("Current cursor has no computed time");
    const validAt = parsed.cursor
      ? (parsed.filters.valid_at as string)
      : (parsed.filters.valid_at ?? parsed.filters.as_of ?? computedAt);
    const query = parsed.cursor?.query ?? normalizedQuery(parsed.filters, validAt);
    const current = await readSnapshot(store);
    const snapshot = parsed.cursor === undefined ? current : pinnedSnapshot(current, parsed.cursor, ruleset);
    const basis = parsed.cursor?.basis ?? makeBasis(snapshot.head, ruleset, query);
    if (!jsonValuesEqual(basis.query, query)) cursorMismatch("Cursor Basis query does not match");
    const projection = computeProjection(snapshot, query, parsed.filters, validAt, policy);
    const resume = parsed.cursor?.resume as OrderedResumeKey | undefined;
    const resumeIndex =
      resume === undefined ? -1 : projection.items.findIndex((item) => sameKey(item.key, resume));
    if (resume !== undefined && resumeIndex < 0)
      cursorMismatch("Current cursor resume item is absent from the recomputed stream");
    const remaining = projection.items.slice(resumeIndex + 1);
    const selected = remaining.slice(0, parsed.limit);
    const cursor =
      remaining.length > selected.length
        ? createCursor(
            "current",
            query,
            basis,
            snapshot,
            (selected[selected.length - 1] as CurrentComputedItem).key,
            computedAt,
          )
        : undefined;
    const continuation =
      cursor === undefined
        ? []
        : [
            affordance(
              "continue",
              "current.read",
              { cursor, ...(parsed.limit === DEFAULT_LIMIT ? {} : { limit: parsed.limit }) },
              "continue this pinned Current Knowledge projection",
            ),
          ];
    return Object.freeze({
      ok: true,
      result: Object.freeze({
        computed_at: computedAt,
        items: Object.freeze(selected.map((item) => item.value)),
      }),
      reconciliation: projection.summary,
      advice: deduplicateAdvice([...correctiveAdvice(selected), ...continuation]),
      basis,
      page: page(selected.length, projection.items.length, cursor),
    });
  };
}
