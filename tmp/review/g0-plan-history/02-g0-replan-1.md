# Loredu G0 escalation replan 1 — replacement boundary proof

## Mission protocol

- **Task:** `loredu-g0-replanner-1--01M10YFBD36CT0XCW8MKZXDX19`
- **Role:** Escalation Replanner; planning only, no implementation
- **Status:** `READY_FOR_ATTEMPT_4`
- **Disposition:** retire PR #32 as failed evidence and implement one clean replacement G0 PR
- **Current failed candidate:** commit `fc5b79bfc23b902069b0544d6c66944954df3cf7`, tree `a0a2a401adfc2a9aa64fc3f38c111138c7381432`
- **Failed candidate merge-base:** `43519c27b9d3be25ab847734d6824f65e9fd2c20`
- **Failed candidate CI:** run `33044928321`, exact-head `ci-required` success; green is retained as evidence but is not acceptance
- **Current planning base:** `origin/master` at `fefe20698b7769f65754173e6d4fabfa92b3b442`; its delta from the old merge-base is docs-only
- **Attempt counters:** `attempt_count: 3` completed; next implementation is attempt 4; `attempt_limit: 20`
- **Replan counters:** `replan_count: 1` (was 0)
- **Caused by:** repeated G0 boundary-analysis false-green/false-red class after ownership-changed attempt 3
- **Recommended next role:** a **fresh Coder** who did not own attempts 1–3, followed by independent fresh Tester and Reviewer on one exact head

This is a usable material replan: the limit increases from 10 to 20, but the wider limit is not permission for serial finite patches. Attempt 4 changes the architecture, evidence model, branch lineage, and ownership.

## Authority and fan-in consumed

This replan is governed by:

- the G0 matrix in `m0-decomposition.md`;
- ADR 0011 for the package DAG, zero-dependency kernel, testing seam, and single proven architecture guard;
- ADR 0012 for fail-closed full-suite CI;
- ADR 0016 for effective kernel compiler isolation and replacement of overlapping scanners;
- PR #32 attempts and reports at heads `7744fbcc`, `e917bde4`, and `fc5b79bf`;
- `g0-review-findings.md`, `g0-test-audit.md`, `g0-rereview-findings.md`, `g0-retest-audit.md`, `g0-final-review-findings.md`, and `g0-final-audit.md`.

The reports show convergence on represented examples but not on analysis closure. Attempt 1 used finite text/policy lists. Attempt 2 enlarged the AST/resolver implementation. Attempt 3 patched discovery, resolution, aliases, directives, and exports. The remaining failures are still category failures: configured resolution precedes syntactic workspace law; module-reference enumeration omits `ImportTypeNode`; the ambient model is not a flow analysis; and optional filesystem roots use existence checks before `lstat`. Attempt 4 must replace those models rather than add branches to them.

## Decision: one replacement PR, serial internal worksets

Use **one replacement G0 PR**, not multiple independently mergeable guard PRs.

Reasons:

1. Main must never contain a partial boundary authority or two scanners claiming the same law.
2. Filesystem inventory, syntactic classification, TypeScript resolution, semantic capability analysis, compiler isolation, and CI mutation evidence are complementary layers. Merging one without the rest would overstate G0.
3. The work can still be bounded as internal worksets and coherent commits, allowing review by assurance layer without creating a partial merge train.
4. A new branch from current master prevents attempt 4 from becoming a fourth patch commit over the failed implementation.

Do **not** force-push or reset `feat/m0-g0-preflight`. Do not cherry-pick `7744fbcc`, `e917bde4`, or `fc5b79bf` into the replacement. The fresh Coder may read them and must port all closed behaviors into the new case table, but implementation starts from the contracts and the replacement architecture.

Proposed branch and worktree:

```text
branch:   feat/m0-g0-boundary-proof-v2
worktree: .worktrees/g0-boundary-proof-v2
base:     fefe20698b7769f65754173e6d4fabfa92b3b442
```

Open the replacement PR as draft while the internal worksets are incomplete. Mark it ready only after the one-authority and mutation gates pass. Once the replacement PR exists and its evidence links back to PR #32, close PR #32 as superseded without deleting its branch.

## Failed-head preservation protocol

Preservation happens **before** any PR #32 branch operation:

1. Reverify locally and remotely:

   ```sh
   git fetch origin --prune
   test "$(git rev-parse fc5b79bfc23b902069b0544d6c66944954df3cf7^{tree})" = a0a2a401adfc2a9aa64fc3f38c111138c7381432
   test "$(git merge-base fc5b79bfc23b902069b0544d6c66944954df3cf7 43519c27b9d3be25ab847734d6824f65e9fd2c20)" = 43519c27b9d3be25ab847734d6824f65e9fd2c20
   test "$(git rev-parse origin/feat/m0-g0-preflight)" = fc5b79bfc23b902069b0544d6c66944954df3cf7
   ```

2. Create and push a once-only annotated retention tag:

   ```text
   evidence/g0-pr32-attempt3-fc5b79b
   ```

   Its annotation must record commit, tree, merge-base, CI run `33044928321`, PR URL, and the two final report paths. Never move or delete this tag. Protect `evidence/**` tags against update/deletion if repository rules support it.

3. Create a local Git bundle rooted at the exact failed head and record its SHA-256 in an evidence manifest under this task folder. The manifest also records the remote tag object and peeled commit returned by `git ls-remote`. A Git ref is administratively movable; the content-addressed commit/tree plus bundle checksum makes movement detectable even if tag protection is unavailable.

4. Preserve these links in the replacement PR body: PR #32, exact failed commit/tree, run URL, final review, final audit, retention tag, and bundle checksum manifest.

5. After the tag and manifest are verified, make no further pushes to `feat/m0-g0-preflight`. Close PR #32 only as `superseded by <replacement PR>`; do not delete the remote branch.

The retention tag and evidence bundle are coordination artifacts, not acceptance of the failed guard.

## Attempt 4 task goal

Deliver one authoritative, mechanically fail-closed G0 boundary proof for CM-I41, CM-I43–I47, and CM-I50 that:

1. inventories every policy-relevant package, control path, source root, and source entry before analysis;
2. applies `@loredu/*`, testing-seam, package-subpath, environment-protocol, and package-edge law to the **syntactic module name before TypeScript resolution**;
3. extracts every current TypeScript module-reference form, including `ImportTypeNode`, and reports unclaimed/future reference syntax as uncertainty rather than silently omitting it;
4. uses checker symbols, lexical scope, and conservative flow facts for ambient capabilities and global-object aliases instead of file-wide names or one-pass alias strings;
5. preserves precise green controls for local bindings, labels, deterministic explicit-value time construction, and definitely overwritten mutable aliases;
6. uses `lstat`-first path classification, including dangling symlinks, for all required/optional source and control positions;
7. preserves every already-closed case in a table-driven corpus with exact diagnostics and an automated mutation ratchet;
8. is the only production boundary scanner and is explicitly selected by the full CI suite.

## Scope

### In scope and exact owned surfaces

The attempt-4 Coder owns only:

- `scripts/check-workspace-boundaries.ts` as the sole CLI/orchestrator;
- new internal modules under `scripts/workspace-boundaries/**` if needed to separate inventory, references, capabilities, manifests, and diagnostics;
- `tests/workspace-structure.test.ts` as the authoritative structural suite;
- new fixture/case support under `tests/support/workspace-boundaries/**` if needed;
- root `package.json` only for the single `check:boundaries` script and no other product dependency change;
- `.github/workflows/ci-required.yml` only for the explicit full-suite boundary invocation;
- `bun.lock` only if an already-approved dev-tool resolution requires it. The default plan adds no dependency and should not change the lockfile.

The entrypoint may be internally modular, but `scanWorkspace`/`check:boundaries` remains one authority and returns one stable `Violation` model. Tests may consume internal seams for deterministic fault injection; no package export or runtime product API is added.

### Out of scope

- all record/domain/application semantics;
- P0 implementation and every PR #33-owned file or catalog migration;
- M1 store behavior, CLI behavior, reconciliation, projection, and Working Lore;
- changing the three-package DAG or published export shape;
- changing allowed kernel time/random semantics;
- adding a runtime dependency to any package;
- claiming or moving any behavioral catalog T-number;
- changing docs/contracts merely to fit an implementation shortcut;
- dependency-cruiser adoption unless a stop condition below explicitly triggers a separately recorded tool decision;
- force-pushing master, rewriting PR #32 history, publishing, or release work.

### Domain-document impact

None is expected. This plan mechanizes existing ADR 0011/0012/0016 boundaries and changes no domain term, behavior, public API, or contract. If the Coder discovers that a currently legal source form must be banned, a package edge/export must change, or a new checker dependency is required, stop: that is no longer this implementation-only scope and needs the appropriate superseding decision before code.

## Revised Contract Matrix for G0

