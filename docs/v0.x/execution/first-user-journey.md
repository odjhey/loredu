---
name: first_user_journey
description: "The first real usage journey (human driver + agents via CLI) and the automated behavioral test catalog derived from it."
type: plan
tags: [v0.x, execution, journey, testing, cli]
generated: "Claude Fable 5 (Claude Code), ChatGPT GPT-5.6 Sol, and OpenAI coding agent, 2026-08-28"
created_at: 2026-08-26T00:00:00+08:00
---

# First user journey and behavioral test cases

The first user is the project owner plus their agents, driving Loredu through the CLI ([decision 0007](../../decisions/0007-typescript-bun.md)). The binary is `lor` — short enough for agents to type constantly. This document describes usage step by step and derives the behavioral tests that must be automated. [Decision 0026](../../decisions/0026-m15-application-cli-contract.md) fixes the implemented M1.5 protocol; [decision 0027](../../decisions/0027-m2-reconciliation-projection-contract.md) fixes the additive M2 `current`/temporal projection protocol; M2 implementation and M3 remain staged.

The CLI arrives right after M1, before full reconciliation, and its semantic responses are **agent-reactive** ([decision 0008](../../decisions/0008-cli-first-agent-reactive.md)): they expose mechanical feedback, health, and deterministic affordances when applicable so an agent can chain calls until health passes. M1.5 orientation is status plus filtered record queries. Current Knowledge does not exist until M2; Working Lore does not exist until M3.

## Response envelope

The exact [application and CLI contract](../../architecture/contracts/application-cli.md) owns field shapes, errors, exits, filters, cursors, and rendering. A Claim mutation success has this shape (handle internals are abridged in this explanatory example):

```json
{
  "ok": true,
  "result": {"id": "clm_3333333333333333", "kind": "claim", "position": 4, "handle": {"id": "clm_3333333333333333", "kind": "claim", "affordances": []}},
  "reconciliation": {
    "state": "conflict-candidate",
    "key": {"scope": {"repo": "rozoro"}, "subject": {"type": "code-area", "id": "command-registration"}, "predicate": "location"},
    "related_count": 2,
    "related": [{"id": "clm_1111111111111111", "kind": "claim", "affordances": []}],
    "claims": {"rel": "list", "action": "claims.list", "params": {"query": {"scope": {"repo": "rozoro"}, "scope_match": "exact", "subject_type": "code-area", "subject": "command-registration", "predicate": "location", "perspective": null}}, "why": "inspect the complete exact-key group", "run": "lor claims --scope repo=rozoro --exact-scope --subject-type code-area --subject command-registration --predicate location --without-perspective"}
  },
  "advice": [
    {"rel": "list", "action": "claims.list", "params": {"query": {"scope": {"repo": "rozoro"}, "scope_match": "exact", "subject_type": "code-area", "subject": "command-registration", "predicate": "location", "perspective": null}}, "why": "inspect the complete exact-key group", "run": "lor claims --scope repo=rozoro --exact-scope --subject-type code-area --subject command-registration --predicate location --without-perspective"},
    {"rel": "show", "action": "record.show", "params": {"id": "clm_1111111111111111"}, "why": "inspect the earlier representative", "run": "lor show clm_1111111111111111"},
    {"rel": "show", "action": "record.show", "params": {"id": "clm_3333333333333333"}, "why": "inspect the new claim", "run": "lor show clm_3333333333333333"}
  ],
  "basis": {
    "stream_position": 4,
    "ruleset": {"core": "loredu.reconciliation/v1", "claim_policy": {"id": "loredu.default", "version": "1"}},
    "query": {"operation": "add", "id": "clm_3333333333333333"}
  }
}
```

Claim/history lists and the combined status attention/advisory collection add `page: {returned,total,cursor?}`. Every collection is deterministically ordered and bounded to 50 by default (maximum 200). List items expose only their own handle and omit reference fields from summaries; `show` is the explicit full-reference disclosure step. A continuation command carries only its opaque `loredu.cursor.v1.` cursor; the token binds operation, normalized query, Basis, pinned-head record-id anchor, and an operation-specific exclusive resume key. Claims/history use the last position; status also binds item class and same-position ordinal so two diagnostics from one record paginate exactly. It rejects invalid/foreign snapshots rather than restarting. Every present Loredu record id exposed at the full-record level is paired with show/history affordances. Valid absent ids reported as missing-reference diagnostics and external SourceRefs explicitly end Loredu disclosure; neither receives a dead command.

