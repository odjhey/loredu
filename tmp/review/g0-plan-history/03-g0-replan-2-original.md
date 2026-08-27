# Loredu G0 material replacement replan 2

**Task:** `loredu-g0-replanner-2--01M114QXHW7RS0KY190TGBN527`  
**Disposition:** `READY_FOR_ATTEMPT_6`  
**Planning base:** `master@612ddcb0f23d0177b806942f89a158c50267b926`  
**Attempt state:** 5 failed; next implementation attempt 6; attempt limit 20  
**Replan state:** replan 2 of 4  
**Rule:** this artifact plans work only. It does not implement, merge, claim no-mistakes, or claim a human gate.

## 1. Decision and failure custody

PR #35 is retired as historical evidence. It is **not** a repair line and no valid slice is extracted from its implementation commits. The replacement is a clean stacked series rooted at `master@612ddcb0`; workers may read PR #35 but may not cherry-pick or amend it. PR #32 and PR #35 branches remain preserved and are never force-pushed or deleted.

Attempt-5 evidence was preserved before this plan:

- retention ref: `refs/tags/evidence/g0-pr35-rejected-a945521-attempt5`
- annotated tag object: `4407b365f4d09ad42eca0b36295bf9e0b69b00c4`
- peeled commit: `a945521af7d3a8415f071322b577be6865f9ed8f`
- tree: `06c42f72db78d83e084b39b4c281a59ab7929335`
- merge-base: `612ddcb0f23d0177b806942f89a158c50267b926`
- exact-head CI: `33052334867` (green, historical only)
- task-local bundle: `evidence/g0-pr35-attempt5-a945521.bundle`
- bundle SHA-256: `6b08ae21c8bc67327b3f64f340cf8ffdfd18e08b821e08877d821f1e369ff7e1`
- manifest: `evidence/preservation-manifest.md`

The existing PR #32 tag/bundle and PR #35 attempt-4 tag/bundle are also historical custody evidence. A replacement PR body must link all three generations, the exact failed heads/trees, CI runs, and manifests.

### Why the old architecture is rejected

Fresh Tester and Reviewer both found exact-head false greens despite green local gates, 61 focused tests, 72 full tests, and CI:

| Failed area | Observed false green/false red on `a945521` | Replacement owner |
|---|---|---|
| Capability flow | closure-before-alias ordering, exported `Date.now` aliases, unknown-computed `globalThis`, escape sinks, and branch/write behavior were not conservatively closed | D |
| Static references | aliased `require`, `require.resolve`, `module.require`, and valid JSDoc import-from forms were not all claimed | B/C/E |
| Config graph | missing project references, `extends: null`, malformed `paths`, and malformed `references: [null]` could pass or throw; package control closure was incomplete | A/F |
| Filesystem totality | absent and unreadable states were conflated; control-path symlink/error behavior was incomplete | A/F |
| Evidence | duplicate/missing/stale ledger mutations were not all rejected; green mutants could be explained by unrelated violations | G1/G2 |
| Authority | green CI proved invocation, not that every real stage was mutated before execution | G2/final integration |

The decomposition below replaces these models, rather than adding cases to one monolithic visitor.

## 2. Frozen shared contract (must land before slices)

A0 is a contract-lock slice, not a boundary acceptance slice. It creates one internal contract module and one case schema; it does not wire a root command or claim that any policy is implemented.

### Frozen internal interfaces

The following are internal to `scripts/workspace-boundaries/**` and test support. They are not package exports, product APIs, or permission to alter the domain contracts.

