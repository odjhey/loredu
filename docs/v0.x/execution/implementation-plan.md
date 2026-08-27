---
name: v0x_implementation_plan
description: "M0–M4 implementation sequence (including the M1.5 CLI milestone) for the Loredu domain kernel, plain-file store, projections, Working Lore, and the first real consumer."
type: plan
tags: [v0.x, execution]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-28"
created_at: 2026-08-26T12:10:00+08:00
---

# v0.x implementation plan

The implementation sequence starts from the application contracts. The `lor` CLI is an early adapter milestone, but the kernel remains independently testable and usable through its application API.

## M0 — Domain and application kernel

Scaffold the workspace per [decision 0011](../../decisions/0011-repo-package-architecture.md) (`packages/kernel`, `packages/store-plainfile`, `packages/cli`, central catalog-shaped `tests/`) and establish the repository guardrails from [decision 0012](../../decisions/0012-dx-and-ci-gating.md), then implement and test the kernel only:

- detached, recursively frozen immutable records over the strict portable JSON domain, with public encode-to-JSON-value/decode-from-unknown and structural equality;
- the closed draft/record split: drafts omit `schema`, `id`, and `recorded_at`; runtime rejects stamps/excess/accessors/custom containers; application supplies fixed schema/id/time and canonical `scope`, `metadata`, `sources`;
- exact Entry, Claim, binary directed Relation, Resolution, and Claim-targeted Verification field/cardinality/reference shapes;
- exact RFC3339 millisecond normalization, validity ordering, and kind-prefixed MSB-first Crockford ID fixtures;
- claim-key declaration and **shape validation only** ([decision 0004](../../decisions/0004-claim-identity-key.md)): identifier-safe subject/predicate/perspective fields, with vocabulary and namespacing left to consumers/policy rather than normalized by the kernel;
- the versioned `ClaimPolicy` port and default: policy validates but cannot transform declared identity, values are `exclusive`, policy advice is empty; generic key-divergence ownership is versioned core mechanics but its execution remains M1.5;
- structural RulesetIdentity/Basis construction, validation, and equality primitives, excluding `computed_at`, without claiming projections;
- the M0 RecordStore slice: typed append returning only opaque monotonic position and get returning a typed record; application append returns exactly `{record, position}`; full scan/stream/head/durability/conformance remains M1;
- the `Clock` and `RandomSource` capability ports ([decision 0018](../../decisions/0018-capability-ports.md), [clock and identity contract](../../architecture/contracts/clock-and-identity.md)): injected at application assembly, deterministic substitutes in tests, kernel-owned id format over supplied entropy; `RandomSource` supplies qualified bytes rather than ids, and production code may not substitute `Math.random()` for the id contract;
- application append orchestration in exact validation → ordered reference reads → one entropy call → one clock call → freeze → immediate store append order, with deterministic structured errors/capability consumption and no collision retry; T19 covers every record-reference family in M0;
- the exact frozen two-entrypoint surface in the [kernel API contract](../../architecture/contracts/kernel-api.md), including dependency-object assembly, family-narrowed generic append, branded `createInstant`/`createStreamPosition`, no deep imports, and only `InMemoryStore`, `FixedClock`, `SeededRandomSource` under testing;
- optional validity fields, scope, actor, provenance/source references, namespaced metadata preservation rules, and schema replay compatibility ([decision 0005](../../decisions/0005-embedded-kernel-compatibility.md));
- kernel boundary enforcement from [decision 0011](../../decisions/0011-repo-package-architecture.md): zero external runtime dependencies, no environment-specific imports, a kernel TypeScript environment that does not expose Bun/Node ambient globals, and a structural capability-bypass check rejecting ambient wall-time/randomness access (`Date.now()`, zero-argument `new Date()`, `Math.random()`) in production kernel sources.

Supervised bootstrap/M0 work may proceed while the repository-readiness tracker proves its guardrails. **Unattended fleet fan-out waits for that tracker to demonstrate every required gate both green and red.** Dependency-cruiser remains a spike until its Bun-workspace/TypeScript behavior is demonstrated; capability-bypass checks do not wait for it because import-graph tooling cannot see ambient calls with no import.

