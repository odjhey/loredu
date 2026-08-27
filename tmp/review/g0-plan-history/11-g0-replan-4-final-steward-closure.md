# Loredu G0 replan4 final contract closure

**Task:** `loredu-g0-replan4-steward--01M118E9Q0YKZGYRDQ4M77KE31`

**Disposition:** `CLOSED_FOR_PLANNER_COPY`; internal assurance authority is closed. This artifact is not implementation, G0 acceptance, a human/repository gate, or authorization to mutate historical PRs.

**Consumed and hash-verified:**

- replan3: `820d83dc2e91298c18025ae789d3f2b75a472acca7fca14844c03311df3e64b6`
- superseding clarification: `ed2db13e50f3f60d084a55c3103b8efcc81582b3184949e364ac75562b6096f3`
- replan3 planning base: `master@612ddcb0f23d0177b806942f89a158c50267b926`, tree `1216774a600c79894138a7a99d810617789ed0f8`
- pinned runtime/toolchain: Bun `1.4.0` (`.bun-version`), TypeScript `5.9.3` (`bun.lock`), `moduleResolution: bundler`, `moduleDetection: force`, target/lib `ES2023`, kernel `types: []`
- governing ADRs: 0011, 0012, 0015, 0016, 0018, 0019 and the M0 implementation plan
- reviewer findings: `/Users/tiny/.rozoro/tasks/loredu-g0-replan3-matrix-review--01M117XFQ7T2WRQY5A67XBAERJ/handoff.md` and final session `56e5035b-f3fc-4cc8-9340-aff1d398f07f`

All replan3 language remains in force except the clauses expressly superseded below. This is an internal G0 assurance closure, not a Loredu package/domain/capability-port/catalog contract. No repository file is changed by this artifact.

## 1. Exact closure of the ten blockers

### 1. ReferenceStage manifest authority and target lookup

A/F is the sole producer of `ManifestModel` values and the sole manifest parser. It also creates the sole typed registry:

```ts
interface ManifestRegistry {
  readonly byPath: ReadonlyMap<string, ManifestModel>;
  readonly byPackage: ReadonlyMap<PackageName, ManifestModel>;
}

interface ManifestLookup {
  readonly source: ManifestModel | undefined;
  readonly target: ManifestModel | undefined;
}

function lookupManifests(
  registry: ManifestRegistry,
  sourcePath: string,
  targetPath: string | undefined,
): ManifestLookup;
```

`byPath` is keyed by canonical workspace-relative manifest path. `byPackage` is a derived index over the same object identities; A/F constructs both indexes in one operation and implementations must not parse, reconstruct, or independently populate a second manifest model. A package has at most one registry entry. A source lookup uses the package owning `sourcePath`; a target lookup uses the package owning the resolved `targetPath`. A target outside the workspace, unresolved, ignored, symlinked, changed, or not represented by A/F has `target: undefined` and produces the already-frozen target/export violation; it is never guessed from a package name or reread.

The superseding ReferenceStage signature is:

```ts
interface ReferenceStage {
  (input: SourceInput,
   syntax: SyntaxFacts,
   graph: ConfigGraph,
   manifests: ManifestRegistry,
   context: StageContext): StageResult<readonly ModuleReference[]>;
}
```

The stage performs `lookupManifests(registry, input.snapshot.path, resolvedTargetPath)` only after static extraction, raw syntax identity, package-edge/seam decision, and permitted resolution. It consumes A/F facts and owns no manifest authority.

**Classification:** existing manifest ownership and package law; internal closure of the reference-stage interface; not public.

### 2. Phase-once versus per-SourceInput invocation

The following invocation table is normative. “Once” means once per `scanWorkspace` call, even when its result is blocked. “Per input” means once for every applicable `SourceInput` in the exact source-parse result, in source-path canonical order. A disabled branch is checked at the beginning of that invocation, returns `status: "blocked"`, `value: undefined`, and `violations: []`, and is not retried.

