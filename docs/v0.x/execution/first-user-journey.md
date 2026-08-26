---
name: first_user_journey
description: "The first real usage journey (human driver + agents via CLI) and the automated behavioral test catalog derived from it."
type: plan
tags: [v0.x, execution, journey, testing, cli]
status: draft
generated: "Claude Fable 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T00:00:00+08:00
updated_at: 2026-08-26T00:00:00+08:00
---

# First user journey and behavioral test cases

The first user is the project owner plus their agents, driving Loredu through the CLI ([decision 0007](../../decisions/0007-typescript-bun.md)). The binary is `lor` — short enough for agents to type constantly. This document describes how usage is expected to work, step by step, and derives the behavioral tests that must be automated. The behavior is the contract; command spellings are provisional adapter surface.

The CLI arrives early — right after M1, before full reconciliation — and every response is **agent-reactive** ([decision 0008](../../decisions/0008-cli-first-agent-reactive.md)): each call returns the result plus deterministic next-step advice, so an agent can chain calls until the store is healthy.

## Response envelope

Every command returns the same envelope shape in text and `--json`:

```json
{
  "ok": true,
  "result": { "id": "c_0003", "kind": "claim" },
  "reconciliation": { "state": "conflict-candidate", "key": "(repo=rozoro code-area command-registration).location", "related": ["c_0001"] },
  "next": [
    { "why": "another claim exists under this key with a different value", "run": "lor show c_0001" },
    { "why": "record your judgment once verified against the source", "run": "lor resolve --targets c_0001,c_0003 --decision prefer --replacement c_0003 --reason \"...\"" }
  ],
  "basis": { "position": 6 }
}
```

Rules: `next` is derived only from deterministic checks (key overlap, dangling references, unresolved groups) — the envelope never speculates. Its shape is stable across milestones; only who computes `reconciliation` changes (mechanical key-overlap in the early CLI, the full ruleset from M2). Text mode mirrors it compactly as `next:` lines.

Two suites automate the same journeys:

- **application suite** (`bun:test`, fast, majority of cases) — drives the application API directly;
- **CLI conformance suite** — drives the compiled binary with `--json`, asserting parseable output and stable exit codes for every journey step.

## Journey 0 — install and init

```text
$ lor init
initialized plain-file store at ./lore
```

One directory, human-inspectable, Git-friendly ([decision 0003](../../decisions/0003-plain-files-first.md)). No daemon, no config required to start.

## Journey 1 — first activity on an empty store

```text
$ lor lore --activity investigate --scope repo=rozoro
no knowledge yet for this scope
basis: position=0 ruleset=r1
```

A definitive empty state (borrowed agent-ergonomics principle), never an error, and even the empty packet carries a basis.

## Journey 2 — record what was learned

Free text first, always cheap:

```text
$ echo "Command registration is concentrated in src/commands, but plugins
  can register commands dynamically elsewhere." | lor add entry \
    --type finding --title "command registration" \
    --source repo=rozoro --locator src/commands --snapshot 3a1d8b7 --body -
e_0001
```

Then the structured claim, keyed ([decision 0004](../../decisions/0004-claim-identity-key.md)):

```text
$ lor add claim --scope repo=rozoro \
    --subject-type code-area --subject command-registration \
    --predicate location --value src/commands \
    --derived-from e_0001 --confidence observed
c_0001  new claim (no prior claims under this key)
```

The write-time feedback line is part of the contract: it is how writers learn whether their key vocabulary is landing.

## Journey 3 — corroboration and conflict

A second actor (an agent, different phrasing, same declared key):

```text
$ lor add claim ... --predicate location --value src/commands ...
c_0002  corroborates c_0001
```

A later run finds the world changed:

```text
$ lor add claim ... --predicate location --value src/cli/commands ...
c_0003  conflict candidate under key with c_0001
next: lor show c_0001
next: lor resolve --targets c_0001,c_0003 --decision prefer --replacement c_0003 --reason "..."
```

Nothing is deleted or overwritten; the conflict is now visible knowledge, and the advice tells the same agent how to close it.

## Journey 3b — chain until healthy

The agent follows the advice in the same session: inspect, verify against the source, resolve, then check overall health:

```text
$ lor status
open attention: 0    malformed: 0    dangling refs: 0
healthy
```

`lor status` is the "am I done?" check that terminates the chain. It reports unresolved same-key groups, malformed records, and dangling `derived_from` references — all mechanical checks, available even before full reconciliation exists. `lor status --check` exits nonzero when unhealthy, for scripts and CI.

## Journey 4 — working lore reflects it

```text
$ lor lore --activity investigate --scope repo=rozoro
current:
  (code-area command-registration) location = src/commands   [c_0001, corroborated]
attention:
  conflict: location = src/commands vs src/cli/commands      [c_0001 ~ c_0003]
basis: position=4 ruleset=r1
```

Bounded, ranked, with stable handles — not a record dump.

