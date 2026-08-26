---
name: v0x_implementation_plan
description: "M0–M4 implementation sequence (including the M1.5 CLI milestone) for the Loredu domain kernel, plain-file store, projections, Working Lore, and the first real consumer."
type: plan
tags: [v0.x, execution]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
---

# v0.x implementation plan

The implementation sequence starts from the application contracts. The `lor` CLI is an early adapter milestone, but the kernel remains independently testable and usable through its application API.

## M0 — Domain and application kernel

Scaffold the workspace per [decision 0011](../../decisions/0011-repo-package-architecture.md) (`packages/kernel`, `packages/store-plainfile`, `packages/cli`, central catalog-shaped `tests/`) and establish the repository guardrails from [decision 0012](../../decisions/0012-dx-and-ci-gating.md), then implement and test the kernel only:

- immutable record envelope with explicit schema version;
- the draft/record split: callers construct drafts with no `id` or `recorded_at`; the append application path assigns both — the type model makes canonical-history backdating unrepresentable;
- Entry, Claim, Relation, Resolution, Verification shapes in draft and persisted forms;
- opaque, kind-prefixed ID generation/validation;
- claim-key declaration and **shape validation only** ([decision 0004](../../decisions/0004-claim-identity-key.md)): identifier-safe subject/predicate/perspective fields, with vocabulary and namespacing left to consumers/policy rather than normalized by the kernel;
- the versioned `ClaimPolicy` port and built-in default policy ([decision 0010](../../decisions/0010-claim-policy-seam.md)): identity = declared key, value semantics = `exclusive`, no custom advisories beyond built-in generic mechanics;
- the `RecordStore` port shape required by the append application path, without any durable provider assumptions;
- the `Clock` and `RandomSource` capability ports ([decision 0018](../../decisions/0018-capability-ports.md), [clock and identity contract](../../architecture/contracts/clock-and-identity.md)): injected at application assembly, deterministic substitutes in tests, kernel-owned id format over supplied entropy; `RandomSource` supplies qualified bytes rather than ids, and production code may not substitute `Math.random()` for the id contract;
- application append orchestration: the single stamping point for `id` and `recorded_at`, validation, reference-before-referrer checks, and returning persisted record identity/position — `recorded_at` is sampled immediately before the store append attempt, while the store receives a complete record and assigns only the stream position;
- test-only `InMemoryStore`, `FixedClock`, and `SeededRandomSource` support under `@loredu/kernel/testing` so the application path is exercised without filesystem/storage-provider dependencies;
- optional validity fields, scope, actor, provenance/source references, namespaced metadata preservation rules, and schema replay compatibility ([decision 0005](../../decisions/0005-embedded-kernel-compatibility.md));
- kernel boundary enforcement from [decision 0011](../../decisions/0011-repo-package-architecture.md): zero external runtime dependencies, no environment-specific imports, a kernel TypeScript environment that does not expose Bun/Node ambient globals, and a structural capability-bypass check rejecting ambient wall-time/randomness access (`Date.now()`, zero-argument `new Date()`, `Math.random()`) in production kernel sources.

Supervised bootstrap/M0 work may proceed while the repository-readiness tracker proves its guardrails. **Unattended fleet fan-out waits for that tracker to demonstrate every required gate both green and red.** Dependency-cruiser remains a spike until its Bun-workspace/TypeScript behavior is demonstrated; capability-bypass checks do not wait for it because import-graph tooling cannot see ambient calls with no import.

Exit: through public kernel APIs, drafts can be validated and appended into the in-memory test store; returned records have kernel-assigned IDs and `recorded_at`; malformed keys/references fail with actionable errors; the default ClaimPolicy reproduces the declared-key/exclusive behavior; deterministic capability substitutes reproduce the same first stamped record across fresh assemblies while repeated appends consume fresh entropy; attempts to introduce environment-specific or ambient time/randomness kernel APIs fail the configured boundary/type checks.

## M1 — Durable plain-file persistence

Implement:

- the reusable `RecordStore` conformance kit under `@loredu/kernel/testing` from the published store guarantees;
- `@loredu/store-plainfile` implementing the already-defined `RecordStore` port;
- Markdown/frontmatter codec for canonical records with free-text Entry bodies;
- append/get/scan/stream/head/replay semantics;
- single-writer locking, atomic record visibility, durable-before-return/fsync behavior, and prefix-valid crash behavior;
- monotonic stream positions stable across replays ([decision 0006](../../decisions/0006-explicit-version-basis.md));
- deterministic filesystem layout and named-store resolution that do not leak into kernel/domain contracts;
- conformance runs against both the in-memory reference store and `PlainFileStore`.

Optional only if useful: a generated human-readable index. Do not make the index canonical.

Exit: `PlainFileStore` passes the shared store conformance suite; deleting all derived state and replaying Markdown records reconstructs the same canonical record stream; crash/locking tests demonstrate the v0.x durability and single-writer guarantees.

## M1.5 — Agent-operable CLI (`lor`)

Pulled ahead of full reconciliation ([decision 0008](../../decisions/0008-cli-first-agent-reactive.md)) so real usage and dogfooding start as early as possible. Implement:

