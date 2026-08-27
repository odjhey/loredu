# Loredu M0 initial decomposition

Baseline: `master` at `e887b567ed74243ffd51ec0bf3ca4350257b5a32` (`v0.0.1`). This plan uses only current repository/GitHub state. Open draft/DO-NOT-MERGE PRs are observations, not contract authority or implementation bases.

## Result protocol

- status: `NEEDS_DECISION`
- summary: M0 is bounded to the public kernel, its test-only deterministic support, and enforceable boundaries. Substantial implementation fan-out must wait for D0 (contract closure) and the P0/G0 mission-workset preflight. The graph then has three bounded stacks and one fan-in.
- attempt_count: `0`
- caused_by: `initial M0 decomposition`
- recommended_next_role: `contract-closer / ADR author`, followed by `M0 preflight integrator`

## Scope

In: immutable draft/persisted record model for all five families; validation and equality primitives; kind-prefixed ids; Clock/RandomSource; application append and reference-before-referrer checks; the RecordStore slice the append path consumes; built-in ClaimPolicy/version identity; basis identity primitive required by T81/T82; `InMemoryStore`, `FixedClock`, `SeededRandomSource`; public exports; catalog tests; package/type/capability boundaries.

Out: durable plain-file behavior and conformance (M1), CLI behavior (M1.5), reconciliation/conflict production behavior and projections (M2), Working Lore (M3), real consumer/custom policy (M4), dependency-cruiser adoption unless issue #18's trigger is met, publishing, daemon/services/crawlers/models/vector/graph/distributed work.

## Initial Contract Matrix

Classification vocabulary is exactly `IN_SCOPE`, `OUT_OF_SCOPE`, `DEPENDENCY`, or `AMBIGUOUS — NEEDS_DECISION`.

### IN_SCOPE

