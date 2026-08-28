---
name: projection_contract
description: "Exact deterministic reconciliation, Resolution precedence, bitemporal Current Knowledge, projection history/evidence summaries, and rebuild/staleness behavior."
type: contract
tags: [contracts, projection, temporal, event-sourcing, reconciliation]
generated: "OpenAI coding agent, 2026-08-28"
created_at: 2026-08-26T12:10:00+08:00
---

# Projection contract

A Projection is detached, recursively frozen derived data computed from immutable records. It is disposable, never canonical, and may be rebuilt at any time. [Decision 0027](../../decisions/0027-m2-reconciliation-projection-contract.md) closes the M2 behavior below. Current implementation and catalog status are tracked by the [implementation plan](../../v0.x/execution/implementation-plan.md) and [`catalog-status.json`](../../v0.x/execution/catalog-status.json).

## Exact boundary

M2 adds one surface-neutral application operation. The application performs reconciliation as part of projection; it does not append derived Relation or Resolution records.

```ts
interface ProjectionFilters {
  readonly scope?: Scope
  readonly as_of?: string
  readonly valid_at?: string
}
type CurrentQuery =
  | (ProjectionFilters & {readonly limit?: number; readonly cursor?: never})
  | {readonly cursor: string; readonly limit?: number}

type ApplicationCurrentResponse =
  Omit<ApplicationResponse<CurrentProjectionResult>, "reconciliation"> & {
    readonly reconciliation: ProjectionReconciliationSummary
    readonly page: Page
  }
interface CurrentProjectionResult {
  readonly computed_at: string
  readonly items: readonly CurrentProjectionItem[]
}
type CurrentProjectionItem = CurrentKnowledgeItem | PolicyAdvisory

interface LoreduApplication {
  // M0/M1.5 members remain unchanged.
  current(query?: CurrentQuery): Promise<ApplicationCurrentResponse>
}
```

All supplied filters combine with logical AND. Scope uses the Claim-query subset rule: every supplied pair must occur in the ClaimKey scope with the same value; omitted scope and `{}` both mean every scope and normalize to omission. Cursorless input is closed inert data under the normal descriptor-safe validation rules. Limits remain 1–200 with default 50. A cursor form forbids every filter and may carry only `limit`.

`current` is the complete public M2 projection interface. Existing `claims`, `show`, and `history` remain the record-history/evidence disclosure interface; M2 does not introduce a second mutable history, an evidence store, or surface-shaped `resolve` method. Current Knowledge summaries link back to exact-key Claims and record handles, from which `show` exposes Claim/Entry/SourceRef/Verification data and `history` exposes the canonical records that refer to them.

## Recorded time and valid time

Loredu keeps two independent inclusive dimensions:

- **recorded time** — `recorded_at`, when a record entered Loredu history;
- **valid time** — a Claim's closed interval `[valid_from, valid_until]`, with either absent bound unbounded, and a Resolution's optional `effective_at`.

A cursorless request resolves one exact valid-time point before deriving content:

| Request | Visible records | Valid-time point |
|---|---|---|
| current | all records in the pinned prefix | one Clock sample |
| `as_of=A` | records whose `recorded_at <= A` | `A` |
| `valid_at=V` | all records in the pinned prefix | `V` |
| `as_of=A, valid_at=V` | records whose `recorded_at <= A` | `V` |

Caller timestamps use the record contract grammar and normalize to canonical milliseconds. `as_of` and both Claim bounds are inclusive. A Claim applies at the resolved point exactly when `(valid_from absent or valid_from <= point) && (valid_until absent or point <= valid_until)`. A Resolution applies in valid time exactly when `effective_at` is absent or `effective_at <= point`.

This split is deliberate. `as_of=A, valid_at=V` can ask what Loredu knew at A about an earlier or later external-world point V. A current `valid_at=V` may use evidence learned after V. Stream position remains commit order; an `as_of` cutoff compares canonical `recorded_at`, not ids or positions. A visible Relation, Resolution, or Verification whose referenced record is excluded by `as_of` is ineligible for that projection.