| Stage | Invocation cardinality | Prerequisites and blocked propagation | Mutation branch |
|---|---:|---|---|
| `inventory` | phase-once | none; if blocked, no dependent phase is scheduled | `A.inventory.pre-execution` |
| `config-graph` | phase-once | inventory result must be available; otherwise not scheduled | `E.config-graph.pre-execution` |
| `manifest-exports` | phase-once | inventory result must be available; otherwise not scheduled | `F.manifest-exports.pre-execution` |
| `source-parse` | phase-once | inventory and graph must be available; otherwise not scheduled | `C.source-parse.pre-execution` |
| `syntax` | per input | one invocation per parse-produced input; no input means zero invocations | `B.syntax.pre-execution` |
| `compiler` | phase-once | inventory, graph, and source-parse must be available; otherwise not scheduled | `E.compiler.pre-execution` |
| `references` | per input | requires that input's syntax result and the manifest registry; blocked syntax means no reference invocation for that input | `C.references.pre-execution` |
| `capability-flow` | per input | requires that input; independent of syntax/reference result | `D.capability-flow.pre-execution` |
| `scanWorkspace` | phase-once | owns scheduling, concatenation, and final sort only | no production mutation construction |

A stage is not invoked with `undefined`, an empty fabricated inventory/graph/registry, a guessed `SourceInput`, or a path in place of a typed input. If a phase-once prerequisite is blocked, all dependent invocations are omitted and no substitute violation is added. Independent work continues only when its typed prerequisites exist. A per-input blocked syntax/reference/capability result affects only that input; other inputs continue.

`SyntaxFacts` is the explicit raw-syntax result consumed by references:

```ts
interface SyntaxFact {
  readonly sourcePath: string;
  readonly syntax: ReferenceSyntax;
  readonly specifier: string;
  readonly location: SourceLocation;
  readonly status: "allowed" | "forbidden" | "uncertain";
}
interface SyntaxFacts {
  readonly sourcePath: string;
  readonly facts: readonly SyntaxFact[];
  readonly status: "complete" | "blocked";
  readonly violations: readonly Violation[];
}
interface SyntaxStage {
  (input: SourceInput, context: StageContext): StageResult<SyntaxFacts>;
}
```

This makes `StageName: "syntax"` executable rather than an unowned label. Syntax is per-input; references are also per-input; all other listed production stages follow the table.

**Classification:** internal execution semantics. This supersedes replan3’s underspecified “each applicable stage once” wording and its old ReferenceStage signature.

### 3. Closed MatrixRow registry and CaseSpec

The matrix vocabulary is exactly and only:

```ts
type MatrixRow =
  | "CM-I41" | "CM-I43" | "CM-I44" | "CM-I45"
  | "CM-I46" | "CM-I47" | "CM-I50";

const MATRIX_ROWS: readonly MatrixRow[] = [
  "CM-I41", "CM-I43", "CM-I44", "CM-I45",
  "CM-I46", "CM-I47", "CM-I50",
];

interface MatrixRowSpec {
  readonly id: MatrixRow;
  readonly classification: "IN_SCOPE";
}

const MATRIX_REGISTRY: Readonly<Record<MatrixRow, MatrixRowSpec>>;
```

`MATRIX_ROWS` is the canonical ordered registry and `MATRIX_REGISTRY` is a total record over it. No eighth row, alias, or free-form string is valid. The frozen case shape is superseded only at `matrixRows`:

```ts
interface CaseSpec {
  readonly id: string;
  readonly group: CaseGroup;
  readonly matrixRows: readonly MatrixRow[];
  readonly assuranceLayer: AssuranceLayer;
  readonly fixtureMutation: readonly FixtureOperation[];
  readonly expected: readonly Violation[];
  readonly pairedGreenControl: string;
  readonly killsCheckIds: readonly BoundaryCheckId[];
  readonly provenance: readonly CaseProvenance[];
}
```

A0 schema validation rejects an unknown row, duplicate row, missing row registry key, or registry key not present in `MATRIX_ROWS`. The seven rows retain Steward classification `IN_SCOPE`; public package/domain/capability-port/catalog remains `OUT_OF_SCOPE`.

**Classification:** internal assurance. Supersedes `readonly string[]` and any non-total row registry language.

### 4. Workspace/root project representation

There is no root compiler project in G0. This is an explicit exclusion, not an omitted type.

