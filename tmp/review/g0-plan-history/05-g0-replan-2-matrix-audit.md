# G0 replan 2 matrix/decomposition audit

## Verdict

**NEEDS_REPLAN. Watchtower must not dispatch A0 yet.** The replan is materially safer than the rejected PR #35 architecture and correctly preserves the a945521 failure custody, but it does not yet freeze an implementable/independently-assurable stage contract. Contract Steward closure is also absent, so the three declared decision gates remain open. A0 is intentionally policy-free, but it cannot freeze the current incomplete shared types and assurance accounting without inviting local inventions.

This is a planning judgment only. No repository, branch, PR, or historical ref was changed.

## Evidence boundary

Reviewed `/Users/tiny/.rozoro/tasks/loredu-g0-replanner-2--01M114QXHW7RS0KY190TGBN527/g0-replan-2.md` against:

- governing `docs/v0.x/execution/implementation-plan.md` at `master@612ddcb0f23d0177b806942f89a158c50267b926`;
- ADR 0011, ADR 0012, ADR 0016 and the package/API contracts at that head;
- the original G0 matrix and prior M0 decomposition;
- all prior G0 Reviewer/Tester findings through PR #32 and PR #35;
- PR #35 attempt-5 final Reviewer/Tester evidence at `a945521af7d3a8415f071322b577be6865f9ed8f`, tree `06c42f72db78d83e084b39b4c281a59ab7929335`, CI `33052334867`;
- the preservation manifest and bundle SHA-256 `6b08ae21c8bc67327b3f64f340cf8ffdfd18e08b821e08877d821f1e369ff7e1`.

The current local checkout is stale (`master` is three commits behind `origin/master`); this does not alter the audit because the governing comparison is the explicitly named `612ddcb` base.

## Normative G0 invariant coverage

The complete G0 set from the governing matrix is CM-I41, CM-I43, CM-I44, CM-I45, CM-I46, CM-I47, and CM-I50. The intended coverage is present as follows, but is not fully closed because of the findings below:

| Invariant | Planned owners / evidence | Audit result |
|---|---|---|
| CM-I41 — test-only seam, narrow test surfaces, no production `/testing` | A/F inventory; B/C/E syntax/reference/target law; G1 ledger; G2 mutation; I integrated scan | Present, but test-surface ownership and pair/ledger accounting are not frozen enough to prove it. |
| CM-I43 — zero kernel runtime dependencies and one-way `kernel <- store <- cli` DAG | A/F manifest facts; B/C/E syntax-first resolution; G1 cases; G2 per-check mutants; I one authority | Present, but A/F/B/C/E have overlapping export/target authority and no closed ID-to-stage map. |
| CM-I44 — no environment imports/builtins, adapter/CLI/testing edges, directives, or ambient Bun/Node capability reads | A/F compiler/config facts; B/C/E references; D flow; G1 red/green corpus; G2; I | All historical bypass families are named, including a945521 loader/config/flow cases. The source-input contract and mutation mapping are insufficiently frozen. |
| CM-I45 — no ambient time/random invocation, alias, indirect call, or escape | D capability lattice/fixpoint; G1 adversarial cases; G2; I | Semantically complete on paper, but D is declared parallel after A0 while also consuming A/F output, and no stage API fixes the flow result/diagnostic boundary. |
| CM-I46 — effective kernel `types: []`, `lib: [ES2023]`, source/config isolation and negative compile proof | A/F config graph; B/C/E compiler isolation; G1; G2; I | Source directives and compiler isolation are explicitly carried forward. Exact config-node/edge and compiler evidence contracts are missing. |
| CM-I47 — total source/control/export inventory and resolver target classification | A/F lstat inventory/manifests/config; B/C/E syntax-before-resolution/export law; G1; I | Historical false greens are explicitly covered. Exact ownership between inventory, config graph, resolver, and export law is ambiguous. |
| CM-I50 — total/no-throw discovery, one authority, CI selection, mutation/watchdog authority | A/F; G1; G2; I; final exact-head evidence | Historical evidence is correctly treated as non-acceptance. G2 still lacks exact watchdog/CI timeout semantics and a closed check-to-mutant contract. |

No G0 invariant is wholly omitted from the prose. Several are only asserted as intent rather than frozen as independently executable contracts; those are blocking omissions for this decomposition.

## Findings (standard Reviewer classes)

### R2-MR-01 — P1 blocker: the frozen interfaces cannot compose the proposed stages