The application samples its injected Clock once before the atomic scan on a cursorless `current` call. That sample is `computed_at`; it is also the implicit valid-time point only when neither temporal flag is supplied. With `as_of` alone the valid-time point is A, while `computed_at` remains the independent Clock sample. A continuation takes `computed_at` and the resolved valid point from its cursor and consumes no Clock call.

The normalized Basis query is exact:

```text
{operation:"current", valid_at:"<resolved canonical point>"}
{operation:"current", scope:{...}, as_of:"<canonical A>", valid_at:"<canonical V>"}
```

`valid_at` is therefore always present in a Current Knowledge Basis, even when resolved implicitly. Empty scope is omitted. `limit`, `cursor`, and `computed_at` are never Basis fields.

## ClaimPolicy mediation

Core constructs the exact declared ClaimKey and never reconciles across it. For selected visible keys, ordered by their earliest Claim position, projection calls `validateClaimKey` once and then `semantics` once if validation accepts. Callback failures and malformed results are fresh `VALIDATION_FAILED` errors with no partial projection.

M2 additively permits one optional callback on the otherwise unchanged versioned policy:

```ts
interface PositionedClaim {
  readonly position: StreamPosition
  readonly record: Claim
}
interface PositionedRelation {
  readonly position: StreamPosition
  readonly record: Relation
}
interface PositionedResolution {
  readonly position: StreamPosition
  readonly record: Resolution
}
interface ClaimPolicyAdviceContext {
  readonly query: JsonObject
  readonly claims: readonly PositionedClaim[]
  readonly relations: readonly PositionedRelation[]
  readonly resolutions: readonly PositionedResolution[]
}
interface PolicyAdvisoryDraft {
  readonly code: string
  readonly claims: readonly [ClaimId] | readonly [ClaimId, ClaimId]
  readonly details: JsonObject
}
interface ClaimPolicy {
  readonly id: string
  readonly version: string
  validateClaimKey(key: ClaimKey): readonly LoreduIssue[]
  semantics(key: ClaimKey): ClaimSemantics
  advise?(context: ClaimPolicyAdviceContext): readonly PolicyAdvisoryDraft[]
}
```

`advise`, when present, is captured and descriptor-validated at assembly but is not invoked by `createRulesetIdentity`. For advice-context construction, let **C** be every scope-selected, recorded-visible, valid-time-applicable Claim, ordered by stream position. A recorded-visible, backward-valid Relation is admitted exactly when both endpoints resolve to Claims in C; every Relation type and cross-key link is allowed. A recorded-visible, valid-time-effective, backward-valid Resolution is admitted exactly when it has at least one target, every Claim target belongs to C, every Relation target is an admitted Relation, and any replacement belongs to C. Mixed qualifying Claim/Relation targets are allowed; one irrelevant or nonapplicable target excludes the entire Resolution from this context. The callback receives exactly C and those admitted Relation/Resolution arrays as detached recursively frozen values in stream order; empty C and empty related arrays remain valid input. `query` is the normalized Basis query.

After cursor/query/snapshot admission, pinned reconciliation, and construction of that frozen context, core invokes `advise` exactly once on every `current` call: first page and every continuation, including an empty or knowledge-only projection. An omitted callback is invoked zero times. An invalid/mismatched cursor fails before admission and invokes it zero times. Invocation occurs before full advisory validation, combined-stream counting/ordering, resume, and pagination.