Application advice contains surface-neutral `{rel,action,params,why}`; only CLI JSON adds `run`. Advice is deterministic mechanics, never model output. Exact-key overlap and core key-divergence are not ClaimPolicy advice. If a Claim commits but its feedback scan fails, success still returns that id/position, marks reconciliation unavailable, and advises `lor status`; it never tells the caller to repeat the append.

Two suites automate the same staged journeys:

- **application suite** (`bun:test`, fast, majority of cases) — drives the surface-neutral application API directly;
- **CLI conformance suite** — drives the compiled binary with `--json`, asserting equivalent semantic results, parseable envelopes, runnable renderings, and stable exits.

## Journey 0 — install and init

```text
$ lor init rozoro-investigation
initialized store at ~/.loredu/stores/rozoro-investigation
```

One directory per store, human-inspectable, Git-friendly ([decision 0003](../../decisions/0003-plain-files-first.md)). No daemon, no config required to start.

Store resolution is predictable and follows the [plain-file provider contract](../../architecture/contracts/plain-file-store.md): an explicit path is used outside Loredu home (an explicit relative path is intentionally resolved from cwd), a validated name resolves to `$LOREDU_HOME/stores/<name>` with absolute `LOREDU_HOME` defaulting to `~/.loredu`, and with no selector resolution uses the default name `default`. Relative Loredu homes reject for named/default selection so store identity cannot drift with cwd; explicit paths bypass Loredu home. A one-token `--store` value is path-like only when absolute, prefixed by `.` plus a platform separator, or containing a platform separator; every other token is a name. If the resolved store does not exist, the command fails with an actionable error suggesting `lor init`—no upward discovery or silent creation. Stores live under `stores/` so the home root stays free for configuration and other concerns; multiple named stores have disjoint roots/locks/positions, and tests isolate by pointing `LOREDU_HOME` at an absolute temp directory.

## Journey 1 — first M1.5 orientation on an empty store

```text
$ lor status
healthy: true
open exclusive groups: 0    dangling record refs: 0
advisories: 0
page: returned=0 total=0
$ lor claims --scope repo=rozoro
no claims
page: returned=0 total=0
```

Both are definitive empty successes with Basis position zero. Bare `lor` is exactly the first status view. This is the M1.5 orientation promised by ADR 0008; the empty Working Lore packet is deferred to M3 and appears in journey 4.

## Journey 2 — record what was learned

Free text first, always cheap:

```text
$ echo "Command registration is concentrated in src/commands, but plugins
  can register commands dynamically elsewhere." | lor add entry \
    --actor agent:example.agent --type finding --title "command registration" \
    --source-json '{"ref":"repo=rozoro","locator":"src/commands","snapshot":"3a1d8b7"}' --body -
ent_0123456789abcdef
```

Then the structured claim, keyed ([decision 0004](../../decisions/0004-claim-identity-key.md)):

```text
$ lor add claim --actor agent:example.agent --scope repo=rozoro \
    --subject-type code-area --subject command-registration \
    --predicate location --value src/commands \
    --derived-from ent_0123456789abcdef --confidence observed
clm_1111111111111111  new claim (no prior claims under this key)
```

The write-time feedback line is part of the contract: it is how writers learn whether their key vocabulary is landing.

## Journey 3 — corroboration and conflict

A second actor (an agent, different phrasing, same declared key):

```text
$ lor add claim ... --predicate location --value src/commands ...
clm_2222222222222222  corroborates clm_1111111111111111
```

A later run finds the world changed:

```text
$ lor add claim ... --predicate location --value src/cli/commands ...
clm_3333333333333333  conflict candidate under key with 2 earlier differing claims
advice: lor claims --scope repo=rozoro --exact-scope --subject-type code-area --subject command-registration --predicate location --without-perspective
advice: lor show clm_1111111111111111
advice: lor show clm_3333333333333333
```

Nothing is deleted or overwritten. The advice is executable mechanics: inspect both facts. It does not prejudge a preferred claim, actor, or reason; after verification, the embedded skill supplies the explicit Resolution grammar.

## Journey 3b — chain until healthy

The agent follows the exact-key list and every continuation, inspects and verifies all three Claims, resolves the complete current group, then checks health:

```text
$ lor claims --scope repo=rozoro --exact-scope --subject-type code-area \
    --subject command-registration --predicate location --without-perspective
clm_1111111111111111
clm_2222222222222222
clm_3333333333333333
$ lor resolve --actor agent:example.agent \
    --target clm_1111111111111111 --target clm_2222222222222222 \
    --target clm_3333333333333333 --decision prefer \
    --replacement clm_3333333333333333 \
    --reason "verified against snapshot 9f21c44; registration moved"
res_4444444444444444
$ lor status --check
healthy: true
open exclusive groups: 0    dangling record refs: 0
advisories: 0
page: returned=0 total=0
```

`lor status` is the "am I done?" check that terminates the chain. It has two tiers:

- **health** (blocks `--check`): unresolved `exclusive` exact-key groups and dangling persisted record references;
- **advisories** (reported, never blocking): generic equal-value/different-key divergence within one exact scope, suppressible by eligible explicit `duplicates` Relations whose endpoints point backward and connect the key components.

Malformed canonical files are provider corruption: status fails with the store-error envelope rather than claiming partial health. All successful checks are mechanical and available before full reconciliation. `lor status --check` exits 5 only when health is false; advisories alone exit 0.

Content first (borrowed agent-ergonomics principle): bare `lor` with no arguments prints this orientation view — live data, never a help screen. Help stays consistent and concise: `lor <command> --help` prints a per-command reference; `lor skill` remains the full agent guide.

## Namespacing and key hygiene

The kernel enforces key **shape** only (identifier-safe, no prose). Namespacing and vocabulary are the consumer's to impose — Loredu models healthy conventions in its examples and CLI output (e.g. `--scope repo=rozoro`, subjects like `code-area/command-registration`) without mandating them. The agent's duplicate-detection tool is the query engine, not a kernel rule: `lor claims` composes the contract filters (`--scope`, `--subject-type`, `--subject`, `--predicate`, `--perspective`, `--value`, `--actor`, `--since`), so an agent checks for existing keys before inventing one, and `status` advisories catch what slips through.

Because semantic results are available as `--json` or line-oriented text, the built-in filters only need to cover the common paths — anything further composes through unix pipes:

```text
$ lor claims --scope repo=rozoro --json | jq -r '.result[] | select(.confidence == "candidate") | .id'
```

The shell is the rest of the query engine; lor does not need to grow one.

## Journey 4 — M3 Working Lore reflects it

This journey begins only when M3 lands. On an empty matching scope, the same command returns a definitive empty packet with Basis and exit 0. After the complete Resolution in journey 3b, the current packet reflects that judgment:

```text
$ lor lore --activity investigate --scope repo=rozoro
current:
  (code-area command-registration) location = src/cli/commands   [clm_3333333333333333, resolved]
attention: none
basis:
  stream_position: 5
  ruleset: { core: loredu.reconciliation/v1, claim_policy: { id: loredu.default, version: "1" } }
  query: { activity: investigate, scope: { repo: rozoro } }
```

Bounded, ranked, with stable handles — not a record dump.

## Journey 5 — M2 projects the M1.5 Resolution

Journey 3b already recorded the complete-group judgment and proved M1.5 health. M2 adds the projection command; it is not accepted by an M1.5 binary:

```text
$ lor current --scope repo=rozoro
(code-area command-registration) location = src/cli/commands  [preferred, clm_3333333333333333]
reconciliation: preferred=1 disputed=0
```

The winning `prefer` Resolution is recorded-visible, effective, directly covers all applicable Claims, and names its same-key replacement. Current Knowledge exposes at most two representatives, full history/evidence counts, an exact-key Claim affordance, Basis, separate `computed_at`, and a page. “Preferred” reports deterministic precedence, not a truth judgment.

## Journey 6 — M2 time travel

```text
$ lor current --scope repo=rozoro --as-of 2026-08-26T12:00:00Z
(code-area command-registration) location = src/commands  [preferred]
$ lor current --scope repo=rozoro --valid-at 2026-07-15T00:00:00Z
(code-area command-registration) location = src/cli/commands  [preferred]
$ lor current --scope repo=rozoro \
    --as-of 2026-07-15T00:00:00Z --valid-at 2026-07-15T00:00:00Z
(code-area command-registration) location = src/commands  [preferred]
```