- `PackageName` remains exactly `"kernel" | "store-plainfile" | "cli"`.
- `SourceProgramContext.project` and `CompilerProjectEvidence.project` remain `PackageName`.
- A/F still inventories and validates a root `tsconfig.json`/solution node as `owner: "workspace"`, including its exact project-reference grammar and containment.
- A root solution may reference only known package project configs under the allowed package topology. Its options are not used to create a `SourceProgramContext`, and it contributes no `CompilerProjectEvidence` row.
- Package source files are the only source inputs and are parsed/checked in their package compiler contexts. The existing root `tsconfig.base.json` is an inherited config fact, not a source project.
- A root solution edge to an unknown package, outside target, malformed target, or forbidden cycle is an A/F violation; it is not silently ignored.

This is consistent with ADR 0016’s four sequential `tsc -p` projects and rejection of project-reference build-output ceremony. It prevents a root solution from being represented as a package or from being accidentally claimed as compiler evidence.

**Classification:** existing ADR/toolchain rule; internal explicit exclusion; no public change.

### 5. Exact mutation propagation and output deltas

For one fixed fixture root, let `A`, `G`, `F`, `P`, `S`, `C`, `R`, and `D` denote the literal violation arrays emitted by inventory, config graph, manifest, source-parse, syntax, compiler, references, and capability-flow in a normal run. Subscripts identify input where needed. `sort(...)` means the sole I0 canonical Unicode-scalar sort; `⊎` is concatenation before that sort, not set deduplication. The baseline is:

```text
B = sort(A ⊎ G ⊎ F ⊎ P ⊎ S ⊎ C ⊎ R ⊎ D)
```

The exact mutation outputs are:

| Mutation | Invocations suppressed | Exact mutant output | Exact delta from baseline |
|---|---|---|---|
| `A.inventory.pre-execution` | inventory is blocked; config, manifest, parse, syntax, compiler, references, capability are unscheduled | `[]` | removes `A ⊎ G ⊎ F ⊎ P ⊎ S ⊎ C ⊎ R ⊎ D` |
| `E.config-graph.pre-execution` | config blocked; parse, syntax, compiler, references, capability unscheduled | `sort(A ⊎ F)` | removes `G ⊎ P ⊎ S ⊎ C ⊎ R ⊎ D` |
| `F.manifest-exports.pre-execution` | manifest blocked; references unscheduled; parse, syntax, compiler, capability still run | `sort(A ⊎ G ⊎ P ⊎ S ⊎ C ⊎ D)` | removes `F ⊎ R` |
| `C.source-parse.pre-execution` | parse blocked; syntax, references, capability unscheduled; compiler unscheduled | `sort(A ⊎ G ⊎ F)` | removes `P ⊎ S ⊎ C ⊎ R ⊎ D` |
| `B.syntax.pre-execution` for input `i` | syntax blocked for `i`; reference for `i` unscheduled; all other inputs and capability continue | `sort(B \ (S_i ⊎ R_i))` | removes exactly `S_i ⊎ R_i` |
| `E.compiler.pre-execution` | compiler blocked; all other available phases continue | `sort(B \ C)` | removes exactly `C` |
| `C.references.pre-execution` for input `i` | reference blocked for `i`; all other phases/inputs continue | `sort(B \ R_i)` | removes exactly `R_i` |
| `D.capability-flow.pre-execution` for input `i` | capability blocked for `i`; all other phases/inputs continue | `sort(B \ D_i)` | removes exactly `D_i` |

The table is the acceptance contract, not an expectation generator. Each canonical mutation fixture commits the complete literal `B` and complete literal mutant array after execution; the harness compares exact arrays, including unrelated diagnostics that remain runnable. Where a blocked prerequisite makes a dependent phase unschedulable, the dependent baseline contribution is removed exactly as shown—no `boundary-target`, empty facts, guessed source, or substitute diagnostic is inserted. Whole-layer omission and trivial-`[]` orchestrator mutations remain separate G2 mutants.

The eight mutation IDs and check IDs remain the exact one-to-one union in replan3. The production CLI cannot import or construct `ScanMutation`; normal calls use `context.mutation === undefined`.

**Classification:** internal assurance. This supersedes the conflicting “baseline minus only disabled stage while all dependents continue” implication; blocked propagation now has literal branch-by-branch semantics.