The callback result is descriptor-checked as a normal Array with its standard own data `length` descriptor. The first safely read own data length is authoritative. A length above 200 produces a fresh `VALIDATION_FAILED` before any indexed descriptor or value inspection, density or element validation, advisory sorting or counting, or pagination. For an accepted length, the structural snapshot must retain that exact length and contain no canonical numeric key outside its range; drift or an out-of-range key rejects without inspecting indexed values. Every in-range index must then be an own enumerable data property, and no hole, accessor, custom prototype, symbol, or other excess property is accepted. Each element must be a closed plain object: `code` is an identifier-safe token, `claims` contains one or two distinct ids from the input Claim array, and `details` is a closed canonical JsonObject. The nested `claims` tuple follows the same first-length discipline with an exact length of one or two: any other initial length fails before own-key or indexed descriptor/value inspection, a later length drift fails before own-key inspection, and accepted tuples reject out-of-range keys, holes, accessors, custom prototypes, symbols, and extras without adopting a changed length. Core orders the referenced handles by position and orders advisories by code, then referenced positions, preserving callback order for a remaining tie; an exact duplicate output is `VALIDATION_FAILED`, not silently coalesced. Throwing or malformed output fails the operation with a fresh `VALIDATION_FAILED`, no partial result, and no foreign details. The maximum of 200 is a protocol literal and adds no public constant or export.

A policy advisory may point across exact keys, but it cannot create a derived relation, merge groups, change a Claim state, choose a value, close health, or suppress core key-divergence. It is non-blocking mechanics, not judgment. Same inputs and policy version must reproduce the same validated canonical advisory stream; adding or changing advisory behavior requires a new policy version. The default policy omits `advise` and emits no policy advisories.

The rendered derived shape is:

```ts
interface PolicyAdvisory {
  readonly kind: "policy-advisory"
  readonly code: string
  readonly policy: {readonly id: string; readonly version: string}
  readonly claims: readonly [RecordHandle] | readonly [RecordHandle, RecordHandle]
  readonly details: JsonObject
}
```

## Derived relation vocabulary and pair boundaries

Core emits only these derived relation names:

```ts
type DerivedRelationType =
  | "duplicate"
  | "corroboration"
  | "support"
  | "conflict"
  | "coexistence"
  | "temporal-succession"
interface DerivedRelation {
  readonly relation: DerivedRelationType
  readonly from: RecordHandle
  readonly to: RecordHandle
}
```

Derived relations compare recorded-visible Claims within one exact ClaimKey. They are data, not persisted `relation` records. Except for temporal succession, `from` is the later stream Claim and `to` the earlier. Pair validity intervals overlap when they share at least one instant; because bounds are inclusive, an end equal to a start overlaps.

For one same-key pair, exactly one of these boundaries applies:

1. **Temporal succession** — intervals are strictly disjoint. The externally later interval is `from`, regardless of record order; equal or differing values do not alter this relation.
2. **Conflict** — intervals overlap, values are canonically different, and policy semantics are `exclusive`.
3. **Coexistence** — intervals overlap, values are canonically different, and semantics are `coexisting`.
4. **Duplicate** — intervals overlap, values are canonically equal, and the semantic fingerprint is equal. The fingerprint is ClaimKey, value, presence/value of `claim_class`, confidence, validity bounds, the order-insensitive `derived_from` set, and the order-insensitive complete SourceRef set. In addition, either Actors are equal or that equal evidence basis is nonempty. Record id, `recorded_at`, metadata, and source-array declaration order do not distinguish a duplicate.
5. **Corroboration** — intervals overlap and values are canonically equal, the pair is not a duplicate, and either Actors differ or their evidence sets differ. T20's different actors/phrasing therefore corroborate even when neither Claim cites a SourceRef.
6. **Support** — the remaining overlapping equal-value case. It is same-actor, non-duplicate reinforcement whose provenance does not establish independent corroboration, for example a later confidence or validity refinement.

Canonical value equality is `jsonValuesEqual`: object property order is irrelevant; array order and multiplicity matter; `1` and `"1"` differ. Relation counts are pair counts, not Claim counts. The same pair never appears under two derived names.

Persisted Relations remain explicit records and retain the record vocabulary `supports|contradicts|duplicates|supersedes|derived_from|related_to`. They are never relabeled as derived output. Same-key active `supersedes` can establish projection precedence below; cross-key Relations remain inspectable history and, for `duplicates`, may suppress the separate core key-divergence advisory, but never cause cross-key reconciliation. Derived-to-manual corpus comparison maps `duplicate→duplicates`, `corroboration|support→supports`, `conflict→contradicts`, and `temporal-succession→supersedes`; coexistence has no persisted v1 equivalent. A disagreement is review evidence, never an automatic append or override.

