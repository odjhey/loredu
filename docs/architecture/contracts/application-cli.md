---
name: application_cli_contract
description: "Exact M1.5 application read, response, pagination, health, affordance, CLI grammar, rendering, error, exit, host-capability, and embedded-skill contract."
type: contract
tags: [contracts, application, cli, m1.5, pagination, agents]
generated: "OpenAI coding agent, 2026-08-28"
created_at: 2026-08-28T06:00:00+08:00
---

# M1.5 application and CLI contract

[Decision 0026](../../decisions/0026-m15-application-cli-contract.md) closes this contract before M1.5 command implementation. It is agreed but remains pre-`current` until implementation and the two-consumer stabilization bar. M1.5 exposes records, exact-key overlap, health, and disclosure; it does **not** expose Current Knowledge or Working Lore, which remain M2 and M3.

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

`add` is the reactive mutation operation used by surfaces. It calls the same append path once, then derives feedback from the prefix ending at the returned position. `append` remains available for embedded consumers that want the smaller M0 result. `show`, `history`, `claims`, `status`, and `readHead` never stamp or append records and consume neither Clock nor RandomSource.

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
  readonly rel: "show" | "history" | "list" | "continue" | "init"
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

The valid rel/action pairs are exactly `show`/`record.show`, `history`/`record.history`, `list`/`claims.list`, `continue`/`claims.list|history.list|status.read`, and `init`/`store.init`. Params are respectively exactly `{id}`, `{id}`, `{query}`, `{cursor, limit?}`, and `{selector}`. A list query is a complete cursorless `ClaimQuery`. Continuation params include `limit` exactly when the current effective limit is not the default 50, preserving that page size; callers may still change it explicitly on the next request. The application never emits `lor`, shell quoting, paths, or argv. `params` contains complete typed portable JSON input for that action. `why` is deterministic explanatory text but its prose is not a compatibility surface. The set, order, action, and params are compatibility behavior. An affordance is emitted only when it is executable as-is: mechanics may recommend inspecting a conflict, but cannot preselect a Resolution decision, replacement, actor, or reason. The embedded skill teaches the agent to construct that judgment command after inspection.

Application failures remain structured `LoreduError` throws; they are never returned as `ok:false` application values. The application preserves the existing phase-owned errors and adds `RECORD_NOT_FOUND`, `INVALID_CURSOR`, and `CURSOR_MISMATCH`. `RECORD_NOT_FOUND` identifies a syntactically valid absent record. `INVALID_CURSOR` means the token cannot be decoded as a supported cursor. `CURSOR_MISMATCH` means it is structurally valid but belongs to another operation, normalized query, ruleset, or store snapshot.

## Result and feedback shapes

```ts
interface RecordHandle {
  readonly id: RecordId
  readonly kind: RecordKind
  readonly affordances: readonly Affordance[] // show, then history
}
interface AddedRecordResult<R extends PersistedRecord = PersistedRecord> {
  readonly record: R
  readonly position: StreamPosition
  readonly handles: readonly RecordHandle[]
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
}
```

Non-Claim additions and every read use `{state:"not-applicable", related:[]}`. A Claim addition compares only earlier Claims in the prefix that have the same exact declared ClaimKey:

1. no same-key Claim → `new-key`;
2. at least one canonically different value and assembled semantics `exclusive` → `conflict-candidate`;
3. otherwise, at least one canonically equal value → `corroboration`;
4. otherwise differing values with `coexisting` semantics → `coexisting`.

`jsonValuesEqual` defines value equality; `claimKeysEqual` defines key equality. Validity, actor, confidence, source, and phrasing do not alter this M1.5 classification. For each non-new state, `related_count` counts the relevant earlier same-key Claims: canonically equal for `corroboration`, canonically different for `conflict-candidate` and `coexisting`. `related` contains exactly the earliest such Claim as a bounded representative. `claims` is the `claims.list` affordance for the complete exact key, using exact scope, subject, predicate, and present/absent perspective filters; it is the bounded drill-down for every overlap state. The feedback creates no Relation and makes no projection choice.

