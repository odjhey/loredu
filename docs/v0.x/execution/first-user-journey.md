---
name: first_user_journey
description: "The first real usage journey (human driver + agents via CLI) and the automated behavioral test catalog derived from it."
type: plan
tags: [v0.x, execution, journey, testing, cli]
generated: "Claude Fable 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T00:00:00+08:00
---

# First user journey and behavioral test cases

The first user is the project owner plus their agents, driving Loredu through the CLI ([decision 0007](../../decisions/0007-typescript-bun.md)). The binary is `lor` — short enough for agents to type constantly. This document describes how usage is expected to work, step by step, and derives the behavioral tests that must be automated. The behavior is the contract; command spellings are provisional adapter surface.

The CLI arrives early — right after M1, before full reconciliation — and every response is **agent-reactive** ([decision 0008](../../decisions/0008-cli-first-agent-reactive.md)): each call returns the result plus deterministic next-step advice, so an agent can chain calls until the store is healthy.

## Response envelope

Every command returns the same envelope shape in text and `--json`:

```json
{
  "ok": true,
  "result": { "id": "clm_3333333333333333", "kind": "claim" },
  "reconciliation": { "state": "conflict-candidate", "key": "(repo=rozoro code-area command-registration).location", "related": ["clm_1111111111111111"] },
  "advice": [
    { "why": "another claim exists under this key with a different value", "run": "lor show clm_1111111111111111" },
    { "why": "record your judgment once verified against the source", "run": "lor resolve --targets clm_1111111111111111,clm_3333333333333333 --decision prefer --replacement clm_3333333333333333 --reason \"...\"" }
  ],
  "basis": {
    "stream_position": 6,
    "ruleset": { "core": "loredu.reconciliation/v1", "claim_policy": { "id": "loredu.default", "version": "1" } },
    "query": {}
  }
}
```

Rules: `advice` is derived only from deterministic checks (key overlap, dangling references, unresolved groups) — the envelope never speculates. Its shape is stable across milestones; only who computes `reconciliation` changes (mechanical key-overlap in the early CLI, the full ruleset from M2). Text mode mirrors it compactly as `advice:` lines.

List-returning commands add a `page` object and a navigational entry in `advice` ([decision 0009](../../decisions/0009-hypermedia-pagination.md)):

```json
"page": { "returned": 20, "total": 143, "cursor": "eyJwb3MiOjQyLCJpZCI6ImNsbV8wMTIwIn0" },
"advice": [ { "why": "123 more claims under this filter", "run": "lor claims --scope repo=rozoro --cursor eyJwb3MiOjQyLCJpZCI6ImNsbV8wMTIwIn0" } ]
```

Cursors are opaque and pinned to the basis position: a page chain is a consistent snapshot even while writers append; a cursorless query picks up the new head. Truncation is never silent (`returned`/`total` always present when a bound applies), ordering is deterministic (position/timestamp, id tiebreak), and every id printed anywhere is a handle — the response embeds or implies the command that expands it, so an agent navigates disclosure levels 0→4 by following links, never by memorizing the surface.

Two suites automate the same journeys:

- **application suite** (`bun:test`, fast, majority of cases) — drives the application API directly;
- **CLI conformance suite** — drives the compiled binary with `--json`, asserting parseable output and stable exit codes for every journey step.

## Journey 0 — install and init

```text
$ lor init rozoro-investigation
initialized store at ~/.loredu/stores/rozoro-investigation
```

One directory per store, human-inspectable, Git-friendly ([decision 0003](../../decisions/0003-plain-files-first.md)). No daemon, no config required to start.

Store resolution is predictable, never cwd-dependent: `--store <path>` (used as-is) or `--store <name>` (resolved to `$LOREDU_HOME/stores/<name>`, `LOREDU_HOME` defaulting to `~/.loredu`); with no flag, the default store `$LOREDU_HOME/stores/default`. If the resolved store does not exist, the command fails with an actionable error suggesting `lor init` — no upward discovery, no silent creation. Stores live under `stores/` so the home root stays free for configuration and other concerns; multiple named stores coexist under one relocatable home, and tests isolate by pointing `LOREDU_HOME` at a temp directory.