### 6. Watchdog exit 125, fault seam, platform, API, and evidence

G0 supports exactly this acceptance platform matrix:

| CI runner | runtime | process boundary authority | status |
|---|---|---|---|
| GitHub Actions `ubuntu-24.04` | Bun `1.4.0` | POSIX process group plus Bun’s `Bun.spawn`/`Subprocess` and Bun’s Node-compatible `process.kill(-pgid, signal)` API | supported |
| any other OS/runner, including Windows and local macOS | Bun `1.4.0` | no G0 authority is claimed | unsupported; deterministic 125 before spawn |

The workflow pins `runs-on: ubuntu-24.04`; G0 does not claim Windows support. This removes the prior unsupported POSIX/Windows claim rather than inventing a Windows Job Object implementation.

The wrapper’s test-only, unprivileged, data-only fault seam is:

```ts
type WatchdogFault =
  | "before-spawn-boundary-unavailable"
  | "after-spawn-terminate-fails"
  | "after-spawn-cleanup-probe-fails";

interface WatchdogTestOptions {
  readonly fault?: WatchdogFault;
}
```

The seam is accepted only by the watchdog test harness, never by the root CLI command or production scanner. It injects deterministic failures at setup, group termination, or final group probe; it uses no permissions, signals from another privileged process, callbacks, shell interpolation, or host-global mutation.

On the supported runner the wrapper starts the direct child in a newly owned process group (`Bun.spawn` with the pinned detached/process-group behavior), stores its PID as PGID, and terminates/probes the group via `process.kill(-pgid, SIGTERM/SIGKILL)` and `process.kill(-pgid, 0)`. A successful timeout is `124` only after the group probe proves `ESRCH` (group absent). Direct-child kill is never a fallback.

Exit contract:

- invalid invocation: `2`, before spawn;
- ordinary child exit `0`: preserve `0`;
- ordinary child nonzero: preserve that code;
- signal-only child: `1`;
- timeout with proven group cleanup: `124`;
- unsupported setup, injected setup failure, termination failure, or cleanup probe failure: `125`.

A setup failure before spawn proves `spawned: false`. A cleanup-failure record proves only that the required process-boundary cleanup could not be proven, and records `fault`, PID/PGID if created, attempted signals, probe result/error class, and `descendantStatus: "unknown"`. It must not claim “no descendant remains” and must not claim timeout success. The prior stronger wording that simultaneously required exit `125` and proved absence after an unproven cleanup is superseded. The watchdog test harness runs an independent final group probe and performs test-owned cleanup in a `finally` path; any remaining process fails the test. That harness evidence is not a wrapper claim.

The supported CI evidence must show `ubuntu-24.04`, Bun `1.4.0`, each fault seam, exact exit, spawn/no-spawn fact, and the distinction between `cleanup-proven` and `cleanup-unproven`. The outer GitHub `workspace-suite` job remains a 10-minute defense-in-depth ceiling; boundary and root-test budgets remain 60s and 180s.

**Classification:** internal CI/watchdog assurance. Supersedes the unpinned Windows claim and the contradictory cleanup-failure/no-descendant claim. No public runtime contract changes.

### 7. Legacy structural-test authority and G2 timing

`tests/workspace-structure.test.ts` is not allowed to remain a policy authority when G2 claims the sole root authority. Its manifest-DAG and kernel-boundary assertions must be migrated into the I0/G2 scanner consumer or removed after equivalent scanner-owned assertions are present. The file may not be left as a second scanner or a second root authority.

The migration/removal gate is **before G2’s authority acceptance and before the first final wrapped-root-test evidence**. G1 ledger execution may occur before the migration because it runs against I0 and does not establish root/CI authority. Planner must therefore put the real legacy migration work before G2 authority acceptance (or make G2’s parent include that completed work); an I1 after G2 cannot retroactively make G2’s sole-authority claim true. A static G2 preflight fails if the legacy file still contains its old policy assertions or if an equivalent duplicate authority remains.

**Classification:** internal assurance and Planner ordering input. Supersedes replan3’s “I1 after G2 owns legacy migration” ordering for authority purposes.