Top-level advice is exact and bounded at M1.5. A `conflict-candidate` addition emits the exact-key `claims.list` affordance, one `record.show` for its earlier representative, and one for the new Claim, in that order. Thus the second differing Claim names both ids directly, while later additions do not expand the response with the size of the group. `new-key`, `corroboration`, `coexisting`, and non-Claim additions emit no corrective advice. Each status page emits the exact-key `claims.list` and representative show affordances for each unresolved group, then one show for each dangling reference's referring record, deduplicated by the general rule, followed by continuation when present. Generic divergence remains represented by its result handles and adds no corrective advice. Show and ordinary list reads add no top-level advice except list continuation. Every record handle still carries its ordinary nested show/history disclosure affordances.

A history or Claim result item carries only its own record handle. List summaries deliberately omit record-reference fields; following the item's show affordance is the explicit full-record disclosure step rather than multiplying each bounded list item by an unbounded schema array. An added or shown result carries its own handle followed by every distinct referenced record committed at a lower position, in schema field/index order. An absent or forward-pointing id in a persisted reference field remains visible in the full shown record but receives no handle or affordance; it is an explicit terminal invalid-reference diagnostic, never a promise that following it is valid history. `show` scans one snapshot so it can return the full record's position, handles, and basis atomically. Lists also omit Entry bodies and common metadata/sources. `history(id)` returns the target and every record in the pinned prefix that directly references it: Claim `derived_from`; Relation `from`/`to`; Resolution `targets`/`replacement`; and Verification `targets`. Results are unique and ascending by stream position; the target naturally occupies its committed position rather than being forced to index zero. `history` for an absent target still fails with `RECORD_NOT_FOUND`; it never turns dangling references into a successful dead-end result. External SourceRefs and explicit missing-reference diagnostics are terminal disclosure values, not Loredu record handles.

## Claim query and ordering