## Explicit Resolution precedence

A record is structurally replayable under the record contract even when it cannot settle a particular projection group. Projection application is deliberately stricter and mechanical.

After scope and recorded-time selection, core builds each key's **applicable Claim set** before any preference tier: the nonempty set of its selected Claims whose validity interval contains the resolved valid-time point. No Resolution, Relation, or policy result may add a Claim to this set. A key with an empty set has no Current Knowledge item.

A Resolution is projection-eligible only when it is recorded-visible, valid-time-effective, and every target and optional replacement resolves to a matching lower-position record. For one applicable Claim set, it is **complete** only when its direct Claim targets include every member of that set. Relation targets and nonapplicable Claim targets do not provide coverage. Decision application is exact:

- `prefer` — requires its replacement to be a directly targeted member of the applicable Claim set; all applicable Claims with the replacement's canonically equal value remain contributors to that preferred value, while different-value alternatives remain historical;
- `supersede` — has the same applicable replacement requirement; only the replacement contributes to the preferred value, while every other applicable target, including an equal-value target, is superseded in history;
- `retract` — requires no replacement and produces the `retracted` state with no current value;
- `leave_disputed` — requires no replacement and produces the `disputed` state.

A Resolution that does not satisfy the decision/replacement rule or complete applicable coverage remains canonical and inspectable but has no group-level projection effect. A later applicable Claim therefore reopens the group until a later complete Resolution covers it. Among complete projection-eligible Resolutions for one key, highest stream position wins. This is the first precedence tier.

A Resolution may separately target a persisted Relation. The highest-position projection-eligible Resolution targeting that Relation controls it: `prefer` keeps it active; `supersede` or `retract` deactivates it; `leave_disputed` makes it ineligible to choose projection precedence. This target-specific effect neither satisfies Claim-group coverage nor makes either Relation endpoint applicable.

Without a winning complete Resolution, active same-key persisted `supersedes` Relations form the second precedence tier, but an edge participates only when both its `from` and `to` Claims are members of the applicable Claim set. Direction is successor `from` → predecessor `to`. Any directed cycle in the active participating graph forces the whole key to `disputed`, regardless of ClaimPolicy semantics, canonical value equality, or surviving distinct-value count. Every cycle member survives; active edges whose `to` Claim is outside every cycle still remove that target, so an unrelated acyclic `D → C` remains effective beside an `A ↔ B` cycle. A higher complete Resolution governs before cycle detection, and a Resolution-deactivated edge does not participate. Mechanical succession among the applicable candidates is the third tier. No confidence rank, actor type, latest-record shortcut, Verification result, lexical value order, or policy advisory may choose a preferred Claim.

Future or otherwise nonapplicable Claims, replacements, and Relation endpoints remain canonical history, but they cannot cover, replace, select, or remove an applicable Claim. For example, if an old Claim is valid through January and a targeted replacement begins in February, a January projection keeps the old Claim: the future replacement cannot satisfy `prefer`, and a persisted `new → old` `supersedes` edge is inactive because both endpoints are not applicable. A Resolution targeting that Relation cannot make the future endpoint eligible.

The precedence order is therefore explicit and stable within the prebuilt applicable Claim set:

```text
complete latest Resolution
  > active explicit same-key supersedes Relation
  > mechanical temporal succession
  > no preference (coexist or dispute according to ClaimPolicy)
```

## Current Knowledge, history, and evidence shapes