| ID | Normative invariant | Source / acceptance |
|---|---|---|
| CM-I01 | Canonical records are immutable; no API edits a created record. | records inv. 1; ADR 0002; T05 |
| CM-I02 | New understanding always appends a new record; contradictory history is legal; supersession/resolution never deletes or rewrites prior records. | records inv. 2,5,6; ADR 0002 |
| CM-I03 | Every persisted record uses exactly `schema: loredu.record/v1` and one closed kind: `entry|claim|relation|resolution|verification`. | records; ADR 0019; T02 |
| CM-I04 | Persisted common envelope carries `schema`, `kind`, `id`, `recorded_at`, required actor, scope, and metadata; optional common provenance fields are preserved. | records; M0 plan |
| CM-I05 | Drafts contain caller-owned fields only; their TypeScript types expose neither `id` nor `recorded_at`, and runtime append rejects either property rather than overwriting it. | records; ADR 0018; T83/T84 |
| CM-I06 | Exactly one application append path stamps both `id` and `recorded_at`; callers and stores never do. | records/store/clock contracts; T80/T83 |
| CM-I07 | Store append receives a complete validated record and assigns only stream position; it never fabricates or rewrites identity/time. | store; ADR 0018 |
| CM-I08 | `recorded_at` is sampled immediately before the append attempt, becomes canonical only on successful append, is not the durability instant, and stream position is ordering/commit fact. | clock contract; ADR 0018; T80 |
| CM-I09 | Clock and RandomSource are injected once at application assembly, never global/singleton/storage dependencies. | clock contract |
| CM-I10 | Clock returns an instant; kernel renders the record field. RandomSource returns exactly requested bytes or fails and knows nothing about record ids. | clock contract |
| CM-I11 | Kernel owns id format: `ent|clm|rel|res|ver` + `_` + exactly 16 lowercase Crockford-base32 symbols (alphabet excludes `i,l,o,u`), 80 bits from 10 bytes. | records/clock; T08 |
| CM-I12 | Id prefix must agree with kind; suffix is opaque and carries no time/order/domain meaning; logic may inspect no more than the prefix. | records/clock; T08 |
| CM-I13 | Store rejects duplicate ids; repeated appends are not content-addressed and consume fresh entropy. | store/clock; T07/T84 |
| CM-I14 | Same draft + fixed clock + identically initialized deterministic source in fresh assemblies gives the same first stamped record; sequential appends in one assembly give distinct ids. | clock; T84 |
| CM-I15 | Actor is required; actor type is closed to `human|agent|program|system`; actor id uses the token rule. | records/ADR 0019; T02 |
| CM-I16 | Token fields (`subject.type`, `subject.id`, `predicate`, `perspective`, `actor.id`, scope keys/values) match `^[a-z0-9]([a-z0-9._:/-]*[a-z0-9])?$`, max 128; lowercase is rejected rather than normalized; no edge separator/whitespace. | ADR 0019; T03/T04 |
| CM-I17 | Scope is a flat unordered token→token map; absent and `{}` are identical; key identity compares pair sets order-insensitively, while adding a pair changes identity. | ADR 0019; T85 |
| CM-I18 | Metadata is a flat map; keys are `<namespace>.<name>` with both token-safe; unnamespaced keys are rejected; `loredu.*` is kernel-reserved; other namespaces are preserved verbatim and ignored if unknown. | records/ADR 0019; T06 |
| CM-I19 | Source `ref` is not token-shaped: it is trimmed, nonempty, max 1024, and may be URL/path/vendor id. | ADR 0019 |
| CM-I20 | Closed vocabularies reject unknowns: kind, actor type, relation type, resolution decision, verification result, confidence. | ADR 0019 |
| CM-I21 | Open vocabularies accept and preserve unknown strings: `entry_type`, `claim_class`; kernel never branches on them. | ADR 0019 |
| CM-I22 | Entry body is required/nonempty; title optional; an Entry needs no Claim. | records inv. 3; T01 |
| CM-I23 | Claim requires subject/type/id, predicate, value, confidence and declared key; optional perspective/validity/provenance/source fields are preserved. | records; T03/T04 |
| CM-I24 | Claim value is JSON-serializable, required, may be `null`, and compares structurally over canonical object-key ordering with exact strings and no type coercion (`1 !== "1"`). | ADR 0019; M0 utility dependency for T86 |
| CM-I25 | Claim key is exactly `(scope, subject.type, subject.id, predicate, perspective?)`; mechanics reconcile only exact policy keys; different perspectives are different keys; malformed/missing keys reject. | ADR 0004/0010; T03/T04/T85 |
| CM-I26 | Kernel validates claim-key shape only and never normalizes/interprets consumer vocabulary or namespacing; unkeyed knowledge is an Entry. | ADR 0004/0010 |
| CM-I27 | `derived_from` contains Entry ids only; claim-to-claim derivation uses Relation; provenance is retained when available. | records inv. 4 |
| CM-I28 | Relation type is closed to `supports|contradicts|duplicates|supersedes|derived_from|related_to`; explicit relations can persist, rebuildable ones need not. | records |
| CM-I29 | Resolution decision is closed to `prefer|supersede|retract|leave_disputed`; targets are claims or relations; replacement is optional claim; effective time optional; auditable reason is not chain-of-thought. | records |
| CM-I30 | Verification targets Claims (Pattern is a claim class), carries a stated source/snapshot basis, and result is closed to `confirmed|contradicted|unchanged|needs_revalidation`. | records |
| CM-I31 | Application rejects missing referenced Entries/targets before append; referents precede referrers; store remains semantics-ignorant; every valid append prefix stays valid. | store; M0 exit; T19 |
| CM-I32 | Validation/reference failures are actionable and name the bad/missing field or reference; unknown schemas are never silently skipped. | records/ADR 0019; T03/T19 |
| CM-I33 | Every persisted schema ever written remains replayable; additive evolution within version, otherwise new schema + old replay support; canonical records may not be stranded. | records inv. 9; ADR 0005 |
| CM-I34 | ClaimPolicy is one narrow deterministic/versioned seam owning identity, `exclusive|coexisting` semantics, and optional mechanical advisories; no micro-ports; Extractor/Resolver/Ranker remain separate. | ADR 0010 |
| CM-I35 | Policy mechanics never judge/speculate, never interpret consumer vocabulary, and never cross the exact returned key; same inputs+version produce same output. | ADR 0010 |
| CM-I36 | Default policy ships in core: declared key identity, all values `exclusive`, no policy-produced custom advisories; zero configuration. | ADR 0010; T82 |
| CM-I37 | Any policy affecting derived behavior has stable version identity included with core ruleset identity; policy bump invalidates derived cache without touching records. | ADR 0010/0006; T82 |
| CM-I38 | Basis identity contains stream position, ruleset, query; `computed_at` is outside identity/comparison. | ADR 0006; T81 |
| CM-I39 | RecordStore is provider-neutral; application code depends on no paths/tables/SDK/query language. M0 supplies the typed append/get capability needed by orchestration. | store; M0 plan |
| CM-I40 | M0 test InMemoryStore follows the same public RecordStore port and returns exact canonical records; it is not a filesystem/provider dependency. | M0 plan; ADR 0011 |
| CM-I41 | `FixedClock`, `SeededRandomSource`, and `InMemoryStore` are exported only from `@loredu/kernel/testing`; production code never imports that subpath. | M0 plan; ADR 0011/0018 |
| CM-I42 | Runtime embedding API is exported from `@loredu/kernel`; behavioral tests consume only public package exports, never deep internals. | ADR 0011; tests README |
| CM-I43 | Kernel has zero external runtime dependencies and no adapter/CLI dependency; DAG is kernel ← store-plainfile ← cli. | ADR 0011 |
| CM-I44 | Kernel imports no `node:*`, bare Node builtins, `bun:*`, adapter/CLI, DB/model SDK; no Bun/Node ambient globals. | ADR 0011/0016 |
| CM-I45 | Production kernel source cannot use ambient `Date.now(...)`, zero-arg `new Date()`, or `Math.random(...)`; explicit-value temporal parsing remains allowed. | M0 plan; clock contract |
| CM-I46 | Kernel remains strict portable TS with `types:[]`, `lib:[ES2023]`, source exports, per-project typecheck, and no dedicated clock/random package. | ADR 0007/0016/0018 |
| CM-I47 | Workspace install is frozen; root tests are real workspace consumers; package exports remain exactly normal runtime + separate testing seam. | ADR 0011/0016; preflight requirement |
| CM-I48 | Each catalog row is executable via real assertion and `@covers` xor explicitly deferred; no placeholder/skip/todo/unknown/double accounting. | ADR 0012/0015 |
| CM-I49 | M0 implementation migrates T01–T08 and T80–T85 only when fully true; T86 remains M2 although canonical equality utility lands now; T19 assignment must be resolved in D0. | catalog/plan |
| CM-I50 | CI remains fail-closed and runs lint, spell, docs, catalog, gate selftests, typecheck, tests, compile smoke for code changes; source/test discovery must expand when zero consumers/tests/placeholders become real. | ADR 0012/0015; workflow |
| CM-I51 | Contracts are not marked `current` before two real consumers; M0 docs may be updated/clarified but remain pre-stability. | ADR 0005 |