The frozen block defines `ConfigGraph` in terms of undeclared `ConfigNode` and `ConfigEdge`, and `CaseSpec.killsCheckIds` in terms of undeclared `BoundaryCheckId` (lines 96–103 and 136–147). More importantly, it freezes data fragments but no stage function signatures, result types, source-read contract, error propagation, or mutation-injection contract:

- `WorkspaceInventory` contains paths/kinds/packages/violations but no source bytes, parsed `SourceFile`, source snapshot, or read failure result for B/C/E and D to consume;
- `ModuleReference` and `CapabilityFacts` are individual facts, not a typed stage result carrying all violations, source identity, uncertainty, or canonical ordering;
- `ConfigGraph` has no defined node identity, edge kind, target representation, malformed-shape representation, or boundary of recursive traversal;
- `CaseSpec.fixtureMutation` and `pairedGreenControl` have no frozen types or referential constraints;
- `ScanMutation` is named but its shape and branch propagation are not frozen.

The plan says stages consume typed outputs and never re-scan/reinterpret another stage's result, yet B/C/E must parse source and D must analyze source. With the stated interfaces they either cannot run or must add private/shared representations and local authority. The private-field escape in the plan does not define how later stages receive the required input. This is exactly the kind of shared-authority invention the replacement is intended to prevent.

**Required classification/correction:** Contract Steward must freeze the missing node/edge/check unions and the stage input/output signatures, including one authoritative source snapshot/read outcome consumed by B/C/E and D, or explicitly define that inventory owns source loading and publishes an opaque typed program/AST representation. Freeze upstream-failure propagation (no re-read/no throw), deterministic aggregation and source locations, and the exact test-only mutation path. Until then A0 is not a safe contract lock.

### R2-MR-02 — P1 blocker: ownership overlaps create multiple authorities

The decomposition assigns exact manifest/export facts and exact export expectations to both A/F (`manifest-model.ts`, “manifests, exports”, G0-F) and B/C/E (`export-law.ts`, “exact export maps and regular targets”). A/F owns config graph/target facts while B/C/E owns `resolution.ts` and canonical target classification. A0 owns `fixture-operations.ts` while A/F separately owns `filesystem-fixtures.ts`. I also calls `tests/workspace-structure.test.ts` the sole integrated structural suite while G1/G2 add separate executable structural/authority suites.

These can be split into facts versus policy, but the plan does not say which module is authoritative for:

- export-map shape versus target existence/type;
- config target traversal versus module target resolution;
- fixture creation/classification;
- one scanner invocation versus multiple assurance test invocations.

The old false greens were specifically caused by partial guards and independent regex/scanner authorities. An implementer can satisfy both named modules with duplicate checks, or make one module bypass the other.

**Required classification/correction:** Contract Steward/Watchtower must assign one owner and one typed handoff for each fact/rule. A/F should either be the sole manifest/export/config fact authority consumed by B/C/E, or B/C/E must own a clearly separate module-law check; it must not be both. A0’s fixture operations must be the sole mutation primitive (or be explicitly limited to generic operations with A/F’s helper as a wrapper). Clarify “sole integrated suite” as one production scanner authority, not an accidental prohibition on G1/G2 assurance tests.

### R2-MR-03 — P1 blocker: A/F and D dependencies are misclassified

D’s own dependency list is “A0 fact lattice”, “final source inventory from A/F”, and a pinned checker, while its parallelism says it may implement after A0 and its dependency list omits A/F (lines 346–354). A/F itself is described as producing the source/control inventory consumed by later stages, but B/C/E and D have no shared source input contract. D cannot be independently merge-ready against the frozen API it is said to consume, and a final integration-only repair can silently change its semantics.

G1 has the same deliberate split between parallel scaffolding and a complete executable ledger, but that distinction is not made as an artifact/branch rule.

**Required classification/correction:** Reclassify A/F as a dependency of D, or freeze a source-analysis input seam available from A0. Explicitly label G1’s parallel work as schema/table scaffolding only and require the executable ledger to be based on the completed stage contracts. Every slice handoff must name its base SHA/tree, consumed contract version, and whether its tests run against real stages or only schema fixtures.

### R2-MR-04 — P1 blocker: closed check IDs are not mapped one-to-one to executable stage branches and mutants

The eight production IDs are closed, but the plan never provides the required ownership/invocation table:

```text
G0-A-INVENTORY
G0-B-SYNTAX
G0-C-REFERENCES
G0-C-SOURCE-PARSE
G0-D-CAPABILITY-FLOW
G0-E-COMPILER
G0-E-CONFIG-GRAPH
G0-F-MANIFEST-EXPORTS
```

B/C/E contains both C IDs and E compiler; A/F contains A, E config graph, and F manifests/exports; G2 says “disable the actual stage branch” but does not define whether each ID has a distinct branch, whether a parser failure is C-SOURCE-PARSE or B-SYNTAX, or how A/F’s three IDs are independently disabled. `BoundaryCheckId` is not defined. A mutant can disable a shared aggregate and be counted as killing multiple IDs, reproducing the historical shared-oracle false green.

**Required classification/correction:** Freeze a check-ID → sole owner → stage function → canonical red case(s) → paired green → mutation branch table. Each ID must have an independently injected pre-execution branch and an exact expected delta; a shared module may have multiple IDs only if the branches and evidence distinguish them. Include whole-layer omission and trivial-return mutants as separate G2 controls. No ID is closed until that table is present in the artifact and ledger.

### R2-MR-05 — P1 blocker: the ledger’s provenance, pair, ordering, and independence contracts are underspecified

G1 correctly identifies every historical false-green family and requires literal expected violations, but the frozen `CaseSpec` is too weak to enforce it:

- `pairedGreenControl: string` does not guarantee a case exists, is unique, is a green control, or is not self/reciprocal/circular;
- `provenance: string[]` has no allowed reference vocabulary, source artifact identity, commit/tree binding, or stale criterion; “stale provenance” is required in prose but not defined;
- no `CaseGroup`, fixture operation schema, or exact case-id registry is frozen;
- “canonical order” for `{path, rule, detail}` is not defined (path then rule then detail, or another order);
- the plan does not state a test-independent expected-output construction mechanism beyond “literal”, nor does it explicitly forbid the ledger runner from asking `scanWorkspace` for the expected result;
- no exact rule says a paired green must be executed in an isolated fixture with no unrelated violation, rather than merely having the expected violation absent from a larger result.

Attempt 5’s missing/stale ledger mutations passed while all scanner tests and CI were green. These omissions directly leave that historical false green unguarded.

**Required classification/correction:** Freeze a committed, machine-readable provenance manifest with stable source IDs and exact head/tree/CI/artifact references; define stale/unknown behavior as a failure; make pair references typed and bidirectionally/uniquely validated; freeze canonical violation sort; require isolated red and green fixture runs and exact array equality; and add meta-mutants for delete, duplicate, stale, re-pair, altered expected output, and unrelated-violation masking. The task-local prior handoffs may be evidence inputs, but cannot be the runtime provenance oracle unless a committed manifest reproduces them.

### R2-MR-06 — P1 blocker: pinned grammar and config policy are declared gates, not yet executable authority

The plan’s three decision gates are correct and align with the a945521 failures, but gate 1 only says a pinned AST/preprocessor inventory “must be recorded” and gate 2 only lists malformed shapes. There is no named durable artifact or exact table containing:

- TypeScript/Bun/lockfile version identity;
- every `ImportDeclaration`, `ExportDeclaration`, `ImportEqualsDeclaration`, `ImportTypeNode`, dynamic import, unshadowed `require`/`require.resolve`/`module.require` alias/chain, supported JSDoc import-from/type forms, and triple-slash directive form;
- the static/non-static result and exact `boundary-ast-uncertain` rule for each unsupported/future form;
- whether `extends` and `references` may leave the workspace, and the allowed substitutions/target extensions;
- whether `paths` mappings may target workspace-looking names or ignored/outside trees;
- exact malformed/null/array/scalar/non-string/missing/cycle/unreadable/dangling-symlink diagnostics and ownership.

Without that table, B/C/E and A/F must choose local semantics, exactly what the plan says they may not do. This is a Contract Steward **NEEDS_DECISION**/classification blocker, not an implementation freedom.

### R2-MR-07 — P1 blocker: G2 watchdog and CI authority remain too weak to catch a hang/omission false green

G2 requires a “hard outer watchdog” and says a CI timeout duration must be explicitly set if not fixed, but does not freeze:

- the watchdog mechanism/process boundary and whether it kills the whole descendant process group;
- timeout duration and precedence between script watchdog and GitHub `timeout-minutes`;
- exact cross-platform timeout exit semantics and preservation of ordinary 0/nonzero scanner exits;
- how a synchronous infinite loop is injected without giving production CLI access to `ScanMutation`;
- a red static/fixture control for removing the explicit `check:boundaries` workflow step or adding a second invocation.