- commands: `init`, `add entry`, `add claim`, `relate`, `resolve`, `add verification`, `show`, `history`, `claims` (query engine: composable filters over any key/envelope field — scope, subject-type, subject, predicate, value, actor, since), `head`, `status` (`--check`), `skill`;
- the agent-reactive response envelope (`ok`, `result`, `reconciliation`, `advice`, `basis`) in text and `--json`, with stable exit codes;
- surface-neutral affordances from the application layer rendered by the CLI as runnable commands; literal `lor ...` strings remain CLI-adapter behavior ([decision 0009](../../decisions/0009-hypermedia-pagination.md));
- cursor pagination on every list command (`--limit`/`--cursor`, basis-pinned, explicit `returned`/`total`, continuation affordance/advice) and disclosure handles on every printed id;
- the mechanical key-overlap slice through the **default ClaimPolicy**: same exact key + same value → corroboration feedback; same exact key + different value under `exclusive` semantics → conflict candidate + advice; unresolved same-key groups, dangling refs, and malformed records surfaced by `status` as health failures, plus generic non-blocking key-divergence advisories;
- namespacing stays consumer-imposed: the kernel/default policy validates shape and exact identity, while examples and agent guidance encourage discovering existing vocabulary before inventing keys;
- the CLI composition root supplies the production `Clock` and secure `RandomSource` implementations when assembling the application; no dedicated clock/random package is introduced;
- embedded agent guide printed by `lor skill` ([draft](./agent-skill.md));
- compiled single-file binary via `bun build --compile`.

During this phase the agent performs judgment manually: it records explicit Relations and Resolutions through the CLI. Those canonical records become the fixture corpus that M2's deterministic ruleset is validated against.

Exit: an agent given only the binary and `lor skill` completes journeys 1–5 and 3b of the [first user journey](./first-user-journey.md) on a fresh store, ending with `lor status --check` passing; acceptance scenario A is executable manually end to end.

## M2 — Reconciliation and projection

Implement deterministic baseline rules, mediated by the active versioned ClaimPolicy:

- exact-key duplicate detection where identity/value/source makes it unambiguous;
- same-value corroboration/support;
- differing-value handling according to policy semantics (`exclusive` → candidate conflict, `coexisting` → coexist without conflict);
- optional policy-produced deterministic advisories across related claims without crossing exact-key reconciliation boundaries;
- mechanical temporal precedence where inputs are sufficient;
- explicit Resolution application;
- current, `as_of`, `valid_at`, and combined temporal projections;
- a versioned ruleset identity that includes the active ClaimPolicy version and stamps every projection `basis`;
- evidence/history lookup by record identity.

The CLI's feedback upgrades in place: the envelope shape is unchanged, but `reconciliation` is now filled by the full deterministic ruleset instead of the early key-overlap slice, and `current`/`--as-of` queries appear.

Exit: projections are deterministic and rebuildable from canonical records using the same core-ruleset + ClaimPolicy version; a stale cached projection is detectable by comparing its store-wide `basis.stream_position` to `head()`; deterministic reconciliation is diffed against the manual-phase relation corpus and disagreements are reviewed, not silently overridden.

## M3 — Working Lore

Implement:

- Activity query/scope input;
- bounded Working Lore output;
- deterministic baseline ranking/filtering;
- separate current, patterns, candidates/conflicts, and revalidation sections;
- stable semantic handles/affordances for drilling into claims, evidence, and entries;
- item/character budgets and explicit continuation when sections truncate.

Do not require embeddings or a model reranker. Ranking sits behind a `Ranker` port with a deterministic baseline, so a consumer can substitute its own without core changes. Any deterministic extension that changes Working Lore output must be represented in the versioned basis/ruleset as required by ADR 0010.

Exit: the acceptance activity receives useful context that remains bounded as historical records accumulate, with reproducible basis-stamped output and progressive disclosure to deeper evidence.

## M4 — First real consumer

Embed the kernel in one consumer from [candidate consumers](../../reports/candidate-consumers.md) — real writers, real corpus, no hand-tuned fixtures. Introduce the first custom ClaimPolicy only if that consumer actually needs semantics beyond the built-in default. The consumer supplies its own `Clock`/`RandomSource` implementations at its composition boundary rather than depending on a kernel-owned host adapter.

Exit: the consumer records and retrieves knowledge through the published contracts alone; friction found here (key vocabulary, ergonomics, missing disclosure handles/policy needs) feeds contract revisions before anything is marked `status: current`.

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

- current projection prefers the amended value after an explicit or mechanically justified supersession/resolution path;
- `as_of` before discovery returns the earlier belief;
- current `valid_at` after the amendment effective date returns the amended value;
- combined `as_of` + `valid_at` distinguishes historical knowledge from later correction;
- evidence resolves to both base and amendment references.

## Acceptance scenario C — cross-actor claim keying

1. Actor A (human) records a claim with free text `notice period is 30 days` under a declared key for the agreement/notice-period proposition.
2. Actor B (program) records the same fact with different phrasing and provenance under the same declared/default-policy identity.
3. Actor C records `observed_process` and `documented_process` variants of another fact as distinct perspectives/keys.

Verify:

- A and B reconcile as corroboration; a differing value under the same exact key with default `exclusive` semantics surfaces as a candidate conflict;
- the perspective variants coexist without destructive reconciliation; a consumer ClaimPolicy may later add a deterministic cross-perspective advisory without changing core;
- a claim with a malformed or missing required key is rejected at validation, not silently stored.

## Guardrail scenario — business-process perspectives

Record different documented and observed process sequences. Verify that distinct perspectives prevent automatic destructive contradiction. With the built-in policy they simply coexist; when a process consumer later supplies a custom policy, it may additionally surface a deterministic process-gap advisory.

## After v0.x

Only after these contracts prove useful should the project decide whether SQLite indexing, source adapters, agent extraction, model-assisted resolution, additional surfaces, or deeper Rozoro integration are justified.