Acceptance ownership without graph changes: P0 owns T87 assembly, exact export allowlists, all-family public imports, branded positions, and failure non-advancement. R1 owns all family/subtype positive and negative shapes; Verification nonempty/snapshotted basis and duplicates; timestamp CM-N06 strict-RFC3339/safe-integer/calendar/offset/fraction/validity boundaries, including normalized caller values at the inclusive year-0000/year-9999 extrema; repeated JSON arrays, own `__proto__` preservation, Unicode-scalar dynamic-map ordering, order, aliases, cycles, every rejected JS-only value, nested accessors/prototypes/symbols/excess fields, present-own `undefined`, exact duplicate issue codes; and codec detachment. R2 owns every capability failure, runtime Clock-domain and actual Uint8Array validation, phase-owned operational error mapping, exact calls/order, no retries, every reference path/kind, store failure publication, and collision behavior. P1 owns exact closed Basis acceptance/rejection, equality and inequality across each component, `computed_at` rejection, default/custom policy validation, and remap rejection. F0 audits exact normal/testing export sets, no deep imports, no testing imports from production, and all-family external package consumption.

Exit: through public kernel/testing exports, every draft family validates and appends into InMemoryStore with exact `{record, position}`; JSON transport round-trips; malformed values/keys/family fields and all missing/wrong-kind record references produce stable code/pointer issues before stamping; call order/collision behavior is exact; default declared-key/exclusive/no-policy-advice and structural Basis identities pass T81/T82; T87 proves assembly/position/export boundaries; deterministic helpers reproduce the first record while sequential appends consume entropy; every assurance vector above passes; boundary/type checks reject host and ambient capability leaks.

## M1 — Durable plain-file persistence

Implement [decision 0022](../../decisions/0022-m1-store-and-plain-file-contract.md) and its [provider-neutral store](../../architecture/contracts/store.md) / [plain-file provider](../../architecture/contracts/plain-file-store.md) contracts exactly:

- the runner-neutral `recordStoreConformance(subject)` cases under `@loredu/kernel/testing`, plus an M1-complete `InMemoryStore`, against the published full-port guarantees;
- `RecordStore.scan` as an atomic `{head, records}` snapshot with kind-only `RecordFilter`, snapshot-bounded unfiltered `stream({after?})`, and empty/latest `head` semantics;
- `@loredu/store-plainfile` using contiguous 16-digit filename positions as replay authority, never mtime/id/index ordering;
- the strict JSON-valued YAML frontmatter codec, exact Entry-only free-text Markdown body, and empty body for structured families;
- append/get/scan/stream/head and replay across new instances, including a correctly named next-position hand addition;
- append-scoped exclusive locking with immediate loud contention failure and only proven-dead-owner stale recovery;
- temp-file fsync → atomic rename → records/temp directory fsync before return, whole-record uncertain failure after rename, and prefix-valid crash behavior;
- explicit initialization plus path > validated name > default root resolution, no upward discovery/implicit creation/symlink escape, and isolated named stores;
- the unchanged conformance cases against both the in-memory reference store and `PlainFileStore`, with provider-specific crash/layout/locking tests beside them.

Optional only if useful: a generated human-readable index. It is disposable and never canonical.

Exit: both adapters pass the shared full-port suite; deleting all derived/control leftovers and replaying canonical Markdown files reconstructs the same positioned record stream; hand addition, malformed-prefix rejection, root isolation, contention, atomic visibility, fsync-before-return, and simulated-crash tests demonstrate T10–T18 without making the provider representation part of the kernel domain.

## M1.5 — Agent-operable CLI (`lor`)

Pulled ahead of full reconciliation ([decision 0008](../../decisions/0008-cli-first-agent-reactive.md)) so real usage and dogfooding start as early as possible. Implement [decision 0026](../../decisions/0026-m15-application-cli-contract.md) and the exact [application/CLI contract](../../architecture/contracts/application-cli.md):

