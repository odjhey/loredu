---
name: application_cli_contract
description: "Exact M1.5 application/CLI protocol plus additive M2 Current Knowledge and M3 Working Lore envelope, affordance, grammar, and cursor upgrades."
type: contract
tags: [contracts, application, cli, m1.5, m2, m3, projection, working-lore, pagination, agents]
generated: "OpenAI coding agent, 2026-08-28"
created_at: 2026-08-28T06:00:00+08:00
---

# M1.5 application and CLI contract

[Decision 0026](../../decisions/0026-m15-application-cli-contract.md) closed this contract before M1.5 command implementation. [Decision 0027](../../decisions/0027-m2-reconciliation-projection-contract.md) closes the additive M2 `current` upgrade, and [decision 0030](../../decisions/0030-working-lore-ranker-contract.md) closes the additive M3 `lore` upgrade. M1.5 itself exposes records, exact-key overlap, health, and disclosure; it does **not** claim either later projection.

## Boundary and application surface

The application remains surface-neutral. M0 `append` is unchanged and still returns exactly `{record, position}`. M1.5 additively extends the assembled `LoreduApplication` with response-producing operations:

```ts
interface LoreduApplication {
  append<D extends RecordDraft>(draft: D):
    Promise<AppendRecordResult<PersistedRecordFor<D>>>
  add<D extends RecordDraft>(draft: D):
    Promise<ApplicationResponse<AddedRecordResult<PersistedRecordFor<D>>>>
  show(id: RecordId): Promise<ApplicationResponse<ShownRecordResult>>
  history(query: HistoryQuery): Promise<ApplicationListResponse<HistoryItem>>
  claims(query?: ClaimQuery): Promise<ApplicationListResponse<ClaimItem>>
  status(query?: StatusQuery): Promise<ApplicationStatusResponse>
  readHead(): Promise<ApplicationResponse<HeadResult>>
}
```

`add` is the reactive mutation operation used by surfaces. It calls the same append path once, then for a Claim attempts to derive feedback from the prefix ending at the returned position. Once append has returned, `add` is committed and must not turn a later feedback-read failure into a failed-looking mutation: it returns the committed id/kind/position and own handle with `reconciliation.state:"unavailable"`, a Basis pinned to the committed position, and one runnable status affordance. The CLI exits 0 and states that the record committed but feedback must be retried; retrying the mutation is never advised. Pre-acknowledgement append failures retain the M1 uncertain-outcome contract. `append` remains available for embedded consumers that want the smaller M0 result. `show`, `history`, `claims`, `status`, and `readHead` never stamp or append records and consume neither Clock nor RandomSource.

`init`, store selection, argv parsing, help, rendering, environment access, and skill output are adapter behavior, not application operations. Relation, Resolution, and Verification commands construct their public drafts and call `add`; the application does not gain surface-shaped methods for each family.

## Exact application response

Every successful application operation returns a detached, recursively frozen value with this base shape:

```ts
interface ApplicationResponse<R> {
  readonly ok: true
  readonly result: R
  readonly reconciliation: ReconciliationFeedback
  readonly advice: readonly Affordance[]
  readonly basis: Basis
}
interface ApplicationListResponse<I> extends ApplicationResponse<readonly I[]> {
  readonly page: Page
}
interface ApplicationStatusResponse extends ApplicationResponse<StatusResult> {
  readonly page: Page
}
interface Page {
  readonly returned: number
  readonly total: number
  readonly cursor?: string
}
interface Affordance {
  readonly rel: "show" | "history" | "list" | "status" | "continue" | "init"
  readonly action:
    | "record.show"
    | "record.history"
    | "claims.list"
    | "history.list"
    | "status.read"
    | "store.init"
  readonly params: JsonObject
  readonly why: string
}
interface RenderedAdvice extends Affordance { readonly run: string }
```

`returned` is the number on this page; `total` is the number matching the query in the pinned snapshot, not the number remaining. `cursor` is present exactly when another item exists. Non-list operations never carry `page`. Top-level `advice` carries corrective actions first and continuation last; ordinary disclosure affordances live on each handle and enter top-level advice only when inspection is itself corrective. Within a class, advice follows the record ordering rules below. Duplicate semantic affordances are removed by `(rel, action, params)` structural identity, keeping the first.

The valid rel/action pairs are exactly `show`/`record.show`, `history`/`record.history`, `list`/`claims.list`, `status`/`status.read`, `continue`/`claims.list|history.list|status.read`, and `init`/`store.init`. Params are respectively exactly `{id}`, `{id}`, `{query}`, `{}`, `{cursor, limit?}`, and `{selector}`. A list query is a complete cursorless `ClaimQuery`. Continuation params include `limit` exactly when the current effective limit is not the default 50, preserving that page size; callers may still change it explicitly on the next request. The application never emits `lor`, shell quoting, paths, or argv. `params` contains complete typed portable JSON input for that action. `why` is deterministic explanatory text but its prose is not a compatibility surface. The set, order, action, and params are compatibility behavior. An affordance is emitted only when it is executable as-is: mechanics may recommend inspecting a conflict, but cannot preselect a Resolution decision, replacement, actor, or reason. The embedded skill teaches the agent to construct that judgment command after inspection.

Application failures remain structured `LoreduError` throws; they are never returned as `ok:false` application values. The sole committed-success recovery is `add`'s post-append feedback-read fallback above, which is `ok:true` and not an error. The application preserves the existing phase-owned errors and adds `RECORD_NOT_FOUND`, `INVALID_CURSOR`, and `CURSOR_MISMATCH`. `RECORD_NOT_FOUND` identifies a syntactically valid absent record. The [opaque cursor contract](#opaque-cursors-and-pinned-snapshots) owns the exact boundary between `INVALID_CURSOR` and `CURSOR_MISMATCH`.