`as_of` is an inclusive recorded-time cutoff. Alone it also supplies the valid-time point. Explicit `valid_at` is the inclusive external-world point; the combination keeps both dimensions independent. Bare current captures one Clock instant as its resolved `valid_at`, records that semantic input in Basis query, and keeps the same sample separately as informational `computed_at`.

## Journey 7 — drill down

```text
$ lor show clm_3333333333333333        # claim detail + provenance refs
$ lor history clm_3333333333333333     # relations, resolution, verifications
$ lor show ent_0123456789abcdef        # the original free text
```

Every id presented as an existing record is resolvable. An absent or forward-pointing id can appear only as an explicit invalid-reference diagnostic and is terminal rather than paired with a misleading command.

## Journey 8 — M1.5 head; later projection staleness

```text
$ lor head
stream_position=5
```

M1.5 can compare any response Basis to this store-wide head and can continue an older list through its pinned cursor. Once projections exist, a cached Current Knowledge or Working Lore response with `basis.stream_position=4` is conservatively stale when head is 5. Equal head alone is insufficient: active structural ruleset and normalized query must also equal the cached Basis. Deleting derived artifacts and replaying plain files must reproduce semantic items, reconciliation counts, ordering, and affordance actions/params for the same Basis; separate `computed_at`, rendered prose/commands, and private cursor bytes do not participate ([decisions 0006](../../decisions/0006-explicit-version-basis.md) and [0027](../../decisions/0027-m2-reconciliation-projection-contract.md)).

## Journey 9 — teach the agents

The skill ships **inside the binary**: build embeds [the one agent guide source](./agent-skill.md). Text `lor skill` strips only YAML frontmatter and prints the remaining Markdown bytes exactly without resolving a store; `--json` returns the same guide string. The M1.5 guide instructs agents to orient with status/claims, provide actor and provenance, follow embedded commands/cursors, and record rather than guess judgment. `current` and `lore` appear only in its M2/M3 revision triggers. A repo-level `.agents/skills` wrapper can simply defer to `lor skill`.

## Behavioral test catalog

Grouped by milestone; **AC n** = acceptance criterion in [goal and scope](../scope/goal-and-scope.md), **S A/B/C** = acceptance scenarios in the [implementation plan](./implementation-plan.md).

### M0 — records and validation

| # | Given / When / Then | Covers |
|---|---|---|
| T01 | valid exact-body Entry draft → application returns `{record, position}`; whitespace-only body rejects without stamping | AC 1, invariant 3 |
| T02 | application supplies fixed schema/id/canonical millisecond `recorded_at`; actor plus canonical `scope`, `metadata`, `sources` are present | AC 1 |
| T03 | all safely discoverable malformed Claim/plain-data issues aggregate as stable code + RFC6901 path without invoking accessors | AC 11, ADR 0004 |
| T04 | missing/malformed declared-key fields, including free prose in `subject.id`, reject without normalization | ADR 0004 |
| T05 | canonical records are detached recursive copies and deeply frozen; mutating every nested draft container or returned/store-read container cannot change history | invariant 1 |
| T06 | public `encodePersistedRecord → JSON.stringify → JSON.parse → decodePersistedRecord` preserves recursive unknown non-`loredu.*` metadata, including repeated nested array elements; malformed/excess persisted data rejects | ADR 0005 |
| T07 | same logical input twice → distinct record ids (append, never replace) | store contract |
| T08 | all family prefixes and MSB-first entropy fixtures match; prefix mismatch rejects; generated collision surfaces `DUPLICATE_RECORD_ID` without retry | record/identity contracts |
| T19 | through kernel + testing only, missing/wrong-kind Claim `derived_from`, Relation `from`/`to`, Resolution `targets`/`replacement`, or Verification `targets` fails with ordered code/path issues before entropy, clock, or append; SourceRefs cause no lookup | store contract, ADR 0020 |
| T85 | scope identity is order-insensitive: two claims whose scope maps differ only in pair order share a key; adding a pair yields a different key; absent scope and `{}` are the same key | ADR 0019, ADR 0004 |
| T87 | using only exact normal/testing exports, assemble via `createLoreduApplication`; two Entry appends return branded positive increasing positions; plain number assignment fails; failed append publishes/advances no position; `createStreamPosition` supports adapters; testing helpers are absent normally | ADR 0020, kernel API |