```ts
type PathKind =
  | "absent"
  | "regular-file"
  | "directory"
  | "symlink"
  | "other"
  | "unreadable";

interface Violation {
  readonly path: string;     // root-relative, portable separators
  readonly rule: string;     // stable rule name
  readonly detail: string;   // exact stable detail, including location if needed
}

interface InventoryEntry {
  readonly path: string;
  readonly kind: PathKind;
  readonly readable: boolean;
  readonly policySurface:
    | "workspace"
    | "package"
    | "source"
    | "test"
    | "control"
    | "ignored"
    | "unknown";
}

interface WorkspaceInventory {
  readonly root: string;
  readonly entries: readonly InventoryEntry[];
  readonly packages: readonly PackageInventory[];
  readonly violations: readonly Violation[];
}

interface PackageInventory {
  readonly name: "kernel" | "store-plainfile" | "cli";
  readonly root: string;
  readonly sourceRoots: readonly string[];
  readonly controlFiles: readonly string[];
  readonly testRoots: readonly string[];
  readonly ignoredRoots: readonly string[];
}

interface ConfigGraph {
  readonly nodes: readonly ConfigNode[];
  readonly edges: readonly ConfigEdge[];
  readonly violations: readonly Violation[];
}

interface ModuleReference {
  readonly sourcePath: string;
  readonly syntax:
    | "import"
    | "export"
    | "import-equals"
    | "import-type"
    | "dynamic-import"
    | "require"
    | "require-resolve"
    | "module-require"
    | "jsdoc-import"
    | "triple-slash";
  readonly specifier: string | undefined;
  readonly isStatic: boolean;
  readonly start: number;
  readonly end: number;
}

interface CapabilityFacts {
  readonly possible: ReadonlySet<
    | "GlobalObject"
    | "DateConstructor"
    | "DateNow"
    | "MathObject"
    | "MathRandom"
    | "BunGlobal"
    | "ProcessGlobal"
    | "BufferGlobal"
    | "Clean"
    | "UnknownCapabilityDerived"
  >;
}

interface CaseSpec {
  readonly id: string;                    // G0-*; never T-numbers
  readonly matrixRows: readonly string[];
  readonly assuranceLayer: "A" | "B" | "C" | "D" | "E" | "F" | "G1" | "G2";
  readonly fixtureMutation: FixtureMutation;
  readonly expected: readonly Violation[]; // literal, exact, independently authored
  readonly pairedGreenControl: string;
  readonly killsCheckIds: readonly BoundaryCheckId[];
  readonly provenance: readonly string[];
}
```

The actual implementation may add private representation fields, but the stage boundaries and the observable `Violation` shape above are frozen. Stages consume typed outputs, never re-scan source or reinterpret another stage's result.

### Frozen production check IDs

This exact set is closed; no worker may rename, remove, split, or add a production check ID:

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

G1/G2 assurance controls have separate fixed names and are not scanner policy IDs:

```text
G0-G1-CASE-LEDGER
G0-G1-PROVENANCE
G0-G2-MUTATION-INJECTION
G0-G2-WATCHDOG
G0-G2-AUTHORITY
```

The only test mutation input is an internal, test-only `ScanMutation` that disables a stage at its execution branch before the stage runs. It cannot be passed by the normal CLI or root script. There is no output-filtering mutation path.

### Frozen matrix and vocabulary

- **CM-I41:** package testing seam and test-surface law.
- **CM-I43:** package DAG, kernel zero runtime dependencies, and static edge ownership.
- **CM-I44:** environment protocols, builtins, directives, and ambient Bun/Node capability reads.
- **CM-I45:** ambient time/randomness invocation, aliasing, indirect invocation, and escapes.
- **CM-I46:** effective kernel compiler isolation and negative compile proof.
- **CM-I47:** source/control/export path inventory and valid resolver target classification.
- **CM-I50:** total discovery, no throw/silent omission, one authority, CI selection, mutation and watchdog authority.

Reference vocabulary is frozen to the `ModuleReference.syntax` values above. Capability vocabulary is frozen to the ten facts above. Config graph semantics are frozen to explicit graph nodes/edges/violations, not ad hoc resolver success.

## 3. Contract status and decision gate

All workers must classify facts as `IN_SCOPE`, `OUT_OF_SCOPE`, `DEPENDENCY`, or `AMBIGUOUS`. `AMBIGUOUS` means `NEEDS_DECISION`, not permission to choose locally.

The following are the only known decision gates:

1. **Pinned TypeScript loader grammar:** the exact pinned-TypeScript AST/preprocessor inventory for `require.resolve`, `module.require`, and JSDoc import-from tags must be recorded before B/C/E. The guard must cover every supported form and emit uncertainty for future/unclaimed forms.
2. **Config graph malformed-shape policy:** required package `package.json`/`tsconfig.json`, `extends`, `references`, `compilerOptions.paths`, and recursive targets must be explicitly classified fail-closed before A/F. In particular, `null`, arrays where objects are required, non-string paths, missing targets, cycles, unreadable targets, and dangling symlinks cannot be silently delegated to TypeScript.
3. **Reference/extends scope:** whether every package config reference must remain inside the workspace and which TypeScript-supported config substitutions count as a valid control target must be settled against the governing G0 matrix, not inferred from a successful compiler call.