## Result and feedback shapes

```ts
interface RecordHandle {
  readonly id: RecordId
  readonly kind: RecordKind
  readonly affordances: readonly Affordance[] // show, then history
}
interface AddedRecordResult<R extends PersistedRecord = PersistedRecord> {
  readonly id: R["id"]
  readonly kind: R["kind"]
  readonly position: StreamPosition
  readonly handle: RecordHandle
}
interface ShownRecordResult {
  readonly record: PersistedRecord
  readonly position: StreamPosition
  readonly handles: readonly RecordHandle[]
}
type RecordSummary =
  | {readonly kind: "entry"; readonly title?: string; readonly entry_type?: string}
  | {readonly kind: "claim"; readonly key: ClaimKey; readonly value: JsonValue;
      readonly confidence: Confidence}
  | {readonly kind: "relation"; readonly relation_type: RelationType}
  | {readonly kind: "resolution"; readonly decision: ResolutionDecision;
      readonly reason: string; readonly effective_at?: string}
  | {readonly kind: "verification"; readonly result: VerificationResult}
interface HistoryItem {
  readonly id: RecordId
  readonly position: StreamPosition
  readonly recorded_at: string
  readonly actor: Actor
  readonly scope: Scope
  readonly summary: RecordSummary
  readonly handles: readonly RecordHandle[]
}
interface ClaimItem {
  readonly id: ClaimId
  readonly position: StreamPosition
  readonly recorded_at: string
  readonly actor: Actor
  readonly key: ClaimKey
  readonly value: JsonValue
  readonly confidence: Confidence
  readonly handles: readonly RecordHandle[]
}
interface HeadResult { readonly stream_position: StreamPosition }

type ReconciliationFeedback =
  | {readonly state: "not-applicable"; readonly related: readonly []}
  | {readonly state: "new-key"; readonly key: ClaimKey;
      readonly related: readonly []}
  | {readonly state: "corroboration"; readonly key: ClaimKey;
      readonly related_count: number;
      readonly related: readonly [RecordHandle]; readonly claims: Affordance}
  | {readonly state: "conflict-candidate"; readonly key: ClaimKey;
      readonly related_count: number;
      readonly related: readonly [RecordHandle]; readonly claims: Affordance}
  | {readonly state: "coexisting"; readonly key: ClaimKey;
      readonly related_count: number;
      readonly related: readonly [RecordHandle]; readonly claims: Affordance}
  | {readonly state: "unavailable"; readonly key: ClaimKey;
      readonly reason: "post-commit-read-failed"; readonly related: readonly []}
}
```

Non-Claim additions and every read use `{state:"not-applicable", related:[]}`. When its committed feedback read succeeds, a Claim addition compares only earlier Claims in the prefix that have the same exact declared ClaimKey:

1. no same-key Claim → `new-key`;
2. at least one canonically different value and assembled semantics `exclusive` → `conflict-candidate`;
3. otherwise, at least one canonically equal value → `corroboration`;
4. otherwise differing values with `coexisting` semantics → `coexisting`.

`jsonValuesEqual` defines value equality; `claimKeysEqual` defines key equality. Validity, actor, confidence, source, and phrasing do not alter this M1.5 classification. For each overlap state, `related_count` counts the relevant earlier same-key Claims: canonically equal for `corroboration`, canonically different for `conflict-candidate` and `coexisting`. `related` contains exactly the earliest such Claim as a bounded representative. `claims` is the `claims.list` affordance for the complete exact key, using exact scope, subject, predicate, and present/absent perspective filters; it is the bounded drill-down for every overlap state. The feedback creates no Relation and makes no projection choice.

Top-level advice is exact and bounded at M1.5. Post-commit unavailable feedback emits only `status`/`status.read`. A `conflict-candidate` addition emits the exact-key `claims.list` affordance, one `record.show` for its earlier representative, and one for the new Claim, in that order. Thus the second differing Claim names both ids directly, while later additions do not expand the response with the size of the group. `new-key`, `corroboration`, `coexisting`, and non-Claim additions emit no corrective advice. Each status page emits the exact-key `claims.list` and representative show affordances for each unresolved group, then one show for each dangling reference's referring record, deduplicated by the general rule, followed by continuation when present. Generic divergence remains represented by its result handles and adds no corrective advice. Show and ordinary list reads add no top-level advice except list continuation. Every record handle still carries its ordinary nested show/history disclosure affordances.

A history or Claim result item carries only its own record handle. List summaries deliberately omit record-reference fields; following the item's show affordance is the explicit full-record disclosure step rather than multiplying each bounded list item by an unbounded schema array. An added result returns only the new `id`, `kind`, `position`, and own `handle` rather than echoing the full submitted record, so neither payload nor automatic affordances grow with an unbounded reference array; embedded consumers that need the full canonical append result already have M0 `append`. A shown result carries its own handle followed by every distinct referenced record committed at a lower position, in schema field/index order. An absent or forward-pointing id in a persisted reference field remains visible in the full shown record but receives no handle or affordance; it is an explicit terminal invalid-reference diagnostic, never a promise that following it is valid history. `show` scans one snapshot so it can return the full record's position, handles, and basis atomically. Lists also omit Entry bodies and common metadata/sources. `history(id)` returns the target and every record in the pinned prefix that directly references it: Claim `derived_from`; Relation `from`/`to`; Resolution `targets`/`replacement`; and Verification `targets`. Results are unique and ascending by stream position; the target naturally occupies its committed position rather than being forced to index zero. `history` for an absent target still fails with `RECORD_NOT_FOUND`; it never turns dangling references into a successful dead-end result. External SourceRefs and explicit missing-reference diagnostics are terminal disclosure values, not Loredu record handles.