Classification vocabulary remains `IN_SCOPE`, `DEPENDENCY`, and `OUT_OF_SCOPE`; no G0 row is ambiguous after D0.

| Matrix row | Classification | Attempt-4 executable acceptance |
|---|---|---|
| CM-I41 | IN_SCOPE | Production module names are syntactically checked for `@loredu/kernel/testing` before aliases/resolution; resolved relative paths into any package `testing/` surface are also rejected. Only explicit package `testing/` and documented colocated `.test/.spec` files are tests; `src/testing` remains production. |
| CM-I43 | IN_SCOPE | Manifest DAG and every static source edge obey kernel ← store-plainfile ← CLI. Kernel bare externals are rejected generically. Syntactic `@loredu/*` package identity, unknown names, and exported subpaths are decided before resolver output, so `paths` cannot launder an edge. Relative and non-workspace aliases are then resolved and target-owned. |
| CM-I44 | IN_SCOPE | Kernel environment protocols/builtins, source directives, and ambient Bun/Node capabilities are rejected. Direct, aliased, destructured, computed, optional, shorthand, and globalThis-derived forms are covered; local symbols and inert property names are green. |
| CM-I45 | IN_SCOPE | Ambient `Date()`/`Date.now`/zero-or-uncertain-argument `new Date` and `Math.random` cannot execute or escape through aliases, `.call`, `.apply`, or unknown invocation. Explicit-value `new Date(value)`, `Date.parse`, deterministic `Math`, and definitely-clean reassigned aliases remain green. |
| CM-I46 | IN_SCOPE | Effective kernel config is exactly `types: []`, `lib: [ES2023]`; source-level `lib/types/path` widening is rejected; an actual kernel-project negative compile proves `node:fs`, Bun, process, and Buffer unavailable. Compiler and guard are complementary evidence. |
| CM-I47 | IN_SCOPE | All required package/source/control roots are regular expected kinds under an lstat-first policy; package exports are exact, order-independent maps to regular existing files; valid bundler resolution (`.js`→TS, declarations, index, configured non-workspace aliases) is accepted after syntactic law. |
| CM-I50 | IN_SCOPE | Discovery cannot throw or silently omit missing, unreadable, unsupported, symlinked, dangling, ignored-target, or unclassified policy paths. Exact table cases and deletion/omission mutants run under `bun test`; `check:boundaries` is explicit in the selected full CI suite and aggregate remains fail-closed. |
| D0 contracts/ADRs | DEPENDENCY, satisfied | `43519c2` and docs-only Instant clarification `fefe206` are the authority. No G0 contract edit. |
| PR #33 / P0 | DEPENDENCY for final merge-base validation, not an owned surface | G0 may be implemented in parallel, but final G0 evidence must run after rebasing/merging the accepted P0 master so new production kernel sources are discovered. Do not edit or cherry-pick PR #33. |
| Behavioral T-numbers | OUT_OF_SCOPE | G0 claims no catalog row and makes no `@covers` change. Structural case IDs are not T-numbers. |

## Replacement architecture and assurance map

The scanner is a pipeline with explicit layer outputs, not one recursive visitor that mixes policy, resolution, and flow.

| Layer | Mechanism | Proves | Must not claim |
|---|---|---|---|
| A. Filesystem inventory | One `lstat`-first path classifier; bounded recursive inventory; caught read/stat/parse failures | Inspectable package/source/control closure and deterministic diagnostics | Module or semantic safety |
| B. Manifest/syntactic package law | Parse package name/subpath/protocol directly from source text represented by AST nodes, before resolution | Unknown `@loredu/*`, private subpaths, testing seam, forbidden workspace edge, kernel environment protocol cannot be laundered by `paths` | Relative/non-workspace target ownership |
| C. TypeScript reference inventory and resolution | Central module-reference extractor plus TypeScript resolver for relative and non-workspace aliases | Current grammar coverage, static/dynamic certainty, target ownership, ignored/outside targets, valid bundler substitutions | Ambient-global capability use |
| D. Semantic capability analysis | Program/checker symbols plus lexical and forward-flow facts over bindings and assignments | Actual global vs local meaning, aliases/destructure/shorthand/call/apply, labels and reassignment controls | Filesystem/config closure |
| E. Compiler isolation | Effective config parse, directive ban, and actual project compile-negative fixture | No accidental ambient Node/Bun type environment | Package DAG by itself |
| F. Manifest/export policy | Exact workspace edge sets, kernel zero runtime dependencies, normalized exports and regular targets | Structural package contract | Source-level imports by itself |
| G. CI/corpus/mutation | Exact adversarial tables, real-tree clean test, check-ID accounting, mutants, full CI selector/aggregate | Guard remains invoked and represented rules are sensitive | Proof against untested future semantics; uncertainty must remain red |