A contract steward must resolve these from existing ADRs/TypeScript pinned behavior (and write a superseding decision record if a public/contractual choice is actually missing) before implementation. No slice may modify domain docs or change a package/API contract to avoid the gate.

## 4. Replacement slices

The following are stacked replacement PRs. Every branch starts from `master@612ddcb0` by ancestry; a child may be based on the preceding replacement branch for review, but no branch starts from PR #35 and no PR claims final G0 until the final integration slice.

### Slice A0 — shared boundary contracts and case schema

**Goal**

Freeze the stage interfaces, eight production check IDs, matrix vocabulary, exact diagnostic form, mutation contract, and fixture-grounded case schema. Establish the ledger accounting rules without pretending that a test of the schema is a test of the scanner.

**Exact owned surfaces**

- new `scripts/workspace-boundaries/contracts.ts`;
- new `tests/support/workspace-boundaries/case-schema.ts`;
- new `tests/support/workspace-boundaries/fixture-operations.ts`;
- no root `package.json` script, workflow step, production entrypoint, or package file;
- no edits to `packages/**`, `docs/**`, or catalog status.

**Matrix/contracts**

- `CM-I41`, `CM-I43`, `CM-I44`, `CM-I45`, `CM-I46`, `CM-I47`, `CM-I50` as vocabulary only;
- ADR 0011, ADR 0012, ADR 0016; accepted replan-1 frozen contract;
- no product contract change.

**Invariants**

- `IN_SCOPE:` typed stage boundaries; portable exact violations; eight closed IDs; fixture operations that mutate real files/sources; case IDs/provenance/paired controls.
- `OUT_OF_SCOPE:` scanner policy, TypeScript resolution, capability analysis, CI selection, package manifests, runtime kernel, behavioral T-numbers.
- `DEPENDENCY:` pinned TypeScript version and current `master@612`; the preservation manifest; governing matrix and ADRs.
- `AMBIGUOUS / NEEDS_DECISION:` unresolved loader inventory or config malformed-shape semantics. The slice can encode a decision placeholder, but cannot make a policy choice.

**Dependencies/parallelism/merge**

First. Nothing depends on implementation; A/F, B/C/E, D, and G1 can branch after A0. A0 must merge before any stage module is treated as consuming shared output.

**Expected tests/review**

Schema tests reject duplicate IDs, unknown matrix rows, unknown layer/check IDs, empty provenance, missing exact expected arrays, missing paired controls, and non-fixture mutations. Review confirms that no helper imports or invokes the scanner and that `CaseSpec.expected` is not derived from scanner output.

### Slice A/F — lstat-first inventory, manifests, exports, and total config graph

**Goal**

Produce a total, deterministic inventory and control graph before any semantic analysis. Own all path/control closure and the exact manifest/export/config facts consumed by later stages.

**Exact owned surfaces**

- new `scripts/workspace-boundaries/inventory.ts`;
- new `scripts/workspace-boundaries/config-graph.ts`;
- new `scripts/workspace-boundaries/manifest-model.ts`;
- new fixture support under `tests/support/workspace-boundaries/filesystem-fixtures.ts`;
- A/F-focused case data only; no root command or CI wiring;
- no edits to `scripts/check-workspace-boundaries.ts` beyond a type-only seam if unavoidable (prefer none).

**Matrix/contracts**

- `CM-I47`, `CM-I50` primarily;
- `CM-I43` for manifest edge facts;
- `CM-I46` for config effective-input facts;
- `PathKind`, `InventoryEntry`, `WorkspaceInventory`, `PackageInventory`, `ConfigGraph` frozen interfaces;
- exact package/source/control roots and export expectations already defined by accepted replan-1.

**Invariants**

- `IN_SCOPE:` `lstat` as first operation for every policy path; absent vs unreadable vs symlink vs dangling symlink; package/source/testing roots; all package manifests and tsconfigs; recursive `extends`/`references`/`paths`; ignored/hidden/dist/node_modules classification; exact export map shape and regular targets; cycles/missing/unreadable/malformed config diagnostics; no throw.
- `OUT_OF_SCOPE:` module specifier classification, TypeScript source resolution, ambient capability meaning, CI invocation, mutation implementation, product packages.
- `DEPENDENCY:` A0 contracts; current three-package topology; pinned compiler options; P0's actual files on final integration.
- `AMBIGUOUS / NEEDS_DECISION:` config malformed shapes, config-reference boundary, and any source extension not in the frozen policy. Stop rather than default to TypeScript's permissive behavior.

