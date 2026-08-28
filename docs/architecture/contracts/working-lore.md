---
name: working_lore_contract
description: "Exact M3 Working Lore application, Ranker, packet, budget, continuation, disclosure, and staleness contract."
type: contract
tags: [contracts, context, progressive-disclosure, ranking, pagination, m3]
generated: "OpenAI coding agent, 2026-08-28"
created_at: 2026-08-26T12:10:00+08:00
---

# Working Lore contract

Working Lore is a bounded projection prepared for one Activity. It is not the entire knowledge store. [Decision 0030](../../decisions/0030-working-lore-ranker-contract.md) closes the M3 boundary below before implementation; this document makes no code or catalog claim.

## Core invariant

> Storage growth must not imply activity-context growth.

A caller supplies an activity, optional scope and corpus identity, and item/character budgets. Loredu returns compact current knowledge and attention plus stable disclosure and section-continuation affordances. A definitive empty match is a successful packet with full zero counts, a Basis, and `computed_at`.

## Exact application boundary

M3 additively extends the assembled application. Existing operations and their Basis shapes do not change.

```ts
type WorkingLoreSectionName =
  | "current"
  | "patterns"
  | "candidates"
  | "conflicts"
  | "needs_revalidation"

interface WorkingLoreFilters {
  readonly activity: string
  readonly scope?: Scope
  readonly corpus?: SourceRef
}
type WorkingLoreQuery =
  | (WorkingLoreFilters & {
      readonly max_items?: number
      readonly max_chars?: number
      readonly cursor?: never
    })
  | {
      readonly cursor: string
      readonly max_items?: number
      readonly max_chars?: number
    }

interface RankerIdentity {
  readonly id: string
  readonly version: string
}
interface WorkingLoreRulesetIdentity extends RulesetIdentity {
  readonly ranker: RankerIdentity
}
interface WorkingLoreBasis {
  readonly stream_position: StreamPosition
  readonly ruleset: WorkingLoreRulesetIdentity
  readonly query: JsonObject
}

interface WorkingLoreApplicationResponse
  extends Omit<ApplicationResponse<WorkingLoreResult>, "basis"> {
  readonly basis: WorkingLoreBasis
}
interface LoreduApplication {
  // M0–M2 members remain unchanged.
  lore(query: WorkingLoreQuery): Promise<WorkingLoreApplicationResponse>
}
```

`activity` is a required identifier-safe token and enters Ranker context/Basis; the baseline does not guess an activity ontology. Scope uses Current Knowledge's subset rule: every supplied pair must occur in a ClaimKey scope with the same value; omission and `{}` mean every scope and normalize to omission. `corpus`, when present, is one closed canonical `SourceRef` identifying the activity's current source/snapshot, not a Loredu record. A knowledge group passes the corpus filter only when its M2 evidence set contains a SourceRef with equal `ref` and, when the query corpus has a locator, equal locator; query snapshot never filters because a differing historical snapshot is revalidation evidence. Scope and corpus filters combine with logical AND. Input is closed, descriptor-safe inert data under the existing validation rules. A cursor forbids activity, scope, and corpus but permits new budgets.

A cursorless call samples Clock exactly once before its atomic scan. That instant is both `computed_at` and the valid-time point used by M2 reconciliation. Continuation preserves both values and consumes no Clock. The normalized Basis query is exact, with object fields in the order shown:

```text
{operation:"lore",activity:"<token>",valid_at:"<canonical point>"}
{operation:"lore",activity:"<token>",valid_at:"<canonical point>",scope:{...},corpus:{...}}
```

Only present scope/corpus fields occur; canonical scope pairs and SourceRef fields retain their domain ordering. Budgets and cursors are pagination controls and never enter Basis.

## Compact packet and item shapes