The prior attempt had a watchdog that could kill a hang, but that did not prove stage authority or ledger completeness. Merely recording a nonzero hang result and grepping a workflow does not prove the selected CI suite executes the intended command exactly once.

**Required classification/correction:** Steward must settle exact watchdog/CI semantics (or record an internal assurance decision with a named artifact). G2 must exercise a novel synchronous hang and ordinary exit 0/9 cases, verify descendant termination, and prove workflow selection/explicit invocation/`if: always()` aggregate via a red mutation or exact static test. A platform default is not evidence.

## Classification disputes / Steward closure inputs

These are the exact items to hand to Contract Steward; they remain `AMBIGUOUS → NEEDS_DECISION` until a durable closure artifact exists:

1. **Loader/reference grammar:** bind to the locked TypeScript/Bun versions and commit a complete node/preprocessor inventory and uncertainty behavior. Resolve the `require` alias/chain and JSDoc import-from/type forms, not only direct call syntax.
2. **Config graph:** define all node/edge kinds and recursive traversal; required-file policy; malformed `extends`, `references`, `paths`; missing/unreadable/dangling/cyclic targets; workspace containment; ignored/hidden/dist/node_modules targets; and supported TypeScript substitutions. Resolver success can never launder a syntaxually forbidden workspace identity.
3. **Watchdog/CI:** fix watchdog duration, process-group/platform behavior, exit codes, GitHub timeout authority, and single explicit workflow invocation.
4. **Frozen contract definitions:** define `ConfigNode`, `ConfigEdge`, `BoundaryCheckId`, `ScanMutation`, fixture/provenance/pair types, stage functions/results, source snapshot ownership, and canonical violation ordering.

These are assurance contracts, not Loredu product/domain choices. A new public/package semantic is not needed; if the steward determines one is needed, docs/ADR-first handling is required.

## Slice-by-slice audit and dispatch conditions

### A0

**Good boundary:** owns only internal contracts/case schema/fixture primitives; no root command, production entrypoint, package files, docs, or product policy. It can land without claiming any scanner policy **only after** the missing type/handshake definitions above are closed. Its tests may prove schema rejection and literal/fixture/provenance mechanics, but must not claim CM-I41/43/44/45/46/47/50 behavior or T-numbers.

**Required A0 acceptance:** contract compiler checks; closed unions; typed pair/provenance/fixture references; canonical violation sort; explicit no-scanner-import test; no root wiring; exact base/head/tree evidence. A0 must not encode a placeholder that later workers reinterpret.

### A/F

Covers inventory totality, lstat-first classification, package/source/control/test/ignored ownership, manifests/exports, and total config graph. Its listed controls cover all prior a945521 config/filesystem false greens. It must stop on the open config policy gate and must publish source/config facts without allowing later modules to re-read failed paths or reinterpret ownership. Exact export/config authority must be disambiguated from B/C/E before dispatch.

### B/C/E

Covers syntax-first package identity, complete static-reference vocabulary, loader/JSDoc/triple-slash uncertainty, resolver target ownership, compiler isolation, and export law. This is the historical false-green closure point for aliased loaders, ImportTypeNode, configured paths, and valid JSDoc forms. It cannot dispatch until Steward records the TypeScript inventory and config/reference scope. It must prove syntax classification occurs before any resolver call and must use the A/F graph/source handoff.

### D

Covers symbol identity, runtime/erased/uncertain binding, conservative capability lattice, CFG/fixpoint, unknown computed access, call/apply/optional/escape sinks, branch/backedge/closure/recursive behavior, and all five ambient/global families. It is the strongest redesign in the plan and addresses every a945521 flow probe. It nonetheless needs the source-input dependency correction and exact check/mutation branch. Novel probes must be independent of the committed case table.

### G1

Covers complete case IDs, exact literal violations, pair/provenance/meta-accounting, historical closure, and real-stage execution. This is necessary after the attempt-5 missing/stale ledger false greens. It is not merge-ready as a complete executable slice before A/F/B/C/E/D contracts exist; only scaffolding may proceed in parallel. The committed provenance manifest and isolated-pair rule are mandatory.

### G2