A PR description and final report must map each matrix row to at least two independent layers where the ADR calls for complementary enforcement. In particular, compiler isolation does not excuse a scanner false green, and scanner detection does not excuse a widened kernel project.

## Layer A — lstat-first filesystem policy

Implement one total path-classification helper whose result distinguishes at least:

```text
absent | regular-file | directory | symlink | other | unreadable
```

`lstat`, not `existsSync` or `stat`, is the first operation for every policy path. A dangling symlink is therefore `symlink`, never `absent`. Do not call unchecked `lstatSync`, `realpathSync`, `readdirSync`, manifest reads, config reads, or program creation after a failed precondition.

Policy table:

| Position | Required state | Failure behavior |
|---|---|---|
| `packages/` | real readable directory, not symlink | exact `source-tree`; stop traversing that root, continue other independent checks |
| each known package root | real readable directory | exact `source-tree/package-location`; no throw |
| `src/`, CLI `bin/` | real readable nonempty directory | missing, symlink, dangling, file, special, unreadable all red |
| optional package `testing/` | true absence is allowed; if an entry exists it must be a real readable directory | dangling or non-dangling symlink, file, special, unreadable all red |
| package `package.json`, `tsconfig.json` | regular readable file, not symlink | exact control-file diagnostic; no parse attempt after classification failure |
| expected export targets | regular readable file in the expected package surface, not symlink | exact `package-exports` diagnostic |
| recursive source/test entries | real directories or supported regular source files | all symlinks, special files, unsupported executable/unknown extensions red |
| ignored `node_modules`, `dist`, hidden trees | not traversed as source; any resolved import into them is red | explicit ignored-target policy; never classified as same-package production |
| unclassified package entries | inspected by kind before skip/recursion | source/control-looking files and every symlink are red |

Use the same classifier for fixtures and real workspace. Add race-safe best-effort diagnostics: a path that changes between `lstat` and read becomes `unreadable/changed`, not a process crash.

## Layers B/C — module-reference law before resolution

### Ordered decision procedure

For every extracted module reference:

1. Require a statically known string where the grammar is required to be static. Otherwise emit `boundary-dynamic`/`boundary-ast-uncertain` and stop that reference.
2. Parse the raw syntactic specifier without consulting TypeScript resolution.
3. If it is `@loredu/*`, decide known package identity, testing seam, exact exported subpath, and allowed owner edge now. A configured `baseUrl/paths` target cannot override this result.
4. If kernel syntax names `node:*`, `bun:*`, a runtime-reported bare builtin/subpath, or another bare/scoped external, apply kernel policy now.
5. Only then resolve relative references and non-workspace aliases with the effective package compiler options.
6. Classify the resolved canonical target by inventoried package/surface, not merely path prefix. Reject outside-workspace, ignored-tree, test-surface, and forbidden cross-package targets.
7. Preserve valid TypeScript bundler forms: `.js`→`.ts`, `.mjs`→`.mts`, `.cjs`→`.cts`, declaration files, index resolution, and configured aliases that do not syntactically impersonate `@loredu/*`.

Required `paths` collision cases are unknown `@loredu/unknown`, kernel testing, private package subpath, kernel→store, store→CLI, and an allowed package edge. All are decided from syntax first even when every alias maps to an existing local file.

### Complete current reference extractor

One extractor owns all reference collection and source locations. At minimum its case table covers:

- `ImportDeclaration` including type-only imports and attributes;
- `ExportDeclaration` including type-only exports and attributes;
- `ImportEqualsDeclaration` with `ExternalModuleReference`;
- `ImportTypeNode`, including `type X = import("...").X` and `typeof import("...")`;
- dynamic `import(...)` with supported static attributes and non-static/arity uncertainty;
- ambient, unshadowed CommonJS `require(...)`, plus currently supported loader variants such as `require.resolve`/`module.require` if the pinned TypeScript source grammar permits them;
- TypeScript-supported JSDoc import tags if present in the pinned compiler AST;
- triple-slash `types`, `lib`, and `path` references as their own forbidden kernel class.

Locally bound `require` is a local call, not a module reference. Ambient declarations such as a string-named `declare module` are classified explicitly as declarations, not silently confused with imports.

For future uncertainty, use two defenses:

1. reconcile the extractor's claimed nodes with the pinned TypeScript source-file/preprocessing module-reference inventory; any inventory item without a claimed AST node emits `boundary-ast-uncertain`;
2. treat a TypeScript version change as an assurance change: it cannot merge unless the reference-kind inventory and parser corpus remain exhaustive. Never use a default visitor branch that simply ignores a new reference-bearing syntax kind.

The test corpus must prove `ImportTypeNode` violations for Node/builtin, adapter edge, testing seam, private subpath, and allowed controls.

## Layer D — symbol/scope/flow-aware capability analysis

Do not retain the attempt-3 `shadows` set or a `Map<Symbol,string>` populated once before visiting. Build a semantic analysis with these properties:

### Identity and lexical roles

- Bind locals by `ts.Symbol` and declaration scope. Resolve actual local parameters, imports, classes, functions, catch variables, and binding-pattern symbols through the checker.
- Treat unresolved kernel identifiers named Bun/process/Buffer as ambient forbidden value reads; local symbols with those names are green.
- Identify the real `globalThis` symbol and propagate a `GlobalObject` fact through parenthesized/as/non-null aliases.
- Classify identifier grammar roles. Labels and `break`/`continue` label references are never value reads. Ordinary property/method names are inert. Shorthand properties are both a key and a value read and must analyze the value.

### Capability fact lattice

Bindings and expressions carry a conservative set drawn from:

```text
GlobalObject
DateConstructor
DateNow
MathObject
MathRandom
BunGlobal
ProcessGlobal
BufferGlobal
Clean
UnknownCapabilityDerived
```

Facts propagate through direct aliases, literal computed/property access, destructuring (including renames/defaults), parenthesized/as/non-null expressions, and assignments. An unknown computed access on `GlobalObject`, or an escaped capability callable whose target cannot be proven, becomes `UnknownCapabilityDerived` and is rejected at its use/escape rather than treated as clean.

### Flow behavior

- Analyze statement order and assignment writes, keyed by symbol.
- `const` facts are stable.
- `let`/`var` facts update after definite assignments. `let d = Date; d = Math.max; d()` is green because the reaching fact at the call is definitely clean.
- Branches/loops join facts conservatively; if any reaching path retains a forbidden or unknown-derived capability, invocation/escape is red.
- Closures capture the joined fact valid at the closure boundary; do not assume a later mutable write is impossible.
- Destructuring assignments and compound/unknown writes invalidate or update affected facts.
- No analysis may use source-order precollection that lets a future/nested declaration hide an earlier or outer global.

### Forbidden sinks and green controls

Reject:

- any Bun/process/Buffer ambient value read, including globalThis alias, destructure, computed literal, optional chain, and object shorthand;
- `Date()` and direct/aliased `Date.now` invocation;
- zero-argument, missing-argument, spread-only, or otherwise uncertain `new Date` on the ambient constructor;
- direct/aliased `Math.random` invocation;
- indirect invocation through `.call`, `.apply`, optional calls, or an equivalent known call target;
- capability callables escaping into an unknown invocation/property/return where the guard can no longer prove the forbidden call cannot occur.

Keep green:

- explicit-value `new Date(value)` without uncertain spread;
- `Date.parse(value)` and deterministic Math operations;
- imported/local/parameter symbols named Date, Math, Bun, process, or Buffer;
- ordinary methods/properties/type names and label declarations/references;
- a mutable alias definitely overwritten with `Math.max` before call.

Required red cases include direct/parenthesized/optional/computed aliases; `const g = globalThis as any`; multi-hop `g["process"]`; globalThis destructures for all five roots; shorthand `{ process, Bun, Buffer }`; `d.now.call(d)`; `m.random.apply(m)`; unknown computed globalThis capability access; branch joins; and capability escape. Required green controls include labels and definitely-clean reassignment from the final reports.

If this flow model cannot be implemented with stable public TypeScript compiler APIs and explicit local dataflow, stop. Do not use undocumented checker internals or fall back to another finite regex/name patch.

## Layer G — table-driven adversarial corpus and mutation ratchet

### Corpus schema

Represent cases as data, not one-off tests. Each case has:

```text
id
matrixRows
assuranceLayer
fixtureMutation/source
expected exact Violation[]
pairedGreenControl
kills check IDs
provenance (attempt/report finding)
```

Diagnostics are compared as exact `{path, rule, detail}` objects including source location where applicable. Generic `toContain("ambient-capability")` is insufficient.

Groups:

1. `filesystem-discovery`
2. `manifest-exports-config`
3. `module-syntax-workspace-law`
4. `typescript-resolution`
5. `ast-reference-inventory`
6. `ambient-symbol-flow`
7. `compiler-isolation`
8. `ci-authority`

### Preserve the closed-case ledger

The replacement corpus must carry forward, with provenance IDs, all behavior already closed at `fc5b79bf`:

- nested supported source discovery and unsupported executable/unknown extensions;
- top-level packages/package-entry symlinks, unclassified symlinks, missing roots, unreadable directories, non-directory testing roots, and no-throw diagnostics;
- ignored `node_modules`/`dist` targets;
- unknown ordinary `@loredu/*` references, complete runtime builtins, generic kernel externals, relative DAG edges, and testing seams;
- `.js` substitution, `.d.ts`, index, configured non-workspace aliases, and outside/unresolved target controls;
- static imports/exports/import-equals/import calls/require, comments/inert text, import attributes, and dynamic uncertainty;
- triple-slash lib/types/path widening;
- direct/computed/optional aliases already represented for Date/Math/Bun/process/Buffer and local parameter/method controls;
- exact export maps, swapped/missing/extra/condition/array/wildcard forms, missing targets, and key-order independence;
- effective inherited compiler options and actual kernel-project negative compile;
- parent paths containing spaces or a `tests` segment;
- real workspace cleanliness and full-suite CI ownership.

Do not use the old `55 tests / 166 assertions` count as a minimum because table parameterization can change test count. Instead maintain a case manifest: every carried-forward semantic case must have a stable case ID, and meta-tests must fail if an ID is missing, duplicated, lacks an exact expectation, or lacks a provenance/Matrix mapping.

### New mandatory cases

Add exact red/green pairs for:

- syntactic `@loredu/*` law under colliding `paths` mappings;
- every `ImportTypeNode` package/environment/seam outcome;
- extractor/preprocessor inventory mismatch and pinned-TypeScript upgrade uncertainty;
- globalThis aliases, all requested destructures, literal/unknown computed properties, and shorthand reads;
- `.call`/`.apply`, optional/indirect invocation, capability escape, and branch joins;
- labels, definitely overwritten mutable aliases, and local/imported symbol controls;
- dangling `testing` symlink and symlinked/malformed package.json, tsconfig, and export target control paths;
- true optional testing-root absence as green;
- changed-between-inspection/read errors as deterministic red where safely fixtureable.

### Automated mutation ratchet

Give each policy check/stage a stable internal check ID. Test-only fault injection may disable one check/stage without changing the normal CLI defaults. The meta-suite must:

1. account for every check ID in at least one red case and a neighboring green control;
2. disable each check ID in turn and prove its assigned exact violation disappears or changes, thereby killing the mutant;
3. kill whole-layer omission mutants for inventory, syntactic workspace policy, resolver target classification, AST reference extraction, capability flow, manifest/exports, and compiler isolation;
4. fail if a mutant survives, a case only passes because of an unrelated violation, or normal production invocation can disable checks.

Fault injection is internal dev-tool/test support, not a package export. The final evidence reports `mutants killed N/N` and lists check IDs, not only a hand-run sample.

## Bounded internal worksets and commits

One fresh Coder owns all worksets serially. Specialists may review designs, but do not split implementation ownership by file or open stacked PRs.

### W0 — preservation and executable case contract

- Preserve attempt 3 using the tag/bundle protocol.
- Create the new worktree from `fefe206`.
- Translate every prior finding and closure into the case manifest before implementation.
- Run the mandatory new cases against the archived attempt-3 scanner and retain the expected false-green/false-red log in the task evidence.
- No repository implementation commit is required for W0.

**Exit:** case ledger accounts for all prior reports and all new mandatory cases; old head demonstrably fails the new blocker cases.

### W1 — total filesystem inventory and policy model

- Introduce the single guard entrypoint/internal policy modules.
- Replace overlapping structural scanning assertions atomically; tests call the one guard.
- Implement lstat-first inventory, manifests/control path kinds, source/test surfaces, and stable diagnostics.
- Add filesystem tables and check-ID mutants.

**Commit intent:** `refactor(ci): build total workspace boundary inventory`

**Exit:** no filesystem fixture throws; dangling and control-file symlinks are red; prior discovery cases remain represented.

### W2 — syntactic module law and complete reference inventory

- Implement central extractor, syntax-first `@loredu/*` and kernel package/protocol rules, future uncertainty reconciliation, and only then TS resolution.
- Add ImportTypeNode/path-collision/current grammar tables and reference mutants.