**Required behavior**

`lstat` failure returns a deterministic `unreadable`/changed diagnostic; it is never converted to `absent`. A dangling symlink is always `symlink`. No `readFile`, `realpath`, `readdir`, JSON parse, or compiler program creation follows a failed required classification. Optional `testing/` is green only when truly absent; any symlink/file/special/unreadable entry is red. Every discovered unclassified symlink or source/control-looking entry is red. Config graph traversal is total and bounded, reports cycles, and validates all shapes before dereference.

**Red/green controls**

Red: missing/read-failed package/source/control roots, file where directory expected, dangling or ordinary symlink at every control/root/export position, malformed JSON, `extends: null`, malformed `paths`, `references: [null]`, missing reference/extends target, cycle, ignored-target resolution, hidden source-looking entry, special/unsupported file. Green: true optional-testing absence, regular valid controls, nested supported source, order-independent export keys, valid non-workspace alias, ordinary parent path containing `tests` or spaces.

**Dependencies/parallelism/merge**

Branch after A0. B/C/E consumes its `WorkspaceInventory` and `ConfigGraph`; D can implement in parallel after A0 but integrates after B/C/E. G1 can assemble A/F cases in parallel. Merge A/F before B/C/E and before final orchestrator.

**Expected tests/review**

Table-driven filesystem/config tests use actual temporary trees and injected stat/read failures, not mocked scanner outputs. Reviewer checks one classifier is used for fixtures and real workspace, bounded traversal, no unchecked filesystem calls, complete graph edge accounting, and exact diagnostics.

### Slice B/C/E — syntax-first workspace law, complete references, compiler isolation, and export law

**Goal**

Classify the raw syntactic module name before resolution, inventory every current static reference form, then resolve only permitted relative/non-workspace forms against the A/F graph. Prove compiler isolation independently and validate exports without allowing `paths` or resolver success to launder package identity.

**Exact owned surfaces**

- new `scripts/workspace-boundaries/syntax-law.ts`;
- new `scripts/workspace-boundaries/module-references.ts`;
- new `scripts/workspace-boundaries/resolution.ts`;
- new `scripts/workspace-boundaries/compiler-isolation.ts`;
- new `scripts/workspace-boundaries/export-law.ts`;
- B/C/E fixture and case data;
- no mutation/CI root wiring; no capability-flow module.

**Matrix/contracts**

- `CM-I41`, `CM-I43`, `CM-I44`, `CM-I46`, `CM-I47`;
- `ModuleReference` frozen vocabulary; `Violation`; A/F inventory/config graph;
- `@loredu/*` identity and testing-seam law must precede TypeScript resolution;
- effective kernel `types: []`, `lib: [ES2023]`, source directive ban, and actual negative compile.

**Invariants**

- `IN_SCOPE:` imports/exports/type-only forms/import-equals/`ImportTypeNode`/dynamic imports/static require and loader variants/JSDoc forms/triple-slash references; static-vs-dynamic uncertainty; syntax-first package identity; all builtins and generic kernel externals; valid `.js`→TS/`.mts`/`.cts`/declaration/index/bundler aliases; outside/ignored/test target ownership; exact export maps and regular targets; compiler negative proof.
- `OUT_OF_SCOPE:` ambient value dataflow, filesystem classification implementation, record/domain behavior, dependency-cruiser, new runtime dependencies, product package edges.
- `DEPENDENCY:` A0 and A/F graph; pinned TypeScript AST/preprocessor behavior; existing manifest topology.
- `AMBIGUOUS / NEEDS_DECISION:` any loader/JSDoc node not in the pinned inventory; any TypeScript version change; any non-static dynamic/loader grammar not explicitly classified. Emit `boundary-ast-uncertain` and stop that reference until resolved; never silently ignore it.

**Required ordering and extraction**

