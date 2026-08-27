# Loredu G0 material replacement replan 3

**Task:** `loredu-g0-replanner-3--01M1176WRGJEKXFP8CQE5F6G9W`  
**Disposition:** `READY_FOR_A0_DISPATCH_AFTER_PREFLIGHT`  
**Scope:** planning only. This artifact implements nothing, mutates no branch/PR, invokes no next role, runs no no-mistakes pipeline, and claims neither G0 acceptance nor a human/repository gate.  
**Planning base:** `master@612ddcb0f23d0177b806942f89a158c50267b926`  
**Planning-base tree:** `1216774a600c79894138a7a99d810617789ed0f8`  
**Attempt state:** 5 completed; next implementation attempt 6; attempt limit 20  
**Replan state:** replan 3 of 4  
**Cause:** amended replan2 remained non-dispatchable because its executable G1/I relationship was circular and its executable stage contracts were still incomplete. The superseding Steward clarification closes the semantic inputs; this artifact materially changes the DAG and makes composition an independently mergeable slice.

## 1. Identity-bound authority consumed

The following identities are immutable inputs to this replan. A hash mismatch, unavailable artifact, or changed referenced evidence invalidates this plan and is a stop condition, not a local repair opportunity.

| Authority/evidence | Exact path or identity | SHA-256 / object identity |
|---|---|---|
| Superseding Steward clarification | `/Users/tiny/.rozoro/tasks/loredu-g0-replan3-steward--01M116S6VPWKX60NM9PPS8V7J8/g0-replan3-contract-clarification.md` | `ed2db13e50f3f60d084a55c3103b8efcc81582b3184949e364ac75562b6096f3` |
| Amended replan2 audited | `/Users/tiny/.rozoro/tasks/loredu-g0-replanner-2--01M114QXHW7RS0KY190TGBN527/g0-replan-2-amended.md` | `ee64309175e3034a4179ac9a3c04f623eb0d008404dcd0502a4c2219d19ba63c` |
| Prior Steward decision | `/Users/tiny/.rozoro/tasks/loredu-g0-replan2-contract-steward--01M1157FK6N2S54TG9EYGW6A0X/contract-decisions.md` | `8aef1c4fa99499e6eb8557a65ad15eacf6949d3f9ac547d47b70bbaea2765a32` |
| Prior matrix audit | `/Users/tiny/.rozoro/tasks/loredu-g0-replan2-matrix-review--01M1157FK6MQNHGHJQ3YQ8P9MX/g0-replan-2-matrix-audit.md` | `998f838ef60df2f45ce7ba1285d403a9347e95c7beef68e2030786bb92fca55e` |
| Final amended-plan Reviewer handoff | `/Users/tiny/.rozoro/tasks/loredu-g0-replan2-amended-review--01M116BXJA8YZ6JNJAYVHJXQHZ/handoff.md` | SHA-256 `144ebc882e76ef2767adaf0c48612fe7e2d206d239d37a9390ab051761007a4b`; exact final block `needs-action` |
| Final amended-plan Reviewer session | `/Users/tiny/.pi/agent/sessions/--Users-tiny-packages-loredu--/2026-08-27T08-46-14-456Z_56e5035b-f3fc-4cc8-9340-aff1d398f07f.jsonl` | SHA-256 `ca3370385ab2955a9309dbfc8f53e9aa8613d901c0de3dcef109f0fb6a55a164`; session `56e5035b-f3fc-4cc8-9340-aff1d398f07f` |
| Governing implementation plan | `docs/v0.x/execution/implementation-plan.md` at base | base `612ddcb`; no domain/catalog change authorized |
| Package architecture ADR | `docs/decisions/0011-repo-package-architecture.md` | governing ADR |
| DX/CI ADR | `docs/decisions/0012-dx-and-ci-gating.md` | governing ADR |
| Catalog accounting ADR | `docs/decisions/0015-catalog-accounting-and-docs-gate.md` | governing ADR |
| Workspace/type-isolation ADR | `docs/decisions/0016-workspace-scaffold-and-kernel-type-isolation.md` | governing ADR |
| Capability-port ADR | `docs/decisions/0018-capability-ports.md` | governing ADR |
| Clock/identity contract | `docs/architecture/contracts/clock-and-identity.md` | governing contract |
| Record/store/contracts indexes | `docs/architecture/contracts/README.md`, `records.md`, `store.md` | governing contracts |
| M0 validation ADR | `docs/decisions/0019-m0-validation-rules.md` | governing ADR |

The final Reviewer findings were consumed from both the persisted handoff and its exact session, including the residual decomposition audit: the amended artifact did close R2-MR-01..07 semantically, but its `I` composition was also the dependency of executable `G1` while `I` depended on `G1`; its final command list retained raw `bun test`; and the source contract block still needed the complete `ModuleReference`, `CompilerEvidence`, `CapabilityFacts`, `ManifestModel`, `SourceProgramContext`, checker context, mutation branch map, and `source-parse` stage name carried into implementation boundaries. Those are corrected below.

### Historical PR #32/#35 preservation custody

These are historical evidence only. No replacement branch starts from them; no commit is cherry-picked, amended, force-pushed, deleted, or used as acceptance.

| Historical item | Immutable identity |
|---|---|
| PR #32 attempt-3 | commit `fc5b79bfc23b902069b0544d6c66944954df3cf7`; tree `a0a2a401adfc2a9aa64fc3f38c111138c7381432`; merge-base `43519c27b9d3be25ab847734d6824f65e9fd2c20`; CI `33044928321`; tag object `f1154f99961a6e6bd4e6c2e09d126aaa8747a713`; tag `evidence/g0-pr32-attempt3-fc5b79b`; bundle SHA-256 `e0f88b88ba80a9f1ac272305b3489857b11336226681d914c304e6e70d7e7794` |
| PR #32 custody manifest | `/Users/tiny/.rozoro/tasks/loredu-g0-coder-4--01M10Z0K7YK9QNZGSHTZ503PR6/evidence/preservation-manifest.md`; bundle `g0-pr32-attempt3-fc5b79b.bundle` |
| PR #35 attempt-4 | commit `207d572e63cacc3d4b2843c6410ea3152bc62f30`; tree `fef6f92694fd6683d2943b8c560bd6b9df89d031`; merge-base `612ddcb0f23d0177b806942f89a158c50267b926`; CI `33049957913`; tag object `fc6ad12f9c6ebd001650c7de65792267446a3952`; tag `evidence/g0-pr35-rejected-207d572-attempt4`; bundle SHA-256 `2f316539fb70a108f546a7348f7bbdcffe1536ee755240ad5b0ed04fa5d82ed7` |
| PR #35 attempt-4 custody | `/Users/tiny/.rozoro/tasks/loredu-g0-coder-5--01M11302DRJ9G6MCY3GEDVVCVZ/evidence/pr35-rejected-207d572-manifest.txt`; bundle `pr35-rejected-207d572.bundle` |
| PR #35 attempt-5 | commit `a945521af7d3a8415f071322b577be6865f9ed8f`; tree `06c42f72db78d83e084b39b4c281a59ab7929335`; merge-base `612ddcb0f23d0177b806942f89a158c50267b926`; CI `33052334867`; tag object `4407b365f4d09ad42eca0b36295bf9e0b69b00c4`; tag `evidence/g0-pr35-rejected-a945521-attempt5`; bundle SHA-256 `6b08ae21c8bc67327b3f64f340cf8ffdfd18e08b821e08877d821f1e369ff7e1` |
| PR #35 attempt-5 custody | `/Users/tiny/.rozoro/tasks/loredu-g0-replanner-2--01M114QXHW7RS0KY190TGBN527/evidence/preservation-manifest.md`; bundle `evidence/g0-pr35-attempt5-a945521.bundle` |
| Historical reports | PR #32 review/test reports under `loredu-g0-review`, `loredu-g0-test`, `loredu-g0-rereview`, `loredu-g0-retest`, `loredu-g0-final-review`, `loredu-g0-final-test`; PR #35 final review/test and attempt-5 final2 review/test under their exact task folders |

The green historical CI runs (`33044928321`, `33049957913`, `33052334867`) remain evidence of false-green behavior and never substitute for a new exact-head run.

## 2. Replan-3 decisions