**Commit intent:** `feat(ci): enforce syntax-first module boundary law`

**Exit:** every FR-G0-01/02 case and every prior module/resolution case passes; no configured path can launder workspace identity.

### W3 — semantic ambient capability flow

- Implement symbol/scope/flow facts and sinks.
- Add globalThis/destructure/shorthand/call/apply/labels/reassignment/branch/escape tables and mutants.
- Delete all finite alias precollection or textual capability fallback.

**Commit intent:** `feat(ci): prove ambient capabilities by symbol and flow`

**Exit:** FR-G0-03/04 and final-test F-G0-01/02 are closed with paired controls; no checker-private API.

### W4 — compiler, mutation, authority, and fan-in

- Complete effective config/directive/negative compiler evidence.
- Complete normalized manifests/exports and all layer mutants.
- Wire exactly one root command and one explicit workflow step.
- Prove no duplicate scanner remains.
- Integrate accepted current master/P0, run full local evidence, push, and obtain exact-head CI.

**Commit intent:** `test(ci): ratchet authoritative boundary assurance`

**Exit:** all acceptance, mutation, full-suite, exact-head CI, and one-authority checks pass.

Commits should be coherent and cumulative-green for their declared workset. Do not leave a red test commit as a PR tip. The replacement PR is not mergeable until W4; internal green does not imply partial G0 acceptance.

## Dependencies, base, and merge order

1. **Immediately:** preserve attempt-3 evidence, then branch attempt 4 from `origin/master@fefe206`.
2. **Parallel execution:** attempt-4 implementation may run while PR #33/P0 is independently reviewed. It must not edit, amend, or provide fixes to PR #33.
3. **P0 merge:** merge PR #33 first only after its own exact-head approval. This follows the original D0 → P0 → G0 order and gives G0 real P0 production source to inventory.
4. **G0 fan-in:** before first replacement-PR push if possible, rebase the unpublished local G0 commits onto the new master. Once the branch is published, do not force-push; merge current master into it. Resolve the expected root `package.json` coexistence by retaining both P0's root kernel workspace dependency and G0's `check:boundaries` script. That resolution belongs only to G0 after P0 merges, not to PR #33.
5. If master advances docs-only, integrate it and rerun docs/full gates. If master changes any owned G0 surface, package topology, compiler config, source roots, or CI composition, stop for dependency review rather than casually resolving it.
6. **Replacement merge:** merge G0 only after independent Tester and Reviewer approve the same exact head/tree/merge-base and the new exact-head `ci-required` is green.
7. Later M0 R1/R2/P1 work remains blocked at the original P0+G0 fan-in.

If PR #33 is delayed, G0 can reach ready-for-review on `fefe206`, but final acceptance/merge evidence must be refreshed against the actual intended master. No claim in this replan changes PR #33.

## Required evidence and acceptance

### Local evidence on final candidate

From a fresh worktree/install:

```sh
bun install --frozen-lockfile
bun run lint
bun run spell
bun run check:docs
bun run check:catalog
bun run check:gates
bun run check:boundaries
bun run typecheck
bun test tests/workspace-structure.test.ts
bun test
bun run build && ./packages/cli/dist/lor --version
git diff --check <merge-base>..<head>
```

Additionally record:

- exact head, tree, merge-base, current master, and changed-file list;
- corpus case counts by assurance group and 100% case-manifest accounting;
- `mutants killed N/N` with every check ID;
- actual kernel compiler negative diagnostics for `node:fs`, Bun, process, and Buffer;
- exact expected diagnostics for every prior open finding;
- real-workspace `scanWorkspace` clean after P0 source is present;
- grep/static evidence that only one implementation owns boundary scanning and only one root script invokes it;
- no behavioral `@covers` additions and unchanged catalog accounting except independent P0 changes already on master.

### GitHub CI evidence

The replacement is a code-change PR, so selector must choose the full workspace suite. Acceptance requires:

- selector success;
- workspace suite success, including explicit `workspace boundaries` step;
- docs-only suite correctly skipped;
- aggregate `ci-required` success under `if: always()`;
- all required jobs bound to the exact final head;
- CI URL and run ID in the final report.

A green run on `fc5b79bf` or any superseded replacement head is historical only.

### Independent assurance

Route two fresh roles after Coder completion:

1. **Tester:** reruns the exact corpus and mutation ratchet, then invents at least one novel adversarial probe in each of filesystem, module-reference, and ambient-flow layers. The probes must not be copied from the committed case table.
2. **Reviewer:** reviews policy ordering, symbol/flow soundness, one-authority ownership, and Matrix/evidence mapping; independently verifies failed-head preservation and exact-head CI.

Both must report against the same exact head/tree. No `DONE` may be inferred by combining a review of one head with tests from another.

## Catalog impact

- G0 implements repository architecture assurance, not user-visible behavioral catalog rows.
- Add no `@covers Txx` marker.
- Move no row in `docs/v0.x/execution/catalog-status.json`.
- `check:catalog` must remain green. Any catalog changes seen after P0 merges are PR #33 history and must not be modified by G0.
- Structural case IDs use a `G0-*` namespace and must never resemble T-numbers.

## Stop and escalation conditions

Stop without merging if any of these occurs:

1. any known closed case from attempts 1–3 is dropped, weakened to substring assertions, or regresses;
2. syntactic workspace decisions are still downstream of TypeScript resolver output;
3. an AST/preprocessor module reference is unclaimed, ImportTypeNode is omitted, or a TypeScript upgrade changes the reference inventory;
4. ambient analysis depends on file-wide shadow names, immutable one-pass aliases, regex fallback, checker private APIs, or cannot conservatively join branches/writes;
5. a dangling/control/source symlink is treated as absence, or a fixture can throw out of the scanner;
6. two scanners, two CI commands, or a structural test with independent policy logic remain;
7. a new runtime dependency, package edge, package export, allowed capability, contract, domain behavior, T-number, or PR #33 edit is proposed;
8. final master changes an owned G0/code surface and the impact has not been reclassified;
9. any P1 false green or false red remains, any P2 filesystem/authority false green remains, either fresh role rejects the exact head, or CI is not exact-head green;
10. preservation tag/bundle/manifest is missing or does not peel/checksum to `fc5b79bf` and tree `a0a2a401`.

A single review defect may be repaired within attempt 4 only if it is expressible as a missing table row in an already-declared abstraction and the generalized fix adds no special-case policy branch. Add the red/green pair and mutant first, then repair and rerun both independent roles. Escalate back to replanning instead of patching when a defect requires a new assurance layer, changes the policy order/fact lattice, yields two or more P1 findings in one review, or survives the declared mutation model.

If stable public TypeScript APIs cannot support the required reference or flow proof, stop and route issue #18's checker/tool spike. Any dependency-cruiser/compiler-plugin/ESLint adoption requires a separately recorded tool decision and is not an in-attempt fallback.

## Attempt-4 completion checklist

- [ ] Attempt-3 annotated evidence tag pushed and verified; bundle checksum manifest retained.
- [ ] New branch/worktree starts at `fefe206`; no failed implementation commit cherry-picked.
- [ ] Fresh Coder owns W0–W4 serially.
- [ ] One guard/orchestrator and one stable violation model.
- [ ] Lstat-first policy covers all source/control roots and dangling symlinks.
- [ ] Syntactic workspace law precedes all resolution.
- [ ] Central extractor covers ImportTypeNode and reports future/unclaimed uncertainty.
- [ ] Symbol/scope/flow capability analysis closes globalThis, destructure, shorthand, call/apply, labels, and reassignment cases.
- [ ] Every prior closed semantic case has a case ID/provenance/Matrix mapping.
- [ ] Every check ID is killed by the automated mutation ratchet.
- [ ] No domain, P0, PR #33, public API, or catalog behavior changed.
- [ ] PR #33 accepted/merged independently; G0 refreshed against current master/P0.
- [ ] Full local command sequence and build smoke green.
- [ ] Fresh Tester and Reviewer approve the same exact head/tree.
- [ ] New exact-head GitHub `ci-required` green.
- [ ] PR #32 closed only after replacement link exists; old branch retained.

## Result protocol

- **status:** `READY_FOR_ATTEMPT_4`
- **summary:** Replace PR #32's finite patched analyzer with a clean, layered, syntax-first and flow-aware boundary proof on a new current-master branch. Preserve the failed head by immutable-by-policy tag plus content-addressed bundle evidence; keep one PR and one guard, but execute five bounded internal worksets under one fresh Coder.
- **attempt_count:** `3`
- **next_attempt:** `4`
- **attempt_limit:** `20`
- **replan_count:** `1`
- **caused_by:** repeated G0 boundary-analysis false-green/false-red class after ownership-changed attempt 3
- **recommended_next_role:** fresh Coder for W0–W4, then fresh Tester and Reviewer
- **inputs_needed:** none