### AMBIGUOUS — NEEDS_DECISION

| ID | Public-semantic ambiguity that must be closed in D0 |
|---|---|
| CM-A01 | Relation payload has vocabulary but no endpoint/cardinality shape; therefore relation references and reference-before-referrer validation are not implementable from `master` alone. |
| CM-A02 | Required/defaulted envelope fields are unclear: persisted examples require scope/metadata, drafts mention scope/sources/metadata, but absent scope is legal and no default rule is stated. Unknown top-level/payload field handling is also unstated. |
| CM-A03 | Runtime immutability depth/aliasing is unstated: readonly types vs deep frozen copies, including nested `value`, arrays, metadata, scope, and caller mutation after append. |
| CM-A04 | “JSON-serializable” and canonical equality do not define rejection/encoding of `undefined`, non-finite numbers, `-0`, bigint, sparse arrays, cycles, class instances, accessors/prototypes, or Unicode. |
| CM-A05 | Timestamp/Instant public representation, accepted syntax/offset normalization, and `valid_from <= valid_until` behavior are unstated. |
| CM-A06 | Nonempty/length/duplicate rules for body/title/reason, source locator/snapshot, arrays (`derived_from`, targets, sources, verified_against), and replacement cardinality are incomplete. |
| CM-A07 | Verification’s `verified_against.source` does not clearly reuse `SourceRef`; glossary allows source/projection verification while record contract restricts persisted targets to Claims. |
| CM-A08 | Crockford byte→symbol bit order is not pinned, so independent fixtures can disagree despite the same 10 entropy bytes; collision retry vs surfaced duplicate is unstated. |
| CM-A09 | Clock contract diagram calls Clock before RandomSource, while “sampled immediately before append” implies entropy should be generated before the clock sample. Capability failure/call-consumption order is observable and must be fixed. |
| CM-A10 | Published store contract lists append/get/scan/stream/head and says store append returns position only; current public TypeScript port omits `scan` and returns `AppendResult` with ref+position. M0 plan asks only the append-path slice. Exact public M0 port must be decided. |
| CM-A11 | T06 requires serialize/parse in M0, but the provider codec is M1 and `master` exposes no storage-neutral parse/decode API. Define M0 evidence (for example JSON transport + public persisted-record decoder) or move/split the row. |
| CM-A12 | T19 is catalogued M1 although M0 plan/exit require reference-before-referrer checks. Move it to M0, split adapter conformance, or explicitly narrow M0 evidence. |
| CM-A13 | T81/T82 are catalogued M0 although projections/M1.5 byte behavior do not exist. Define an M0 public basis/ruleset identity primitive and exact default core-policy version composition, or split/defer the future clauses. |
| CM-A14 | ClaimPolicy says “derive or validate identity” while ADR 0004 says every Claim declares its exact key; decide whether custom policies may transform identity or only validate/select from declared fields. |
| CM-A15 | Actionable error is normative but public error shape/code/path aggregation and fail-fast vs collect-all are unspecified; parallel implementers would expose incompatible APIs. |
| CM-A16 | Runtime treatment of excess fields and objects with getters/custom prototypes is unspecified, including the required runtime refusal of `id`/`recorded_at`. |
| CM-A17 | ADR 0016 says InMemoryStore/test doubles land M1, while the current M0 plan requires them in M0; this needs a superseding/clarifying ADR, not silent implementation. |
| CM-A18 | Default policy text alternates between “no advisories” and “no advisories beyond built-in key-divergence hint”; establish that the hint is core mechanics and outside `ClaimPolicy.advise`. |