## Claim query and ordering

```ts
interface ClaimFilters {
  readonly same_key_as?: ClaimId
  readonly scope?: Scope
  readonly scope_match?: "subset" | "exact"
  readonly subject_type?: string
  readonly subject?: string
  readonly predicate?: string
  readonly perspective?: string | null
  readonly value?: JsonValue
  readonly actor?: Actor
  readonly since?: string
}
type ClaimQuery =
  | (ClaimFilters & {readonly limit?: number; readonly cursor?: never})
  | {readonly cursor: string; readonly limit?: number}
type HistoryQuery =
  | {readonly id: RecordId; readonly limit?: number; readonly cursor?: never}
  | {readonly cursor: string; readonly limit?: number; readonly id?: never}
type StatusQuery =
  | {readonly limit?: number; readonly cursor?: never}
  | {readonly cursor: string; readonly limit?: number}
```

Except for M3's anchored exact-key form below, all supplied filters combine with logical AND. Scope defaults to subset matching: every requested pair must exist with the exact same value; `{}` or omission matches every scope. `scope_match:"exact"` requires exact pair-set equality and is valid only with a supplied scope (including `{}`); `"subset"` is the normalized default and is omitted from Basis. Subject type/id, predicate, value, and Actor use exact structural equality with no normalization. A string perspective matches only Claims where it is present and equal; `null` matches only Claims with no perspective. `since` is an inclusive lower bound on canonical `recorded_at`. It accepts the caller timestamp grammar from the record contract and is normalized before query identity is constructed.

Application query inputs are closed descriptor-safe inert data under the record boundary rules: excess fields, accessors, custom containers, present-own `undefined`, mixed cursor/filter forms, malformed ids/timestamps/limits, and invalid portable JSON reject as `VALIDATION_FAILED` before a store call. `show` likewise validates a complete record id before reading. Omitted `claims()` is the empty cursorless query.

Claims and history order only by ascending stream position. Position is already a total order, so timestamp/id tiebreakers are neither needed nor permitted. The default limit is 50; accepted limits are safe integers from 1 through 200. Every list is bounded. Cursor continuation may select another valid limit, but may not supply filters or an id; those come from the cursor. A cursorless query may not combine `cursor` with any other query field except `limit`.

M3 additively activates `same_key_as`. On a cursorless Claim query it is mutually exclusive with every other Claim filter but may combine with `limit`. Core resolves that visible Claim in the pinned scan, derives its complete exact ClaimKey, and returns all Claims with that key in normal stream order and pagination. A missing anchor is `RECORD_NOT_FOUND`; malformed or wrong-family input follows ordinary validation. No Scope preview participates in equality or filtering. Continuation uses the existing Claims cursor contract. The normalized Basis query is exactly `{operation:"claims",filters:{same_key_as:"<claim-id>"}}`.

The normalized Basis query is exact portable JSON:

```text
claims:  {operation:"claims", filters:{...present normalized filters...}}
history: {operation:"history", id:"<record-id>"}
show:    {operation:"show", id:"<record-id>"}
status:  {operation:"status"}
head:    {operation:"head"}
add:     {operation:"add", id:"<new-record-id>"}
```

A cursorless read uses one atomic scan head. Status pagination uses the same `{operation:"status"}` query because limit is excluded from Basis and cursor identity. `add` pins to the returned append position and ignores any later concurrent suffix. It shares the append execution and reuses the Claim semantics already validated there rather than invoking policy callbacks a second time. `readHead` uses the position returned by its one `head()` call. All use the assembled structural RulesetIdentity.

## Opaque cursors and pinned snapshots

A cursor is an opaque, versioned application token. Clients may store and return it but may not decode, edit, synthesize, compare, or derive ordering from it. Its transport spelling uses only base64url characters without padding after the literal `loredu.cursor.v1.` prefix. Decoded bytes and field encoding are implementation-private; semantic content is fixed:

- cursor version and operation;
- normalized query excluding `limit` and `cursor`;
- complete Basis;
- the record id committed at `basis.stream_position` as snapshot anchor (a distinguished empty anchor only for position zero);
- the operation-specific exclusive resume key: the last returned stream position for Claims/history, or the last returned status item's class rank, primary stream position, and same-position ordinal.

The token is an integrity/checking mechanism, not a confidentiality or authentication promise. Shared admission validates transport, version, and a known operation discriminator, then the complete schema and normalized query declared by that discriminator, including exact equality between the duplicated top-level query and `basis.query`. Decode failures, arbitrary operations, unsupported versions, malformed declared schemas or queries, disagreement between those query copies, impossible positions, and missing or excess fields are `INVALID_CURSOR` at every endpoint. Only after that full validation does the receiving endpoint compare operations, so a genuine cursor submitted to a different operation is `CURSOR_MISMATCH`. For a cursor accepted by its own operation, the application scans current history, verifies current head is at least the pinned head and that the pinned position still contains the anchor id, verifies ruleset and operation-specific replay state, then filters every read to `position <= basis.stream_position`. Failure is `CURSOR_MISMATCH`; it never restarts at current head. Admission and mismatch checks occur before Clock, ClaimPolicy advice, or Ranker callbacks. Appends during a chain therefore cause neither duplicates nor skips. A cursorless repeat chooses a fresh snapshot.

The anchor makes accidental use against another store detectable without introducing a store identity, secret, ambient randomness, or canonical provider metadata. Record-id collision is governed by the existing random-id contract; cursors add no stronger security claim.

## Mechanical status and policy boundary