```ts
interface WorkingLoreKnowledgeSummary {
  readonly key: ClaimKey
  readonly semantics: ClaimSemantics
  readonly state: "preferred" | "coexisting" | "disputed"
  readonly value_count: number
  readonly claim_count: number
  readonly representatives: readonly [] | readonly [RecordHandle] |
    readonly [RecordHandle, RecordHandle]
  readonly history: ProjectionHistorySummary
  readonly evidence: ProjectionEvidenceSummary
  readonly claims: Affordance
}

type WorkingLoreKnowledgeItem =
  | {readonly kind: "current"; readonly summary: string;
      readonly knowledge: WorkingLoreKnowledgeSummary}
  | {readonly kind: "pattern"; readonly summary: string;
      readonly knowledge: WorkingLoreKnowledgeSummary}
  | {readonly kind: "candidate"; readonly summary: string;
      readonly knowledge: WorkingLoreKnowledgeSummary}
  | {readonly kind: "conflict"; readonly summary: string;
      readonly knowledge: WorkingLoreKnowledgeSummary}
  | {readonly kind: "needs-revalidation"; readonly summary: string;
      readonly knowledge: WorkingLoreKnowledgeSummary;
      readonly revalidation: {
        readonly verification_count: number
        readonly snapshot_mismatch_count: number
      }}

type WorkingLoreItem = WorkingLoreKnowledgeItem

interface WorkingLoreSection {
  readonly name: WorkingLoreSectionName
  readonly items: readonly WorkingLoreItem[]
  readonly page: Page
}
interface WorkingLoreOrientation {
  readonly current_count: number
  readonly pattern_count: number
  readonly candidate_count: number
  readonly conflict_count: number
  readonly needs_revalidation_count: number
  readonly attention_count: number
}
interface WorkingLoreBudget {
  readonly max_items: number
  readonly max_chars: number
  readonly used_items: number
  readonly used_chars: number
}
interface WorkingLorePacket {
  readonly activity: string
  readonly scope: Scope
  readonly corpus?: SourceRef
  readonly orientation: WorkingLoreOrientation
  readonly sections: readonly WorkingLoreSection[]
  readonly budget: WorkingLoreBudget
}
interface WorkingLoreResult {
  readonly computed_at: string
  readonly packet: WorkingLorePacket
}
```

A knowledge summary deliberately omits raw values and canonical records. Its bounded `summary` provides enough value context to choose a representative, while handles and the exact-key `claims` affordance lead to complete values, Claim history, evidence, Entries, and terminal SourceRefs. `claim_count` is the full number of contributing applicable Claims across all surviving values, not the number of representatives. `value_count`, history, and evidence retain the M2 meanings. Retracted knowledge and superseded/nonapplicable Claims are omitted from default sections; they remain reachable by following an included representative's history and exact-key Claim disclosure.

The compact summary is deterministic. For knowledge, core forms compact canonical JSON of `{key,state,values}`, where `values` is the ordered full surviving value list from M2 reconciliation. Canonical JSON has no insignificant whitespace, orders object keys by Unicode scalar value, and uses JSON string escaping. If that text exceeds 512 Unicode scalar values, `summary` is its first 511 scalar values followed by `…`; otherwise it is unchanged. This truncation never splits a Unicode scalar. Full Claim values remain available through the item's `claims` affordance and representative handles.

## Deterministic section membership

Core first derives the complete, unpaginated M2 knowledge stream for the normalized scope and resolved valid point, then applies the corpus evidence filter above. It uses ClaimPolicy validation and semantics but does not invoke the optional projection-wide `advise` callback: Working Lore candidates are Claim-backed knowledge, while policy details remain available through `current`. It never appends an inferred record. One knowledge group may intentionally occur in more than one section; each occurrence is a budgeted item.

- `current` contains every `preferred` or `coexisting` knowledge group.
- `patterns` contains each current group with at least one contributing applicable Claim whose exact open `claim_class` is `pattern`.
- `candidates` contains each current group for which every contributing applicable Claim has confidence `candidate`.
- `conflicts` contains every `disputed` group. A complete `leave_disputed` Resolution remains a conflict item because it records judgment without selecting a value.
- `needs_revalidation` contains any current or disputed group with at least one visible `needs_revalidation` Verification targeting a contributing Claim, or a corpus snapshot mismatch.

A corpus snapshot mismatch exists only when the query corpus and a corpus-matching evidence SourceRef both have snapshots and their snapshots differ. Evidence SourceRefs are the distinct contributing-Claim, referenced-Entry, and visible-Verification sources already defined by M2. `snapshot_mismatch_count` counts that structural distinct set; `verification_count` counts distinct visible `needs_revalidation` Verifications. Without a query snapshot, source inference adds no revalidation item. Loredu does not crawl or compare external content.

`attention_count` is exactly `candidate_count + conflict_count + needs_revalidation_count`. Every orientation and section total covers the full pinned query before budgets. Counts therefore remain explicit even when no item from a section fits the first packet.