## Journey 1 — first activity on an empty store

```text
$ lor lore --activity investigate --scope repo=rozoro
no knowledge yet for this scope
basis:
  stream_position: 0
  ruleset: { core: loredu.reconciliation/v1, claim_policy: { id: loredu.default, version: "1" } }
  query: { activity: investigate, scope: { repo: rozoro } }
```

A definitive empty state (borrowed agent-ergonomics principle), never an error, and even the empty packet carries a basis.

## Journey 2 — record what was learned

Free text first, always cheap:

```text
$ echo "Command registration is concentrated in src/commands, but plugins
  can register commands dynamically elsewhere." | lor add entry \
    --type finding --title "command registration" \
    --source repo=rozoro --locator src/commands --snapshot 3a1d8b7 --body -
ent_0123456789abcdef
```

Then the structured claim, keyed ([decision 0004](../../decisions/0004-claim-identity-key.md)):

```text
$ lor add claim --scope repo=rozoro \
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
clm_3333333333333333  conflict candidate under key with clm_1111111111111111
advice: lor show clm_1111111111111111
advice: lor resolve --targets clm_1111111111111111,clm_3333333333333333 --decision prefer --replacement clm_3333333333333333 --reason "..."
```

Nothing is deleted or overwritten; the conflict is now visible knowledge, and the advice tells the same agent how to close it.

## Journey 3b — chain until healthy

The agent follows the advice in the same session: inspect, verify against the source, resolve, then check overall health:

```text
$ lor status
open attention: 0    malformed: 0    dangling refs: 0
healthy
```

`lor status` is the "am I done?" check that terminates the chain. It has two tiers:

- **health** (blocks `--check`): unresolved same-key groups, malformed records, dangling `derived_from` references;
- **advisories** (reported, never blocking): cheap divergence hints, e.g. the same value recorded under different keys within one scope — a sign two writers named the same fact differently.

All checks are mechanical and available before full reconciliation exists. `lor status --check` exits nonzero only on health failures.

Content first (borrowed agent-ergonomics principle): bare `lor` with no arguments prints this orientation view — live data, never a help screen. Help stays consistent and concise: `lor <command> --help` prints a per-command reference; `lor skill` remains the full agent guide.

## Namespacing and key hygiene

The kernel enforces key **shape** only (identifier-safe, no prose). Namespacing and vocabulary are the consumer's to impose — Loredu models healthy conventions in its examples and CLI output (e.g. `--scope repo=rozoro`, subjects like `code-area/command-registration`) without mandating them. The agent's duplicate-detection tool is the query engine, not a kernel rule: `lor claims` filters by any field (`--scope`, `--subject-type`, `--subject`, `--predicate`, `--value`, `--actor`, `--since`), so an agent checks for existing keys before inventing one, and `status` advisories catch what slips through.

Because every command emits machine-readable artifacts (`--json`, line-oriented text), the built-in filters only need to cover the common paths — anything further composes through unix pipes:

```text
$ lor claims --scope repo=rozoro --json | jq -r '.result[] | select(.confidence == "candidate") | .id'
```

The shell is the rest of the query engine; lor does not need to grow one.

## Journey 4 — working lore reflects it

```text
$ lor lore --activity investigate --scope repo=rozoro
current:
  (code-area command-registration) location = src/commands   [clm_1111111111111111, corroborated]
attention:
  conflict: location = src/commands vs src/cli/commands      [clm_1111111111111111 ~ clm_3333333333333333]
basis:
  stream_position: 4
  ruleset: { core: loredu.reconciliation/v1, claim_policy: { id: loredu.default, version: "1" } }
  query: { activity: investigate, scope: { repo: rozoro } }
```

Bounded, ranked, with stable handles — not a record dump.

## Journey 5 — resolve

```text
$ lor resolve --targets clm_1111111111111111,clm_3333333333333333 --decision prefer --replacement clm_3333333333333333 \
    --reason "verified against snapshot 9f21c44; registration moved"
res_4444444444444444
$ lor current --scope repo=rozoro
(code-area command-registration) location = src/cli/commands  [clm_3333333333333333, resolved]
```

## Journey 6 — time travel