```ts
interface UnresolvedExclusiveGroup {
  readonly kind: "unresolved-exclusive-group"
  readonly key: ClaimKey
  readonly claim_count: number
  readonly representative: RecordHandle
  readonly claims: Affordance // list/claims.list for this exact key
}
interface DanglingRecordReference {
  readonly kind: "dangling-record-reference"
  readonly record: RecordHandle
  readonly path: string
  readonly target: RecordId
}
type HealthItem = UnresolvedExclusiveGroup | DanglingRecordReference
interface KeyDivergenceAdvisory {
  readonly kind: "key-divergence"
  readonly scope: Scope
  readonly value: JsonValue
  readonly component_count: number
  readonly representatives: readonly [RecordHandle, RecordHandle]
  readonly claims: Affordance // list/claims.list for this exact scope/value
}
interface StatusResult {
  readonly healthy: boolean
  readonly health: {
    readonly unresolved_exclusive_groups: number
    readonly dangling_record_references: number
  }
  readonly advisory_count: number
  readonly attention: readonly HealthItem[]
  readonly advisories: readonly KeyDivergenceAdvisory[]
}
```

Health blocks `status --check`; advisories never do. Status forms one bounded ordered item stream: all unresolved groups, then all dangling references, then all key-divergence advisories, using each class's order below. Its unique resume key is `(class rank, primary position, ordinal)`: class ranks are that fixed three-class order; primary position is the group's earliest member, the dangling reference's referring record, or the advisory's earliest representative; ordinal is the zero-based position among same-class items with that primary position in their defined deterministic order. The cursor resumes strictly after the complete key, so multiple diagnostics from one record cannot be duplicated or skipped. `health` and `advisory_count` are full pinned-snapshot counts; `attention` and `advisories` contain only their members on this page. Its top-level `page.returned` is their combined page length and `page.total` is both full health counts plus `advisory_count`. Status uses the same default 50 and maximum 200 as other bounded collections, and continuation is `status.read`.

An **unresolved exclusive group** is an exact ClaimKey conflict set under assembled `exclusive` semantics. The shared pair classifier creates a conflict pair only for canonically different values whose inclusive validity intervals overlap; computing this overlap samples no Clock. The conflict set is the union of endpoints of every such pair. No group exists when that set is empty, so equal values and purely interval-disjoint temporal succession are non-blocking history and do not make `status --check` unhealthy.

A conflict set is closed only by an eligible Resolution in the same prefix whose unique direct Claim `targets` include every Claim in that set. Completeness and the item's `claim_count` use the conflict set, not every historical same-key Claim. A Resolution is eligible for closure only when every target and optional replacement resolves to a matching record at a lower position. An absent or forward-pointing reference still contributes dangling diagnostics but has no closure effect. Any decision, including `leave_disputed`, records sufficient human judgment to close health. A later Claim reopens health only when it joins an overlapping different-value conflict pair and therefore enters the set; a purely disjoint successor does not. Relations describe links but do not close a conflict set. Set Claims and groups order by earliest member position. The item carries only the earliest conflict-set representative plus full `claim_count`; its `claims.list` affordance still uses the complete exact key so bounded history remains inspectable.

A **dangling record reference** is any persisted Claim `derived_from`, Relation endpoint, Resolution target/replacement, or Verification target for which no matching record exists at a lower stream position. An absent target and a target appearing only later are both dangling because references must point backward. One item is emitted per field/index in ascending referring-record position and schema traversal order. Its `record` is the executable handle for inspecting the referring record; `target` reports the invalid reference id as an explicit terminal diagnostic and never itself carries an affordance. Wrong-family ids make the persisted record invalid and therefore provider-corrupt rather than health data. Normal application appends prevent dangling references, but valid hand-authored records can expose them. `attention` lists unresolved groups first, then dangling references, each in its ordering above.

Malformed canonical files are not application health data. The M1 provider rejects them as `STORE_CORRUPT` before returning a `RecordScan`; `status` consequently fails with the store-error envelope and cannot truthfully return partial health. This preserves the RecordStore boundary rather than adding a filesystem inspection escape hatch.

The generic key-divergence advisory is versioned core mechanics. Partition Claims into cohorts by exact structural scope equality and canonical JSON-equal value. For each cohort, create one graph node per distinct exact ClaimKey represented by a Claim in that cohort; multiple Claims with the same key occupy one node. Order nodes by the earliest stream position of a Claim with that key. An eligible `duplicates` Relation contributes one undirected edge between the nodes of its Claim endpoints only when both endpoints belong to that cohort and both occur at positions lower than the Relation. An absent or forward-pointing endpoint still contributes a dangling diagnostic, but the Relation contributes no edge. Self-node and repeated edges do not change connectivity.

Order each cohort's connected components by the earliest Claim position in the component, and select that earliest Claim as the component representative. Emit one advisory exactly when the cohort has more than one component. It carries the full component count, the representatives of the first two ordered components, and a `claims.list` affordance using exact-scope plus value filters for bounded drill-down; it never embeds an unbounded representative array. Advisories order by their first representative's position. It never reconciles across keys, changes health, or guesses which key is preferred. Recording enough eligible explicit `duplicates` Relations to connect the key nodes suppresses it.

M1.5 executes no ClaimPolicy advice callback. The M0 policy surface has no such member, and the built-in policy advice set is empty. `exclusive|coexisting` semantics affect exact-key overlap and health only. During `status` group evaluation, exact keys are visited by earliest Claim position; the application calls `validateClaimKey` once and, only when accepted, `semantics` once per distinct key. Existing custom-policy rejection or malformed/throwing callback output fails the operation as fresh `VALIDATION_FAILED` under the M0 callback boundary. A later additive policy-advice API must version its policy, label policy-produced advisories separately from core divergence, and must not cross exact-key reconciliation boundaries.