### 8. `changed` race representation

`changed` is a first-class value in every affected model:

```ts
type PathKind =
  | "absent" | "regular-file" | "directory" | "symlink"
  | "other" | "unreadable" | "changed";

type ConfigNodeStatus =
  | "valid" | "absent" | "malformed" | "unreadable" | "symlink"
  | "outside" | "cycle" | "unsupported" | "changed";

type ConfigEdgeStatus =
  | "valid" | "forbidden" | "missing" | "malformed" | "unreadable"
  | "symlink" | "outside" | "cycle" | "unsupported" | "changed";

type ManifestExportStatus =
  | "valid" | "missing" | "malformed" | "unreadable" | "symlink"
  | "outside" | "unsupported" | "changed";

type ReadOutcome =
  | { readonly kind: "read"; readonly snapshot: SourceSnapshot }
  | { readonly kind: "failed"; readonly violation: Violation }
  | {
      readonly kind: "changed";
      readonly violation: Violation;
      readonly operation: "after-lstat-before-read" | "after-lstat-before-stat";
      readonly before: PathKind;
      readonly after: PathKind;
    };
```

`InventoryEntry.kind === "changed"` always has `readable: false`; no snapshot is emitted. A config node/edge or export with `changed` is red and is never delegated to JSON parsing, resolver, or TypeScript. Same-kind content replacement is represented by `before: "regular-file"`, `after: "regular-file"`, and the race operation, not collapsed to unreadable or absence. `after` is the observed post-mutation kind and is required by the fixture seam.

**Classification:** internal filesystem assurance. Supersedes the narrower old unions.

### 9. Complete TypeScript 5.9.3 dynamic-import attributes table

TypeScript 5.9.3 exposes the dynamic import call as a `CallExpression`/`ImportCall`; the second argument is an ordinary expression. Its library type is:

```ts
interface ImportCallOptions {
  /** @deprecated */ assert?: ImportAssertions;
  with?: ImportAttributes;
}
interface ImportAssertions {
  [key: string]: string;
}
interface ImportAttributes {
  [key: string]: string;
}
```

G0’s extractor accepts exactly this closed operational table:

| Source shape | TypeScript 5.9.3 parse/type shape | G0 result |
|---|---|---|
| `import(S)` | one argument; `S` string literal or no-substitution template | extract `dynamic-import` |
| `import(S, {})` | two args; second plain object with no members | extract `dynamic-import` |
| `import(S, { with: A })` | `with` unique data property; `A` plain object | extract; every A key is identifier/string-literal and every A value is string literal/no-substitution template |
| `import(S, { assert: A })` | deprecated `assert` unique data property; `A` plain object | extract under the same closed attribute-value rule; deprecation does not make it cleanly ignored |
| `import(S, { with: A, assert: B })` | parser accepts it and both outer properties exist in the TS type | `boundary-ast-uncertain` (both forms together are not a supported G0 shape) |
| `import(S, { unknown: A })` | parser accepts ordinary object syntax, but it is not `ImportCallOptions` | `boundary-ast-uncertain` |
| `import(S, { ...x })`, methods, accessors, computed/spread keys | parser accepts some forms as object syntax | `boundary-ast-uncertain` |
| `import(S, { with: x })` or non-object options | parser accepts expression, not the closed attribute object shape | `boundary-ast-uncertain` |
| duplicate outer `with`/`assert` or duplicate inner attribute key | parser may parse duplicate properties | `boundary-ast-uncertain` |
| second argument count other than 0 or 1 options argument | parser may parse a call with that arity | `boundary-ast-uncertain` |
| non-static `S` (identifier, concatenation, substitution template, property/computed expression) | valid expression but not a static module specifier | `boundary-ast-uncertain` |

For the accepted rows, attribute names are preserved as source facts and values are literal strings; G0 does not invent a MIME/module vocabulary. `assert` is included because TS 5.9.3’s public type still declares it, while simultaneous `with`+`assert` is explicitly not supported. Every row is covered by a red/green AST fixture. No “supported attributes” placeholder remains.