```text
$ lor current --scope repo=rozoro --as-of 2026-08-26T12:00:00Z
(code-area command-registration) location = src/commands
```

`as_of`, `valid_at`, and the combination behave per the [projection contract](../../architecture/contracts/projection.md).

## Journey 7 — drill down

```text
$ lor show clm_3333333333333333        # claim detail + provenance refs
$ lor history clm_3333333333333333     # relations, resolution, verifications
$ lor show ent_0123456789abcdef        # the original free text
```

Every id printed anywhere is resolvable — the progressive-disclosure promise.

## Journey 8 — staleness and replay

```text
$ lor head
stream_position=6
```

A cached lore packet with `basis.stream_position=4` is stale the moment `head` moves past it for the scope. And deleting every derived artifact then replaying the plain files reproduces identical projections for the same basis and query ([decision 0006](../../decisions/0006-explicit-version-basis.md)).

## Journey 9 — teach the agents

The skill ships **inside the binary**: `lor skill` prints the agent guide, so distributing the executable distributes the integration — no separate file to install. The guide ([agent skill draft](./agent-skill.md)) instructs agents: orient with `lor status` (later `lor lore`); record findings as entries as you go; write a claim whenever a finding is stable enough to key; follow every `advice:` line until `lor status` reports healthy; never fight a conflict — record it, verify, resolve with a reason. A repo-level `.agents/skills` wrapper can simply defer to `lor skill`.

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
| T10 | every adapter under the M1 reusable conformance kit, including PlainFileStore and M1-complete InMemoryStore, returns positive strictly increasing successful positions and matching latest `head` | ADR 0006, ADR 0020 |
| T11 | write records → new store instance on same directory replays the identical ordered stream | AC 9 |
| T12 | positions are stable across replays | ADR 0006 |
| T13 | `append` with an existing id → error, original untouched | store contract |
| T14 | store files are hand-inspectable Markdown + frontmatter; hand-added valid record is picked up on replay | ADR 0003 |
| T15 | domain layer compiles/tests with a pure in-memory store (no Bun/fs import in core) | ADR 0001/0007 |
| T16 | concurrent-writer safety: a second writer against a locked store fails loudly with no corruption; the store replays clean afterward | store contract |
| T17 | store resolution: path flag as-is > name under `$LOREDU_HOME/stores/` > default store; nonexistent resolved store → actionable error (never created implicitly, never discovered from cwd); two named stores under one home are fully isolated (no reads or writes outside the resolved root) | journey 0 |
| T18 | append is the commit point: a returned position implies the record survives a simulated crash (kill between staging and completion leaves either no record or a whole one, never a torn file); replay stays clean | store contract |

### M2 — reconciliation, resolution, projections

| # | Given / When / Then | Covers |
|---|---|---|
| T20 | two claims, same key, same value, different actors/phrasing → corroboration relation | AC 3, 11, S C |
| T21 | two claims, same key, different value, overlapping validity → candidate conflict + attention item | AC 3, S C |
| T22 | same subject/predicate under different `perspective` → no conflict; surfaced as perspective gap | S C guardrail |
| T23 | claims under different keys never auto-reconcile | ADR 0004 |
| T24 | resolution `prefer` flips projection preference; both claims still addressable; no record mutated | AC 4, invariant 6 |
| T25 | `as_of` before a record's `recorded_at` excludes it (S A: earlier belief reproduced) | AC 6, S A |
| T26 | `valid_at` after an amendment's effective date returns amended value even if recorded late | AC 7, S B |
| T27 | combined `as_of` + `valid_at` distinguishes historical knowledge from later correction | AC 7, S B |
| T28 | delete derived state, replay → identical derived content for same Basis + query | AC 5, ADR 0006 |
| T29 | every projection carries exact Basis (`stream_position`, structural `ruleset`, canonical query) and separate `computed_at` | AC 14 |
| T30 | core or policy ruleset version bump → cached view marked invalid without touching canonical records | ADR 0006 |
| T86 | using the M0 canonical equality primitive, object key order does not affect value equality while `1` and `"1"` under one key become a conflict candidate, not duplicate | ADR 0019, ADR 0010 |