1. **Production composition is its own slice, `I0`.** `I0` is after A/F → B/C/E → D and creates the sole production `scanWorkspace` orchestrator. It owns no root `package.json` authority, no workflow authority, no watchdog, no CI selector, and no executable ledger. This removes the G1/I cycle.
2. **Executable G1 follows `I0`.** G1 executes literal cases against the already-composed production scanner. Schema-only G1 metadata may be prepared after A0, but cannot claim policy and cannot be the executable G1 slice.
3. **G2 follows executable G1.** G2 owns test-only mutation injection evidence, watchdog, root commands, and workflow authority. It does not create a second scanner or alter policy to satisfy mutants.
4. **`I1` is a real final landing slice, not an empty fan-in.** The current base has `tests/workspace-structure.test.ts`, whose legacy policy assertions must be folded into the I0 authority. I1 owns that migration to a thin scanner consumer plus final accepted-P0 reconciliation and exact-head evidence manifest. If an accepted P0 has already removed that legacy surface without leaving any equivalent integration work, I1 is omitted and the final landing is procedural; it must never exist as an empty PR.
5. **A0 is policy-free.** A0 compiles and validates contracts/metadata only. It does not depend on scanner output, instantiate a scanner, assert a G0 policy, add a root command, add workflow authority, or claim a matrix row implemented.
6. **No stage re-reads or reparses.** A/F reads each source once into `SourceSnapshot`/`ReadOutcome`; source-parse creates one snapshot-backed program/checker context; compiler, references, and capability flow consume `SourceInput` and do not accept paths.
7. **No raw unwrapped root test is final evidence.** The root `test` script invokes the 180-second watchdog, and the final command list invokes `bun run test` exactly once. No standalone `bun test` appears in final commands, CI authority, or evidence manifests.

### Exact non-circular DAG and merge order

```text
master@612
   |
   v
 A0 ---------------> G1-schema-only (metadata scaffolding only)
   |
   v
 A/F  --hard-->  B/C/E  --hard-->  D  --hard-->  I0  --hard-->  G1  --hard-->  G2  --hard-->  I1 (conditional real work)
                                      \__________________________/
                                         no reverse dependency
```

`A/F` is a hard dependency of B/C/E and D. B/C/E is a hard dependency of D. `I0` is the first point at which a production scanner exists. G1's executable ledger starts only after I0. G2 starts only after executable G1. I1 starts only after G2 and accepted P0/master reconciliation. No slice consumes future scanner output, and no slice claims production policy through A0 schema metadata.

