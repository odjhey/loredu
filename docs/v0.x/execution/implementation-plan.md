---
name: v0x_implementation_plan
description: "M0–M4 implementation sequence for the Loredu domain kernel, plain-file store, projections, Working Lore, and the first real consumer."
type: plan
tags: [v0.x, execution]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T12:10:00+08:00
---

# v0.x implementation plan

The implementation sequence starts from the application contracts and deliberately postpones product surfaces.

## M0 — Domain kernel

Implement and test:

- immutable record envelope with explicit schema version;
- Entry, Claim, Relation, Resolution, Verification shapes;
- claim key declaration and well-formedness validation (subject/predicate/perspective normalization rules, [decision 0004](../../decisions/0004-claim-identity-key.md));
- opaque ID generation/validation;
- `recorded_at` and optional validity fields;
- scope, actor, and provenance/reference structures;
- record validation and compatibility rules (any shipped schema version stays replayable, [decision 0005](../../decisions/0005-embedded-kernel-compatibility.md)).

Exit: records can be created, validated, serialized, and compared without any storage or UI dependency, and malformed claim keys are rejected with actionable errors.

## M1 — Plain-file persistence

Implement:

- `RecordStore` port;
- `PlainFileStore` adapter;
- Markdown/frontmatter codec for records with free-text Entry bodies;
- append/get/scan/replay semantics;
- monotonic stream positions (`append` returns one, `head` exposes the latest) stable across replays ([decision 0006](../../decisions/0006-explicit-version-basis.md));
- deterministic filesystem layout that is not exposed as a domain contract.

Optional only if useful: a generated human-readable index. Do not make the index canonical.

Exit: deleting all derived state and replaying the Markdown records reconstructs the same record stream.

## M1.5 — Agent-operable CLI (`lor`)

Pulled ahead of full reconciliation ([decision 0008](../../decisions/0008-cli-first-agent-reactive.md)) so real usage and dogfooding start as early as possible. Implement:

- commands: `init`, `add entry`, `add claim`, `relate`, `resolve`, `add verification`, `show`, `history`, `claims` (query engine: composable filters over any key/envelope field — scope, subject-type, subject, predicate, value, actor, since), `head`, `status` (`--check`), `skill`;
- the agent-reactive response envelope (`result`, `reconciliation`, `next`, `basis`) in text and `--json`, with stable exit codes;
- cursor pagination on every list command (`--limit`/`--cursor`, basis-pinned, explicit `returned`/`total`, runnable continuation in `next`) and link-following handles on every printed id ([decision 0009](../../decisions/0009-hypermedia-pagination.md));
- the mechanical key-overlap slice of reconciliation: same key + same value → corroboration feedback; same key + different value → conflict candidate + advice; unresolved same-key groups, dangling refs, and malformed records surfaced by `status` as health failures, plus non-blocking advisories (same value under different keys in one scope → possible key divergence);
- namespacing stays consumer-imposed: the kernel validates key shape only; examples and CLI output model healthy conventions without mandating them;
- embedded agent guide printed by `lor skill` ([draft](./agent-skill.md));
- compiled single-file binary via `bun build --compile`.

During this phase the agent performs reconciliation judgment manually: it records explicit Relations and Resolutions through the CLI. Those canonical records become the fixture corpus that M2's deterministic ruleset is validated against.

Exit: an agent given only the binary and `lor skill` completes journeys 1–5 and 3b of the [first user journey](./first-user-journey.md) on a fresh store, ending with `lor status --check` passing; acceptance scenario A is executable manually end to end.

## M2 — Reconciliation and projection

Implement deterministic baseline rules, all scoped within a claim key:

- duplicate detection where identity/value/source makes it unambiguous;
- same-value corroboration/support;
- candidate conflict detection for overlapping property-like claims;
- mechanical temporal precedence where inputs are sufficient;
- explicit Resolution application;
- current, `as_of`, `valid_at`, and combined temporal projections;
- a versioned ruleset identifier and `basis` stamping on every projection;
- evidence/history lookup by record identity.

The CLI's feedback upgrades in place: the envelope shape is unchanged, but `reconciliation` is now filled by the full ruleset instead of the key-overlap slice, and `current`/`--as-of` queries appear.

Exit: projections are deterministic and rebuildable from canonical records and the same versioned ruleset; a stale cached projection is detectable by comparing its `basis.stream_position` to the store head; deterministic reconciliation is diffed against the manual-phase relation corpus and disagreements are reviewed, not silently overridden.

## M3 — Working Lore

Implement:

- Activity query/scope input;
- bounded Working Lore output;
- deterministic baseline ranking/filtering;
- separate current, patterns, candidates/conflicts, and revalidation sections;
- stable handles for drilling into claims, evidence, and entries;
- item/character budgets.

Do not require embeddings or a model reranker. Ranking sits behind a `Ranker` port with a deterministic baseline, so a consumer can substitute its own without core changes.

Exit: the acceptance activity receives useful context that remains bounded as historical records accumulate.

## M4 — First real consumer

Embed the kernel in one consumer from [candidate consumers](../../reports/candidate-consumers.md) — real writers, real corpus, no hand-tuned fixtures.

Exit: the consumer records and retrieves knowledge through the published contracts alone; friction found here (key vocabulary, ergonomics, missing disclosure handles) feeds contract revisions before anything is marked `status: current`.

## Acceptance scenario C — cross-actor claim keying

1. Actor A (human) records a claim with free text "notice period is 30 days" under key `(scope, policy, agreement-x, notice_period_days)`.
2. Actor B (program) records the same fact with different phrasing and provenance under the same declared key.
3. Actor C records `observed_process` and `documented_process` variants of another fact as distinct perspectives.

Verify:

- A and B reconcile as corroboration; a differing value under the same key surfaces as a candidate conflict;
- the perspective variants coexist without destructive conflict and appear as an attention item;
- a claim with a malformed or missing key is rejected at validation, not silently stored.

## Acceptance scenario A — repeated technical investigation

1. Run/entry 1 records: `CLI commands appear under src/commands`.
2. Run/entry 2 records: `plugins can register commands dynamically`.
3. Run/entry 3 records a later plugin-registration change with source/snapshot provenance.

Verify:

- current projection does not claim `src/commands` is exhaustive;
- earlier `as_of` projection reproduces the earlier belief;
- supporting entries/source refs are inspectable;
- Working Lore returns a compact current pattern plus any revalidation attention rather than all three raw entries.

## Acceptance scenario B — policy change

1. Base document states a 30-day notice period.
2. Later amendment states a 60-day notice period effective on a specific date.
3. The amendment is recorded after its effective date.

Verify:

- current projection prefers the amended value;
- `as_of` before discovery returns the earlier belief;
- current `valid_at` after the amendment effective date returns the amended value;
- combined `as_of` + `valid_at` distinguishes historical knowledge from later correction;
- evidence resolves to both base and amendment references.

## Guardrail scenario — business-process perspectives

Record different documented and observed process sequences. Verify that perspective prevents an automatic destructive contradiction and allows the projection to surface a process gap/attention item.

## After v0.x

Only after these contracts prove useful should the project decide which inbound surface to build first and whether SQLite indexing, source adapters, agent extraction, model-assisted resolution, or Rozoro integration are justified.