## CLI grammar

The executable is `lor`. Options are long-form, case-sensitive, accepted exactly once unless explicitly repeatable, and unknown options or extra positionals are usage errors. `--json` and `--store <selector>` may appear anywhere in argv outside an option value; command-specific options may appear in any order. Short options other than the exact `-v` alias, bundled options, and an end-of-options `--` delimiter are not supported. `--help` must be the only option, global or command-specific, after a valid command path. Comma-separated lists are not accepted: repeat the singular option.

```text
lor (--version | -v)
lor [--store <selector>] [--json]
lor init [<selector>] [--json]
lor add entry --actor <type:id> --body <text|->
    [--type <token>] [--title <text>] [--scope <key=value>]...
    [--metadata-json <object>] [--source-json <SourceRef>]...
lor add claim --actor <type:id> --subject-type <token> --subject <token>
    --predicate <token> (--value <string> | --value-json <json>)
    --confidence <value> [--class <token>] [--perspective <token>]
    [--valid-from <rfc3339>] [--valid-until <rfc3339>]
    [--derived-from <entry-id>]... [common options]
lor relate --actor <type:id> --from <record-id> --to <record-id>
    --type <relation-type> [common options]
lor resolve --actor <type:id> --target <claim-or-relation-id>...
    --decision <decision> --reason <text> [--replacement <claim-id>]
    [--effective-at <rfc3339>] [common options]
lor add verification --actor <type:id> --target <claim-id>...
    --verified-against-json <snapshotted-SourceRef>... --result <result>
    [common options]
lor show <record-id> [--json]
lor history [<record-id>] [--limit <n>] [--cursor <token>] [--json]
lor claims [filters] [--limit <n>] [--cursor <token>] [--json]
lor head [--json]
lor status [--check] [--limit <n>] [--cursor <token>] [--json]
lor skill [--json]
lor <command-path> --help
```

`--version` and `-v` are identical and accept no other option or positional. They write exactly `lor <cli-version> (schema <record-schema>, store <adapter-name>, home <default-home>)` plus LF to stdout and exit 0, preserving the existing compile-smoke metadata line. The four placeholders are the current build's CLI package version, record schema id, adapter name, and absolute OS-default Loredu home (`<osHome>/.loredu`). The command ignores `LOREDU_HOME`, checks no store, and consumes neither Clock nor RandomSource. Any combined form, including `lor --version --json`, is `CLI_USAGE`; when `--json` is present the normal JSON failure envelope is emitted and the exit is 2.

For a valid command path, `--help` writes its concise direct help text plus LF to stdout and exits 0 without resolving a store or emitting an envelope. Combining it with `--json`, `--store`, or any command option is `CLI_USAGE`; a supplied `--json` therefore produces the JSON failure envelope and exit 2 rather than help text.

`[common options]` means repeated `--scope <key=value>`, one `--metadata-json <object>`, and repeated `--source-json <SourceRef>`. Scope splits on the first `=` and both sides must satisfy token rules; duplicate keys reject. Actor splits on the first `:`; the left side is the closed Actor type and the right side is the complete id token. JSON options accept exactly one JSON text value and then pass through the public domain decoder; `--metadata-json` must be an object, `--source-json` one SourceRef object, and `--verified-against-json` one snapshotted SourceRef. `--value` is always a string; `--value-json` is required to distinguish `1`, `true`, `null`, arrays, objects, and a JSON-quoted string.

`--body -` first validates argv and every non-body draft field, then resolves, opens, and checks the selected store. An invalid selector (exit 2) or missing store (exit 3 with selected-store init advice) therefore fails without reading stdin. Only after successful preflight does the command read stdin exactly once to EOF as UTF-8 and pass the decoded text unchanged: no trimming or newline insertion/removal. A leading UTF-8 BOM is preserved as the U+FEFF body character rather than consumed as a signature. Invalid UTF-8 is a usage/validation failure. The append reuses that opened store and application without resolving or opening them again, and this path never initializes a store. A terminal may supply `--body <text>` directly; stdin is not read for another spelling.

Claim filters are repeated `--scope`, optional `--exact-scope` (with no scope pair it means exact empty scope), plus singular `--subject-type`, `--subject`, `--predicate`, mutually exclusive `--perspective <token>` or `--without-perspective`, `--value|--value-json`, `--actor`, and `--since`. M3 additively permits singular `--same-key-as <claim-id>` on `lor claims`; it is mutually exclusive with every other cursorless Claim filter, may combine with `--limit`, and is mutually exclusive with `--cursor` under the existing rule. A `--cursor` forbids every filter and the history positional id but may combine with one `--limit`; therefore continuation rendering is the command plus cursor and optional changed limit. Cursorless history requires its positional id; cursor history forbids it. `--check` is valid only on cursorless status, may combine with `--limit`, evaluates full pinned health regardless of the displayed page, and changes only the exit.

Store selection follows the plain-file contract. Named/default selection rejects a nonempty relative `LOREDU_HOME` as `VALIDATION_FAILED` at `/environment/LOREDU_HOME` before initialization or store access. Explicit path selection is the sole cwd-relative mode and bypasses `LOREDU_HOME`, including an invalid relative value. For `init`, positional selector and global `--store` are mutually exclusive; omission initializes default. Init success returns `{root, selector}` where `root` is the adapter-resolved absolute path and `selector` is the supplied selector or `"default"`; its Basis has stream position zero and query `{operation:"init"}`. All other store-backed commands use global selection and never initialize. `skill`, version, and help do not resolve a store and reject `--store`; skill still permits `--json` as its documented mode. Bare `lor` is exactly the first status page for the selected store; it is not help and behaves as cursorless `lor status`, without `--check`.