For each reference: establish static string/uncertainty; inspect raw syntax; classify `@loredu/*`, kernel protocol/builtin, external, testing seam, private subpath, and package edge; only then invoke TypeScript resolution; finally classify the canonical target using A/F ownership. The extractor must claim import/export declarations, type-only references, import-equals, `ImportTypeNode`, dynamic imports, ambient unshadowed `require`, `require.resolve`, `module.require`, supported JSDoc import tags, and triple-slash `types`/`lib`/`path`. Locally bound `require` is not a loader reference. A reconciliation test compares extractor claims with the pinned compiler/preprocessor inventory.

**Red/green controls**

Red: `@loredu/unknown`, private subpath, testing seam, kernel→adapter and adapter→CLI, every environment builtin, kernel external, `ImportTypeNode` variants, loader/JSDoc aliases, dynamic non-static uncertainty, path-collision laundering, ignored/test/outside target, malformed export map/condition/array/wildcard/missing target, widened compiler config/directive, negative compile failure. Green: allowed edges, configured non-workspace aliases, `.js` substitutions, declarations/index, type-only allowed local imports, locally bound `require`, inert comments/text, valid JSDoc control, exact exports with reordered keys.

**Dependencies/parallelism/merge**

Branch after A0; implementation can proceed in parallel with D, but B/C/E review consumes A/F and the merge order is A/F → B/C/E → D → integration. Do not wire a partial root scanner. Merge only when its stage tests and the complete extractor inventory are green.

**Expected tests/review**

Reviewer traces a path-collision fixture and proves no resolver call precedes syntax law. Tester adds a novel `ImportTypeNode` and a novel loader/JSDoc form outside the committed table. Both verify no regex/text fallback and no omitted AST/preprocessor node.

### Slice D — conservative capability dataflow/fixpoint and escape sinks

**Goal**

Replace file-wide name sets and one-pass aliases with symbol-aware, lexical, statement-ordered, conservative CFG dataflow that reaches a fixpoint over branches/backedges and rejects forbidden capability use or escape.

**Exact owned surfaces**

- new `scripts/workspace-boundaries/capability-flow.ts`;
- new `scripts/workspace-boundaries/capability-facts.ts`;
- new D fixture/case data under test support;
- no changes to package code, A/F/B/C/E modules, root command, or workflow.

**Matrix/contracts**

- `CM-I44`, `CM-I45`, and complementary `CM-I46` compiler evidence;
- frozen ten-fact capability vocabulary and `CapabilityFacts` interface;
- stable public TypeScript checker APIs only; no checker-private internals.

**Invariants**

- `IN_SCOPE:` checker symbols/declaration scopes; ambient vs local/imported/parameter names; globalThis aliases; direct, computed, optional, shorthand, destructured, parenthesized/as/non-null aliases; assignment order; branch/loop/backedge joins and fixpoint; closures/recursive functions; call/apply/optional/indirect invocation; return/export/property/array/spread/destructure/conditional/unknown-call escapes; explicit-value Date and deterministic Math controls.
- `OUT_OF_SCOPE:` module extraction/resolution, manifest/config/filesystem closure, CI watchdog, product capability ports, changing allowed kernel time/random contracts.
- `DEPENDENCY:` A0 fact lattice; pinned TypeScript checker; final source inventory from A/F; no need to depend on B/C/E semantics except final integration.
- `AMBIGUOUS / NEEDS_DECISION:` any expression whose checker meaning cannot be established with stable public APIs. It must become `UnknownCapabilityDerived`/red or stop for a tool decision; it may not be treated as clean or solved with a regex list.

**Frozen flow rules**

Facts are sets of possible values with `Clean` and `UnknownCapabilityDerived`; joins union possibilities. The analysis is statement ordered and iterates to a fixpoint for loops/backedges. A future declaration cannot hide an earlier ambient read. `const` facts remain stable; mutable facts update only on definite writes and join conservatively. A closure captures the fact at its boundary; later mutation cannot retroactively clean an already escaped capability. Unknown computed global-object access and unknown callable capability are red.

Reject ambient Bun/process/Buffer reads; `Date()`; `Date.now`; uncertain/zero-argument/spread-only `new Date`; `Math.random`; known capability calls through `.call`/`.apply`/optional calls; and any capability escape where the guard cannot prove safety. Keep green explicit-value `new Date(value)`, `Date.parse`, deterministic Math, local/imported/parameter symbols with reserved names, labels, ordinary properties/type names, and a mutable alias definitely overwritten with `Math.max` before the call.

**Red/green controls**