### M1 — plain-file store

| # | Given / When / Then | Covers |
|---|---|---|
| T10 | every adapter under the runner-neutral M1 conformance cases, including PlainFileStore and M1-complete InMemoryStore, returns contiguous positive successful positions; scan's captured head and latest `head()` match; duplicate and pre-publication failures do not advance | ADR 0006, ADR 0020, ADR 0022 |
| T11 | write records → new store instance on the same root replays the identical ascending positioned stream and atomic scan snapshot | AC 9, ADR 0022 |
| T12 | contiguous filename-derived positions and head are stable across replays and after derived/control leftovers are removed | ADR 0006, ADR 0022 |
| T13 | `append` with an existing id → `DUPLICATE_RECORD_ID`; original bytes/record and scan/head are untouched | store contract |
| T14 | files are inspectable strict JSON-valued YAML frontmatter + Markdown; an Entry body is exact and a hand-added valid next-position/matching-id record is picked up on replay | ADR 0003, ADR 0022 |
| T15 | full RecordStore and runner-neutral conformance compile/test with pure InMemoryStore and no Bun/fs/test-runner import or ambient host types in kernel | ADR 0001/0007/0011/0022 |
| T16 | while one append owns the append-scoped lock, a second writer fails immediately with `STORE_LOCKED` and allocates/mutates nothing; elapsed time or hostname equality cannot steal it, while a dead owner is recovered only under matching boot/session and PID-namespace identity | store contract, ADR 0022 |
| T17 | root helpers return composable primitive strings; resolution is explicit path > validated name under `$LOREDU_HOME/stores/` > default name; named/default roots require absolute configured/OS homes, while explicit paths ignore `LOREDU_HOME`, resolve symlink targets and the nearest existing ancestor of missing roots; missing roots fail actionably and are never implicitly created/discovered; relocation by a new explicit path works; named roots isolate files, locks, and positions and reject traversal or symlink escape through the shared `stores` ancestor or root | journey 0, ADR 0022, ADR 0028 |
| T18 | append fsyncs temp bytes, atomically renames, and fsyncs directory entries before returning; kill/failure at each boundary replays old prefix or one whole next record, and a returned position survives reopen | store contract, ADR 0022 |

### M2 — reconciliation, resolution, projections

| # | Given / When / Then | Covers |
|---|---|---|
| T20 | overlapping same-key/equal-value Claims from different actors are one `corroboration` derived relation (later → earlier), `preferred` one-value knowledge, and never an appended Relation | AC 3, 11, S C, ADR 0027 |
| T21 | overlapping same-key/different-value Claims under `exclusive` produce one `conflict` relation and disputed Current Knowledge; absent a complete Resolution, an active participating `supersedes` cycle is disputed even for one equal value and removes no cycle member | AC 3, S C, ADR 0027 |
| T22 | different-perspective keys never conflict or merge; custom advice context admits exactly applicable Claims, Relations with both endpoints in that set, and Resolutions whose every target/replacement stays inside it; dense non-blocking output may name both keys, accepts 200, and rejects 201 before elements/sort/count/page with no partial result | S C guardrail, ADR 0027 |
| T23 | Claims under different exact keys never auto-reconcile or share a derived relation, even when a policy advisory or explicit cross-key Relation names both | ADR 0004, ADR 0027 |
| T24 | a latest effective backward-valid `prefer` Resolution directly covering every selected applicable same-key Claim selects only a targeted applicable replacement; an incomplete/later-uncovered Resolution or future replacement does not; every Claim/Resolution remains addressable and immutable | AC 4, invariant 6, ADR 0027 |
| T25 | `as_of=A` includes exactly records with `recorded_at <= A`, uses A as implicit valid point when `valid_at` is absent, and reproduces scenario A's earlier belief | AC 6, S A, ADR 0027 |
| T26 | current `valid_at=V` uses all recorded-visible knowledge and inclusive Claim intervals/Resolution effectiveness; at a January point an old Claim remains selected when a targeted replacement starts in February, and an inapplicable `new → old` supersedes edge cannot remove it, while a late-recorded amendment can project once applicable | AC 7, S B, ADR 0027 |
| T27 | `as_of=A, valid_at=V` independently limits recorded knowledge and external applicability, distinguishing the historical belief from a later-discovered correction | AC 7, S B, ADR 0027 |
| T28 | under ADR 0027's narrow replacement of ADR 0006 byte identity, delete derived state and replay the same prefix → equal semantic items, relation/state counts, ordering, and affordance actions/params for the same Basis; computed time, why/run/rendering, and private cursor bytes are excluded | AC 5, ADR 0006/0027 |
| T29 | current projection carries full-scan-head Basis with structural ruleset and explicit resolved `valid_at`, plus sibling `computed_at`; advice is called once per admitted first/continuation page (including empty), omitted/pre-admission-invalid means zero, and continuation stores no output, preserves inputs, consumes no Clock, recomputes the combined stream, and mismatches impossible resume | AC 14, ADR 0027 |
| T30 | lower store head means stale; equal head with query/core/policy mismatch means invalid; a ruleset version bump invalidates cache without touching canonical records | ADR 0006/0027 |
| T86 | M0 canonical equality makes reordered objects equal and classifies the exact duplicate/corroboration/support boundary deterministically, while `1` and `"1"` under one overlapping exclusive key produce `conflict`, never duplicate | ADR 0019, ADR 0010/0027 |