### M3 — Working Lore

| # | Given / When / Then | Covers |
|---|---|---|
| T40 | empty scope → definitive empty packet with basis, exit 0 | journey 1 |
| T41 | packet respects `max_items` / `max_chars` as record count grows 10× (S A: bounded, not raw entries) | AC 8, S A |
| T42 | superseded claims omitted from default packet but reachable via handles | working-lore contract |
| T43 | conflicts and needs-revalidation appear in attention sections | AC 8 |
| T44 | every handle in a packet resolves via show/history | journey 7 |
| T45 | packet with stale basis detected after exactly one new relevant record | AC 14 |

### CLI conformance (compiled binary)

| # | Given / When / Then | Covers |
|---|---|---|
| T50 | every command supports `--json`; output parses and matches the application-suite result | agent ergonomics |
| T51 | exit codes: 0 success, distinct nonzero for validation error vs not-found vs store error | agent ergonomics |
| T52 | `add entry --body -` reads stdin; body round-trips byte-exact through store and `show` | journey 2 |
| T53 | `add claim` prints the reconciliation feedback line (new / corroborates / conflict candidate) | journey 2–3 |
| T54 | end-to-end scenario A (three runs, revalidation surfaced) through the binary | S A |
| T55 | end-to-end scenario B (30→60-day amendment, all four temporal queries) through the binary | S B |
| T56 | end-to-end journey 0→8 as one scripted session on a fresh temp dir | AC 12 (ergonomics) |
| T57 | AC 12 measured: journey 2 (entry + claim) is ≤ 2 commands; journey 1 (lore) is 1 command | AC 12 |
| T58 | content first: bare `lor` prints the orientation/status view (live data, exit 0), not help; `lor <command> --help` prints a concise per-command reference; an unknown flag fails with an actionable error, never ignored | agent ergonomics, journey 3b |

### Agent-reactive envelope (ships with the early CLI)

| # | Given / When / Then | Covers |
|---|---|---|
| T60 | every mutation response (`--json`) contains `ok`, `result`, `reconciliation`, `advice`, `basis`; every `advice` entry is a runnable command | ADR 0008 |
| T61 | second claim, same key + same value → corroboration feedback, no attention raised | journey 3 |
| T62 | second claim, same key + different value → conflict-candidate feedback with `advice` entries naming both ids | journey 3 |
| T63 | agent chain: execute the `advice` commands from T62 (show → resolve) → `lor status` reports healthy, `--check` exits 0 | journey 3b |
| T64 | `lor status` flags dangling `derived_from`, malformed records, and same-key groups with no relation/resolution among them | journey 3b |
| T65 | `lor skill` prints the agent guide; a fresh store + only the guide's commands completes journeys 1–5 | journey 9 |
| T66 | `advice` is deterministic: same store state → byte-identical advice; no advice on healthy state | ADR 0008 |
| T67 | `lor claims` filters compose across fields (scope + predicate + value, etc.) and return stable ordering with `--json` | key hygiene |
| T68 | versioned core mechanics (not ClaimPolicy advice) finds canonically equal values under different exact keys in one exact scope → non-blocking advisory, never cross-key reconciliation | key hygiene |

### Pagination and link-following (ADR 0009)

| # | Given / When / Then | Covers |
|---|---|---|
| T70 | any list over the default limit → `page` with `returned`/`total`/`cursor` plus a runnable continuation in `advice`; under the limit → counts, no cursor | ADR 0009 |
| T71 | append records mid-pagination → the cursor chain yields no duplicates or skips (basis-pinned); a fresh query reflects the new head | ADR 0009 + 0006 |
| T72 | invalid or foreign `--cursor` → actionable error, distinct exit code, never a silent restart | ADR 0009 |
| T73 | link-following: starting from a `lor lore` packet, disclosure levels 0→4 (packet → claim → evidence/history → entry → source ref) are reachable using only commands embedded in responses | ADR 0009, journey 7 |
| T74 | no dead ends: every id printed by any command resolves via `show`/`history` (generalizes T44 to all output) | ADR 0009 |
| T75 | a Working Lore section hitting its budget states its full count and carries a continuation handle | working-lore contract |

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