Red includes closure-before-alias, exported `now` by named/default/aggregate export, all five globalThis destructures, multi-hop literal and unknown computed properties, shorthand reads, `d.now.call(d)`, `m.random.apply(m)`, branch joins, loop backedges, recursion, return/property/array/spread/unknown-call escapes, and tainted→clean/clean→tainted paths. Green includes labels, method/property names, imported/local shadowing, explicit values, deterministic Math, definitely-clean reassignment, and allowed capability ports.

**Dependencies/parallelism/merge**

Implementation may run parallel with B/C/E after A0. It merges after B/C/E so final integration can prove the one pipeline and after its own independent dataflow review. No D implementation may alter shared lattice vocabulary.

**Expected tests/review**

Tester must invent novel nested loop/backedge, closure ordering, and escape probes not copied from the case table. Reviewer inspects CFG join/fixpoint termination, symbol identity, declaration order, all sink categories, and public-API usage. Any finite alias/name fallback is a rejection.

### Slice G1 — complete stable case ledger and provenance

**Goal**

Make the adversarial corpus a fixture-grounded, exact expectation ledger that accounts for every prior closure and every new blocker. It must detect missing, duplicate, stale, unpaired, unproven, and unrelated-violation cases.

**Exact owned surfaces**

- new `tests/support/workspace-boundaries/case-ledger.ts` and grouped case tables;
- new `tests/workspace-boundaries-ledger.test.ts` (or equivalent central test file);
- provenance manifest under task/test support, not a prose-only report;
- no scanner policy changes and no root CI wiring.

**Matrix/contracts**

- all `CM-I41`, `CM-I43`–`CM-I47`, `CM-I50` rows;
- `CaseSpec`, frozen IDs, exact `Violation[]`, paired controls, provenance;
- no T-number and no change to `catalog-status.json`.

**Invariants**

- `IN_SCOPE:` stable G0 case IDs, exact diagnostics, fixture mutation/source operation, matrix/layer mapping, historical provenance, paired green, check-ID kill mapping, case-group accounting, execution against real stages.
- `OUT_OF_SCOPE:` inventing policy, changing expected behavior to make a stage green, behavioral catalog coverage, product tests, CI timeout implementation.
- `DEPENDENCY:` A0 schema; A/F, B/C/E, and D stage contracts and fixtures; all prior reports and PR #32/#35 preservation evidence.
- `AMBIGUOUS / NEEDS_DECISION:` any prior case whose expected policy cannot be tied to a governing matrix row. It is not silently dropped; record it as a decision blocker before ledger completion.

**Mandatory ledger content**

Carry forward every replan-1 closed case: nested supported source and unsupported extensions; missing/unreadable roots; all source/control/testing symlinks including dangling; ignored trees; unknown/external/builtin/workspace/testing references; all resolver substitutions/aliases/outside targets; static imports/exports/import-equals/import calls/require/comments/attributes/dynamic uncertainty; triple-slash directives; capability aliases/controls; exact exports and malformed forms; inherited compiler options; parent paths; real workspace cleanliness; and CI ownership.

Add exact red/green pairs for path-collision syntax law; every `ImportTypeNode` result; extractor/preprocessor mismatch and TypeScript upgrade uncertainty; globalThis/destructure/shorthand/computed/unknown-computed; call/apply/optional/indirect/escape/branch/fixpoint; closure-before-alias and export sinks; loader aliases and JSDoc import-from; malformed/missing/cyclic config graph; all control-path symlinks; optional testing absence; and changed-between-inspection/read failures.

Every case uses actual fixture operations and a literal expected violation array. Tests compare exact `{path, rule, detail}` arrays in canonical order. A meta-test fails on a missing ID, duplicate ID, stale provenance, missing pair, unknown check/matrix/layer, case without an exact expected array, or a case that passes only because an unrelated violation remains.

**Dependencies/parallelism/merge**

Ledger scaffolding can run parallel with A/F, B/C/E, and D after A0, but the complete executable ledger merges only after those stage contracts exist. G1 merges before G2.

**Expected tests/review**

Reviewer independently samples one case from every group and traces fixture → stage → exact expected output → paired green → provenance. Tester mutates the ledger itself by deleting, duplicating, and changing provenance; each mutation must fail for the intended reason.

### Slice G2 — true pre-execution mutation ratchet, watchdog, and CI authority

**Goal**