Implementation freedom only after these decisions: file/module layout under existing package boundaries, internal helper names, validator decomposition, canonicalization algorithm data structures, error implementation mechanics once public shape is fixed, and seeded PRNG algorithm if no cross-process byte fixture is promised. These choices must not alter accepted values, equality, ordering, call ownership, exports, or errors.

### DEPENDENCY

| ID | Dependency / boundary |
|---|---|
| CM-D01 | External infra: branch protection and mission labels must be repaired before any implementation PR lands; intake says this is independent and not a replan. |
| CM-D02 | D0 decision records/contracts/catalog closure is required before code fan-out. |
| CM-D03 | P0 and G0 preflight fan-in is required before substantial records/policy fan-out. |
| CM-D04 | M1 owns durable PlainFileStore, Markdown/frontmatter codec, full conformance, locking/atomicity/fsync/crash/replay/stable positions and provider layout. |
| CM-D05 | M2 consumes M0 canonical equality and policy/version primitives for T20–T30/T86; M0 does not claim conflict/corroboration behavior. |
| CM-D06 | M1.5 consumes public application/policy APIs for CLI/envelope/status/pagination; M0 cannot prove byte identity against a nonexistent CLI. |
| CM-D07 | Issue #18 tool spike is not a blocker if the purpose-built structural/capability guard is proven red/green; revisit at its stated trigger. |
| CM-D08 | Open draft PRs #22–#29 are not authority. Coordinator must close/rebase/salvage only contract-conforming commits after D0; DO-NOT-MERGE snapshots must not enter the merge train. |

### OUT_OF_SCOPE

| ID | Deferred invariant/work |
|---|---|
| CM-O01 | Plain-file canonical persistence, store-root resolution, lock/single-writer, atomic visibility, durability/fsync, crash prefix, replay and conformance: M1/T10–T18. |
| CM-O02 | CLI commands, compiled journey behavior, envelope/advice/status/filtering/pagination/handles: M1.5/T50–T75. Existing `--version` smoke remains only a gate consumer. |
| CM-O03 | Duplicate/corroboration/conflict generation, temporal precedence, resolution application, projections/as_of/valid_at/staleness: M2/T20–T30/T86. |
| CM-O04 | Bounded Working Lore/ranking/continuation/disclosure: M3/T40–T45. |
| CM-O05 | Real consumer, custom policy and production consumer capabilities: M4. |
| CM-O06 | Publishing/registry compatibility, lockstep semver, contracts package, extra packages, HTTP/daemon/services, crawlers/OCR/models/embeddings/vector/graph/distributed multiwriter/performance. |

## Work graph

No slice lands without its tests and catalog accounting in the same PR. Every code PR runs the full gate and needs green `ci-required`; docs decisions use the docs suite but P0 must not start until D0 is merged.