```ts
interface ClaimFilters {
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

All supplied filters combine with logical AND. Scope defaults to subset matching: every requested pair must exist with the exact same value; `{}` or omission matches every scope. `scope_match:"exact"` requires exact pair-set equality and is valid only with a supplied scope (including `{}`); `"subset"` is the normalized default and is omitted from Basis. Subject type/id, predicate, value, and Actor use exact structural equality with no normalization. A string perspective matches only Claims where it is present and equal; `null` matches only Claims with no perspective. `since` is an inclusive lower bound on canonical `recorded_at`. It accepts the caller timestamp grammar from the record contract and is normalized before query identity is constructed.

Application query inputs are closed descriptor-safe inert data under the record boundary rules: excess fields, accessors, custom containers, present-own `undefined`, mixed cursor/filter forms, malformed ids/timestamps/limits, and invalid portable JSON reject as `VALIDATION_FAILED` before a store call. `show` likewise validates a complete record id before reading. Omitted `claims()` is the empty cursorless query.

Claims and history order only by ascending stream position. Position is already a total order, so timestamp/id tiebreakers are neither needed nor permitted. The default limit is 50; accepted limits are safe integers from 1 through 200. Every list is bounded. Cursor continuation may select another valid limit, but may not supply filters or an id; those come from the cursor. A cursorless query may not combine `cursor` with any other query field except `limit`.

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

The token is an integrity/checking mechanism, not a confidentiality or authentication promise. Decode failures, unsupported versions, impossible positions, or missing fields are `INVALID_CURSOR`. On continuation the application scans current history, verifies current head is at least the pinned head and that the pinned position still contains the anchor id, verifies operation/query/ruleset equality, then filters every read to `position <= basis.stream_position`. Failure is `CURSOR_MISMATCH`; it never restarts at current head. Appends during a chain therefore cause neither duplicates nor skips. A cursorless repeat chooses a fresh snapshot.

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

An **unresolved exclusive group** is an exact ClaimKey group for which the assembled policy selects `exclusive` and at least two canonically different values exist at the basis. It is closed only by a Resolution in the same prefix whose unique `targets` include every Claim currently in that group. Any decision, including `leave_disputed`, records sufficient human judgment to close health. Adding a later Claim to the group reopens it until a later Resolution covers the enlarged group. Relations describe links but do not close an exclusive group. Group Claims and groups themselves order by earliest member position. The item carries only the earliest representative plus full `claim_count`; its `claims.list` affordance uses exact scope, subject, predicate, and present/absent perspective filters so the complete group remains bounded and paginates normally.

A **dangling record reference** is any persisted Claim `derived_from`, Relation endpoint, Resolution target/replacement, or Verification target for which no matching record exists at a lower stream position. An absent target and a target appearing only later are both dangling because references must point backward. One item is emitted per field/index in ascending referring-record position and schema traversal order. Its `record` is the executable handle for inspecting the referring record; `target` reports the invalid reference id as an explicit terminal diagnostic and never itself carries an affordance. Wrong-family ids make the persisted record invalid and therefore provider-corrupt rather than health data. Normal application appends prevent dangling references, but valid hand-authored records can expose them. `attention` lists unresolved groups first, then dangling references, each in its ordering above.

Malformed canonical files are not application health data. The M1 provider rejects them as `STORE_CORRUPT` before returning a `RecordScan`; `status` consequently fails with the store-error envelope and cannot truthfully return partial health. This preserves the RecordStore boundary rather than adding a filesystem inspection escape hatch.

The generic key-divergence advisory is versioned core mechanics. Within one exact scope, Claims are grouped by canonical JSON-equal value. If a value appears under multiple exact ClaimKeys, `duplicates` Relations are treated as undirected edges between their Claim endpoints. One advisory is emitted when more than one connected key component remains. It carries the full component count, the earliest representative from each of the first two components, and a `claims.list` affordance using exact-scope plus value filters for bounded drill-down; it never embeds an unbounded representative array. Advisories order by earliest representative position. It never reconciles across keys, changes health, or guesses which key is preferred. Recording enough explicit `duplicates` Relations to connect the components suppresses it.

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

`--version` and `-v` are identical and accept no other option or positional. They write exactly `lor <cli-version> (schema <record-schema>, store <adapter-name>, home <default-home>)` plus LF to stdout and exit 0, preserving the existing compile-smoke metadata line. The four placeholders are the current build's CLI package version, record schema id, adapter name, and adapter-resolved default Loredu home. The command checks no store and consumes neither Clock nor RandomSource. Any combined form, including `lor --version --json`, is `CLI_USAGE`; when `--json` is present the normal JSON failure envelope is emitted and the exit is 2.

For a valid command path, `--help` writes its concise direct help text plus LF to stdout and exits 0 without resolving a store or emitting an envelope. Combining it with `--json`, `--store`, or any command option is `CLI_USAGE`; a supplied `--json` therefore produces the JSON failure envelope and exit 2 rather than help text.

`[common options]` means repeated `--scope <key=value>`, one `--metadata-json <object>`, and repeated `--source-json <SourceRef>`. Scope splits on the first `=` and both sides must satisfy token rules; duplicate keys reject. Actor splits on the first `:`; the left side is the closed Actor type and the right side is the complete id token. JSON options accept exactly one JSON text value and then pass through the public domain decoder; `--metadata-json` must be an object, `--source-json` one SourceRef object, and `--verified-against-json` one snapshotted SourceRef. `--value` is always a string; `--value-json` is required to distinguish `1`, `true`, `null`, arrays, objects, and a JSON-quoted string.

`--body -` reads stdin to EOF as UTF-8 and passes the decoded text unchanged: no trimming or newline insertion/removal. Invalid UTF-8 is a usage/validation failure. A terminal may supply `--body <text>` directly. Stdin is not read for another spelling or after an earlier error.

Claim filters are repeated `--scope`, optional `--exact-scope` (with no scope pair it means exact empty scope), plus singular `--subject-type`, `--subject`, `--predicate`, mutually exclusive `--perspective <token>` or `--without-perspective`, `--value|--value-json`, `--actor`, and `--since`. A `--cursor` forbids every filter and the history positional id but may combine with one `--limit`; therefore continuation rendering is the command plus cursor and optional changed limit. Cursorless history requires its positional id; cursor history forbids it. `--check` is valid only on cursorless status, may combine with `--limit`, evaluates full pinned health regardless of the displayed page, and changes only the exit.

Store selection follows the plain-file contract. For `init`, positional selector and global `--store` are mutually exclusive; omission initializes default. Init success returns `{root, selector}` where `root` is the adapter-resolved absolute path and `selector` is the supplied selector or `"default"`; its Basis has stream position zero and query `{operation:"init"}`. All other store-backed commands use global selection and never initialize. `skill`, version, and help do not resolve a store and reject `--store`; skill still permits `--json` as its documented mode. Bare `lor` is exactly the first status page for the selected store; it is not help and behaves as cursorless `lor status`, without `--check`.

M1.5 intentionally has no `lore`, `current`, `--as-of`, or `--valid-at` grammar. M2 adds `current` and temporal flags without changing this envelope; M3 adds `lore` and Working Lore section continuations.

## JSON, text, errors, and exits

For store-backed commands, `--json` writes exactly one JSON object plus LF to stdout. JSON success preserves the application fields, renders branded positions as numbers, and renders every application advice item as:

```json
{"rel":"show","action":"record.show","params":{"id":"clm_..."},"why":"inspect the claim","run":"lor show clm_..."}
```

`run` is added by the CLI and is shell-ready POSIX syntax using single-quote escaping where required. The CLI recursively renders every affordance: top-level `advice`, each `RecordHandle.affordances`, reconciliation-related handles, health/advisory handles, and result handles all gain the same `run` field. Removing only those `run` fields reproduces the application value. A store-backed rendered action preserves the originating explicit selector by placing the shell-quoted `--store <selector>` before its command; when selection was implicit default, it omits `--store`. Store-init advice renders the exact missing selector. Thus following a handle or cursor cannot silently switch stores. Generated Claim-query runs order scope pairs canonically, then `--exact-scope`, subject type/id, predicate, perspective/absence, canonical `--value-json`, Actor, normalized since, and limit. Generated continuation runs order cursor then optional limit. This fixed order plus POSIX quoting makes rendering deterministic. Output key insertion order is `ok`, `result`, `reconciliation`, `advice`, `basis`, then `page` when present; consumers must not rely on JSON object key order. No diagnostics accompany JSON on stdout.

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

CLI-local stable error codes are `CLI_USAGE` for argv grammar and `INTERNAL_ERROR` for an unexpected unmapped failure. JSON/UTF-8/domain failures use `VALIDATION_FAILED`; application/provider codes pass through their named category. `status --check` remains a successful envelope and has no synthetic error code. A missing store failure may carry one CLI-rendered `store.init` affordance; other failures do not invent corrective domain action.

Stable process exits are:

| Exit | Meaning |
|---:|---|
| 0 | command executed, including ordinary `status` that reports unhealthy |
| 2 | argv/JSON/stdin/domain validation, invalid or mismatched cursor, or reference validation |
| 3 | valid store or record selector not found |
| 4 | store/provider/append/lock/corruption/I/O failure or duplicate id |
| 5 | `status --check` executed successfully and health is false |
| 6 | Clock, RandomSource, or unexpected internal application failure |

`status --check` returns the same successful response as `status`; only exit 5 differs. A generic divergence advisory alone still exits 0. Unknown errors map to 6 without leaking details. Signal/launcher exits are host behavior outside this table.

## Composition root capabilities

The CLI package is the production composition root. It creates one host `Clock` whose `now()` obtains current epoch milliseconds and validates them through `createInstant`, and one secure `RandomSource` whose `nextBytes(count)` returns a newly allocated `Uint8Array` filled by the host cryptographic random generator. There is no fallback to `Math.random`, time-derived bytes, seeded entropy, partial output, or retry in the adapter. Host capability failures flow through the application's existing `CLOCK_FAILED` or `RANDOM_SOURCE_FAILED` mapping. These host implementations are CLI-internal, are not exported by kernel or adapter packages, and no clock/random package is introduced.

Read-only commands may assemble the application with these capabilities but cannot call them. `init`, version, skill, and help require neither capability.

## Embedded skill

`docs/v0.x/execution/agent-skill.md` is the only skill source. The compile step embeds its UTF-8 bytes; no runtime filesystem lookup, network access, generated second copy, or separately installed skill is allowed. Text `lor skill` removes only the YAML frontmatter including its delimiters and writes the remaining Markdown bytes exactly, preserving the source's final LF. It resolves no store and emits no envelope decoration. `lor skill --json` returns the same Markdown string as `result.guide` in the CLI success envelope with `reconciliation` not applicable, empty advice, and `basis:null`; this is the sole successful non-store envelope with a null basis.

The embedded M1.5 guide may name only commands available in this grammar. It orients with status and claims, teaches explicit actor/provenance, exact-key discovery, cursor following, manual Relation/Resolution judgment, and `status --check`. Its revision triggers, not its M1.5 instructions, may mention M2 `current` and M3 `lore`.

## Milestone upgrades and readiness

M1.5 implements record commands, exact-key feedback, query/status, pagination, and disclosure. M2 may add richer reconciliation and `current` while preserving response/error/exit shapes. M3 may add `lore`, Working Lore budgets, and section continuation under the same cursor and affordance rules. T50–T75 therefore have fixed protocol semantics now but retain their staged implementation owners; this contract is no implementation or catalog claim.