M1.5 intentionally has no `lore`, `current`, `--as-of`, or `--valid-at` grammar. M2 adds `current` and temporal flags without changing this envelope; M3 adds the exact `lore` grammar and Working Lore section continuations under ADR 0030.

## JSON, text, errors, and exits

For store-backed commands, `--json` writes exactly one JSON object plus LF to stdout. JSON success preserves the application fields, renders branded positions as numbers, and renders every application advice item as:

```json
{"rel":"show","action":"record.show","params":{"id":"clm_..."},"why":"inspect the claim","run":"lor show clm_..."}
```

`run` is added by the CLI and is shell-ready POSIX syntax using single-quote escaping where required. The CLI recursively renders every affordance: top-level `advice`, each `RecordHandle.affordances`, reconciliation-related handles, health/advisory handles, and result handles all gain the same `run` field. Removing only those `run` fields reproduces the application value. A store-backed rendered action preserves the originating explicit selector by placing the shell-quoted `--store <selector>` before its command; when selection was implicit default, it omits `--store`. Store-init advice renders the exact missing selector. Thus following a handle or cursor cannot silently switch stores. Generated Claim-query runs use `--same-key-as` then limit for the anchored M3 form; otherwise they order scope pairs canonically, then `--exact-scope`, subject type/id, predicate, perspective/absence, canonical `--value-json`, Actor, normalized since, and limit. Generated continuation runs order cursor then optional limit. This fixed order plus POSIX quoting makes rendering deterministic. Output key insertion order is `ok`, `result`, `reconciliation`, `advice`, `basis`, then `page` when present; consumers must not rely on JSON object key order. No diagnostics accompany JSON on stdout.

A CLI failure writes exactly one JSON object plus LF under `--json`:

```ts
interface CliFailureEnvelope {
  readonly ok: false
  readonly result: null
  readonly reconciliation: {readonly state: "not-applicable", readonly related: readonly []}
  readonly advice: readonly RenderedAdvice[]
  readonly basis: null
  readonly error: {
    readonly code: LoreduErrorCode | "CLI_USAGE" | "INTERNAL_ERROR"
    readonly message: string
    readonly issues: readonly LoreduIssue[]
  }
}
```

Every failure uses `basis:null`; only a successful semantic result claims a Basis. `issues` is present and may be empty. Raw host causes, stacks, and provider paths are never emitted. Text mode presents the same semantic fields as stable line-oriented labels, with ids and the primary result first, `reconciliation:`, `advice: <run>`, `basis:`, `page:`, or `error:` lines as applicable. Human prose and spacing are not compatibility surfaces; field presence, ids, commands, counts, and values are. All normal output is stdout; unexpected diagnostics are stderr.

CLI-local stable error codes are `CLI_USAGE` for argv grammar and `INTERNAL_ERROR` for an unexpected unmapped failure. JSON/UTF-8/domain failures use `VALIDATION_FAILED`; application/provider codes pass through their named category. `status --check` remains a successful envelope and has no synthetic error code. A missing store failure may carry one CLI-rendered `store.init` affordance; other failures do not invent corrective domain action. The init run preserves the exact selector and uses `lor init --store <selector>` whenever it begins with `-`, so one- and two-dash path selectors remain executable; other selectors use the positional form.

Stable process exits are:

| Exit | Meaning |
|---:|---|
| 0 | command executed, including ordinary `status` that reports unhealthy |
| 2 | argv/JSON/stdin/domain validation, invalid or mismatched cursor, or reference validation |
| 3 | valid store or record selector not found |
| 4 | store/provider/append/lock/corruption/I/O failure or duplicate id |
| 5 | `status --check` executed successfully and health is false |
| 6 | Clock, RandomSource, or unexpected internal application failure |

`status --check` returns the same successful response as `status`; only exit 5 differs. A generic divergence advisory alone still exits 0. An `add` whose append returned but feedback read failed is committed success and exits 0 with `reconciliation.state:"unavailable"`. Unknown errors map to 6 without leaking details. Signal/launcher exits are host behavior outside this table.

## Composition root capabilities

The CLI package is the production composition root. It creates one host `Clock` whose `now()` obtains current epoch milliseconds and validates them through `createInstant`, and one secure `RandomSource` whose `nextBytes(count)` returns a newly allocated `Uint8Array` filled by the host cryptographic random generator. There is no fallback to `Math.random`, time-derived bytes, seeded entropy, partial output, or retry in the adapter. Host capability failures flow through the application's existing `CLOCK_FAILED` or `RANDOM_SOURCE_FAILED` mapping. These host implementations are CLI-internal, are not exported by kernel or adapter packages, and no clock/random package is introduced.

Read-only commands may assemble the application with these capabilities but cannot call them. `init`, version, skill, and help require neither capability.

[Decision 0029](../../decisions/0029-cli-composition-seam.md) exposes the same CLI
parser/composer/renderer through `run(argv, io, options?)`. An embedding composition
root may explicitly supply an existing `ClaimPolicy`, `Clock`, and `RandomSource`;
the runner passes them unchanged into `createLoreduApplication`. Omitted options use
`DEFAULT_CLAIM_POLICY`, `SystemClock`, and `CryptographicRandomSource`, and the shipped
`lor` entry omits the options object. This seam adds no argv or environment grammar,
no CLI-owned policy semantics, and no alternate renderer.

## Embedded skill