## Journey 5 — resolve

```text
$ lor resolve --targets c_0001,c_0003 --decision prefer --replacement c_0003 \
    --reason "verified against snapshot 9f21c44; registration moved"
r_0001
$ lor current --scope repo=rozoro
(code-area command-registration) location = src/cli/commands  [c_0003, resolved]
```

## Journey 6 — time travel

```text
$ lor current --scope repo=rozoro --as-of 2026-08-26T12:00:00Z
(code-area command-registration) location = src/commands
```

`as_of`, `valid_at`, and the combination behave per the [projection contract](../../architecture/contracts/projection.md).

## Journey 7 — drill down

```text
$ lor show c_0003        # claim detail + provenance refs
$ lor history c_0003     # relations, resolution, verifications
$ lor show e_0001        # the original free text
```

Every id printed anywhere is resolvable — the progressive-disclosure promise.

## Journey 8 — staleness and replay

```text
$ lor head
position=6
```

A cached lore packet with `basis.position=4` is stale the moment `head` moves past it for the scope. And deleting every derived artifact then replaying the plain files reproduces identical projections for the same basis and query ([decision 0006](../../decisions/0006-explicit-version-basis.md)).

## Journey 9 — teach the agents

The skill ships **inside the binary**: `lor skill` prints the agent guide, so distributing the executable distributes the integration — no separate file to install. The guide ([agent skill draft](./agent-skill.md)) instructs agents: orient with `lor status` (later `lor lore`); record findings as entries as you go; write a claim whenever a finding is stable enough to key; follow every `next:` line until `lor status` reports healthy; never fight a conflict — record it, verify, resolve with a reason. A repo-level `.agents/skills` wrapper can simply defer to `lor skill`.

## Behavioral test catalog

Grouped by milestone; **AC n** = acceptance criterion in [goal and scope](../scope/goal-and-scope.md), **S A/B/C** = acceptance scenarios in the [implementation plan](./implementation-plan.md).

### M0 — records and validation

| # | Given / When / Then | Covers |
|---|---|---|
| T01 | valid entry (free text only, no claim) → accepted, id returned | AC 1, invariant 3 |
| T02 | entry/claim carries `schema: lor.record/v1`, `recorded_at`, actor | AC 1 |
| T03 | claim missing `predicate` (or any key field) → rejected with an actionable message naming the field | AC 11, ADR 0004 |
| T04 | claim with free prose in `subject.id` (violates normalization) → rejected | ADR 0004 |
| T05 | records are value-immutable: no API mutates a created record | invariant 1 |
| T06 | unknown namespaced metadata round-trips through serialize/parse | ADR 0005 |
| T07 | same logical input twice → distinct record ids (append, never replace) | store contract |

### M1 — plain-file store

| # | Given / When / Then | Covers |
|---|---|---|
| T10 | `append` returns monotonically increasing positions | ADR 0006 |
| T11 | write records → new store instance on same directory replays the identical ordered stream | AC 9 |
| T12 | positions are stable across replays | ADR 0006 |
| T13 | `append` with an existing id → error, original untouched | store contract |
| T14 | store files are hand-inspectable Markdown + frontmatter; hand-added valid record is picked up on replay | ADR 0003 |
| T15 | domain layer compiles/tests with a pure in-memory store (no Bun/fs import in core) | ADR 0001/0007 |

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
| T28 | delete derived state, replay → identical projection for same basis + query | AC 5, ADR 0006 |
| T29 | every projection result carries `basis` (position, ruleset, query, computed_at) | AC 14 |
| T30 | ruleset version bump → cached view marked invalid without touching canonical records | ADR 0006 |

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

### Agent-reactive envelope (ships with the early CLI)

| # | Given / When / Then | Covers |
|---|---|---|
| T60 | every mutation response (`--json`) contains `result`, `reconciliation`, `next`, `basis`; every `next` entry is a runnable command | ADR 0008 |
| T61 | second claim, same key + same value → corroboration feedback, no attention raised | journey 3 |
| T62 | second claim, same key + different value → conflict-candidate feedback with `next` advice naming both ids | journey 3 |
| T63 | agent chain: execute the `next` commands from T62 (show → resolve) → `lor status` reports healthy, `--check` exits 0 | journey 3b |
| T64 | `lor status` flags dangling `derived_from`, malformed records, and same-key groups with no relation/resolution among them | journey 3b |
| T65 | `lor skill` prints the agent guide; a fresh store + only the guide's commands completes journeys 1–5 | journey 9 |
| T66 | `next` advice is deterministic: same store state → byte-identical advice; no advice on healthy state | ADR 0008 |

### Deliberately not tested yet

Ranking quality beyond determinism (Ranker port ships a baseline; quality is judged by the M4 consumer), concurrency beyond single-writer, performance at scale, and any model-assisted extraction — all deferred per [goal and scope](../scope/goal-and-scope.md).