| Slice / PR | Matrix slice and owned surfaces | Depends on | Catalog rows | Exact evidence / review / acceptance |
|---|---|---|---|---|
| **D0 — contract closure** | CM-A01–A18; ADR(s), records/store/clock contracts, catalog wording/status, indexes. Docs only. | infra may proceed independently | decide T06/T19/T81/T82; no `@covers` | `bun run spell`, `check:docs`, `check:catalog`, `check:gates`; review verifies every A-row closed, no implementation freedom used for public semantics, prior ADRs superseded rather than rewritten, domain-doc playbook followed. |
| **P0 — mission workset preflight / smallest vertical Entry append** | CM-I03–I14, I22, I39–I42, I47–I50. Own `src/application` assembly, common envelope/Entry minimum, ports, testing helpers minimum, public/barrel exports, one public-consumer test and catalog migrations. | D0; external protection before landing | T01, T02, T84 (only if all clauses pass) | Fresh `bun install --frozen-lockfile`; a root test imports only `@loredu/kernel` and `@loredu/kernel/testing`, assembles app+InMemory+FixedClock+SeededRandomSource, appends an Entry, proves schema/actor/metadata/policy-version metadata propagation, two-assembly equality and sequential id difference. Runtime refuses caller stamps. Red commit/probe before green is recorded. `check:catalog` proves first deferred→executable migration. Review freezes exports and confirms no deep import/provider API. |
| **G0 — boundary/capability/source-discovery guard** | CM-I41, I43–I47, I50. Own guard scripts/root structural tests/package scripts; no domain code. | D0; can parallel P0, but both fan in before later work | none | Synthetic red/green tests for `node:*`, bare builtin, kernel→adapter, production `/testing`, `Date.now`, zero-arg `new Date`, `Math.random`; explicit-value Date construction green; nested new production source discovered; test-only import accepted only from test surfaces; type-isolation fixture proves Bun/process/Buffer/node imports fail. Audit and replace overlapping scanner in `workspace-structure.test.ts`, never leave two claimed authorities. |
| **R1 — complete record domain and validation** | CM-I01–I04, I15–I30, I32–I33 plus resolved A02–A08/A15/A16. Own `src/domain/**`, domain barrel and records tests; stack on P0. | P0 (and G0 merged/rebased before landing) | T03, T04, T05, T06, T08, T85; T86 remains deferred | Public decoder validates all draft/persisted families and exact shapes; deep immutability/alias tests; closed/open vocabulary tests; metadata JSON transport round-trip; all five prefixes; scope key equivalence; noncatalog canonical-equality vectors including object order and `1` vs `"1"`. Review checks each family/type restriction and unknown-field policy. |
| **R2 — generalized append + references/store ownership** | CM-I05–I08, I13, I26–I33, I39–I40 plus resolved A01/A09/A10/A12. Own `src/application/append*`, `ports/record-store`, generalized InMemoryStore and app tests. | R1 | T07, T19 (after D0), T80, T83 | Compile-time negative draft fixtures; runtime stamp rejection; spy ports prove validation/ref checks occur before capabilities, fixed call order, clock sampled at settled point, complete record enters store, store only returns position, failed append publishes nothing, duplicate logical append gets distinct id, each family’s refs checked with actionable path. Review focuses ownership and prefix-validity, not M1 durability. |
| **P1 — policy and basis identity** | CM-I24–I25, I28, I34–I38 plus resolved A13/A14/A18. Own `src/policy/**`, `src/basis/**`, policy barrel and reconciliation invariant tests. | P0; parallel with R1→R2 after preflight | T81, T82 (as clarified by D0) | Default identity equals canonical declared key; exact `exclusive|coexisting`; no policy custom advice; deterministic custom policy fixture cannot cross chosen key; stable core+policy version identity propagates into basis; `computed_at` changes do not change basis equality/content. No projections/reconciliation claimed. |
| **F0 — M0 fan-in and closure audit** | All IN_SCOPE rows; README/state/catalog/source-discovery cleanup only unless a defect requires returning to owning slice. | G0 + R2 + P1 | all M0 rows accounted; T86 still deferred M2 | Rebase stacks in order G0 → R1 → R2 → P1 (or P1 before R1 if conflict-free), run fresh-clone full command sequence, inspect public export list, verify zero runtime deps and no production testing import, grep zero placeholders/skips/todos, catalog says every agreed M0 row implemented xor deferred. Adversarial review maps every test to matrix row. Do not mark contracts `current`. |

### Parallel groups and fan-in