Planned branch lineage (all are descendants of `master@612`, never PR #32/#35):

```text
feat/g0-r3-a0
  -> feat/g0-r3-af
  -> feat/g0-r3-bce
  -> feat/g0-r3-d
  -> feat/g0-r3-i0
  -> feat/g0-r3-g1
  -> feat/g0-r3-g2
  -> feat/g0-r3-i1       # only if the I1 work test is present
```

Each branch is a small, continuously mergeable PR. A stage PR may have focused unit/fixture evidence, but may not wire a partial root authority. A child may be reviewed on its parent branch; after publication it is never force-pushed.

## 3. Frozen internal contract — verbatim authority

The following names, discriminants, ownership, and semantics are reproduced from the superseding Steward clarification (`ed2db13e...`) and are frozen. They are internal assurance types, not Loredu package exports and not public domain contracts. Private fields may be added only without changing these shapes or meanings.

```ts
type PackageName = "kernel" | "store-plainfile" | "cli";
type PolicySurface =
  | "workspace" | "package" | "source" | "test"
  | "control" | "ignored" | "unknown";
type PathKind =
  | "absent" | "regular-file" | "directory"
  | "symlink" | "other" | "unreadable";

interface Violation {
  readonly path: string;       // root-relative, portable separators
  readonly rule: string;       // stable rule identifier
  readonly detail: string;     // stable exact detail/location text
}

interface SourceSnapshot {
  readonly path: string;
  readonly text: string;        // decoded once, unchanged thereafter
  readonly byteLength: number;
  readonly contentDigest: string;
}

type ReadOutcome =
  | { readonly kind: "read"; readonly snapshot: SourceSnapshot }
  | { readonly kind: "failed"; readonly violation: Violation };

interface InventoryEntry {
  readonly path: string;
  readonly kind: PathKind;
  readonly readable: boolean;
  readonly policySurface: PolicySurface;
}
interface PackageInventory {
  readonly name: PackageName;
  readonly root: string;
  readonly sourceRoots: readonly string[];
  readonly controlFiles: readonly string[];
  readonly testRoots: readonly string[];
  readonly ignoredRoots: readonly string[];
}
interface WorkspaceInventory {
  readonly root: string;
  readonly entries: readonly InventoryEntry[];
  readonly packages: readonly PackageInventory[];
  readonly sourceReads: readonly ReadOutcome[];
  readonly violations: readonly Violation[];
}

type ConfigNodeKind =
  | "root-manifest" | "root-tsconfig" | "package-manifest"
  | "package-tsconfig" | "extends-target" | "project-reference-target";
type ConfigNodeStatus =
  | "valid" | "absent" | "malformed" | "unreadable"
  | "symlink" | "outside" | "cycle" | "unsupported";
interface ConfigNode {
  readonly id: string;
  readonly kind: ConfigNodeKind;
  readonly owner: "workspace" | PackageName;
  readonly pathKind: PathKind;
  readonly status: ConfigNodeStatus;
}
type ConfigEdgeKind = "extends" | "project-reference" | "path-substitution";
type ConfigEdgeStatus =
  | "valid" | "forbidden" | "missing" | "malformed"
  | "unreadable" | "symlink" | "outside" | "cycle" | "unsupported";
interface ConfigEdge {
  readonly from: string;
  readonly kind: ConfigEdgeKind;
  readonly raw: string;
  readonly to: string | undefined;
  readonly status: ConfigEdgeStatus;
}
interface ConfigGraph {
  readonly nodes: readonly ConfigNode[];
  readonly edges: readonly ConfigEdge[];
  readonly violations: readonly Violation[];
}

type ReferenceSyntax =
  | "import" | "export" | "import-equals" | "import-type"
  | "dynamic-import" | "require" | "require-resolve"
  | "module-require" | "jsdoc-import" | "triple-slash";
type ReferenceResolution =
  | "not-applicable" | "resolved" | "unresolved"
  | "forbidden" | "uncertain";
type ReferenceTargetSurface =
  | "production-source" | "declaration" | "control" | "test"
  | "ignored" | "outside";
interface SourceLocation {
  readonly start: number;
  readonly length: number;
  readonly line: number;       // one-based
  readonly character: number;  // one-based
}
interface ModuleReference {
  readonly sourcePath: string;
  readonly syntax: ReferenceSyntax;
  readonly specifier: string;
  readonly location: SourceLocation;
  readonly resolution: ReferenceResolution;
  readonly targetPath: string | undefined;
  readonly targetKind: PathKind | undefined;
  readonly targetSurface: ReferenceTargetSurface | undefined;
}

interface SourceProgramContext {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly compilerOptions: ts.CompilerOptions;
  readonly project: PackageName;
}
interface SourceInput {
  readonly snapshot: SourceSnapshot;
  readonly sourceFile: ts.SourceFile;
  readonly context: SourceProgramContext;
}

interface CompilerDiagnostic {
  readonly path: string;
  readonly code: number;
  readonly category: "error" | "warning" | "suggestion" | "message";
  readonly message: string;
  readonly start: number | undefined;
  readonly length: number | undefined;
}
interface EffectiveCompilerOptions {
  readonly target: "ES2023";
  readonly lib: readonly ["ES2023"];
  readonly moduleResolution: "bundler";
  readonly moduleDetection: "force";
  readonly types: readonly string[];
}
interface CompilerProjectEvidence {
  readonly project: PackageName;
  readonly configPath: string;
  readonly options: EffectiveCompilerOptions;
  readonly projectReferences: readonly string[];
  readonly sourcePaths: readonly string[];
  readonly diagnostics: readonly CompilerDiagnostic[];
}
interface CompilerEvidence {
  readonly projects: readonly CompilerProjectEvidence[];
  readonly status: "valid" | "invalid";
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly violations: readonly Violation[];
}

type CapabilityName =
  | "GlobalObject" | "DateConstructor" | "DateNow" | "MathObject"
  | "MathRandom" | "BunGlobal" | "ProcessGlobal" | "BufferGlobal"
  | "Clean" | "UnknownCapabilityDerived";
type CapabilityUse = "read" | "call" | "construct" | "escape";
interface CapabilityFact {
  readonly sourcePath: string;
  readonly location: SourceLocation;
  readonly possibilities: readonly CapabilityName[];
  readonly use: CapabilityUse;
  readonly certainty: "proven" | "unknown";
}
interface CapabilityFacts {
  readonly sourcePath: string;
  readonly facts: readonly CapabilityFact[];
  readonly status: "complete" | "blocked";
  readonly violations: readonly Violation[];
}

type StageName =
  | "inventory" | "config-graph" | "source-parse" | "syntax"
  | "references" | "compiler" | "manifest-exports" | "capability-flow";
type StageResult<T> =
  | { readonly stage: StageName; readonly status: "ok";
      readonly value: T; readonly violations: readonly [] }
  | { readonly stage: StageName; readonly status: "blocked";
      readonly value: undefined; readonly violations: readonly Violation[] }
  | { readonly stage: StageName; readonly status: "partial";
      readonly value: T; readonly violations: readonly Violation[] };

interface StageContext { readonly mutation: ScanMutation | undefined }
interface InventoryStage {
  (root: string, context: StageContext): StageResult<WorkspaceInventory>;
}
interface ConfigGraphStage {
  (inventory: WorkspaceInventory, context: StageContext): StageResult<ConfigGraph>;
}
interface SourceParseStage {
  (inventory: WorkspaceInventory, graph: ConfigGraph,
   context: StageContext): StageResult<readonly SourceInput[]>;
}
interface ManifestStage {
  (inventory: WorkspaceInventory, context: StageContext):
    StageResult<readonly ManifestModel[]>;
}
interface CompilerStage {
  (inputs: readonly SourceInput[], inventory: WorkspaceInventory,
   graph: ConfigGraph, context: StageContext): StageResult<CompilerEvidence>;
}
interface ReferenceStage {
  (input: SourceInput, graph: ConfigGraph, manifest: ManifestModel,
   context: StageContext): StageResult<readonly ModuleReference[]>;
}
interface CapabilityStage {
  (input: SourceInput, context: StageContext): StageResult<CapabilityFacts>;
}
interface ScanWorkspace {
  (root: string, context?: StageContext): readonly Violation[];
}
```

The frozen `ManifestModel` is:

```ts
interface ManifestDependency {
  readonly name: string;
  readonly scope: "dependencies" | "optionalDependencies" |
    "peerDependencies" | "devDependencies";
  readonly version: string;
}
type ManifestExportStatus =
  | "valid" | "missing" | "malformed" | "unreadable"
  | "symlink" | "outside" | "unsupported";
interface ManifestExport {
  readonly subpath: string;
  readonly target: string;
  readonly targetPath: string | undefined;
  readonly targetKind: PathKind;
  readonly surface: PolicySurface;
  readonly status: ManifestExportStatus;
}
interface ManifestModel {
  readonly path: string;
  readonly owner: "workspace" | PackageName;
  readonly packageName: string;
  readonly dependencies: readonly ManifestDependency[];
  readonly exports: readonly ManifestExport[]; // canonical subpath order
  readonly status: "valid" | "partial" | "blocked";
  readonly violations: readonly Violation[];
}
```

### Frozen propagation and failure semantics

- A/F creates exactly one `ReadOutcome` for every inventoried readable source. A failed read is the A/F violation and a blocked input; no guessed source is emitted.
- A/F decodes the bytes once into `SourceSnapshot`. `source-parse` creates one snapshot-backed `ts.Program`, one `ts.TypeChecker`, and one `SourceProgramContext` per project context through a snapshot-backed TypeScript host; the host returns the pre-read text/source and never opens the path.
- `compiler` validates the existing context and records `CompilerEvidence`; it does not create a second program or parse. `references` and `capability-flow` consume `SourceInput`; they do not accept a path, read, stat, decode, reparse, or independently inventory.
- A parse failure is owned by `G0-C-SOURCE-PARSE` and blocks only that file from reference/capability guessing. Independent files continue. A stage catches owned operational errors into its violations; an unexpected failure is a deterministic nonzero scan failure and never a clean result.
- I0 invokes each applicable stage once and passes only typed results. It concatenates all stage violations and is the only place that stable-sorts the final result by portable `path`, `rule`, and `detail` using Unicode scalar order. It never filters, deduplicates, reinterprets, or rereads.

## 4. Frozen ownership and stage boundary

| Fact/policy | Sole owner | Typed consumer / prohibition |
|---|---|---|
| Filesystem kind/readability and source/control/test/ignored membership | A/F inventory | all later stages consume `WorkspaceInventory`; no restat/reclassification |
| Source bytes and read outcomes | A/F | `source-parse` consumes outcomes; no later path reads |
| Package manifest JSON shape, dependencies, normalized exports and target regularity | A/F manifest stage | B/C/E consumes `ManifestModel`; never parses manifests or owns export facts |
| Config nodes, edges, recursive target status, shape, containment, cycles | A/F config graph | B/C/E consumes `ConfigGraph`; never reinterprets config shape |
| Source parsing, `SourceInput`, `SourceProgramContext` | B/C/E source-parse | compiler/references/D consume the same inputs; no second program |
| Raw source syntax and syntax-first package identity | B/C/E syntax | no resolver before raw classification |
| Module reference extraction, resolution, and source-target policy | B/C/E references | uses A/F facts; no path read or path-kind authority |
| Compiler isolation and source directive policy | B/C/E compiler | uses existing context/graph; no second compiler guard |
| Capability meaning, symbol identity, scope, flow/fixpoint, sinks | D | consumes `SourceInput`; no module extraction/config parsing |
| Production orchestration and final aggregation/sort | I0 | sole `scanWorkspace`; no G1/G2 scanner |
| Case metadata, literal arrays, pairs, provenance | G1 | assurance only; never an expectation oracle from scanner output |
| Mutation evidence, watchdog and CI authority | G2 | assurance/command authority only; no production policy duplicate |
| Legacy structural test migration and final P0 fan-in | I1 | thin caller/evidence integration only; no second scanner |
| Fixture mutation vocabulary | A0 contract support | all fixture helpers compose `FixtureOperation`; no callbacks or ad hoc writes |

“One authority” means one production scanner, one normal scanner command, and one wrapped root-test authority. G1/G2 may contain many assurance tests; they are not additional scanners or root authorities.

## 5. Frozen mutation and case contracts

### Closed production check map

The map is one-to-one. Every row has one stage owner, one exact pre-execution branch, one canonical isolated red case, one reciprocal isolated green pair, and one mutation record. A shared helper may be used only if these branches remain independently observable.

| Check ID | Sole stage | Canonical red case ID | Paired green case ID | Exact branch location/identity | Mutation ID |
|---|---|---|---|---|---|
| `G0-A-INVENTORY` | A/F inventory | `G0-A-inventory-required-root-read-failure` | `G0-A-inventory-regular-complete-workspace` | first executable branch in `inventoryStage`, before traversal | `MUT-G0-A-INVENTORY` / `A.inventory.pre-execution` |
| `G0-B-SYNTAX` | B/C/E syntax | `G0-B-syntax-forbidden-raw-workspace-identity` | `G0-B-syntax-allowed-raw-workspace-edge` | first executable branch in syntax classification, before resolution | `MUT-G0-B-SYNTAX` / `B.syntax.pre-execution` |
| `G0-C-REFERENCES` | B/C/E references | `G0-C-references-ambient-aliased-loader` | `G0-C-references-local-bound-loader` | first executable branch in reference extraction/resolution, before extraction | `MUT-G0-C-REFERENCES` / `C.references.pre-execution` |
| `G0-C-SOURCE-PARSE` | B/C/E source-parse | `G0-C-source-parse-malformed-source` | `G0-C-source-parse-valid-source` | first executable branch before parse diagnostics/program creation | `MUT-G0-C-SOURCE-PARSE` / `C.source-parse.pre-execution` |
| `G0-D-CAPABILITY-FLOW` | D capability-flow | `G0-D-capability-global-object-escape` | `G0-D-capability-local-clean-control` | first executable branch in D before analysis/fixpoint | `MUT-G0-D-CAPABILITY-FLOW` / `D.capability-flow.pre-execution` |
| `G0-E-COMPILER` | B/C/E compiler | `G0-E-compiler-effective-kernel-widening` | `G0-E-compiler-exact-inherited-isolation` | first executable branch in compiler stage before evidence evaluation | `MUT-G0-E-COMPILER` / `E.compiler.pre-execution` |
| `G0-E-CONFIG-GRAPH` | A/F config graph | `G0-E-config-graph-malformed-extends` | `G0-E-config-graph-valid-recursive-graph` | first executable branch before recursive dereference | `MUT-G0-E-CONFIG-GRAPH` / `E.config-graph.pre-execution` |
| `G0-F-MANIFEST-EXPORTS` | A/F manifest-exports | `G0-F-manifest-missing-or-swapped-export` | `G0-F-manifest-exact-normalized-exports` | first executable branch before manifest/export validation | `MUT-G0-F-MANIFEST-EXPORTS` / `F.manifest-exports.pre-execution` |

The exact closed mutation union and positional mapping are:

```ts
type BoundaryCheckId =
  | "G0-A-INVENTORY" | "G0-B-SYNTAX" | "G0-C-REFERENCES"
  | "G0-C-SOURCE-PARSE" | "G0-D-CAPABILITY-FLOW"
  | "G0-E-COMPILER" | "G0-E-CONFIG-GRAPH"
  | "G0-F-MANIFEST-EXPORTS";
type MutationBranchId =
  | "A.inventory.pre-execution" | "B.syntax.pre-execution"
  | "C.references.pre-execution" | "C.source-parse.pre-execution"
  | "D.capability-flow.pre-execution" | "E.compiler.pre-execution"
  | "E.config-graph.pre-execution" | "F.manifest-exports.pre-execution";
type MutationId =
  | "MUT-G0-A-INVENTORY" | "MUT-G0-B-SYNTAX"
  | "MUT-G0-C-REFERENCES" | "MUT-G0-C-SOURCE-PARSE"
  | "MUT-G0-D-CAPABILITY-FLOW" | "MUT-G0-E-COMPILER"
  | "MUT-G0-E-CONFIG-GRAPH" | "MUT-G0-F-MANIFEST-EXPORTS";
interface ScanMutation {
  readonly kind: "disable-stage";
  readonly checkId: BoundaryCheckId;
  readonly mutationId: MutationId;
  readonly branchId: MutationBranchId;
}
```

The production CLI calls only `scanWorkspace(root)` and cannot construct/import `ScanMutation`. The mutation branch is evaluated before the named stage performs policy work. A disabled stage returns `status: "blocked"`, `value: undefined`, and an empty violation list. Dependents receive no substitute facts and do not guess; independent stages continue. A mutant test asserts the literal complete baseline and literal complete mutant arrays, including retention of unrelated diagnostics, and proves the normal CLI cannot reach the branch. Whole-layer omission and trivial `[]` orchestrator mutants are separate G2 assurance mutations.

### Complete fixture operation vocabulary

All fixture mutations, including failures, races, and special files, use this exact data-only union. No hidden callbacks, scanner hooks, output transforms, expectation factories, privileged permission workaround, or unrelated host path is permitted.

```ts
type FixtureFailureOperation = "lstat" | "stat" | "read" | "readdir";
type FixtureFailureCode = "EACCES" | "EIO" | "ENOENT";
type FixtureReplacement =
  | { readonly kind: "write"; readonly contents: string }
  | { readonly kind: "remove" }
  | { readonly kind: "mkdir" }
  | { readonly kind: "symlink"; readonly target: string };
type FixtureOperation =
  | { readonly kind: "mkdir" | "remove" | "symlink";
      readonly path: string; readonly target?: string }
  | { readonly kind: "write";
      readonly path: string; readonly contents: string }
  | { readonly kind: "chmod";
      readonly path: string; readonly mode: number }
  | { readonly kind: "inject-failure";
      readonly operation: FixtureFailureOperation;
      readonly path: string; readonly error: FixtureFailureCode }
  | { readonly kind: "change-between";
      readonly path: string;
      readonly boundary: "after-lstat-before-read" | "after-lstat-before-stat";
      readonly replacement: FixtureReplacement }
  | { readonly kind: "special-other";
      readonly path: string; readonly representation: "fifo" };
```

`inject-failure` is authoritative for `lstat`/`stat`/`read`/`readdir`; `chmod` is supplementary and tests cannot depend on root. `change-between` runs exactly once at the named harness operation boundary without callbacks. `special-other` creates only an unprivileged workspace-local FIFO or pinned platform equivalent; unsupported platform capability fails fixture support. Symlink operations include dangling targets. Fixtures never invoke the scanner to create expectations.

### Frozen ledger/provenance/pair contract

```ts
interface CaseProvenance {
  readonly id: string;
  readonly artifact: string;
  readonly commit: string;
  readonly tree: string;
  readonly mergeBase: string;
  readonly ciRun?: string;
  readonly sha256?: string;
}
interface GreenPair { readonly redId: string; readonly greenId: string }
type CaseGroup =
  | "filesystem-discovery" | "manifest-exports-config"
  | "module-syntax-workspace-law" | "typescript-resolution"
  | "ast-reference-inventory" | "ambient-symbol-flow"
  | "compiler-isolation" | "ci-authority";
type AssuranceLayer = "A" | "B" | "C" | "D" | "E" | "F" | "G1" | "G2";
interface CaseSpec {
  readonly id: string;
  readonly group: CaseGroup;
  readonly matrixRows: readonly string[];
  readonly assuranceLayer: AssuranceLayer;
  readonly fixtureMutation: readonly FixtureOperation[];
  readonly expected: readonly Violation[];
  readonly pairedGreenControl: string;
  readonly killsCheckIds: readonly BoundaryCheckId[];
  readonly provenance: readonly CaseProvenance[];
}
```

Every case has one known group/layer, at least one matrix row, nonempty fixture operations, one or more frozen check IDs, nonempty provenance, and an independently authored literal expected array in canonical order. Every red has one reciprocal non-self green pair; pair links are bijective and both roots are separate temporary roots from the same clean seed. The complete output equals the literal array, not merely contains/omits one diagnostic. An unrelated violation fails the case.

The committed provenance manifest binds every identity to artifact, commit, tree, merge-base, and optional CI/artifact checksum. Unknown, absent, mismatched, changed, unavailable, or missing artifact identity is stale and fails the ledger. Provenance is not a runtime oracle, and expected arrays cannot be generated from scanner output or historical reports.

The canonical violation order is stable lexicographic Unicode scalar comparison of portable root-relative `path`, then `rule`, then `detail`; I0 alone sorts, and G1 never filters/deduplicates. G1 meta-mutants independently fail for deleted/duplicate IDs, stale provenance, missing/nonreciprocal/self pairs, unknown groups/layers/matrix/checks, changed/missing expected arrays, callback/non-fixture operations, contaminated roots, scanner-derived expectations, unrelated-violation masking, and ordering changes.

## 6. Frozen grammar, config, and watchdog policy

### TypeScript/reference authority

The pinned authority is Bun `1.4.0`, TypeScript `5.9.3` from `bun.lock`, `moduleResolution: bundler`, `moduleDetection: force`, target/lib `ES2023`, and kernel-inherited `types: []`. Frozen install is mandatory. A TypeScript/Bun/module-resolution/package-topology change invalidates grammar reconciliation and all dependent handoffs.

`ts.preProcessFile(text, true, true)` reconciles `importedFiles`, `referencedFiles`, `typeReferenceDirectives`, and `libReferenceDirectives`; it is not the sole loader parser. The AST/checker extractor uses public TypeScript APIs and documented JSDoc APIs, never regex over source bytes. The exact supported forms are:

| Form | Static/shape rule and result |
|---|---|
| `ImportDeclaration` | string literal/no-substitution template; `import` |
| `ExportDeclaration` | string literal/no-substitution template; `export` |
| `ImportEqualsDeclaration` | one static external string; `import-equals`; `import x = M.x` is not external |
| `ImportTypeNode` | string literal/no-substitution template, including qualified and `typeof import("x")`, plus supported attributes; `import-type` |
| dynamic `import(...)` | one argument, or two with supported attributes object; first static; `dynamic-import` |
| ambient `require(...)` | exactly one static argument and checker-proven ambient `require`; `require` |
| ambient `require.resolve(...)` | ambient loader, literal `.resolve`, one static argument; `require-resolve` |
| ambient `module.require(...)` | ambient `module`, literal `.require`, one static argument; `module-require` |
| JSDoc `@import` | materialized `JSDocImportTag.moduleSpecifier`, including supported `@import type`; `jsdoc-import` |
| JSDoc type forms | nested materialized `ImportTypeNode` in every materialized JSDoc tag; `import-type` with enclosing provenance |
| triple-slash `path` | preprocessor `referencedFiles`; `triple-slash` |
| triple-slash `types`/`lib` | preprocessor type/lib directives; `triple-slash`, kernel production rejects as `kernel-reference` |

Static is exactly one AST literal; concatenation, substitution, identifiers, properties, spreads, and computed values are not static. Aliases/chains are accepted only while checker/flow proves the reaching ambient loader. Local shadowing, reassignment, closure capture, unsupported arity/attributes, unknown computed members, unresolvable declarations, and future/unclaimed syntax produce the sole uncertainty `boundary-ast-uncertain`, never clean. `boundary-dynamic` is not a second accepted result. Reconciliation subtracts only explicitly documented CommonJS loader extensions not reported by the preprocessor. A parser or toolchain upgrade requires refreshed inventory and corpus before merge.

For every reference the order is: static extraction/uncertainty; raw syntax identity (`@loredu/*`, protocol/builtin, relative, external); package edge/seam decision; only then permitted resolution; finally target classification from A/F facts. `paths` and `baseUrl` cannot launder raw workspace identity.

### Config graph and references

A/F uses one `lstat`-first classifier for every policy path:

```text
absent | regular-file | directory | symlink | other | unreadable
```

Required root/package manifests and tsconfigs are regular readable non-symlink files; package/source roots and CLI `bin/` are real readable nonempty directories; optional `packages/kernel/testing` is green only for true absence or valid real directory; exports target regularity is checked by A/F. Dangling symlinks are symlinks, never absence. Every lstat/read/stat/readdir/parse failure or race is deterministic `unreadable`/`changed`, never a throw or absence. No failed classification is followed by realpath/read/readdir/JSON/resolver/program work.

A/F records every config node and edge, including malformed/unresolved edges, recursively with visited/in-progress sets. Cycles are represented and red. The top-level object must be plain; `extends` is a nonempty string; `references` is an array of plain objects whose only accepted source keys are `path` (required nonempty string), optional boolean `prepend`, and optional boolean `circular`; `originalPath` and every unknown key are forbidden. `paths` is a plain object with at most one `*` per key and nonempty arrays of relative patterns; `baseUrl` is a real readable workspace directory. Dependency maps are plain objects with string versions; exports are the exact plain key/string map, not arrays/conditions/wildcards/null/non-string targets.

Allowed `extends` targets are workspace-contained relative JSON/extensionless same-package or root config forms. Package-name, URL, node_modules, directory/index, source-file, outside, symlink, dangling, missing, unreadable, malformed, cyclic, and unsupported targets are red; cross-package package-config extends are forbidden. Allowed project-reference targets are workspace-contained exact config paths or known package directories resolving to `tsconfig.json`; root solutions may reference known packages; package edges follow kernel none, store→kernel, CLI→kernel/store. `circular: true` does not legalize a Loredu graph cycle. `paths` substitutions remain workspace-contained, inventoried, allowed source/control surfaces and cannot impersonate `@loredu/*`; used missing expansion is `boundary-target`.

### Watchdog and root authority

The wrapper starts one command directly, without shell interpolation, arms its timer before waiting, inherits stdio, and places the child in a complete owned process boundary: POSIX process group; Windows equivalent job/process-tree boundary available through pinned Bun/runtime APIs. Direct-child-only cleanup is not accepted. If setup is unavailable before spawn or complete cleanup cannot be proven, it exits **125** with stable watchdog-capability/cleanup-failure diagnostics and G2 is blocked/escalated; it cannot claim timeout success or leave an owned descendant.

Invalid invocation exits **2** without spawning. Normal child exit 0 is preserved; normal nonzero is preserved; signal-only maps to **1**. Successful timeout cleanup exits **124**. Budgets are exactly 60 seconds for `check:boundaries`, 180 seconds for the complete root test, and 10 minutes for the GitHub `workspace-suite` outer job. The 10-minute ceiling is fail-closed defense-in-depth, not a replacement for either command budget.

The planned root scripts are exact in meaning:

```text
check:boundaries = run-with-watchdog(60, scripts/check-workspace-boundaries.ts)
test             = run-with-watchdog(180, bun test)
```

The workflow has exactly one explicit `bun run check:boundaries` step and exactly one explicit `bun run test` step; the latter is the sole root-test authority and is watchdog-wrapped by the root `test` script. Final commands/evidence contain no standalone raw `bun test`. Focused development/debug runs are not final acceptance evidence. The selector uses `docs_only=false` for code/config/workflow changes, skips docs suite, runs workspace suite, and an `if: always()` aggregate fails closed on any selected-suite failure/cancellation/skip laundering.

## 7. Contract matrix and complete coverage

The G0 matrix is unchanged and remains Steward-classified:

| Matrix row | Classification | Planned ownership/evidence |
|---|---|---|
| CM-I41 | `IN_SCOPE` | A/F test-surface inventory; B/C/E syntax/target law; I0 one scanner; G1 exact seam cases; G2 mutation/authority cases |
| CM-I43 | `IN_SCOPE` | A/F manifest dependencies/exports; B/C/E syntax-first DAG/resolution; I0; G1 package-edge cases; G2 per-check mutants |
| CM-I44 | `IN_SCOPE` | B/C/E environment imports/directives/compiler; D ambient globals; G1 AST/flow cases; G2 source-parse/reference/compiler/flow mutants |
| CM-I45 | `IN_SCOPE` | D symbol/lexical/fixpoint flow; G1 capability cases; G2 flow mutant and novel assurance probe |
| CM-I46 | `IN_SCOPE` | A/F config graph; B/C/E effective compiler evidence and negative compile; G1 compiler/directive cases |
| CM-I47 | `IN_SCOPE` | A/F total inventory/config/manifest facts; B/C/E resolver target ownership; G1 discovery/resolution/export cases |
| CM-I50 | `IN_SCOPE` | A/F total/no-throw; I0 sole scanner; G1 ledger; G2 mutation/watchdog/CI; I1 exact-head evidence |
| Public package/domain/capability-port/catalog contract | `OUT_OF_SCOPE` | no package export, domain term, capability meaning, T-number, or catalog-status change |
| Accepted P0 and master after 612 | `DEPENDENCY` | required before I1 final evidence; any owned-path change invalidates descendants |
| New public semantic/tool/dependency need | `AMBIGUOUS` | none known; immediate stop and decision-record route, never local invention |

A0 has vocabulary-only contact with all seven rows and cannot claim any. No behavioral `@covers` marker or `catalog-status.json` row moves.

Mandatory case inventory, carried into G1, includes all historical replan-1 closure: nested supported discovery; unsupported executable/unknown extensions; missing/unreadable roots; source/control/testing symlinks including dangling; ignored trees; unknown/external/builtin/workspace/testing references; resolver extension/declaration/index/outside cases; every static import/export/import-equals/import-type/import-call/require/resolve/module/JSDoc/triple-slash form; comments/attributes/dynamic uncertainty; capability aliases/globalThis/destructures/shorthand/computed/unknown-computed/call/apply/optional/indirect/escape/branch/backedge/closure/recursive/fixpoint cases; malformed/missing/cyclic configs; malformed references/paths and exact `path`/boolean grammar; control-path symlinks; optional absence; changed-between races; FIFO/other; exact export maps and target regularity; inherited compiler options and negative compile; parent paths with spaces or `tests`; clean real workspace; selector/duplicate/missing invocation/aggregate mutants; descendant cleanup and all watchdog exits.

## 8. Slice-by-slice material plan

All per-slice acceptance is independent of later output. Each slice must publish a handoff containing the actual immutable identities, complete changed paths, exact commands/tool versions, and invalidation scope. Symbolic placeholders below are planning requirements, never acceptable evidence.

### A0 — contract and fixture schema lock

**Goal:** land the exact shared internal types, stage signatures, closed IDs, mutation positional map, full fixture operation union, ledger/provenance/pair schema, canonical sort rule, and no-reread propagation contract without implementing policy.

**Owned paths:**

- `scripts/workspace-boundaries/contracts.ts` (new);
- `tests/support/workspace-boundaries/case-schema.ts` (new);
- `tests/support/workspace-boundaries/fixture-operations.ts` (new);
- A0 schema tests only under `tests/support/workspace-boundaries/`;
- no root `package.json`, no workflow, no scanner entrypoint, no package files, no `docs/**`, no catalog status.

**Interfaces:** all §3 contracts, including `ManifestModel`, `ModuleReference`, `CompilerEvidence`, `CapabilityFacts`, `SourceProgramContext`, `SourceInput`, `StageName` with `source-parse`, `StageResult`, `StageContext`, all stage signatures, `ScanMutation`, `CaseSpec`, `CaseProvenance`, `GreenPair`, and complete fixture operations.

**IN_SCOPE:** contract compilation, closed unions, schema validation, literal-array/canonical-sort metadata, typed pair/provenance references, no-scanner/no-root-wiring proof.  
**OUT_OF_SCOPE:** every scanner policy result, resolver/compiler execution, config traversal, capability result, CI/watchdog, matrix acceptance, T-number.  
**DEPENDENCY:** base `612ddcb`/tree `1216774`; Steward clarification `ed2db13...`; amended/reviewer identities above; pinned Bun/TS.  
**AMBIGUOUS:** none; a new public semantic is an immediate stop.

**Red/green evidence:** malformed CaseSpec metadata (unknown IDs/groups/layers/rows, duplicate/deleted IDs, missing literal expected array, missing pair/provenance, callback or extra fixture field) red; valid schema and valid complete operation records green. These tests do not invoke `scanWorkspace` and make no G0 claim.

**Planned identity:** base/parent commit `612ddcb...`; base/parent tree `1216774...`; merge-base `612ddcb...`; consumed contract hashes `ed2db13...`, `ee643091...`, `8aef1c...`, `998f838...`. A0's resulting commit/tree and contract artifact SHA are created by implementation and must be recorded before any child dispatch; absence is `needs-action`.

### PF-A0 — dispatch preflight (not a code slice)

After A0 is proposed and before A/F/B/C/E/D/G1-schema fan-out, run a coordinator preflight against the exact A0 head. Verify: A0 commit/tree/parent/merge-base; changed paths are only the A0 allowlist; contracts compile; schema tests prove malformed metadata failures; no scanner import/invocation; no root script/workflow/package/catalog change; complete operation union includes injected failures, both races, and FIFO; all frozen hashes match. Record `PF-A0=PASS` or do not dispatch.

### A/F — facts, inventory, manifests, and total config graph

**Goal:** produce all filesystem, source-snapshot/read, manifest/export, dependency, and recursive config facts consumed by later stages.

**Owned paths:**

- `scripts/workspace-boundaries/inventory.ts`;
- `scripts/workspace-boundaries/config-graph.ts`;
- `scripts/workspace-boundaries/manifest-model.ts`;
- `tests/support/workspace-boundaries/filesystem-fixtures.ts` (composes A0 operations only);
- A/F unit/fixture cases only; no root command/workflow/scanner orchestrator.

**Interfaces:** `InventoryStage`, `ConfigGraphStage`, `WorkspaceInventory`, `PackageInventory`, `ReadOutcome`, `SourceSnapshot`, `ConfigNode`, `ConfigEdge`, `ConfigGraph`, `ManifestStage`, `ManifestModel`.

**IN_SCOPE:** lstat-first classification; one read outcome/snapshot per source; source/control/test/ignored membership; all required controls/roots; manifests/dependency maps/export targets; recursive graph nodes/edges, malformed shapes, unknown reference keys, `path`/`prepend`/`circular` validation, containment, cycles, races and failures; exact A/F violations and no-throw behavior; the distinct `A.inventory.pre-execution`, `E.config-graph.pre-execution`, and `F.manifest-exports.pre-execution` branches in the owning stage entrypoints.  
**OUT_OF_SCOPE:** source syntax/reference extraction, TypeScript resolver use, capability meanings, compiler evidence interpretation, mutation harness execution, watchdog, root/CI authority, product code.  
**DEPENDENCY:** A0 exact contract commit/tree; base ancestry from `master@612`; current package topology; pinned config.  
**AMBIGUOUS:** none under the Steward contract; any deviation stops.

**Red/green fixtures:** injected `lstat/stat/read/readdir` EACCES/EIO/ENOENT; `change-between` read/stat races; missing/unreadable/non-directory roots; ordinary/dangling symlinks; FIFO; malformed JSON/null/array/scalar; malformed `extends`, references, paths, baseUrl; missing/outside/ignored/symlink/cyclic/unsupported targets; invalid boolean/unknown reference keys; export target mutations. Green: true optional testing absence, regular complete workspace, valid recursive graph, valid supported booleans, order-independent manifest keys, nested supported sources.

**Planned identity:** base is A0 exact head/tree; parent is A0 exact commit/tree; merge-base remains `612ddcb` unless ordinary integration proves otherwise. A0 handoff SHA is the immutable contract hash. The actual A/F commit/tree and handoff contract SHA must bind all children.

### B/C/E — source parse, syntax/reference/resolution, compiler isolation

**Goal:** parse pre-read snapshots once, enforce complete syntax-first module law, resolve only permitted references against A/F facts, and prove compiler isolation.

**Owned paths:**

- `scripts/workspace-boundaries/source-parse.ts`;
- `scripts/workspace-boundaries/syntax-law.ts`;
- `scripts/workspace-boundaries/module-references.ts`;
- `scripts/workspace-boundaries/resolution.ts`;
- `scripts/workspace-boundaries/compiler-isolation.ts`;
- B/C/E unit/fixture cases; no root wiring, watchdog, mutation harness, D, or duplicate manifest/config authority.

**Interfaces:** `SourceParseStage`, `ReferenceStage`, `CompilerStage`, `SourceInput`, `SourceProgramContext`, `ModuleReference`, `CompilerEvidence`, `CompilerProjectEvidence`, `ManifestModel`, `WorkspaceInventory`, `ConfigGraph`, `StageContext`.

**IN_SCOPE:** `source-parse`; one program/checker context; complete grammar table and preprocessor reconciliation; JSDoc/import-type/loaders/triple slash; uncertainty; syntax-before-resolution; raw workspace identity, testing seam, package edges, generic kernel externals/builtins; permitted bundler resolution and target policy using A/F facts; effective compiler options, source directives, negative compile; the distinct `B.syntax.pre-execution`, `C.references.pre-execution`, `C.source-parse.pre-execution`, and `E.compiler.pre-execution` branches in the owning stage entrypoints.  
**OUT_OF_SCOPE:** filesystem/config/manifest fact creation, capability flow, watchdog/CI, root scanner, product/package changes.  
**DEPENDENCY:** A0 exact contract; accepted A/F exact head/tree/handoff; pinned Bun/TS and lockfile.  
**AMBIGUOUS:** none; future/unclaimed syntax is `boundary-ast-uncertain` and a toolchain change blocks the slice.

**Red/green fixtures:** all canonical check-map pairs; every `ImportTypeNode` outcome; aliases/chains and local binding controls; JSDoc import/type forms; preprocessor mismatch; path-collision workspace names; ignored/test/outside/symlink/missing targets; extension/declaration/index aliases; triple-slash; effective `types`/`lib` widening; exact inherited controls and negative compiler. Tests prove no resolver call precedes syntax law and no source is re-read/reparsed.

**Planned identity:** base/parent are the exact accepted A/F head/tree; merge-base is `612ddcb` or a recorded ordinary merge-base after master integration. A/F handoff SHA is the contract hash. Actual B/C/E head/tree and handoff bind all consumers.

### D — capability flow

**Goal:** analyze ambient capabilities by checker symbol, lexical scope, statement order, conservative flow joins and fixpoint, with no text/name fallback.

**Owned paths:**

- `scripts/workspace-boundaries/capability-facts.ts`;
- `scripts/workspace-boundaries/capability-flow.ts`;
- D unit/fixture cases under test support; no modifications to A/F/B/C/E, root, workflow, or product packages.

**Interfaces:** `CapabilityFacts`, `CapabilityFact`, `CapabilityName`, `CapabilityUse`, `SourceInput`, `SourceProgramContext`, `StageContext`.

**IN_SCOPE:** ambient/local/imported/parameter symbol identity; globalThis aliases/destructuring/renames/defaults; all five global families; direct/literal/unknown computed properties; shorthand; optional/parenthesized/as/non-null; call/apply/indirect invocation; exports and every escape sink; mutable definite writes; branch joins, loops/backedges, closures, recursion and fixpoint; explicit-value/clean controls; the distinct `D.capability-flow.pre-execution` branch in the owning stage entrypoint.  
**OUT_OF_SCOPE:** module extraction/resolution, manifests/config/filesystem, compiler-policy ownership, root/CI/watchdog, capability-port/domain changes.  
**DEPENDENCY:** A0 exact contract; A/F `SourceSnapshot` inventory; B/C/E `SourceInput`/checker context exact head. D is not an A0-parallel policy slice.  
**AMBIGUOUS:** none; unsupported checker meaning becomes `UnknownCapabilityDerived`/red or blocks for a tool review.

**Red/green fixtures:** globalThis alias/destructures for Date/Math/Bun/process/Buffer; literal/unknown computed; shorthand; `.call`/`.apply`; branch/backedge/recursive/closure and export/return/property/array/spread/destructure/conditional/unknown-call escapes; tainted joins. Green: labels, inert property names, locals/imports/parameters, explicit Date values, deterministic Math, definitely-clean reassignment.

**Planned identity:** base/parent are exact B/C/E head/tree and handoff; merge-base recorded against 612. Actual D head/tree and handoff are immutable prerequisites to I0.

### I0 — independently mergeable production composition

**Goal:** create exactly one production `scanWorkspace` from completed typed stages, with no root/CI/watchdog authority and no executable ledger.

**Owned paths:**

- `scripts/check-workspace-boundaries.ts` as the sole production orchestrator and normal scanner API;
- `scripts/workspace-boundaries/composition.ts` if a private composition adapter is needed;
- `tests/support/workspace-boundaries/composition-contract.test.ts` for typed stage-order/no-reread/mutation-context composition checks;
- no root `package.json` script, no workflow, no watchdog, no case ledger execution, no package/domain/docs/catalog files.

**Interfaces and exact order:**

1. `inventoryStage(root, context)` once;
2. `configGraphStage(inventory, context)` once;
3. `manifestStage(inventory, context)` once;
4. `sourceParseStage(inventory, graph, context)` once;
5. `compilerStage(inputs, inventory, graph, context)` once;
6. for each applicable `SourceInput`, `referenceStage(input, graph, owningManifest, context)` once;
7. for each applicable `SourceInput`, `capabilityStage(input, context)` once;
8. concatenate all stage violations and apply the sole canonical sort.

A blocked upstream input is not substituted. I0 passes `StageContext` unchanged, defaults normal invocation to `{ mutation: undefined }`, and makes no policy decisions. `scanWorkspace` is internal and is not a Loredu package export.

**IN_SCOPE:** typed composition, one authority, exact stage invocation count/order, deterministic aggregate/sort, real scanner entrypoint, test-only mutation context transport.  
**OUT_OF_SCOPE:** root command/CI/workflow, watchdog, executable G1 cases, ledger expectations, new policy, package/domain/catalog changes.  
**DEPENDENCY:** exact A/F, B/C/E, and D head/tree/handoff identities; no future G1/G2 output.  
**AMBIGUOUS:** none; a missing typed stage result or second authority is a blocker.

**Red/green evidence:** composition contract uses typed synthetic stage doubles only to assert invocation order and failure propagation, never to claim policy. A valid composed production pipeline has one scanner symbol and no duplicate old scanner. No case expectation is generated here.

**Planned identity:** base/parent are exact D head/tree; merge-base recorded. I0 handoff must bind scanner commit/tree, complete changed paths, stage contract hashes and one-authority static proof.

### PF-I0 — composition preflight before executable fan-out

After I0 merges and before G1 executable work or G2 authority work, run a preflight against the exact I0 head. Verify: all A/F/B/C/E/D handoff hashes and trees; I0 commit/tree/parent/merge-base; `scanWorkspace` is the only production orchestrator; stages are each invoked once in the exact order; no stage accepts a path after source-parse; no root script/workflow/watchdog exists yet; mutation context is test-only; no policy assertion is attributed to A0/I0; I0 can run against a clean temporary workspace without a case-ledger expectation. Record `PF-I0=PASS` or do not dispatch G1/G2.

### G1-schema-only — optional metadata scaffolding after A0

**Goal:** prepare case-registry/provenance file shapes and schema-only meta-test scaffolding without executing or asserting any scanner policy.

**Owned paths:** a child-only metadata scaffold under `tests/support/workspace-boundaries/`, later extended by G1; no I0 import, no fixture execution, no policy expected arrays, no matrix implementation claim, no root/CI authority.  
**IN_SCOPE:** schema metadata declarations already locked by A0.  
**OUT_OF_SCOPE:** scanner output, policy cases, provenance acceptance, executable red/green evidence, all T-numbers.  
**DEPENDENCY:** A0 and PF-A0.  
**AMBIGUOUS:** none; any policy assertion makes the scaffold invalid.

This is optional parallel preparation, not an executable slice and not a substitute for G1. Its handoff says `schema-only` and is not a G1 policy handoff. It may be merged before A/F, B/C/E, D, or I0 without changing the executable DAG.

### G1 — executable literal case ledger against I0

**Goal:** execute every committed red/green pair against I0's production scanner and prove complete accounting, provenance, pair, isolation, ordering, and meta-mutant behavior.

**Owned paths:**

- `tests/support/workspace-boundaries/case-ledger.ts`;
- grouped committed case data and the committed machine-readable provenance manifest under `tests/support/workspace-boundaries/`;
- `tests/workspace-boundaries-ledger.test.ts`;
- the optional G1-schema-only scaffold may be extended here;
- no scanner policy module, root package authority, workflow, or watchdog.

**Interfaces:** A0 schema; I0 `ScanWorkspace`; complete `CaseSpec`, `CaseProvenance`, `GreenPair`, `FixtureOperation`; no raw filesystem callback.

**IN_SCOPE:** all historical/new case IDs; exact literal arrays; complete fixture operations including races/FIFO; one-to-one check kill map; isolated reciprocal pairs; stale provenance; canonical order; execution against I0 only; ledger meta-mutants.  
**OUT_OF_SCOPE:** inventing policy, changing expected arrays to fit I0, mutation branch construction, watchdog, root/CI authority, T-numbers.  
**DEPENDENCY:** PF-I0 pass; A0/A/F/B/C/E/D/I0 exact commit/tree/handoff closure; historical custody identities.  
**AMBIGUOUS:** none; unmapped prior behavior blocks G1, never gets dropped.

**Red/green evidence:** every check-map canonical pair plus all mandatory historical/new groups; literal exact output equality; deleted/duplicate/stale/re-pair/changed-expected/masking/order/fixture meta-mutants. G1 proves ledger correctness and execution coverage; it does not become a scanner.

**Planned identity:** base/parent are exact I0 head/tree and handoff; merge-base recorded. G1 head/tree and ledger/provenance manifest checksum become mandatory immutable inputs to G2.

### G2 — pre-execution mutation, watchdog, root and CI authority

**Goal:** prove every production check is sensitive at its actual pre-execution branch, then establish the only root scanner command, complete watchdog, and explicit fail-closed CI authority.

**Owned paths:**

- `scripts/run-with-watchdog.ts`;
- `tests/support/workspace-boundaries/mutation-harness.ts`;
- `tests/workspace-boundaries-mutation.test.ts` and watchdog/authority tests;
- root `package.json` only for `test` and `check:boundaries` scripts;
- `.github/workflows/ci-required.yml` only for the explicit steps/timeout/aggregate selection needed by this contract.

**Interfaces:** I0 `ScanWorkspace`/`StageContext`; exact `ScanMutation` union/map; G1 executable ledger; watchdog command contract; ADR 0012 selector/aggregate.

**IN_SCOPE:** eight exact pre-execution mutations and branches; canonical baseline/mutant arrays; whole-layer omission and trivial `[]`; normal CLI reachability proof; synchronous hang and descendant; exits 0/9/1/2/124/125; complete process-tree cleanup on POSIX/Windows; one `check:boundaries` command; one wrapped root test; 10-minute workflow ceiling; explicit selector and fail-closed aggregate.  
**OUT_OF_SCOPE:** second scanner, output filtering, policy change, package/runtime code, domain/catalog changes, PR operations.  
**DEPENDENCY:** PF-I0; executable G1 exact head/tree/ledger; P0/master current source if root/workflow conflicts exist.  
**AMBIGUOUS:** none; unsupported process-tree capability yields 125 and blocks/escalates rather than fallback.

**Red/green evidence:** each check mutant removes/changes only its own expected canonical diagnostic and retains unrelated diagnostics; omission/trivial mutants fail. Fixture operations are data-only. Watchdog tests include synchronous hang with a descendant, invalid invocation with no child, ordinary 0 and ordinary 9, signal-only mapping, successful timeout 124, and setup/cleanup failure 125 with proof no owned descendant remains on supported platforms. Static tests reject duplicate scanner/test invocation, raw final root test, missing explicit boundary step, selector laundering, and aggregate pass-on-failure.

**Planned identity:** base/parent are exact G1 head/tree and handoff; merge-base recorded. G2 head/tree and authority/watchdog/mutation manifest checksum become inputs to I1.

### I1 — conditional final landing, legacy-test migration, P0 fan-in and evidence

**Include only because it has real work:** the accepted base contains the legacy `tests/workspace-structure.test.ts`, and its old policy assertions must be migrated so two authorities do not remain. If that migration is already completed by an accepted parent without other landing work, omit I1 and record the omission explicitly.

**Goal:** integrate accepted P0/master, remove/fold legacy policy authority into a thin consumer of I0, reconcile final exact-head facts, and produce the final evidence/landing manifest. I1 is not a new scanner and does not add policy.

**Owned paths:**

- `tests/workspace-structure.test.ts` (rewrite to thin `scanWorkspace` consumer or remove only after equivalent I0/G1 coverage is proven);
- a final integration-only test under `tests/` if needed to assert the real workspace exact expected array and no duplicate authority;
- task/PR evidence manifest for final exact head (not a second repository policy module);
- conflict resolution of accepted P0/master only where the exact handoff records it.

**IN_SCOPE:** accepted P0 fan-in; legacy test migration; final real-workspace scan evidence; exact changed-path/head/tree/merge-base/master binding; same-head Tester/Reviewer/CI evidence; final matrix/case/mutant map.  
**OUT_OF_SCOPE:** new policy/vocabulary, scanner duplication, root command/workflow redesign, package/domain/docs/catalog changes, history rewrite, PR repair.  
**DEPENDENCY:** G2 exact head/tree/handoff; accepted P0 on master; fresh frozen install; no owned-surface master change without re-review.  
**AMBIGUOUS:** any master change touching package topology, compiler config, source roots, workflow, I0/stage paths, or ledger/fixture paths invalidates descendants and requires reclassification before integration.

**Red/green evidence:** old structural logic present/duplicated is red; thin caller through I0 with exact real-workspace expected output is green. Final evidence is bound to one exact head/tree and one CI run. I1 cannot claim acceptance until fresh Tester/Reviewer and exact CI requirements below pass.

**Planned identity:** base/parent are exact G2 head/tree/handoff before P0 integration. After ordinary integration, record new parent/head/tree/merge-base and current master. Any changed owned path invalidates G1/G2 evidence and requires rerun/review rather than a casual conflict resolution.

## 9. Immutable per-slice handoff protocol

Every slice handoff is append-only and must include all of the following actual values; a branch name, PR number, green CI, or prose assertion is invalid without them:

```text
slice: A0 | G1-schema-only | A/F | B/C/E | D | I0 | G1 | G2 | I1
owner/role:
contract-parent-sha256:
base-commit:
base-tree:
parent-commit:
parent-tree:
head-commit:
head-tree:
merge-base:
changed-paths: complete repository-relative manifest
owned-matrix:
owned-checks:
consumed-interfaces-and-exact-signatures:
consumed-parent-handoff-sha256:
local-commands-and-tool-versions: complete results
fixture/case-groups-and-exact-counts:
red-green-controls-and-exact-arrays:
mutation-manifest-and-killed-count:
positive-controls:
provenance-manifest-sha256:
invalidated-by: master/contract/tool/source/lockfile/owned-path changes
pending:
artifacts/checksums:
```

For A0, `contract-parent-sha256` is the clarification hash plus all consumed authority hashes; for each child it is the exact preceding handoff/contract artifact hash. Future hashes are created only by implementation and must be recorded before the next dispatch; symbolic or missing hashes are `needs-action`, not placeholders accepted as evidence.

A child is mergeable only when its own declared paths/tests are green against its immutable parent and it does not require future scanner output. A child cannot modify a sibling's owned paths. P0/master integration uses ordinary merge/rebase policy only; after publication no force-push.

## 10. Exact local/CI/evidence result protocol

### Final acceptance commands

From a fresh worktree at the final exact I1 head, with no standalone raw root-test invocation:

```sh
bun install --frozen-lockfile
bun run lint
bun run spell
bun run check:docs
bun run check:catalog
bun run check:gates
bun run check:boundaries
bun run typecheck
bun run test
bun run build
./packages/cli/dist/lor --version
git diff --check 612ddcb0f23d0177b806942f89a158c50267b926..HEAD
```

`bun run test` is the one 180-second watchdog-wrapped root test. The final command list contains no raw `bun test`; the wrapped root script's child argv is the only complete test process. `bun run check:boundaries` is the one 60-second watchdog-wrapped production scanner command. Focused tests may be used during development but cannot appear in the final acceptance command list, workflow authority, or evidence manifest.

The final exact-head manifest records: all command outputs and versions; final head/tree/merge-base/current master; complete changed paths; A0/A/F/B/C/E/D/I0/G1/G2/I1 handoff checksums; all matrix rows to owners/cases/pairs/mutants/positive controls; literal expected-array counts; provenance and stale-mutant results; exact `mutants killed N/N`; compiler negative diagnostics; source snapshot/no-reread proof; watchdog exits and descendant cleanup; scanner clean result; legacy-authority migration; selector `docs_only=false`; `docs-suite=skipped`; `workspace-suite=success`; `ci-required=success`; exact CI URL/run ID; and same-head independent reports.

### Independent evidence

Fresh Tester and Reviewer roles run only after I1, against the same exact head/tree/merge-base. Tester reruns every committed case and mutation, adds novel filesystem (including race/FIFO), module-reference, and capability-flow probes, verifies all watchdog exits and descendant cleanup. Reviewer audits ownership, stage signatures/order, source snapshot/checker propagation, syntax-before-resolution, complete config/reference grammar, literal ledger/provenance/pairs/order, mutation branch locations, one scanner/one root test/one workflow invocation, and P0/master closure. Mixed-head evidence is invalid. No result is inferred from historical PR #32/#35 CI.

### Changed-head invalidation

Any change to master, P0, package topology, source roots, compiler/Bun/TypeScript/lockfile, workflow, root scripts, I0/stage paths, fixtures, ledger, or provenance invalidates the affected handoff and all descendants. Recompute base/tree/parent/head/merge-base, changed paths, exact expected arrays where relevant, and rerun the dependent preflight and independent evidence. A docs-only master change still requires the documented docs gates; an owned-surface change requires full descendant invalidation. No casual conflict resolution.

## 11. PR closure and historical preservation timing

1. Before implementation dispatch, reverify PR #32/#35 retention tags, peeled commits, trees, merge-bases, remote refs, bundle checksums, and preservation manifests. Do not move, delete, force-push, cherry-pick, repair, or compare against those branches.
2. Create replacement A0 from `master@612` by ancestry and run PF-A0. Do not close historical PRs before custody is reverified.
3. Publish replacement A0 and link all PR #32/#35 custody evidence. PR #35 may then be closed as superseded while retaining its branch/tag/bundle. No repair is pushed to it.
4. Merge replacement slices only in `A0 → A/F → B/C/E → D → I0 → G1 → G2 → I1` order. G1 schema-only scaffolding may be prepared after A0 but is not executable evidence and cannot bypass I0.
5. Keep PR #32 historical and retained through final replacement acceptance. Close PR #32 only after final replacement merge/evidence, as superseded by the merged replacement. Retain its branch/tag/bundle. If PR #35 was not closed at step 3, close it no later than final acceptance; never delete either branch.
6. Accepted P0 must be on master before I1. If it changes any owned surface, stop, rebase/ordinary-merge as permitted, recompute identities, rerun dependent evidence, and obtain fresh same-head review.
7. I1 may land only after fresh Tester/Reviewer approval and exact-head CI; only I1/final coordinator evidence can claim G0 acceptance. This plan does not claim it and does not claim the external human/repository gate.

## 12. Stop conditions

Stop and return `needs-action`/`blocked` rather than inventing a fix if:

- any frozen interface, owner, ID, branch, ledger, grammar, config, watchdog, or root-test rule changes;
- `source-parse` is absent, a later stage accepts a path, or any stage rereads/reparses;
- A0 asserts policy or consumes future scanner output;
- G1 executable cases run before I0 or I0 depends on G1;
- a second scanner, orchestrator, root test authority, workflow boundary invocation, or output-filtering mutation exists;
- any fixture uses a callback/hidden hook, omits failure/race/FIFO vocabulary, or relies on privileged permissions;
- a source reference object accepts any key beyond `path`, optional boolean `prepend`, and optional boolean `circular`;
- direct-child-only cleanup, missing 125 escalation, incomplete descendant proof, duplicate/absent 180-second root watchdog, raw unwrapped `bun test`, or a second root-test invocation appears;
- an expected array is scanner-derived, provenance is stale, pairs are not bijective/isolated, or unrelated diagnostics mask a case;
- a master/P0/contract/tool/lockfile/owned-path change lacks descendant invalidation;
- a historical PR branch/tag/bundle is moved/deleted/force-pushed or used as acceptance;
- implementation needs a public/package/domain/catalog semantic or a new runtime dependency. Route a decision record instead.

## 13. Result protocol

```text
status: READY_FOR_A0_DISPATCH_AFTER_PREFLIGHT
summary: Replan 3 replaces the circular executable G1/I decomposition with A0 -> A/F -> B/C/E -> D -> I0 -> G1 -> G2 -> I1. I0 is the independently mergeable sole production composition slice with no root/CI authority; executable G1 runs against I0; G2 owns pre-execution mutation, complete process-tree watchdog, root commands and CI authority; I1 is conditional and owns real legacy-test/P0/final-evidence integration work only if present.
attempt_count: 5
next_attempt: 6
attempt_limit: 20
replan_count: 3
replan_limit: 4
caused_by: amended replan2 audit found material G1/I circularity and incomplete executable contracts; superseding Steward clarification ed2db13... closed semantic inputs.
planning_base: master@612ddcb0f23d0177b806942f89a158c50267b926
tree: 1216774a600c79894138a7a99d810617789ed0f8
implementation: none
repository_changes: none
acceptance: not claimed
human_gate: not claimed
no_mistakes: not run
next_stage_invocation: not performed
preservation: PR #32/#35 retained as historical; exact custody identities bound above
inputs_needed: none
```

No G0 acceptance, implementation, branch/PR mutation, next-stage invocation, no-mistakes result, or human gate is claimed by this plan.