## Ranker port and deterministic baseline

Ranking is a narrow, versioned ordering port. Core owns section membership, compact item construction, counts, budgets, cursors, and disclosure; a Ranker may only permute already-constructed candidate occurrences.

```ts
interface WorkingLoreRankCandidate {
  readonly index: number
  readonly section: WorkingLoreSectionName
  readonly primary_position: StreamPosition
  readonly key: ClaimKey
  readonly state: "preferred" | "coexisting" | "disputed"
  readonly summary: string
  readonly evidence: ProjectionEvidenceSummary
}
interface WorkingLoreRankContext {
  readonly query: JsonObject
  readonly candidates: readonly WorkingLoreRankCandidate[]
}
interface Ranker {
  readonly id: string
  readonly version: string
  rank(context: WorkingLoreRankContext): readonly number[]
}
```

Assembly additively permits `ranker?: Ranker`; omission selects `DEFAULT_RANKER` with identity `{id:"loredu.baseline",version:"1"}`. Ranker id/version use the normal identifier-safe token rule. Assembly captures and validates the exact closed `{id,version,rank}` shape without invoking `rank`.

Core creates occurrences in section priority `conflicts`, `needs_revalidation`, `candidates`, `current`, `patterns`; inside one section it orders by the earliest contributing applicable Claim position, then the Unicode-scalar lexical order of the ClaimKey's compact canonical JSON. It assigns contiguous zero-based `index` values in that order. `primary_position` is the earliest contributing applicable Claim. Rank candidates contain only the closed semantic descriptor above: no handles, affordances, `why` prose, CLI rendering, cursor bytes, or raw canonical records. The context is detached and recursively frozen.

The default Ranker returns `[0,1,…,n-1]`. A custom Ranker is invoked exactly once on every admitted initial or continuation call, including an empty candidate list, after cursor/snapshot admission and before budgeting. It must return a dense ordinary array containing every input index exactly once and no other value. Core descriptor-validates length/density/elements and rejects throws, duplicates, omissions, out-of-range/non-safe-integer indexes, accessors, excess properties, or custom containers as fresh `VALIDATION_FAILED`, with no partial packet. A Ranker cannot filter, duplicate, mutate, reclassify, or synthesize items. Identical context and ranker version must return the same permutation; any behavior change requires a version bump.

The returned permutation is the packet's global selection order. Regrouping selected occurrences into output sections preserves their relative rank. Output sections themselves always display in `current`, `patterns`, `candidates`, `conflicts`, `needs_revalidation` order.

## Item and character budgets

Default budgets are `max_items:40` and `max_chars:12000`. Accepted `max_items` values are safe integers from 1 through 200. Accepted `max_chars` values are safe integers from 512 through 1,000,000. A summary is at most 512 Unicode scalar values, so any accepted character budget can advance a nonempty continuation.

`used_items` is the number of returned item occurrences. `used_chars` is the sum of Unicode scalar values in their `summary` fields. Structural JSON, field labels, ids, handles, affordances, and surface rendering are not charged to `max_chars`; their growth is bounded by `max_items` and the closed item shapes. The application walks the ranked occurrence stream and returns its longest prefix for which both `used_items <= max_items` and `used_chars <= max_chars`. It never skips an over-budget item to fit a later one.

A cursorless result contains all five sections. Each section's `page.returned` is its returned occurrence count and `page.total` is its full matching count. A section cursor is present exactly when that section has an unreturned occurrence, including when its first occurrence lies beyond the packet's global prefix. A continuation is bound to one section and returns exactly that one `WorkingLoreSection`; it applies its requested/default budgets only to the remaining ranked occurrences in that section. The packet repeats the original activity/scope/corpus, full orientation, and preserved `computed_at`/Basis. Its budget reports that continuation page only.

Truncation is never silent. For each returned conflict item, top-level corrective advice is its exact-key `claims.list` followed by show for each exposed representative; items follow packet rank order and the general structural deduplication rule keeps the first affordance. Top-level advice then carries one `continue/lore.read` affordance for each truncated section in display order. Continuation params are exactly `{cursor}` plus `max_items` and/or `max_chars` when their effective values differ from defaults. Callers may supply new accepted budgets with the cursor.

## Cursor, disclosure, and staleness