1. **Decision gate:** D0 only. No public API implementation before merge.
2. **Preflight group:** P0 and G0 may execute in parallel after D0. **Fan-in PFG:** both merged and external branch protection/labels repaired before substantial fan-out.
3. **Implementation group:** Stack A `R1 → R2`; Stack B `P1`; Stack C is already G0. P1 may run parallel to Stack A because it owns policy/basis barrels, not record/application files.
4. **Final fan-in:** F0 after R2 and P1. Intended merge order: D0 → P0 → G0 → R1 → R2 → P1 → F0; P1 may merge before R1 after rebasing if its D0/P0 contracts remain untouched.

## M0 acceptance criteria

1. From only public package imports, all five legal Draft families can be validated and appended through one assembled application into `InMemoryStore`.
2. Returned result contains exact persisted record plus monotonic position/identity according to D0; record carries kernel id/time/schema/actor and preserved optional scope/source/metadata/validity fields.
3. Draft types cannot carry stamps; runtime excess stamp attempts fail actionably; store receives a complete record and assigns only position.
4. All token/scope/metadata/schema/vocabulary/family/reference restrictions have positive and adversarial tests; errors identify field/reference.
5. Id format/prefix/opacity and deterministic capabilities satisfy T08/T84; sequential appends consume entropy; no content addressing.
6. Default ClaimPolicy is declared-key/exclusive/versioned/no custom advice; basis identity includes settled core+policy version and excludes computed time.
7. Equality canonicalization is implemented/tested as an M2 dependency, while T86 remains honestly deferred until conflict behavior exists.
8. Production kernel has zero runtime deps/environment imports/ambient capability bypasses; test-only helpers are inaccessible to production; red/green guards discover newly added nested sources.
9. T01–T08, T80–T85 and D0’s settled T19 accounting are executable xor deferred with no placeholders; root test count and READMEs no longer claim zero behavior.
10. Full local gate and GitHub `ci-required` pass on final head; branch protection is active before landing; no contract is marked `current`.

## Baseline evidence

- `git rev-parse HEAD`: `e887b567ed74243ffd51ec0bf3ca4350257b5a32`; clean `master...origin/master`.
- Repository contracts/ADRs read: records, store, clock/identity, projection, Working Lore; ADRs 0001/0002/0004–0007/0010–0012/0015/0016/0018/0019; implementation plan, scope, language, catalog/status, package/test/workflow files.
- GitHub: issue #9 open with branch-protection + first real catalog migration outstanding; issue #18 open spike; PRs #22–#29 draft, with #25–#29 explicitly DO NOT MERGE; none treated as authority.
- Current local baseline passed: frozen install; lint; spell; docs; catalog (`66 = implemented 0 + deferred 66`); gate selftest (`16 proofs`); typecheck; `bun test` (`7 pass`, one structural file); build and executable `lor --version`.
- Intake-provided external evidence accepted: GitHub run `32953497748` green for exact head and workflow triggers on PR/push.

## New findings

1. `master` has 66 catalog rows, not ADR 0015’s historical 63; all 66 are deferred. The selftest reports 16 proofs, not the historical 15. This is documentation staleness, not gate failure.
2. `packages/kernel/testing/index.ts` and ADR 0016 say InMemoryStore arrives M1, conflicting with the current M0 plan. Public scope needs a superseding clarification.
3. Current RecordStore TypeScript port omits contract `scan`, returns `AppendResult(ref+position)` although the contract says store returns position only, and types record as `unknown`.
4. Current structural guard checks environment imports but has no ambient Date/randomness capability check; it must evolve before real production sources fan out.
5. T06, T19, T81 and T82 cannot be honestly claimed as currently worded without D0 clarification/splitting.
6. Relation payload shape and several exact runtime boundary rules are absent despite required reference validation; these are public decisions, not coding discretion.
7. Root tests currently consume no kernel application behavior; P0 must explicitly prove frozen workspace resolution and first real public consumer.
8. Numerous open draft/DO-NOT-MERGE PRs are mergeable/green but cannot substitute for a master-based contract closure and clean merge train.

## Assumptions

- `master` at the named head remains planning authority; newer draft branches are not.
- Intake’s branch-protection/label repair is external and will finish before implementation PR landing.
- D0 may make agent-authorized decisions under ADR 0013, but must record them and update contracts/catalog atomically.
- Bun 1.4.0 and strict source-export workspace wiring remain fixed.
- No production publishing or external service action is part of M0.