Prove that each real production check is exercised, can be disabled only before execution by test injection, and is killed by its canonical case. Prove a hard outer watchdog and explicit full-suite CI authority, without relying on output filtering, shared oracles, or a green stale command.

**Exact owned surfaces**

- new/rewritten `scripts/run-with-watchdog.ts`;
- mutation harness under `tests/support/workspace-boundaries/mutation-harness.ts`;
- mutation/authority tests under `tests/workspace-boundaries-mutation.test.ts`;
- root `package.json` only for the single `check:boundaries` command;
- `.github/workflows/ci-required.yml` only for explicit boundary invocation and timeout authority;
- no package/runtime files.

**Matrix/contracts**

- `CM-I50` plus every policy row through mutation ownership;
- eight frozen `BoundaryCheckId`s; five frozen G1/G2 assurance IDs;
- `ScanMutation` must be unreachable from normal production invocation.

**Invariants**

- `IN_SCOPE:` pre-execution stage disabling, one red and one green neighbor per policy ID, whole-layer omission mutants, trivial-return mutant, source-parser/config-graph mutants, watchdog termination and exit preservation, one root command/one scanner/one explicit workflow step, fail-closed aggregate.
- `OUT_OF_SCOPE:` adding a second scanner, changing policy to satisfy a mutant, hiding failures in CI, unrelated no-mistakes/push/merge operations, domain behavior.
- `DEPENDENCY:` all A0/A/F/B/C/E/D/G1 contracts and executable cases; current workflow/ADR 0012; final master P0 source.
- `AMBIGUOUS / NEEDS_DECISION:` CI timeout duration, if not already contractually fixed, must be explicitly set and reviewed; a platform default is not evidence. Any second invocation discovered is a stop condition, not a choice.

**Mutation acceptance**

For each of eight policy IDs, disable the actual stage branch before it executes, run a canonical red fixture, and prove the expected violation disappears or changes. The meta-suite also kills omission of inventory, syntax law, resolver target classification, reference extraction, capability flow, manifest/export, and compiler-isolation layers, plus a trivial `[]` scanner. No test may post-filter violations, call the normal scanner as an oracle to create its expectation, or pass because another violation remains. Normal CLI defaults cannot disable a check.

The watchdog must terminate a synchronous infinite/hard-hang fixture with the documented nonzero exit, while preserving ordinary zero and ordinary failure exits. It must not convert a scanner hang into success. CI must run the boundary command explicitly in the workspace suite and retain `if: always()` fail-closed aggregate authority.

**Dependencies/parallelism/merge**

Last assurance slice before integration; merges after G1. It is not parallel with final CI integration because it owns the single command/workflow invocation.

**Expected tests/review**

Tester independently injects each stage mutant and a novel synchronous hang; confirms pre-execution behavior and exit codes. Reviewer searches for output filtering, duplicate scanner/command ownership, mutation hooks reachable in production, and aggregate paths that can pass when the workspace suite is skipped or fails.

### Slice I — final one-authority integration and acceptance

**Goal**

Compose the stage APIs into exactly one authoritative `scanWorkspace`, wire one root command, rebase/integrate onto accepted P0 master, and produce exact-head evidence. This is the only slice that can claim G0 acceptance.

**Exact owned surfaces**

- new/rewritten `scripts/check-workspace-boundaries.ts` as the sole orchestrator;
- `tests/workspace-structure.test.ts` as the sole integrated structural suite, folding/removing overlapping old policy logic;
- only conflict resolution needed to retain accepted P0 root/package changes;
- no docs/domain/package contract/catalog changes.

**Matrix/contracts**

- all G0 matrix rows and all frozen stage interfaces;
- ADR 0011/0012/0016 and accepted P0;
- one `scanWorkspace(root, mutation?)` internal API and one `check:boundaries` command.

**Invariants**

- `IN_SCOPE:` stage composition, deterministic aggregation, real workspace scan, exact case execution, check-ID accounting, CI authority, P0 fan-in, final evidence.
- `OUT_OF_SCOPE:` new policy, new vocabulary, new package edge, catalog T-numbers, domain docs, release/publish, PR history rewrite.
- `DEPENDENCY:` all replacement slices, accepted P0 on master, fresh install, exact-head CI, independent Tester and Reviewer.
- `AMBIGUOUS / NEEDS_DECISION:` any changed package topology/compiler/workflow surface on final master. Stop and reclassify before resolving; do not casually merge it.