`docs/v0.x/execution/agent-skill.md` is the only skill source. The compile step embeds its UTF-8 bytes; no runtime filesystem lookup, network access, generated second copy, or separately installed skill is allowed. Text `lor skill` removes only the YAML frontmatter including its delimiters and writes the remaining Markdown bytes exactly, preserving the source's final LF. It resolves no store and emits no envelope decoration. `lor skill --json` returns the same Markdown string as `result.guide` in the CLI success envelope with `reconciliation` not applicable, empty advice, and `basis:null`; this is the sole successful non-store envelope with a null basis.

The embedded guide may name only commands available in the shipped grammar. Its current instructions are owned by the [agent skill source](../../v0.x/execution/agent-skill.md); compiled skill bytes follow that source as milestone commands land.

## Milestone upgrades and readiness

M1.5 implements record commands, exact-key feedback, query/status, pagination, and disclosure. [Decision 0027](../../decisions/0027-m2-reconciliation-projection-contract.md) fixes the additive M2 `current` upgrade below, and [decision 0030](../../decisions/0030-working-lore-ranker-contract.md) fixes the additive M3 `lore` upgrade after it, while preserving response/error/exit shapes. T50–T75 therefore have fixed protocol semantics but retain their staged implementation owners; this contract is no implementation or catalog claim.

## Additive M2 Current Knowledge upgrade

M2 does not replace any M1.5 operation or envelope. It adds the surface-neutral application method and exact derived shapes in the [projection contract](./projection.md):

```ts
type ApplicationCurrentResponse =
  Omit<ApplicationResponse<CurrentProjectionResult>, "reconciliation"> & {
    readonly reconciliation: ProjectionReconciliationSummary
    readonly page: Page
  }
interface LoreduApplication {
  current(query?: CurrentQuery): Promise<ApplicationCurrentResponse>
}
```

`ApplicationCurrentResponse` has the existing `ok`, operation-specific `result`, `advice`, and `basis`, replaces the mutation `reconciliation` member with the full-query `ProjectionReconciliationSummary`, and adds `page`. Its result is `{computed_at, items}` rather than a bare array because computed time is projection metadata outside Basis. The item stream combines bounded Current Knowledge items followed by policy advisories; `page` counts that combined stream. Every value representative and policy advisory Claim is a recursively rendered RecordHandle. Exact-key Claim drill-down remains `claims.list`; record history and evidence remain `show`/`history` disclosure rather than new CLI stores.

A policy may return at most 200 advisory drafts from each `advise` call. The application descriptor-validates the returned Array and its own length, rejects a length above 200 with a fresh `VALIDATION_FAILED` before density or element validation, sorting, counting, or pagination, and returns no partial envelope. At an accepted length it requires a dense array before validating elements. This literal bound adds no public constant.

The M2 Claim-add feedback union additively distinguishes `duplicate`, `support`, and `temporal-succession` from the existing states. Each has the exact bounded shape `{state,key,related_count,related:[one handle],claims}`. `new-key` applies only with no earlier same-key Claim. Otherwise feedback selects only one pair class in the order conflict-candidate, duplicate, corroboration, support, coexisting, temporal-succession; its count and representative cover only that class. Temporal succession is non-blocking and emits no corrective top-level advice. The [projection contract](./projection.md) fixes each pair boundary. The optional projection-wide policy advice callback is not called by `add`.

`Affordance` additively permits rel `current`, action `current.read`, and these valid pairs:

```text
current/current.read   params exactly {query}
continue/current.read  params exactly {cursor, limit?}
```