```ts
type CurrentKnowledgeState =
  | "preferred"
  | "coexisting"
  | "disputed"
  | "retracted"
interface CurrentValue {
  readonly value: JsonValue
  readonly representative: RecordHandle
  readonly claim_count: number
}
interface ProjectionHistorySummary {
  readonly claim_count: number
  readonly derived_relation_count: number
  readonly explicit_relation_count: number
  readonly resolution_count: number
  readonly relations: readonly [] | readonly [DerivedRelation] |
    readonly [DerivedRelation, DerivedRelation]
  readonly latest_resolution?: RecordHandle
}
interface ProjectionEvidenceSummary {
  readonly entry_count: number
  readonly source_count: number
  readonly verification: {
    readonly confirmed: number
    readonly contradicted: number
    readonly unchanged: number
    readonly needs_revalidation: number
  }
}
interface CurrentKnowledgeItem {
  readonly kind: "knowledge"
  readonly key: ClaimKey
  readonly semantics: ClaimSemantics
  readonly state: CurrentKnowledgeState
  readonly value_count: number
  readonly values: readonly [] | readonly [CurrentValue] |
    readonly [CurrentValue, CurrentValue]
  readonly history: ProjectionHistorySummary
  readonly evidence: ProjectionEvidenceSummary
  readonly claims: Affordance
}
```

After precedence, values group by canonical JSON equality and order by the earliest surviving Claim position. Normally one surviving value is `preferred`; more than one is `coexisting` under coexisting semantics and `disputed` under exclusive semantics. A winning `leave_disputed` is disputed regardless of equal values. The active-cycle rule is also an override: even a one-value cycle is `disputed`, reports `value_count:1` with its one exposed value, and increments the disputed rather than preferred summary count. A winning retract over a nonempty applicable Claim set is retained as a zero-value `retracted` item. A key with no applicable Claim is omitted.

`value_count` is the full surviving distinct-value count. `values` carries the first one or two value representatives only; a preferred item has exactly one, a retracted item none, and a coexisting/disputed item at most two. `claim_count` on a value counts all surviving applicable Claims with that value. The representative is the Resolution replacement when it selected that value, otherwise the earliest surviving Claim.

History counts use all scope-selected, recorded-visible records, not only Claims applicable at the valid-time point. Derived relations follow the pair rules above and order by the lower participating stream position, then higher position, then relation vocabulary order as listed above; `relations` carries only the first two. Explicit Relation and Resolution counts include eligible records touching the key. `latest_resolution`, when present, is the highest-position eligible Resolution touching the group, whether or not it was complete. The exact-key `claims` affordance is the full bounded drill-down; representative handles lead to `show` and `history`.

Evidence counts only Claims contributing current values. A retracted item has no contributors and therefore reports zero Entries, Sources, and Verifications even though its canonical history remains inspectable. `entry_count` is distinct valid `derived_from` Entry ids. `source_count` is the structural set of complete SourceRefs on contributing Claims, their referenced Entries, and visible Verifications' `verified_against` arrays. Verification counts are distinct visible Verification records targeting a contributing Claim, partitioned by result. Verification reports evidence state but does not silently prefer, retract, or supersede a Claim. Full evidence remains inspectable through the Claim list and record handles; SourceRefs terminate Loredu disclosure.

## Response, ordering, and cursor

Current Knowledge forms one bounded stream: knowledge items first, ordered by each key's earliest recorded-visible Claim position, then policy advisories in their canonical order. `page.returned` is this page's combined item count and `page.total` is the full combined count. `CurrentProjectionResult.items` contains only this page.

The M2 reconciliation envelope member is:

```ts
interface ProjectionReconciliationSummary {
  readonly state: "projection"
  readonly relations: {
    readonly duplicate: number
    readonly corroboration: number
    readonly support: number
    readonly conflict: number
    readonly coexistence: number
    readonly temporal_succession: number
  }
  readonly knowledge: {
    readonly preferred: number
    readonly coexisting: number
    readonly disputed: number
    readonly retracted: number
  }
  readonly policy_advisories: number
  readonly related: readonly []
}
```

Counts cover the full pinned query, not the page. Each disputed knowledge item returned on this page emits corrective top-level advice in this order: its exact-key Claim list, then show for each exposed value representative. Off-page items emit no advice on this page. Coexisting items and policy advisories are non-blocking and add no corrective top-level advice. Continuation is last.