**Dependencies/parallelism/merge**

Merge order is A0 → A/F → B/C/E → D → G1 → G2 → I. P0 must already be accepted on master. If P0 is delayed, slices may be reviewed against 612 but final acceptance is blocked. After a replacement branch is published, do not force-push; integrate later master by a normal merge/rebase policy approved for that branch.

**Expected tests/review**

One fresh Tester and one fresh Reviewer inspect and test the same exact final head/tree/merge-base. They must each add novel probes in filesystem, module-reference, and flow domains, verify all ledger/mutation/watchdog controls, and reject any mixed-head evidence. Final report maps every matrix row to its stage, cases, mutants, positive controls, local commands, and exact CI run.

## 5. Required merge/train and closure protocol

1. Preserve and verify the attempt-5 tag, bundle, remote peeled commit, tree, base, and manifest (done; recheck before final review).
2. Do not repair PR #35. Open replacement stack from `master@612`; first PR is A0 and all later branches are descendants of that clean base.
3. Keep PR #32 and PR #35 source branches intact. Do not create a comparison PR merely to show the rejected implementation; the immutable evidence ref and manifests are sufficient.
4. After A0 replacement PR exists and links the evidence, mark PR #35 retired/superseded and close it without deleting its branch. Do not close PR #32 yet.
5. Merge the replacement slices in the listed order. Intermediate slices are infrastructure only and must not wire a partial `check:boundaries` authority or claim G0 acceptance.
6. Merge accepted P0 before Slice I. If any P0 or master change touches an owned boundary surface, stop for dependency review.
7. Run final exact-head Tester and Reviewer on the same head/tree/base. Only then may the final replacement PR be accepted and merged under the required human/repository gate.
8. After final G0 replacement merge and exact evidence are recorded, close PR #32 as superseded by the merged replacement, retaining its branch/tag/bundle. If PR #35 was not already closed at step 4, close it at this point; never delete either branch.

## 6. Exact evidence and CI protocol

### Pre-acceptance local command set

From a fresh worktree at the final exact head:

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
bun run build
./packages/cli/dist/lor --version
git diff --check 612ddcb0f23d0177b806942f89a158c50267b926..HEAD
```

Also record exact head/tree/merge-base/current-master, changed files, all case counts by group, ledger accounting, `mutants killed N/N` for every frozen ID, watchdog exit evidence, actual kernel negative diagnostics, real-workspace clean output, one-authority grep/static evidence, and the red-on-`a945521` comparison log. A green historical run on `a945521` is never substituted for the final run.

### Required GitHub CI result

Because every replacement slice changes code/config/workflow outside `docs/**`, the selector must report `docs_only=false`; `docs-suite=skipped`; `workspace-suite=success`; aggregate `ci-required=success`. The workspace suite must explicitly run `bun run check:boundaries` in addition to the existing install, lint, spell, docs, catalog, gates, typecheck, tests, and compile-smoke steps. The aggregate remains `if: always()` and fails closed. Record URL/run ID and verify all required jobs bind to the exact final head.

### Acceptance result protocol

```text
status: READY_FOR_ATTEMPT_6
summary: Retire PR #35 as historical evidence; replace it with the A0 → A/F → B/C/E → D → G1 → G2 → I stacked decomposition from master@612.
attempt_count: 5
next_attempt: 6
attempt_limit: 20
replan_count: 2
caused_by: broad repeated exact-head false greens; independent architectures for flow, references, config totality, ledger, and mutation authority were incomplete.
implementation: none in this planning task
acceptance: not claimed
human_gate: not claimed
inputs_needed: none
```

A future implementation handoff is `READY_FOR_ATTEMPT_6` only when the worker has consumed this artifact, the preservation manifest, and the two exact-head final assurance handoffs. Any unmet decision gate or surviving false green changes the verdict to `NEEDS_REPLAN`, not to another monolithic repair attempt.

## 7. Domain and catalog impact

No domain behavior, terminology, package contract, public kernel API, or behavioral T-number changes. No `@covers` markers move and `docs/v0.x/execution/catalog-status.json` remains unchanged. The planned internal scanner contracts are repository assurance artifacts, not Loredu domain contracts. If implementation exposes a new public API, changes package topology, changes legal capability semantics, or needs a new tool/dependency, stop and create the required decision record instead of extending this G0 plan.