`ImportTypeNode.attributes` and static import/export/JSDoc attributes use the same `ImportAttributes` object-member grammar where applicable. Unsupported attribute forms and future syntax are the one fail-closed `boundary-ast-uncertain` outcome, never clean and never a second `boundary-dynamic` result.

**Classification:** internal pinned-toolchain grammar. No package/public API change.

### 10. Typed unexpected-fatal result and CLI exit channel

Unexpected exceptions are not policy violations and are not allowed to escape as an uncaught runtime throw. The internal result is:

```ts
type FatalOwner = StageName | "orchestrator";
type FatalCode = "UNEXPECTED_STAGE_FAILURE" | "UNEXPECTED_ORCHESTRATOR_FAILURE";

interface UnexpectedFatal {
  readonly kind: "unexpected-fatal";
  readonly owner: FatalOwner;
  readonly code: FatalCode;
}

type StageResult<T> =
  | { readonly stage: StageName; readonly status: "ok";
      readonly value: T; readonly violations: readonly [] }
  | { readonly stage: StageName; readonly status: "blocked";
      readonly value: undefined; readonly violations: readonly Violation[] }
  | { readonly stage: StageName; readonly status: "partial";
      readonly value: T; readonly violations: readonly Violation[] }
  | { readonly stage: StageName; readonly status: "fatal";
      readonly value: undefined; readonly violations: readonly [];
      readonly fatal: UnexpectedFatal };

type ScanOutcome =
  | { readonly status: "complete"; readonly violations: readonly Violation[] }
  | { readonly status: "fatal"; readonly violations: readonly [];
      readonly fatal: UnexpectedFatal };

interface ScanWorkspace {
  (root: string, context?: StageContext): ScanOutcome;
}
```

Each stage catches only its owned operational errors into its typed violations. An unexpected error yields `fatal` with the owning stage and fixed code; I0 stops scheduling, does not synthesize downstream facts, and does not sort a partial policy result. An orchestrator error uses owner `"orchestrator"` and the orchestrator code. Error text, stack, and host-specific exception messages are not part of the stable result.

The boundary CLI maps outcomes deterministically: complete with zero violations exits `0`; complete with one or more violations prints canonical violations and exits `1`; fatal prints `LOREDU_BOUNDARY_FATAL <owner> <code>` to stderr and exits `70` (`EX_SOFTWARE`). The watchdog preserves this ordinary child `70`; invalid invocation remains wrapper-owned exit `2`. Thus a fatal scan cannot be mistaken for a clean scan or a policy violation.

**Classification:** internal scanner/CLI assurance. Supersedes the old violations-only `ScanWorkspace` signature. It does not alter the Loredu `lor` public package/domain API.

## 2. Matrix disposition and ownership classification

CM-I41, CM-I43, CM-I44, CM-I45, CM-I46, CM-I47, and CM-I50 remain `IN_SCOPE`, with the exact seven-member registry above. The closure is classified as follows:

- **Existing and retained:** ADR 0011 package DAG and kernel isolation; ADR 0012 fail-safe CI posture; ADR 0015 catalog accounting; ADR 0016 sequential package `tsc -p` projects and root `tsconfig.base.json` inheritance; ADR 0018 capability-port boundary; ADR 0019’s unrelated M0 shape rules; Bun/TypeScript pins; A/F sole filesystem/config/manifest ownership; historical PR custody.
- **Internal assurance additions/clarifications:** the registry, stage cardinality, `SyntaxFacts`, manifest lookup, blocked-propagation table, changed statuses, dynamic-import table, watchdog seam/platform restriction, legacy migration gate, and typed fatal outcome.
- **Public:** none. No package export, domain term, capability meaning, behavioral T-number, runtime dependency, or published CLI contract is added or changed. The issue update below is tracking communication only.

The prior Steward artifact and replan3 are not rewritten. The exact clauses identified above are superseded by this artifact; all other prior text remains historical/in force.

## 3. Planner-owned ordering changes (not Steward-owned decomposition)

Planner must copy these ordering constraints literally while producing replan4:

1. Preserve the non-circular production order through `A0 → A/F → B/C/E → D → I0 → G1`; executable G1 cannot precede I0.
2. Put the real legacy-test migration/removal gate before G2 authority acceptance. A planner may implement that as a pre-G2 landing slice or include it in the I0 parent, but G2 cannot claim sole authority while the old structural policy test remains active.
3. Keep optional G1 schema-only metadata separate from executable ledger evidence.
4. G2 may own the watchdog, mutation harness, root scripts, and CI authority only after the pre-G2 legacy gate; final evidence may have a later integration/fan-in slice.
5. Bind every child to actual parent/head/tree/merge-base and handoff hashes; invalidate descendants on any owned-surface, source-root, package-topology, compiler/Bun/TypeScript/lockfile, workflow, fixture, ledger, or P0/master change.
6. Keep PR #32/#35 custody verification and closure timing from replan3; neither historical item is acceptance evidence.

These are planning/decomposition inputs. The Steward does not name branch/PR identities, implementation paths, or next-role invocation.

## 4. Exact issue #18 update text

Post the following as one new comment on `https://github.com/odjhey/loredu/issues/18` after recording this artifact’s SHA-256:

```text
## G0 replan4 final contract closure — internal assurance

Final closure artifact:
`/Users/tiny/.rozoro/tasks/loredu-g0-replan4-steward--01M118E9Q0YKZGYRDQ4M77KE31/g0-replan4-final-closure.md`
SHA-256: `<INSERT_ARTIFACT_SHA256>`

Consumed and hash-verified replan3 `820d83dc2e91298c18025ae789d3f2b75a472acca7fca14844c03311df3e64b6` and clarification `ed2db13e50f3f60d084a55c3103b8efcc81582b3184949e364ac75562b6096f3`, against Bun 1.4.0, TypeScript 5.9.3, the M0 plan, and ADRs 0011/0012/0015/0016/0018/0019.

The ten replan3 internal-assurance blockers are closed for Planner copy:

- `ReferenceStage` now receives one A/F-owned typed `ManifestRegistry` with source and resolved-target lookup; no duplicate manifest authority.
- Stage cardinality is frozen: inventory/config/manifest/source-parse/compiler are phase-once; syntax/references/capability are per-SourceInput; blocked prerequisites skip dependents without substitutes.
- `MatrixRow` is a closed union/total registry containing exactly CM-I41, CM-I43, CM-I44, CM-I45, CM-I46, CM-I47, and CM-I50; `CaseSpec.matrixRows` uses it.
- Root solutions are validated by A/F but explicitly excluded from source/compiler project contexts; only the three package projects produce compiler evidence.
- Every mutation has a literal baseline/mutant propagation delta; unschedulable dependents are removed exactly and never guessed.
- Watchdog G0 support is pinned to GitHub `ubuntu-24.04`/Bun 1.4.0 with POSIX process-group authority. Data-only unprivileged setup/termination/probe fault seams exercise exit 125; cleanup failure proves only unproven cleanup and never claims no descendant.
- Legacy `tests/workspace-structure.test.ts` must be migrated/removed before G2 can claim sole root authority.
- `changed` is first-class in PathKind, config statuses, manifest export status, and ReadOutcome.
- The TS 5.9.3 dynamic-import table explicitly covers one/two arguments, `with`, deprecated `assert`, object-member restrictions, duplicates, unknown keys, and non-static/unsupported forms; uncertainty is fail-closed.
- Unexpected stage/orchestrator failures have typed fatal results; the scanner CLI maps clean/violations/fatal to 0/1/70, while watchdog 2/124/125 semantics remain distinct.

Classification remains: CM-I41/I43/I44/I45/I46/I47/I50 `IN_SCOPE`; all additions are internal assurance. No package export, domain term, capability-port meaning, T-number, runtime dependency, or public CLI contract changed. This comment updates the review trail only; it does not claim implementation or G0 acceptance. Planner owns slice identities and ordering, subject to the pre-G2 legacy-authority gate.
```

## 5. Result

```text
status: CLOSED_FOR_PLANNER_COPY
classification: internal assurance; public semantic change: none
matrix: CM-I41, CM-I43, CM-I44, CM-I45, CM-I46, CM-I47, CM-I50 = IN_SCOPE
repository_changes: none
implementation: none
acceptance: not claimed
no_mistakes: not run
next_role: not invoked
issue_18: update text prepared; posting is an external tracking action
```