A cursorless `query` contains only supplied typed `scope`, `as_of`, and `valid_at`; the application resolves the semantic valid point into Basis. Continuation includes `limit` exactly under the existing nondefault-limit rule. The [projection contract](./projection.md#response-ordering-and-cursor) owns page-local disputed-item advice and its ordering; continuation remains last. Coexisting items and policy advisories are non-blocking and do not invent corrective commands.

The CLI grammar additively gains exactly:

```text
lor current [--scope <key=value>]... [--as-of <rfc3339>]
    [--valid-at <rfc3339>] [--limit <n>] [--cursor <token>] [--json]
```

`--store` remains a global option and is preserved in every rendered action. Cursorless scope pairs follow the same split/duplicate/token rules as Claims and use subset matching; there is no M2 `--exact-scope` on `current`. `--as-of` and `--valid-at` are singular and use the caller timestamp grammar. A cursor forbids scope and both temporal flags but may combine with one limit. Current rendering orders canonical scope pairs, then `--as-of`, `--valid-at`, `--cursor`, and `--limit` as applicable. `current --help` follows the existing direct-help rule.

Text mode prints each knowledge key/state and at most its two value representatives, then policy advisories, computed time, reconciliation counts, advice, Basis, and page counts. JSON mode is exactly the recursively rendered application response plus LF. An empty matching projection is `ok:true`, `items:[]`, zero counts, Basis, `computed_at`, `page:{returned:0,total:0}`, and exit 0. Disputed or retracted knowledge does not make the command fail; this command is projection, not health. Existing exits are unchanged: query/cursor validation is 2, missing store is 3, provider failure is 4, Clock failure is 6. Exit 5 remains exclusive to unhealthy `status --check`.

A cursorless `current` consumes one Clock call before its atomic scan; continuation consumes none. When the policy defines `advise`, every admitted first page and continuation invokes it exactly once after pinned reconciliation/context construction and before full combined-stream count/order/page; omitted advice means zero calls, and an invalid cursor fails before any call. Continuation stores no advisory output and recomputes it deterministically against the preserved Basis/ruleset/head/valid point/computed time before applying its combined-stream resume key. The CLI's existing internal production Clock supplies time. Bare `lor` remains status, not Current Knowledge. M2 adds no `reconcile` command and no `lore`; M3 owns the additive contract below. This section establishes T20–T30/T86 and staged T54–T56 protocol readiness only; it makes no implementation or catalog claim.

## Additive M3 Working Lore upgrade

M3 does not replace an M1.5/M2 operation, error, exit, or envelope. It adds the application method and exact types in the [Working Lore contract](./working-lore.md):

```ts
interface LoreduApplication {
  lore(query: WorkingLoreQuery): Promise<WorkingLoreApplicationResponse>
}
```

`WorkingLoreApplicationResponse` keeps `ok`, mutation-neutral `reconciliation`, `advice`, and the operation result. Its `basis` is the exact `WorkingLoreBasis` extension containing core, ClaimPolicy, and Ranker identities. Its result is `{computed_at,packet}`. `packet.sections` owns per-section `Page` values rather than adding one misleading top-level page: a cursorless packet returns all five section descriptors, while continuation returns exactly its cursor-bound section. Orientation and every section total cover the full pinned query.

M3 also adds the bounded exact-key disclosure path used by Working Lore. `ClaimFilters` gains optional `same_key_as?: ClaimId`; on a cursorless query it is mutually exclusive with every other Claim filter except `limit`. Core resolves the visible anchor Claim in the pinned scan and lists the complete exact-key group in ordinary Claim order/pagination. Missing anchors are `RECORD_NOT_FOUND`, malformed or wrong-family anchors follow ordinary validation, and continuation remains the existing Claims cursor. Its normalized query is `{operation:"claims",filters:{same_key_as:"<claim-id>"}}`.

`Affordance` additively permits rel `lore`, action `lore.read`, and these exact valid pairs:

```text
lore/lore.read      params exactly {query}
continue/lore.read  params exactly {cursor,max_items?,max_chars?}
```

The cursorless query contains typed activity and present scope/corpus only; budgets are paging controls. A continuation preserves nondefault effective budgets in params and may be called with new accepted budgets. A Working Lore item's exact-key Claim action is exactly `{query:{same_key_as:key.anchor_claim}}`; showing that anchor exposes the complete key/Scope and the anchored list exposes all same-key values/history. After whole-group corpus admission, every included item copies exactly the corresponding M2 `CurrentKnowledgeItem.values` representatives in exposed-value order into a detached frozen one- or two-handle tuple; retracted groups are omitted, and M3/Ranker/section/corpus-per-value choice/budgets never reselect or reorder it. Conflict advice emits the exact-key Claim action, then one show per tuple handle in order. Disputed A/B/C therefore emits claims, show A, show B; C remains reachable through the anchored list. General top-level affordance deduplication may suppress a later repeated show across conflict occurrences but never changes an item's tuple. Coexisting A/B/C emits no corrective top-level advice. Every truncated section emits one continuation in display order. Handles retain their implemented show/history affordances, and exact-key Claim affordances disclose omitted values. CLI rendering recursively adds `run` without changing semantic fields.

The CLI grammar additively gains exactly:

```text
lor claims --same-key-as <claim-id> [--limit <n>] [--json]
lor lore --activity <token> [--scope <key=value>]...
    [--corpus-json <SourceRef>] [--max-items <n>] [--max-chars <n>]
    [--cursor <token>] [--json]
```

`--store` remains global and every generated action preserves explicit selection. `--same-key-as` is mutually exclusive with every other cursorless Claim filter and with cursor, permits limit, and renders before limit. Cursorless lore requires exactly one activity; scope and corpus follow existing public decoders. A cursor forbids activity, scope, and corpus but may combine with each budget exactly once. Generated cursorless runs order activity, canonical scope pairs, corpus, max items, then max chars. Generated continuations order cursor, max items, then max chars. `lore --help` follows the direct-help rule.

JSON mode is the recursively rendered application response plus exactly one LF. Text mode prints orientation, then all five count lines in fixed `current`, `patterns`, `candidates`, `conflicts`, `needs_revalidation` display order. Each always states returned/full total, including `0/0`; details appear only for returned items, and continuation prints whenever a section cursor exists, including `returned=0,total>0`. Page-local budget use, Basis, and computed time always render. An empty match is `ok:true`, five zero-total sections, zero budget use, Working Lore Basis, computed time, and exit 0.

All existing failure forms and exits remain. Query/cursor/Ranker output validation is `VALIDATION_FAILED` or `INVALID_CURSOR|CURSOR_MISMATCH` and exits 2; missing store exits 3; provider failure exits 4; Clock or unexpected internal failure exits 6. Working Lore conflicts are semantic attention, not command failure and not `status --check` health; successful lore exits 0.

A cursorless `lore` consumes one Clock call before its atomic scan. Continuation consumes none, preserves the original valid point/computed time/Basis, and recomputes rather than persists derived items or a full permutation. Its private cursor binds the pure-SHA-256/base64url digest and count of the validated global permutation plus exact `(section,occurrence_index)` resume identity/section ordinal (or `before-first`). Lore uses ClaimPolicy validation/semantics but does not invoke optional policy advice. Continuation follows the shared cursor admission and error classification above; lore-specific budget validation also runs before callbacks. Pinned head and complete core/policy/Ranker identity mismatch fails before callbacks. Only after pinned M2 rebuild does Ranker run once; malformed output is `VALIDATION_FAILED`, while a valid count/digest or exact-resume mismatch is `CURSOR_MISMATCH`, before budgeting or partial output. Appends during continuation do not enter the pinned packet; a fresh cursorless call sees the new head. Bare `lor` remains status. The shipped embedded skill includes bounded lore orientation and disclosure guidance.

This section defines the T40–T45/T75 protocol. Current delivery and catalog status are owned by the [implementation plan](../../v0.x/execution/implementation-plan.md) and [`catalog-status.json`](../../v0.x/execution/catalog-status.json).