- additive surface-neutral application operations `add`, `show`, `history`, `claims`, `status`, and `readHead`, while preserving M0 `append` exactly;
- commands: preserved direct `--version`/`-v`, `init`, `add entry`, `add claim`, `relate`, `resolve`, `add verification`, `show`, `history`, `claims`, `head`, `status` (`--check`), and `skill`; bare `lor` is status orientation;
- no M1.5 `current`, temporal projection flags, or `lore`: M2 owns `current`/`as-of`/`valid-at`, and M3 owns Working Lore;
- exact success and failure envelopes, including a committed-success feedback fallback that never invites mutation retry, surface-neutral affordances plus CLI-rendered runnable commands, text/JSON behavior, and stable exit categories;
- AND-composed exact Claim filters above the kind-only store port: scope subset/exact, subject type/id, predicate, present/absent perspective, JSON value, Actor, and inclusive normalized `since`;
- bounded position-ordered `claims`/`history` pages and a bounded combined status item stream with full counts, plus opaque `loredu.cursor.v1.` cursors bound to operation/query/Basis/pinned-head anchor and an operation-specific resume key; status keys include class and same-position ordinal, while continuation rereads only the pinned prefix and rejects invalid or foreign snapshots;
- automatic add/list results exposing one own-record handle and reference-free list summaries, with full recursively rendered reference handles deferred to `show`; rendered actions preserve explicit store selection, invalid-reference diagnostics and SourceRefs are terminal, and corrective/continuation affordances are deterministic;
- the bounded mechanical key-overlap slice: same exact key + same value → corroboration; same key + different value under `exclusive` → conflict candidate; `coexisting` remains non-conflicting; feedback carries a count, one representative, and exact-key Claim-list drill-down rather than every prior Claim;
- exact health: unresolved exclusive groups not fully covered by an eligible Resolution whose record references all point backward, and references with no backward target; provider corruption is a store failure, not partial health;
- generic same-scope/equal-value/different-key divergence as non-blocking versioned core mechanics suppressible only by eligible explicit duplicate Relations whose endpoints point backward, never cross-key reconciliation or ClaimPolicy advice; M1.5 executes no policy advice callback;
- consumer-owned namespacing, with examples and skill guidance requiring query-before-key invention;
- CLI-internal production Clock and secure cryptographic RandomSource at the composition root, with no weak fallback, ambient kernel access, export, or dedicated package;
- one build-time embedded guide source, with text `lor skill` printing the frontmatter-stripped Markdown bytes and JSON returning the same guide string;
- compiled single-file binary via `bun build --compile`.

During this phase the agent performs judgment manually: it records explicit Relations and Resolutions through the CLI. Those canonical records become the fixture corpus that M2's deterministic ruleset is validated against.

T50–T75 are protocol-ready under this contract, but implementation remains staged: M1.5 owns its record/query/chain rows, M2 owns scenario/Current Knowledge rows, and M3 owns packet-started disclosure and Working Lore budget continuation. Contract closure changes no catalog claim.

Exit: an agent given only the binary and `lor skill` completes the M1.5 portions of journeys 0, 1, 2, 3, 3b, 7, 8, and 9 on a fresh store, follows pagination/disclosure commands, records manual judgment, and ends with `lor status --check` passing. Acceptance scenario A's records and manual relations are executable; its Current Knowledge and Working Lore assertions remain M2/M3 exits.

## M2 — Reconciliation and projection

Implement deterministic baseline rules, mediated by the active versioned ClaimPolicy:

- exact-key duplicate detection where identity/value/source makes it unambiguous;
- same-value corroboration/support;
- differing-value handling according to policy semantics (`exclusive` → candidate conflict, `coexisting` → coexist without conflict);
- optional policy-produced deterministic advisories across related claims without crossing exact-key reconciliation boundaries;
- mechanical temporal precedence where inputs are sufficient;
- explicit Resolution application;
- current, `as_of`, `valid_at`, and combined temporal projections;
- derived content under the M0 structural ruleset/Basis identity, with `computed_at` separate from Basis.

The CLI's feedback upgrades in place: the envelope shape is unchanged, but `reconciliation` is now filled by the full deterministic ruleset instead of the early key-overlap slice, and `current` with temporal query flags appears.

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