Working Lore uses the existing opaque `loredu.cursor.v1.` transport, pinned-head anchor checks, and `INVALID_CURSOR`/`CURSOR_MISMATCH` split. Its semantic payload additionally binds:

- operation `lore` and the normalized activity/scope/corpus query;
- the complete `WorkingLoreBasis`, including Ranker identity;
- the first page's valid point and `computed_at`;
- one section name;
- the exclusive zero-based ordinal in that section's ranked occurrence stream, or a distinguished before-first sentinel when the first packet returned none from that section.

Continuation rereads only the pinned prefix, rebuilds the same M2 semantics and Ranker context, invokes the Ranker under its exact call contract, verifies the same permutation, and resumes strictly after the bound occurrence. It consumes no Clock and stores neither derived items nor ranking output. An impossible recomputed resume is `CURSOR_MISMATCH`. Appends during a chain create no duplicates or skips; a fresh cursorless call sees the new head.

`Affordance` additively permits rel `lore`, action `lore.read`, and these pairs:

```text
lore/lore.read      params exactly {query}
continue/lore.read  params exactly {cursor,max_items?,max_chars?}
```

A cursorless `query` contains only typed activity and present scope/corpus. Every representative is a normal `RecordHandle`, with show then history affordances. Exact-key Claim affordances are surface-neutral. External SourceRefs remain explicit terminal values. No packet id is printed without an existing disclosure path, and no absent reference receives a misleading handle.

Working Lore has its own exact structural ruleset extension:

```yaml
ruleset:
  core: loredu.reconciliation/v1
  claim_policy: { id: loredu.default, version: "1" }
  ranker: { id: loredu.baseline, version: "1" }
```

This does not change the exact M0–M2 `RulesetIdentity` or `Basis` returned by existing operations. A cached packet is reusable only when current store head, core/policy/ranker identities, and normalized query all equal its `WorkingLoreBasis`. Any appended record makes the v0.x packet conservatively stale, including the one new relevant record required by T45; a ranker version or query change invalidates it at equal head. Deleting derived artifacts and replaying the same canonical prefix must reproduce section membership, summaries, full counts, rank order, selected prefix, and surface-neutral affordance actions/params. `computed_at`, `why`, rendered `run`, and private cursor bytes remain outside semantic equality under ADR 0027's rule.

## CLI upgrade

M3 adds this grammar without changing any earlier command:

```text
lor lore --activity <token> [--scope <key=value>]...
    [--corpus-json <SourceRef>] [--max-items <n>] [--max-chars <n>]
    [--cursor <token>] [--json]
```

`--store` remains global and is preserved in every rendered action. Cursorless lore requires activity; scope pairs use existing split/duplicate/token rules, and `--corpus-json` uses the public SourceRef decoder. A cursor forbids activity, scope, and corpus but may combine with each budget once. Generated cursorless runs order activity, canonical scope pairs, corpus, max items, then max chars. Continuation runs order cursor, max items, then max chars. `lore --help`, JSON/text envelopes, recursive `run` rendering, store selection, error sanitization, and exits retain ADR 0026 behavior. Query/cursor/ranker validation exits 2, missing store 3, provider failure 4, and Clock/unexpected internal failure 6. Empty lore is `ok:true`, all five zero-count sections, Basis, `computed_at`, zero budget usage, and exit 0.

Text mode prints orientation, then nonempty sections in display order, their summaries and disclosure commands, explicit returned/total counts, continuations, Basis, and computed time. JSON mode is exactly the recursively rendered application response plus LF. `lor skill` is revised only when the M3 command is implemented; this docs-only closure does not claim that shipped grammar or guide exists.

## Readiness and exclusions

This contract establishes deterministic readiness for T40–T45 and T75. M3 implementation must prove empty success, 10× storage growth under both budgets, omitted-but-discoverable superseded history, conflict/revalidation sections, every handle's show/history chain, one-record staleness, and section continuation against a pinned Basis. It must also prove baseline and custom Ranker ordering/version invalidation and exact callback validation.

Ranking quality beyond deterministic baseline order remains an M4 consumer judgment. Embeddings, lexical indexes, graph traversal, model reranking, source crawling, token counting, automatic Resolution, and derived-record persistence are not required. A consumer may perform those behind a versioned Ranker without changing core contracts. T40–T45/T75 remain deferred until executable implementation evidence exists.