### M3 — Working Lore

| # | Given / When / Then | Covers |
|---|---|---|
| T40 | empty scope → definitive empty packet with basis, exit 0 | journey 4 |
| T41 | packet respects `max_items` / `max_chars` as record count grows 10× (S A: bounded, not raw entries) | AC 8, S A |
| T42 | superseded claims omitted from default packet but reachable via handles | working-lore contract |
| T43 | conflicts and needs-revalidation appear in attention sections | AC 8 |
| T44 | every handle in a packet resolves via show/history | journey 7 |
| T45 | packet with stale basis detected after exactly one new relevant record | AC 14 |

### CLI conformance (compiled binary)

| # | Given / When / Then | Covers |
|---|---|---|
| T50 | every semantic command supports `--json`; success/failure is one LF-terminated object, and application-backed semantic fields match the application result after CLI advice rendering | agent ergonomics, ADR 0026 |
| T51 | exits are exact: 0 executed, 2 usage/validation/reference/cursor, 3 not-found, 4 store/provider, 5 unhealthy `--check`, 6 capability/internal | agent ergonomics, ADR 0026 |
| T52 | `add entry --body -` reads stdin; body round-trips byte-exact through store and `show` | journey 2 |
| T53 | `add claim` prints M1.5 new/corroboration/conflict/coexisting feedback and, once M2 lands, exact duplicate/corroboration/support/temporal-succession feedback with related fields limited to the selected class; a post-commit read failure prints committed-but-feedback-unavailable with status advice and still exits 0 | journey 2–3, ADR 0026/0027 |
| T54 | after M2/M3 commands exist, end-to-end scenario A (three runs, revalidation surfaced) through the binary | S A, staged M2/M3 |
| T55 | after M2 temporal projection exists, end-to-end scenario B (30→60-day amendment, all four temporal queries) through the binary | S B, staged M2 |
| T56 | staged end-to-end journey 0→8 as one scripted fresh-store session: M1.5 record/query/health first, then M2 current/time and M3 lore when those commands land | AC 12 (ergonomics), ADR 0026 |
| T57 | AC 12 measured at M1.5: journey 2 (entry + claim) is ≤ 2 commands; empty orientation is one bare `lor` status command (a scoped claims query is optional follow-up) | AC 12, ADR 0026 |
| T58 | content first: bare `lor` prints the orientation/status view (live data, exit 0), not help; `lor <command> --help` prints a concise per-command reference; an unknown flag fails with an actionable error, never ignored | agent ergonomics, journey 3b |

### Agent-reactive envelope (ships with the early CLI)