Covers true pre-execution mutation, all eight closed IDs, omission/trivial/parser/config mutants, watchdog, one command/one scanner/CI authority. It must be last assurance before I and cannot rely on post-filtering, scanner-as-oracle, a stale command, or another violation. Freeze the ID map and timeout/exit contract first.

### I

Covers the one `scanWorkspace` composition, deterministic aggregation, exact real-workspace scan, and final evidence. It must be the only production authority, but the plan should not imply G1/G2 tests are duplicate production scanners. The final scanner must use one source snapshot/typed stage pipeline and expose mutation only through a test-only path. I must rerun all affected evidence after any P0/master owned-surface change.

## Required exact artifact-bound protocol

No evidence is valid by branch name or prose assertion. Each artifact below must bind to immutable identities and be retained with the task/PR evidence:

1. **Steward closure artifact:** durable decision/issue (or an explicit internal assurance record where no public semantics changed) naming the pinned Bun/TypeScript/lockfile/workflow versions; complete loader/reference table; config-node/edge/malformed/containment table; watchdog mechanism, timeout, process-group behavior, exit codes, and GitHub `timeout-minutes`. Record whether any item is `EXISTING_CONTRACT_CONSEQUENCE` versus `NEEDS_DECISION`.
2. **A0 contract artifact:** exact commit/head/tree/parent/merge-base/current-master; changed-path manifest; compiler-checked definitions for every frozen union/interface/function; contract-consumption matrix; explicit no-scanner/no-root-wiring proof; schema test results. A0’s case IDs must have no policy assertions and no T-number claims.
3. **Per-slice manifests:** for A/F, B/C/E, D, G1, G2, and I record base/head/tree/parent/merge-base, changed paths, consumed contract version/hash, owner, dependency closure, exact local commands, versions, case counts, and invalidation scope. A child slice must prove its parent contract/tree, not just its branch name.
4. **Ledger manifest:** committed case registry with unique IDs, one layer/group, one typed red fixture mutation, one typed paired green control, literal expected array, closed check-ID kill list, stable provenance IDs, source report/head/tree/CI/artifact references, canonical violation sort, and isolated output proof. Ledger meta-mutant logs must include the intended failure reason for missing/duplicate/stale/pair/expected/provenance edits.
5. **Mutation manifest:** for each policy ID, mutation ID, pre-execution branch location, canonical red case, paired green case, exact baseline and mutated outputs, exact expected delta, no unrelated violation assertion, and proof `ScanMutation` cannot reach normal CLI. Include whole-layer omission and trivial-return mutants separately.
6. **Watchdog/CI manifest:** novel synchronous hang fixture, watchdog and GitHub timeout values, signal/exit result, process-tree cleanup, ordinary zero and ordinary failure preservation, workflow single-invocation proof, selector result, workspace success, docs skipped, aggregate success, all bound to the exact final SHA/tree.
7. **Preservation/closure manifest:** reverify tag object `4407b365f4d09ad42eca0b36295bf9e0b69b00c4`, peeled `a945521…`, tree `06c42f…`, bundle checksum, and PR #32/#35 branches/tags before final review; link the historical red-on-a945 log and never use historical green CI `33052334867` as acceptance. Close PR #35 after replacement A0 exists and links custody; retain its branch. Close PR #32 only after final replacement merge/evidence; retain branch/tag/bundle. No comparison PR and no force-push.
8. **Final exact-head manifest:** final SHA/tree/merge-base/current-master, clean status, changed paths, full local command results, every matrix row → stage/cases/mutants/positive controls map, exact CI URL/run ID and job results, and independent Tester/Reviewer reports on the same head/tree/base. Any P0/master/contract/lockfile/workflow change invalidates the named dependent artifacts and requires reconciliation before acceptance.

## Dispatch decision

**Current disposition: NEEDS_REPLAN.** The plan must first receive Steward closure for the three declared gates and the contract/ownership corrections R2-MR-01 through R2-MR-05. After those artifacts are durably closed, Watchtower may dispatch A0 under the narrow rules above; A0 still cannot claim G0 policy. If Steward closes only the three semantic gates but leaves the missing stage interfaces, check-ID mapping, ledger provenance/pair rules, or ownership overlaps unresolved, dispatch remains blocked and NEEDS_REPLAN remains.

After A0 and all subsequent slices satisfy the exact artifact-bound protocol, Watchtower may dispatch the final exact-head Tester and Reviewer. Historical a945521 evidence remains preservation evidence only, never acceptance.