The current cursor uses the existing opaque `loredu.cursor.v1.` transport and snapshot checks. Its semantic payload additionally carries the first page's `computed_at` and a resume key `(item class, primary position, ordinal)`: knowledge before policy; a knowledge item's primary position is its key's earliest visible Claim; an advisory's is its earliest named Claim. It stores no advisory output. A continuation preserves the original Basis, ruleset, pinned head/anchor, resolved valid point, `computed_at`, total ordering, and explicit store selector; it rereads only that prefix, rebuilds the same frozen advice context, invokes `advise` exactly once when present, recomputes the same canonical combined knowledge/advisory stream, and resumes strictly after the bound key. It consumes no Clock. Invalid operation/query/ruleset/anchor fails before callback admission; an impossible resume in the recomputed stream is `CURSOR_MISMATCH`; malformed encoding remains `INVALID_CURSOR`.

## M2 mutation feedback upgrade

The envelope shape does not change. At M2 the public union is exactly:

```ts
type ReconciliationFeedback =
  | {readonly state: "not-applicable"; readonly related: readonly []}
  | {readonly state: "new-key"; readonly key: ClaimKey;
      readonly related: readonly []}
  | {readonly state: "duplicate"; readonly key: ClaimKey;
      readonly related_count: number;
      readonly related: readonly [RecordHandle]; readonly claims: Affordance}
  | {readonly state: "corroboration"; readonly key: ClaimKey;
      readonly related_count: number;
      readonly related: readonly [RecordHandle]; readonly claims: Affordance}
  | {readonly state: "support"; readonly key: ClaimKey;
      readonly related_count: number;
      readonly related: readonly [RecordHandle]; readonly claims: Affordance}
  | {readonly state: "conflict-candidate"; readonly key: ClaimKey;
      readonly related_count: number;
      readonly related: readonly [RecordHandle]; readonly claims: Affordance}
  | {readonly state: "coexisting"; readonly key: ClaimKey;
      readonly related_count: number;
      readonly related: readonly [RecordHandle]; readonly claims: Affordance}
  | {readonly state: "temporal-succession"; readonly key: ClaimKey;
      readonly related_count: number;
      readonly related: readonly [RecordHandle]; readonly claims: Affordance}
  | {readonly state: "unavailable"; readonly key: ClaimKey;
      readonly reason: "post-commit-read-failed"; readonly related: readonly []}
```

`new-key` applies only when no earlier same-key Claim exists. Otherwise the new Claim's pairs with all earlier same-key Claims are classified by the exact pair rules, and feedback selects the first nonempty class in this order: conflict-candidate, duplicate, corroboration, support, coexisting, temporal-succession. `related_count` counts only earlier Claims in the selected class, `related` contains exactly that class's earliest Claim, and `claims` is the complete exact-key drill-down. Temporal succession is non-blocking and emits no corrective top-level advice. No feedback path appends a derived Relation. The optional policy `advise` callback is projection-wide and is not executed by append feedback.

## Basis, computed time, staleness, and rebuild

The structural ruleset identity remains exact:

```yaml
ruleset:
  core: loredu.reconciliation/v1
  claim_policy:
    id: loredu.default
    version: "1"
```

`Basis` remains exactly `{stream_position, ruleset, query}`. `computed_at` is a sibling in `CurrentProjectionResult`, never a Basis member, never a cursor query member, and still rejected by `createBasis`. The projection Basis position is the atomic scan's full pinned head even when `as_of` or scope excludes records. This makes v0.x invalidation deliberately conservative and store-wide.

A cached projection is reusable only when all three are true:

1. `basis.stream_position` equals current store `head()`;
2. `basis.ruleset` equals the assembled core + ClaimPolicy identity;
3. `basis.query` equals the normalized requested query.

A cached Basis position lower than current head is stale. A ruleset or query mismatch is invalid even at the same head. A core or policy version bump invalidates caches without touching canonical records. `computed_at` never makes a view valid or invalid.

Deleting every derived artifact and replaying the canonical positioned record prefix must reproduce the same Current Knowledge items, reconciliation summary, counts, state/relation ordering, and surface-neutral affordance actions/params for the same Basis. `computed_at`, human `why` prose, CLI `run` rendering, and private cursor bytes are outside semantic-content equality. A rebuild never appends inferred Relations or Resolutions and never mutates history.