| # | Given / When / Then | Covers |
|---|---|---|
| T60 | every application mutation response contains exact bounded `ok`, `result`, `reconciliation`, surface-neutral `advice`, and `basis`; it is deeply frozen, carries no CLI strings, and a committed feedback failure never looks like mutation failure | ADR 0008/0026 |
| T61 | in the M1.5 slice, a second same-key/same-value Claim corroborates; in M2, conflict > duplicate > corroboration > support > coexisting > temporal-succession selects one feedback class, `new-key` requires no earlier same-key Claim, and disjoint succession is non-blocking with one earliest representative and no corrective advice | journey 3, ADR 0027 |
| T62 | second claim, same key + different value → conflict-candidate feedback with related count, one representative, exact-key list drill-down, and bounded `advice` naming both ids | journey 3 |
| T63 | application chain: paginate the exact-key list from T62, inspect all Claims, target every current member in a Resolution, record judgment, then read healthy status | journey 3b, ADR 0026 |
| T64 | at M1.5, bounded application status counts every absent/forward persisted reference and unresolved exclusive group and requires complete eligible Resolution coverage; at M2, only inclusive-validity-overlapping different-value conflict-pair endpoints participate in the unresolved set/count/coverage, purely disjoint succession consumes no Clock and never blocks or reopens health, and malformed canonical records fail as store corruption rather than partial health | journey 3b, ADR 0026/0027 |
| T65 | text `lor skill` equals frontmatter-stripped embedded source bytes and needs no store; a fresh store using only its M1.5 commands completes orientation, record/query/disclosure/manual-resolution, and healthy exit | journey 9, ADR 0026 |
| T66 | for the same pinned state, corrective/navigational affordance fields and order are identical; healthy state has no corrective advice, though record handles and list continuation remain navigational | ADR 0008/0026 |
| T67 | application Claim reads AND-compose scope subset/exact + key/present-or-absent-perspective/value/actor/since filters, preserve stream order, and return the contract page | key hygiene, ADR 0026 |
| T68 | versioned core mechanics (not ClaimPolicy advice) finds canonically equal values under different exact keys in one exact scope → non-blocking advisory, never cross-key reconciliation; only eligible backward-pointing duplicate Relations connecting components suppress it | key hygiene, ADR 0026 |

### Pagination and link-following (ADR 0009)

| # | Given / When / Then | Covers |
|---|---|---|
| T70 | any application Claim/history/status collection beyond its effective limit → `page` with returned/total/cursor plus a surface-neutral continuation affordance preserving a nondefault limit; status continuation does not duplicate/skip multiple diagnostics at one position; at completion → counts and omitted cursor | ADR 0009/0026 |
| T71 | append mid-pagination → `loredu.cursor.v1.` chain verifies pinned anchor and its operation-specific resume key, yielding no duplicates/skips from that prefix; a fresh cursorless query reflects new head | ADR 0009/0006/0026 |
| T72 | malformed, wrong-operation/query/ruleset, or foreign-snapshot application cursor → `INVALID_CURSOR`/`CURSOR_MISMATCH`, never restart | ADR 0009/0026 |
| T73 | M1.5 link-following starts from status/query/add responses and reaches record/history/entry/source using only affordances | ADR 0009/0026, journey 7 |
| T74 | no dead ends: automatic add/list items expose only their own recursively rendered handle, `show` explicitly discloses complete valid references, store selection is preserved, and invalid-reference diagnostics/SourceRefs are terminal | ADR 0009/0026 |
| T75 | when M3 lands, a Working Lore section hitting its budget states its full count and carries a Basis-pinned continuation under the same cursor contract | working-lore contract, staged M3 |

### Kernel invariants and the policy seam (issue #6)

| # | Given / When / Then | Covers |
|---|---|---|
| T80 | spy/failure ports prove validation → references → entropy → Clock → immediate append; canonical time is sampled once and only successful append publishes history | records contract, time ownership |
| T81 | M0 Basis primitives: same stream position, structural ruleset, and canonical query compare equal while separately held computed times differ; no projection/content claim | ADR 0006, ADR 0020 |
| T82 | default policy validates exact declared key, selects exclusive, emits no policy advice, and contributes `{id: loredu.default, version: "1"}` beside core `loredu.reconciliation/v1`; remapping rejects | ADR 0010, ADR 0020 |
| T83 | draft types omit `schema`, `id`, `recorded_at`; runtime rejects each reserved own property even `undefined`, excess/accessor/custom-prototype stamp attacks; store receives complete frozen record | records contract |
| T84 | exact call counts/failure consumption; same initialized assembly inputs reproduce first record, sequential appends consume entropy, collision/store failure never retries | ADR 0018, clock-and-identity contract |

### Deliberately not tested yet

Ranking quality beyond determinism (Ranker port ships a baseline; quality is judged by the M4 consumer), concurrency beyond single-writer, performance at scale, and any model-assisted extraction — all deferred per [goal and scope](../scope/goal-and-scope.md).
