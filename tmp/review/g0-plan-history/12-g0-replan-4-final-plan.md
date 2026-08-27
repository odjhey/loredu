# Loredu G0 final material replan 4

**Task:** `loredu-g0-replanner-4--01M11900E198Q4YEN3KHYRZCFY`  
**Disposition:** `READY_FOR_A0_DISPATCH_AFTER_PREFLIGHT`  
**Scope:** planning only. This artifact performs no implementation, branch/PR/repository mutation, issue posting, human gate, no-mistakes run, or next-role invocation. It claims neither G0 acceptance nor CI acceptance.  
**Lineage:** final allowed replan (`replan 4 of 4`); no further replan is available.  
**Planning root:** accepted `master@612ddcb0f23d0177b806942f89a158c50267b926`; tree `1216774a600c79894138a7a99d810617789ed0f8`.  
**Toolchain authority:** Bun `1.4.0` (`.bun-version`), TypeScript `5.9.3` (`bun.lock`), `moduleResolution: bundler`, `moduleDetection: force`, target/lib `ES2023`, kernel `types: []`.

## 1. Hash-bound authority consumed

A hash mismatch, unavailable artifact, or changed base is a stop condition. No implementer may locally reinterpret a frozen item.

| Authority | Path/identity | SHA-256 or immutable identity |
|---|---|---|
| Final Steward closure | `/Users/tiny/.rozoro/tasks/loredu-g0-replan4-steward--01M118E9Q0YKZGYRDQ4M77KE31/g0-replan4-final-closure.md` | `86338b79d54c92d41e0789f27ec009f303dcb8fe1bf8e35aa6cd6904336d594c` |
| Replan 3 | `/Users/tiny/.rozoro/tasks/loredu-g0-replanner-3--01M1176WRGJEKXFP8CQE5F6G9W/g0-replan-3.md` | `820d83dc2e91298c18025ae789d3f2b75a472acca7fca14844c03311df3e64b6` |
| Replan 3 Reviewer handoff | `/Users/tiny/.rozoro/tasks/loredu-g0-replan3-matrix-review--01M117XFQ7T2WRQY5A67XBAERJ/handoff.md` | `e1e698924ea4c14628210c81840b54d1f0d616f24552163a214da14d3e6802be` |
| Replan 3 Reviewer session metadata | `/Users/tiny/.rozoro/tasks/loredu-g0-replan3-matrix-review--01M117XFQ7T2WRQY5A67XBAERJ/session.json` | `c43b982d113e9a817e5cfd34f4ac6595e0325e1c1cba71b0cdfce5c12378bdd0` |
| Replan 3 Reviewer final session | `/Users/tiny/.pi/agent/sessions/--Users-tiny-packages-loredu--/2026-08-27T09-13-18-674Z_4f12fba4-df37-446f-87a7-6d700d28fbf7.jsonl` | session `4f12fba4-df37-446f-87a7-6d700d28fbf7`; `2fae34919ea3c2d27a3b30db832f73f56ef9cc7eefaf76ca7f116e46ff6643ba` |
| Superseding clarification | `/Users/tiny/.rozoro/tasks/loredu-g0-replan3-steward--01M116S6VPWKX60NM9PPS8V7J8/g0-replan3-contract-clarification.md` | `ed2db13e50f3f60d084a55c3103b8efcc81582b3184949e364ac75562b6096f3` |
| Prior Steward decision | `/Users/tiny/.rozoro/tasks/loredu-g0-replan2-contract-steward--01M1157FK6N2S54TG9EYGW6A0X/contract-decisions.md` | `8aef1c4fa99499e6eb8557a65ad15eacf6949d3f9ac547d47b70bbaea2765a32` |
| Prior matrix audit | `/Users/tiny/.rozoro/tasks/loredu-g0-replan2-matrix-review--01M1157FK6MQNHGHJQ3YQ8P9MX/g0-replan-2-matrix-audit.md` | `998f838ef60df2f45ce7ba1285d403a9347e95c7beef68e2030786bb92fca55e` |
| Base | accepted master commit/tree | `612ddcb0f23d0177b806942f89a158c50267b926` / `1216774a600c79894138a7a99d810617789ed0f8` |

Base document identities, consumed at the planning base:

```text
docs/v0.x/execution/implementation-plan.md              64fd3471bffa75b8cb94647645e148a6a3546af0703073a6c22066efbe77d393
docs/decisions/0011-repo-package-architecture.md       15e347c34712ec2cd1803584070c6d661fc159be52e9284b795a1c36d264d74e
docs/decisions/0012-dx-and-ci-gating.md                 17a7dc04fea5d844b063763798eb80bfa842df5de59403d5636355f4f0761d33
docs/decisions/0015-catalog-accounting-and-docs-gate.md 0a316e680b941234571a95a7a3116ab5cf7d4f71a9a809de71140e8ed5927074
docs/decisions/0016-workspace-scaffold-and-kernel-type-isolation.md
                                                        4e0dfc66792f3b16771f1d9c860e6b9cd921335ed5b805045edeb3c5625d590e
docs/decisions/0018-capability-ports.md                  12c0418a320b4f5ccad86891a18f3c67017a38788e73c075cc4e69399b66ca34
docs/decisions/0019-m0-validation-rules.md              84c38edffd9370b09b2a8f705f0f14ae4f7d4581831e1ba315347896fbfe7c07
docs/architecture/contracts/README.md                   4bf4f94bd81f1839ed491e9e17c991312819f8e3c4dd7fefe2b4ea27279c47c0
docs/architecture/contracts/records.md                  1ae5a851a687bf573c127a950968d5b55a745a249f16a8de7a5160e5bf24df23
docs/architecture/contracts/store.md                    c541c44a15e486436017d7b6c22de183f5824b313d2e654e82900de82a89c3af
docs/architecture/contracts/clock-and-identity.md       c405dc86fafa02622f7e91d9da37f8046fc99d6ef7d28c91d60b9daa423aeffb
docs/architecture/ubiquitous-language.md                04cb9cff1f238c5eecb00e4b1e54bcb60fdfe2ea0b12b0ee4260372bd59eb9c9
package.json                                             a8bcc62498f276fecf3b96b73e4d660ab19c0da9494382d5cb12edb70473fbd1
.github/workflows/ci-required.yml                       b4b952694bd5905dcc1f0c1d2fb84116e3860709a5aa46a756866787f0479273
tsconfig.base.json                                      c77086510e7c968266030a56467f34231af41e2d69348c5f0e29e3d1dd7f1062
```

### Historical PR custody (never acceptance evidence)

- PR #32 attempt 3: commit `fc5b79bfc23b902069b0544d6c66944954df3cf7`, tree `a0a2a401adfc2a9aa64fc3f38c111138c7381432`, merge-base `43519c27b9d3be25ab847734d6824f65e9fd2c20`, CI `33044928321`, tag object `f1154f99961a6e6bd4e6c2e09d126aaa8747a713`, peeled commit same, tag `evidence/g0-pr32-attempt3-fc5b79b`, bundle SHA `e0f88b88ba80a9f1ac272305b3489857b11336226681d914c304e6e70d7e7794`, manifest SHA `f80fa68e68da0a5953b42f60bf7923835d50f62e358abf550ab54f8aa014329c`.
- PR #35 attempt 4: commit `207d572e63cacc3d4b2843c6410ea3152bc62f30`, tree `fef6f92694fd6683d2943b8c560bd6b9df89d031`, merge-base `612ddcb0f23d0177b806942f89a158c50267b926`, CI `33049957913`, tag object `fc6ad12f9c6ebd001650c7de65792267446a3952`, tag `evidence/g0-pr35-rejected-207d572-attempt4`, bundle SHA `2f316539fb70a108f546a7348f7bbdcffe1536ee755240ad5b0ed04fa5d82ed7`, manifest SHA `af497748e6ea630206c3621f9d8a3d1586d0f6236b6b09f6da48c8f1f61081c0`.
- PR #35 attempt 5: commit `a945521af7d3a8415f071322b577be6865f9ed8f`, tree `06c42f72db78d83e084b39b4c281a59ab7929335`, merge-base `612ddcb0f23d0177b806942f89a158c50267b926`, CI `33052334867`, tag object `4407b365f4d09ad42eca0b36295bf9e0b69b00c4`, tag `evidence/g0-pr35-rejected-a945521-attempt5`, bundle SHA `6b08ae21c8bc67327b3f64f340cf8ffdfd18e08b821e08877d821f1e369ff7e1`, manifest SHA `c53acac9fd709e4f7d131263c9c64665bf178bf8988d67c2586a24848b8f2cf4`.

Their branches, tags, bundles and reports remain immutable historical false-green/failure custody. No commit is cherry-picked, amended, compared as acceptance, force-pushed, moved, or deleted.

## 2. Frozen internal contract

The following is the complete internal contract. It is not a package export, domain contract, capability-port change, behavioral T-number, or public CLI semantic.

```ts
type PackageName = "kernel" | "store-plainfile" | "cli";
type PolicySurface =
  | "workspace" | "package" | "source" | "test"
  | "control" | "ignored" | "unknown";
type PathKind =
  | "absent" | "regular-file" | "directory" | "symlink"
  | "other" | "unreadable" | "changed";

interface Violation {
  readonly path: string;       // root-relative, portable separators
  readonly rule: string;       // stable rule identifier
  readonly detail: string;     // stable exact detail/location text
}
interface SourceSnapshot {
  readonly path: string;
  readonly text: string;
  readonly byteLength: number;
  readonly contentDigest: string;
}
type ReadOutcome =
  | { readonly kind: "read"; readonly snapshot: SourceSnapshot }
  | { readonly kind: "failed"; readonly violation: Violation }
  | { readonly kind: "changed"; readonly violation: Violation;
      readonly operation: "after-lstat-before-read" | "after-lstat-before-stat";
      readonly before: PathKind; readonly after: PathKind };
interface InventoryEntry {
  readonly path: string; readonly kind: PathKind; readonly readable: boolean;
  readonly policySurface: PolicySurface;
}
interface PackageInventory {
  readonly name: PackageName; readonly root: string;
  readonly sourceRoots: readonly string[]; readonly controlFiles: readonly string[];
  readonly testRoots: readonly string[]; readonly ignoredRoots: readonly string[];
}
interface WorkspaceInventory {
  readonly root: string; readonly entries: readonly InventoryEntry[];
  readonly packages: readonly PackageInventory[];
  readonly sourceReads: readonly ReadOutcome[];
  readonly violations: readonly Violation[];
}

type ConfigNodeKind =
  | "root-manifest" | "root-tsconfig" | "package-manifest"
  | "package-tsconfig" | "extends-target" | "project-reference-target";
type ConfigNodeStatus =
  | "valid" | "absent" | "malformed" | "unreadable" | "symlink"
  | "outside" | "cycle" | "unsupported" | "changed";
interface ConfigNode {
  readonly id: string; readonly kind: ConfigNodeKind;
  readonly owner: "workspace" | PackageName;
  readonly pathKind: PathKind; readonly status: ConfigNodeStatus;
}
type ConfigEdgeKind = "extends" | "project-reference" | "path-substitution";
type ConfigEdgeStatus =
  | "valid" | "forbidden" | "missing" | "malformed" | "unreadable"
  | "symlink" | "outside" | "cycle" | "unsupported" | "changed";
interface ConfigEdge {
  readonly from: string; readonly kind: ConfigEdgeKind; readonly raw: string;
  readonly to: string | undefined; readonly status: ConfigEdgeStatus;
}
interface ConfigGraph {
  readonly nodes: readonly ConfigNode[]; readonly edges: readonly ConfigEdge[];
  readonly violations: readonly Violation[];
}

interface ManifestDependency {
  readonly name: string;
  readonly scope: "dependencies" | "optionalDependencies" |
    "peerDependencies" | "devDependencies";
  readonly version: string;
}
type ManifestExportStatus =
  | "valid" | "missing" | "malformed" | "unreadable" | "symlink"
  | "outside" | "unsupported" | "changed";
interface ManifestExport {
  readonly subpath: string; readonly target: string;
  readonly targetPath: string | undefined; readonly targetKind: PathKind;
  readonly surface: PolicySurface; readonly status: ManifestExportStatus;
}
interface ManifestModel {
  readonly path: string; readonly owner: "workspace" | PackageName;
  readonly packageName: string; readonly dependencies: readonly ManifestDependency[];
  readonly exports: readonly ManifestExport[];
  readonly status: "valid" | "partial" | "blocked";
  readonly violations: readonly Violation[];
}
interface ManifestRegistry {
  readonly byPath: ReadonlyMap<string, ManifestModel>;
  readonly byPackage: ReadonlyMap<PackageName, ManifestModel>;
}
interface ManifestLookup {
  readonly source: ManifestModel | undefined;
  readonly target: ManifestModel | undefined;
}
function lookupManifests(
  registry: ManifestRegistry, sourcePath: string,
  targetPath: string | undefined,
): ManifestLookup;

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
  readonly start: number; readonly length: number;
  readonly line: number; readonly character: number;
}
interface ModuleReference {
  readonly sourcePath: string; readonly syntax: ReferenceSyntax;
  readonly specifier: string; readonly location: SourceLocation;
  readonly resolution: ReferenceResolution; readonly targetPath: string | undefined;
  readonly targetKind: PathKind | undefined;
  readonly targetSurface: ReferenceTargetSurface | undefined;
}
interface SyntaxFact {
  readonly sourcePath: string; readonly syntax: ReferenceSyntax;
  readonly specifier: string; readonly location: SourceLocation;
  readonly status: "allowed" | "forbidden" | "uncertain";
}
interface SyntaxFacts {
  readonly sourcePath: string; readonly facts: readonly SyntaxFact[];
  readonly status: "complete" | "blocked";
  readonly violations: readonly Violation[];
}

interface SourceProgramContext {
  readonly program: ts.Program; readonly checker: ts.TypeChecker;
  readonly compilerOptions: ts.CompilerOptions; readonly project: PackageName;
}
interface SourceInput {
  readonly snapshot: SourceSnapshot; readonly sourceFile: ts.SourceFile;
  readonly context: SourceProgramContext;
}
interface CompilerDiagnostic {
  readonly path: string; readonly code: number;
  readonly category: "error" | "warning" | "suggestion" | "message";
  readonly message: string; readonly start: number | undefined;
  readonly length: number | undefined;
}
interface EffectiveCompilerOptions {
  readonly target: "ES2023"; readonly lib: readonly ["ES2023"];
  readonly moduleResolution: "bundler"; readonly moduleDetection: "force";
  readonly types: readonly string[];
}
interface CompilerProjectEvidence {
  readonly project: PackageName; readonly configPath: string;
  readonly options: EffectiveCompilerOptions;
  readonly projectReferences: readonly string[]; readonly sourcePaths: readonly string[];
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
  readonly sourcePath: string; readonly location: SourceLocation;
  readonly possibilities: readonly CapabilityName[]; readonly use: CapabilityUse;
  readonly certainty: "proven" | "unknown";
}
interface CapabilityFacts {
  readonly sourcePath: string; readonly facts: readonly CapabilityFact[];
  readonly status: "complete" | "blocked"; readonly violations: readonly Violation[];
}

type StageName =
  | "inventory" | "config-graph" | "source-parse" | "syntax"
  | "references" | "compiler" | "manifest-exports" | "capability-flow";
type FatalOwner = StageName | "orchestrator";
type FatalCode = "UNEXPECTED_STAGE_FAILURE" | "UNEXPECTED_ORCHESTRATOR_FAILURE";
interface UnexpectedFatal {
  readonly kind: "unexpected-fatal"; readonly owner: FatalOwner;
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
interface StageContext { readonly mutation: ScanMutation | undefined }
interface InventoryStage { (root: string, context: StageContext): StageResult<WorkspaceInventory> }
interface ConfigGraphStage { (inventory: WorkspaceInventory, context: StageContext): StageResult<ConfigGraph> }
interface SourceParseStage { (inventory: WorkspaceInventory, graph: ConfigGraph, context: StageContext): StageResult<readonly SourceInput[]> }
interface SyntaxStage { (input: SourceInput, context: StageContext): StageResult<SyntaxFacts> }
interface ManifestStage { (inventory: WorkspaceInventory, context: StageContext): StageResult<ManifestRegistry> }
interface CompilerStage { (inputs: readonly SourceInput[], inventory: WorkspaceInventory, graph: ConfigGraph, context: StageContext): StageResult<CompilerEvidence> }
interface ReferenceStage { (input: SourceInput, syntax: SyntaxFacts, graph: ConfigGraph, manifests: ManifestRegistry, context: StageContext): StageResult<readonly ModuleReference[]> }
interface CapabilityStage { (input: SourceInput, context: StageContext): StageResult<CapabilityFacts> }
type ScanOutcome =
  | { readonly status: "complete"; readonly violations: readonly Violation[] }
  | { readonly status: "fatal"; readonly violations: readonly []; readonly fatal: UnexpectedFatal };
interface ScanWorkspace { (root: string, context?: StageContext): ScanOutcome }
```

A/F is the only producer of `SourceSnapshot`, `ReadOutcome`, `ManifestModel`, `ManifestRegistry`, config nodes/edges, path kinds, dependency facts, export facts, and source-surface membership. It creates `byPath` keyed by canonical workspace-relative manifest path and a derived `byPackage` index over the same object identities in one operation. No later stage parses/reconstructs manifests or config. `lookupManifests` resolves the source package from `sourcePath` and the target package from the permitted resolved `targetPath`; outside, unresolved, ignored, symlinked, changed, or unrepresented targets return `undefined` and are never guessed.

A/F reads each inventoried readable source once. A `changed` read has no snapshot. `source-parse` uses a snapshot-backed TypeScript host, creates one program/checker context per package project, and never opens a path. Compiler, references, and capability flow consume the same `SourceInput`; no later stage accepts a path, stats, reads, decodes, or reparses. Root solution configs are inventoried and graph-validated by A/F but do not create a `SourceProgramContext` or `CompilerProjectEvidence`; only `kernel`, `store-plainfile`, and `cli` do.

Each stage catches only owned operational errors into violations. An unexpected exception becomes its typed `fatal`; I0 stops scheduling, emits no partial policy result, and does not sort a fatal result. The CLI maps complete clean/violations/fatal to `0/1/70` and prints `LOREDU_BOUNDARY_FATAL <owner> <code>` for fatal. This is separate from watchdog exits.

## 3. Invocation, propagation, and mutation contract

For each `scanWorkspace` call, the exact schedule is:

1. `inventory`: once; no prerequisite.
2. `config-graph`: once if inventory exists.
3. `manifest-exports`: once if inventory exists.
4. `source-parse`: once if inventory and graph exist.
5. `compiler`: once if inventory, graph, and source-parse exist.
6. For each source input in canonical source-path order: `syntax` once; if syntax is available, `references` once; `capability-flow` once independently of syntax/reference status.
7. Concatenate all produced violations and apply the only final stable sort: Unicode-scalar lexicographic `path`, then `rule`, then `detail`.

“Once” is once per scan phase; “per input” is once for each applicable input. A disabled branch returns `blocked`, `value: undefined`, `violations: []`, and is never retried. A blocked prerequisite omits dependent invocations, passes no empty/guessed fact, and adds no substitute violation. Independent inputs continue.

The exact closed mutation/check map is:

| Check | Owner stage | Canonical red / green | Pre-execution branch | Mutation |
|---|---|---|---|---|
| `G0-A-INVENTORY` | A/F inventory | required-root-read-failure / regular-complete-workspace | `inventoryStage` before traversal | `MUT-G0-A-INVENTORY` |
| `G0-B-SYNTAX` | B/C/E syntax | forbidden raw workspace identity / allowed raw edge | syntax classification before resolution | `MUT-G0-B-SYNTAX` |
| `G0-C-REFERENCES` | B/C/E references | ambient aliased loader / local bound loader | extraction/resolution before work | `MUT-G0-C-REFERENCES` |
| `G0-C-SOURCE-PARSE` | B/C/E source-parse | malformed source / valid source | parse diagnostics before parse | `MUT-G0-C-SOURCE-PARSE` |
| `G0-D-CAPABILITY-FLOW` | D capability-flow | global-object escape / local clean control | flow analysis before fixpoint | `MUT-G0-D-CAPABILITY-FLOW` |
| `G0-E-COMPILER` | B/C/E compiler | effective widening / exact inherited isolation | evidence evaluation before work | `MUT-G0-E-COMPILER` |
| `G0-E-CONFIG-GRAPH` | A/F config graph | malformed extends / valid recursive graph | graph traversal before dereference | `MUT-G0-E-CONFIG-GRAPH` |
| `G0-F-MANIFEST-EXPORTS` | A/F manifest-exports | missing/swapped target / exact normalized exports | manifest validation before work | `MUT-G0-F-MANIFEST-EXPORTS` |

The discriminants are closed and positional:

```ts
type BoundaryCheckId =
  | "G0-A-INVENTORY" | "G0-B-SYNTAX" | "G0-C-REFERENCES"
  | "G0-C-SOURCE-PARSE" | "G0-D-CAPABILITY-FLOW"
  | "G0-E-COMPILER" | "G0-E-CONFIG-GRAPH" | "G0-F-MANIFEST-EXPORTS";
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
  readonly kind: "disable-stage"; readonly checkId: BoundaryCheckId;
  readonly mutationId: MutationId; readonly branchId: MutationBranchId;
}
```

For one fixed fixture, with baseline arrays `A,G,F,P,S,C,R,D` for inventory, graph, manifests, parse, syntax, compiler, references, capability flow, `B = sort(A ⊎ G ⊎ F ⊎ P ⊎ S ⊎ C ⊎ R ⊎ D)`. Exact mutant outputs are:

| Branch | Exact output |
|---|---|
| `A.inventory.pre-execution` | `[]` |
| `E.config-graph.pre-execution` | `sort(A ⊎ F)` |
| `F.manifest-exports.pre-execution` | `sort(A ⊎ G ⊎ P ⊎ S ⊎ C ⊎ D)` |
| `C.source-parse.pre-execution` | `sort(A ⊎ G ⊎ F)` |
| `B.syntax.pre-execution` for input `i` | `sort(B \ (S_i ⊎ R_i))` |
| `E.compiler.pre-execution` | `sort(B \ C)` |
| `C.references.pre-execution` for input `i` | `sort(B \ R_i)` |
| `D.capability-flow.pre-execution` for input `i` | `sort(B \ D_i)` |

These are literal committed baseline and mutant arrays, not an expectation generator. `⊎` is concatenation before sorting, not deduplication. Whole-layer omissions and a trivial empty orchestrator are separate G2 mutants. Production CLI calls `scanWorkspace(root)` only; it cannot construct/import `ScanMutation`.

## 4. Closed matrix and case ledger

```ts
type MatrixRow =
  | "CM-I41" | "CM-I43" | "CM-I44" | "CM-I45"
  | "CM-I46" | "CM-I47" | "CM-I50";
const MATRIX_ROWS: readonly MatrixRow[] = [
  "CM-I41", "CM-I43", "CM-I44", "CM-I45",
  "CM-I46", "CM-I47", "CM-I50",
];
interface MatrixRowSpec { readonly id: MatrixRow; readonly classification: "IN_SCOPE" }
const MATRIX_REGISTRY: Readonly<Record<MatrixRow, MatrixRowSpec>>;

type CaseGroup =
  | "filesystem-discovery" | "manifest-exports-config"
  | "module-syntax-workspace-law" | "typescript-resolution"
  | "ast-reference-inventory" | "ambient-symbol-flow"
  | "compiler-isolation" | "ci-authority";
type AssuranceLayer = "A" | "B" | "C" | "D" | "E" | "F" | "G1" | "G2";
type FixtureFailureOperation = "lstat" | "stat" | "read" | "readdir";
type FixtureFailureCode = "EACCES" | "EIO" | "ENOENT";
type FixtureReplacement =
  | { readonly kind: "write"; readonly contents: string }
  | { readonly kind: "remove" }
  | { readonly kind: "mkdir" }
  | { readonly kind: "symlink"; readonly target: string };
type FixtureOperation =
  | { readonly kind: "mkdir" | "remove" | "symlink"; readonly path: string; readonly target?: string }
  | { readonly kind: "write"; readonly path: string; readonly contents: string }
  | { readonly kind: "chmod"; readonly path: string; readonly mode: number }
  | { readonly kind: "inject-failure"; readonly operation: FixtureFailureOperation; readonly path: string; readonly error: FixtureFailureCode }
  | { readonly kind: "change-between"; readonly path: string; readonly boundary: "after-lstat-before-read" | "after-lstat-before-stat"; readonly replacement: FixtureReplacement }
  | { readonly kind: "special-other"; readonly path: string; readonly representation: "fifo" };
interface CaseProvenance {
  readonly id: string; readonly artifact: string; readonly commit: string;
  readonly tree: string; readonly mergeBase: string; readonly ciRun?: string;
  readonly sha256?: string;
}
interface CaseSpec {
  readonly id: string; readonly group: CaseGroup;
  readonly matrixRows: readonly MatrixRow[];
  readonly assuranceLayer: AssuranceLayer;
  readonly fixtureMutation: readonly FixtureOperation[];
  readonly expected: readonly Violation[];
  readonly pairedGreenControl: string;
  readonly killsCheckIds: readonly BoundaryCheckId[];
  readonly provenance: readonly CaseProvenance[];
}
interface GreenPair { readonly redId: string; readonly greenId: string }
```

The real A0 fixture union is data-only and closed: `mkdir/remove/symlink`, `write`, `chmod`, `inject-failure` for `lstat|stat|read|readdir` with `EACCES|EIO|ENOENT`, `change-between` at `after-lstat-before-read|after-lstat-before-stat` with write/remove/mkdir/symlink replacement, and `special-other` with `fifo`. A0 must use the fully discriminated version, not the abbreviated explanatory shape above. No callback, scanner hook, output transform, privileged permission workaround, or unrelated host path is allowed.

`CaseSpec` validation is total: exactly the seven registry rows are accepted; unknown/duplicate rows, missing registry keys, unknown IDs/groups/layers/checks, missing literal arrays, nonreciprocal/self/duplicate pair links, missing provenance, stale/mismatched commit/tree/merge-base/artifact/checksum, callbacks, and contaminated roots are red. Every red and its reciprocal green are separate temporary roots from the same clean seed. Expected arrays are independently authored, complete, and canonical; scanner output, historical reports, or provenance never generates them. Every canonical check row has one red, one green, and one mutation. Additional cases may regress the row but cannot replace canonical evidence.

The complete mandatory corpus retains all prior cases: nested supported discovery; unsupported/unknown extensions; required/optional missing and unreadable roots; regular/dangling symlinks; ignored/control/test surfaces; FIFO/other; changed races; exact manifests/dependencies/exports and target regularity; malformed/null/array/scalar configs; recursive extends/references/paths, missing/outside/cyclic/unsupported/symlink targets and exact project-reference keys; every static import/export/import-equals/import-type/dynamic/require/resolve/module/JSDoc/triple-slash form; dynamic attribute forms below; aliases, path collisions, declarations/extensions/index; capability alias/destructure/shorthand/computed/optional/call/apply/indirect/escape/branch/backedge/closure/recursive/fixpoint cases; compiler widening and negative compile; clean workspace; mutation omission/trivial-return; selector/duplicate/missing invocation/aggregate; watchdog descendants and all exits. G1 handoff reports actual committed case count by group and exact literal-array count; a missing count is not evidence.

## 5. Grammar and config authority

Pinned TypeScript 5.9.3 public types expose dynamic import options as:

```ts
interface ImportCallOptions {
  /** @deprecated */ assert?: ImportAssertions;
  with?: ImportAttributes;
}
interface ImportAssertions { [key: string]: string }
interface ImportAttributes { [key: string]: string }
```

The exact dynamic-import table is:

| Source shape | Result |
|---|---|
| `import(S)` with string/no-substitution template `S` | `dynamic-import` |
| `import(S, {})` | `dynamic-import` |
| `import(S, { with: A })`, unique plain object and literal string values | `dynamic-import` |
| `import(S, { assert: A })`, unique plain object and literal string values | `dynamic-import` |
| both `with` and `assert` | `boundary-ast-uncertain` |
| unknown outer key | `boundary-ast-uncertain` |
| spread, method, accessor, computed key, duplicate outer/inner key | `boundary-ast-uncertain` |
| non-object options or non-literal attributes | `boundary-ast-uncertain` |
| arity other than one or two | `boundary-ast-uncertain` |
| non-static first argument | `boundary-ast-uncertain` |

Static import/export, import-equals, import-type (including qualified and `typeof import`), ambient checker-proven `require`, `require.resolve`, `module.require`, materialized JSDoc `@import`/nested import types, and triple-slash path/types/lib are extracted through public AST/checker/JSDoc/preprocessor APIs. Unsupported/future forms fail closed; `boundary-dynamic` is not a second result. `ts.preProcessFile(text, true, true)` is reconciled against extractor claims for imported/referenced/type/lib directives; only explicitly documented CommonJS loader extensions are subtractable.

A/F's one lstat-first classifier is authoritative for all policy paths. Required controls and package/source roots are regular readable non-symlink files/directories. Dangling links are symlinks, not absence. Every failed operation/race is `unreadable` or `changed`, never omission. Config graph traversal records malformed/unresolved nodes and edges recursively using visited/in-progress sets. The only accepted source `references` keys are nonempty string `path`, optional boolean `prepend`, optional boolean `circular`; `originalPath` and unknown keys are forbidden. `extends`, `paths`, `baseUrl`, dependency maps, and exact string export maps obey the closed shape/containment rules from the Steward closure. Root solution configs can reference known package configs, but remain inventory/config-graph-only and contribute no source/compiler project evidence.

Syntax identity precedes resolution: raw `@loredu/*`, protocol/builtin, relative, and external classification; package edge/seam decision; permitted TypeScript bundler resolution; A/F target surface/kind and manifest lookup. `paths` and `baseUrl` cannot launder package identity, target ownership, or containment. B/C/E owns source policy and resolution; A/F owns target facts and manifests.

## 6. Exact slice stack

All branch names below are planned identities, not created refs. Every child is an ordinary descendant of its stated parent, never a historical PR branch. A future commit/tree/merge-base is an implementation fact and must be recorded before dispatching its child; a missing actual value stops dispatch rather than acting as a placeholder.

### S0 — A0 contract/fixture schema lock

- **Branch/owner:** `feat/g0-replan4-a0`, contract/fixture owner.
- **Parent/base:** commit/tree/merge-base `612ddcb0f23d0177b806942f89a158c50267b926` / `1216774a600c79894138a7a99d810617789ed0f8` / `612ddcb0f23d0177b806942f89a158c50267b926`.
- **Paths:** `scripts/workspace-boundaries/contracts.ts`; `tests/support/workspace-boundaries/case-schema.ts`; `tests/support/workspace-boundaries/fixture-operations.ts`; `tests/support/workspace-boundaries/case-schema.test.ts`. No package, root script, workflow, docs, catalog, scanner, or product path.
- **Interfaces:** every §2 type, `ManifestRegistry`/`ManifestLookup`, all stage/result/fatal signatures, MatrixRow registry, complete FixtureOperation union, CaseSpec/provenance/pair, mutation map and canonical sort.
- **Matrix:** vocabulary only for CM-I41/I43/I44/I45/I46/I47/I50; claims none. Public/domain/catalog `OUT_OF_SCOPE`.
- **Red/green:** invalid row/ID/group/layer/pair/provenance/fixture/expected metadata red; complete valid schema green. No scanner import/invocation and no policy assertion.
- **Mutation:** schema meta-mutants only; no production mutation branch.
- **Evidence:** contract typecheck; schema tests; static no-scanner/no-root-wiring check; no raw root test authority. Parent contract hashes are closure `86338...`, replan3 `820d...`, clarification `ed2d...`, prior decisions `8aef...` and `998f...`.
- **Invalidation:** any frozen contract, base, toolchain, package topology, or owned path change. A0 handoff must provide actual commit/tree/parent/merge-base, complete changed-path manifest, contract SHA, and test output.

### PF-A0 — dispatch preflight (not a slice)

Against the exact A0 handoff, verify actual commit/tree/parent/merge-base and allowlist; compile contracts; reject all malformed metadata; verify all seven MatrixRows, all eight mutations, complete failure/race/FIFO vocabulary, no scanner/root/workflow/package/catalog path, and all authority hashes. Record `PF-A0=PASS`; otherwise no A/F, B/C/E, D, or executable G1 dispatch.

### S1 — A/F facts, manifests, and config graph

- **Branch/owner:** `feat/g0-replan4-af`, A/F owner.
- **Parent/base:** exact A0 head/tree; merge-base recorded against `612ddcb...`; consumed contract is the actual A0 handoff SHA.
- **Paths:** `scripts/workspace-boundaries/inventory.ts`, `config-graph.ts`, `manifest-model.ts`, `tests/support/workspace-boundaries/filesystem-fixtures.ts`, `tests/support/workspace-boundaries/filesystem-fixtures.test.ts`. No root authority/workflow/orchestrator/product code.
- **Interfaces:** inventory, changed `ReadOutcome`, `WorkspaceInventory`, `ManifestModel`, `ManifestRegistry`, lookup, `ConfigGraph`, `ConfigNode`, `ConfigEdge`.
- **Matrix:** CM-I41/I43/I47/I50 owned evidence; CM-I46 config facts; others consumed only. Public/domain/catalog out.
- **Red/green:** all failure/race/symlink/FIFO/other/missing/unreadable roots; malformed JSON/config/reference/path/baseUrl; recursive missing/outside/cycle/unsupported; exact export/target mutations. Greens: clean regular workspace, optional true absence, valid recursive graph, valid manifest key order.
- **Mutation:** `A.inventory.pre-execution`, `E.config-graph.pre-execution`, `F.manifest-exports.pre-execution`, each independently observed at the named branch.
- **Evidence:** focused A/F unit and fixture suite, deterministic operation log, exact arrays and changed status; no resolver/compiler/capability/root command. CI may run focused tests only as development evidence; no claim of full acceptance.
- **Invalidation:** A0, base/master, package topology, source roots, lockfile/toolchain, owned paths, fixture vocabulary. Child handoff binds actual hashes and complete case counts.

### S2 — B/C/E source parse, syntax, references, compiler

- **Branch/owner:** `feat/g0-replan4-bce`, B/C/E owner.
- **Parent/base:** exact accepted S1 head/tree; consumed A/F handoff SHA and A0 contract SHA; merge-base against 612.
- **Paths:** `source-parse.ts`, `syntax-law.ts`, `module-references.ts`, `resolution.ts`, `compiler-isolation.ts`, `tests/support/workspace-boundaries/source-boundaries.test.ts`. No A/F fact authority, D, root, workflow, watchdog, ledger.
- **Interfaces:** `SourceInput` with checker context; `SyntaxFacts`; `ReferenceStage` with syntax, graph, and one registry; `CompilerEvidence`; `StageResult` fatal/blocked semantics.
- **Matrix:** CM-I41/I43/I44/I46/I47/I50 evidence; CM-I45 only through no capability ownership.
- **Red/green:** complete grammar/attribute/JSDoc/preprocessor table; syntax-first aliases and path collisions; resolver extension/declaration/index/outside/test/ignored/symlink; manifests source/target lookup; effective options and negative kernel compile; no read/reparse and no resolver-before-syntax controls.
- **Mutation:** `B.syntax.pre-execution`, `C.references.pre-execution`, `C.source-parse.pre-execution`, `E.compiler.pre-execution`.
- **Evidence:** pinned Bun/TS fixture run, exact reference objects/locations, compiler diagnostics, fatal-result tests, and proof source snapshot identity is preserved. No scanner composition/root command.
- **Invalidation:** S1/A0/base/package topology/compiler/Bun/TS/lockfile/source roots/owned paths; grammar and all downstream ledger evidence invalidated on such change.

### S3 — D capability flow

- **Branch/owner:** `feat/g0-replan4-d`, D owner.
- **Parent/base:** exact accepted S2 head/tree; consumed S2 and A0 handoff hashes; merge-base against 612.
- **Paths:** `capability-facts.ts`, `capability-flow.ts`, `tests/support/workspace-boundaries/capability-flow.test.ts`. No module/config/filesystem/root/workflow ownership.
- **Interfaces:** same `SourceInput`/checker context, `CapabilityFacts`, `CapabilityFact`, capability unions and stage/mutation result.
- **Matrix:** CM-I44/I45/I50 evidence; other rows out.
- **Red/green:** globalThis aliases/destructures/renames, Date/Math/Bun/process/Buffer, unknown computed, shorthand, optional/call/apply/indirect, all escape sinks, branch/backedge/closure/recursive fixpoint. Greens: locals/imports/parameters, explicit values, deterministic math, definite overwrite.
- **Mutation:** `D.capability-flow.pre-execution`.
- **Evidence:** checker symbol identity and independent flow probes; exact arrays; no textual/name-only oracle and no module extraction.
- **Invalidation:** S2/A0/base/toolchain/source roots/owned paths; downstream I0/G1/G2 invalidated.

### S4 — I0 sole production composition

- **Branch/owner:** `feat/g0-replan4-i0`, composition owner.
- **Parent/base:** exact S3 head/tree and handoff; merge-base against 612.
- **Paths:** `scripts/check-workspace-boundaries.ts`; optional `scripts/workspace-boundaries/composition.ts`; composition tests. No root `package.json`, workflow, watchdog, ledger, product, docs, catalog.
- **Interface/order:** one `ScanWorkspace` with default `{mutation: undefined}`; inventory, graph, manifests, parse, compiler once; canonical input loop syntax/reference/capability; typed fatal stop; one final sort; no policy reinterpretation.
- **Matrix:** one production scanner authority supporting all seven rows, but no G1/G2 acceptance claim.
- **Red/green:** typed synthetic-stage order/blocked/fatal/no-reread controls; clean temporary workspace executes without case-ledger expectation. No scanner-derived expected arrays.
- **Mutation:** transport only; actual mutation evidence waits for G2.
- **Evidence:** static exactly-one scanner symbol and no later path inputs; composition tests; `PF-I0` after merge verifies no root script/workflow/watchdog and no future G1 dependency.
- **Invalidation:** any stage/contract/tool/source/package/owned-path change; PF-I0 must pass before L0/G1/G2.

### S5 — L0 legacy authority migration

- **Branch/owner:** `feat/g0-replan4-legacy-gate`, test-authority owner.
- **Parent/base:** exact S4/I0 head/tree; consumed I0 handoff SHA; merge-base against 612.
- **Paths:** `tests/workspace-structure.test.ts` and `tests/workspace-boundaries-legacy-authority.test.ts`. The former is rewritten as a thin I0 caller or removed after equivalent coverage is present; the latter proves the old authority is absent and never scans independently. No second scanner.
- **Matrix:** CM-I41/I43/I46/I47/I50 authority evidence; no new policy.
- **Red/green:** old manifest-DAG/kernel-boundary scanning logic or duplicate structural authority is red; thin caller through I0, or removal with equivalent G1/G2 coverage, is green. It must not generate separate facts.
- **Mutation:** duplicate/legacy-authority mutant; no production check ID is counted twice.
- **Evidence:** static proof one scanner, one root-test authority, no old assertions; focused test through I0. This gate precedes G2 authority acceptance and final wrapped-root evidence.
- **Invalidation:** I0/base/owned test/scanner/fixture/ledger changes. G2 cannot dispatch until L0 handoff is complete.

### S6 — G1 executable literal ledger

- **Branch/owner:** `feat/g0-replan4-g1`, ledger owner.
- **Parent/base:** exact L0 head/tree; consumed I0 and L0 handoff SHAs; merge-base against 612. Optional `feat/g0-replan4-g1-schema` may branch after PF-A0 for schema-only files but cannot carry policy/evidence and cannot bypass this parent.
- **Paths:** `case-ledger.ts`; grouped case data and committed provenance manifest; `tests/workspace-boundaries-ledger.test.ts`; G1 support only. No scanner policy/root/workflow/watchdog.
- **Matrix:** all seven rows, each canonical check row, every mandatory historical case group; classifications exactly `IN_SCOPE` for seven and `OUT_OF_SCOPE` for public/catalog.
- **Red/green:** every canonical 8 red/8 reciprocal green pair plus complete mandatory corpus; exact literal output equality, stale/deleted/duplicate/pair/order/masking/fixture meta-mutants. Actual registry count and expected-array count are recorded in handoff, not inferred.
- **Mutation:** ledger meta-mutants only; no stage mutation construction.
- **Evidence:** run cases against I0 only, isolated roots, exact arrays, provenance manifest checksum, pair bijection, canonical order, no scanner oracle. G1 executable work cannot begin without PF-I0 and complete prior handoffs.
- **Invalidation:** any I0/stage/fixture/ledger/provenance/tool/source/base change; G2 consumes exact G1 head/tree/manifest SHA.

### S7 — G2 mutation, watchdog, root and CI authority

- **Branch/owner:** `feat/g0-replan4-g2`, assurance/CI owner.
- **Parent/base:** exact S6 head/tree and G1 manifest SHA; consumed L0/I0/A0 handoffs; accepted P0/master conflicts are checked before root/workflow edits; merge-base against 612.
- **Paths:** `scripts/run-with-watchdog.ts`; `tests/support/workspace-boundaries/mutation-harness.ts`; `tests/workspace-boundaries-mutation.test.ts`; `tests/workspace-boundaries-watchdog.test.ts`; `tests/workspace-boundaries-authority.test.ts`; root `package.json` only for `test` and `check:boundaries`; `.github/workflows/ci-required.yml` only for exact authority. No second scanner or policy module.
- **Mutation evidence:** all eight pre-execution mutations with exact baseline/mutant arrays above; whole-layer omission, trivial `[]`, duplicate scanner/test invocation, deleted boundary step, selector laundering, aggregate pass-on-failure, and normal CLI mutation reachability controls. Required result is `mutants killed N/N` with actual N and manifest checksum.
- **Watchdog contract:** support is exactly GitHub Actions `ubuntu-24.04` with Bun 1.4.0. Direct child spawn in an owned POSIX process group; store PID as PGID; terminate/probe group using `process.kill(-pgid, SIGTERM/SIGKILL)` and `process.kill(-pgid, 0)`. Unsupported OS/runner fails deterministically `125` before spawn; no Windows support is claimed. Test-only data seam:
  `before-spawn-boundary-unavailable`, `after-spawn-terminate-fails`, `after-spawn-cleanup-probe-fails`. Cleanup failure records unproven descendant status and exits `125`; it never claims cleanup or `124`. Proven timeout requires group absence and exits `124`. Invalid invocation `2`, child `0` preserved, child nonzero preserved, signal-only `1`. Budgets: boundary 60s, root test 180s, workflow `timeout-minutes: 10`.
- **Root/CI:** root `check:boundaries` invokes scanner once under 60s; root `test` invokes the complete test runner once under 180s. Workflow has exactly one explicit `bun run check:boundaries` and one explicit `bun run test`, no standalone raw test invocation; `runs-on: ubuntu-24.04`; `docs_only=false` for code/config/workflow, docs suite skipped, workspace suite selected, `if: always()` aggregate fails closed.
- **Red/green:** synchronous hang plus descendant; ordinary 0/9; signal-only; invalid invocation no spawn; proven 124; setup/termination/probe fault 125; duplicate/missing workflow/root calls and aggregate laundering red; exact authority green.
- **Invalidation:** L0, G1, I0/stages, root scripts/workflow, lockfile/Bun/OS, package topology, P0/master, watchdog/fixture/ledger changes. No I1/final evidence until G2 handoff complete.

### S8 — I1 final fan-in and evidence

- **Branch/owner:** `feat/g0-replan4-i1`, integration/evidence owner.
- **Parent/base:** exact S7 head/tree/handoff; accepted P0 must be on master before this slice; ordinary merge/rebase only, with actual parent/tree/merge-base recorded. No empty fan-in.
- **Paths:** only real legacy migration if not already S5 (otherwise omit this slice), final integration evidence manifest, and minimal thin real-workspace caller if needed. No new scanner/policy/watchdog design.
- **Matrix:** all seven rows mapped to owner/canonical red/green/mutant/positive control; public/domain/catalog remains out.
- **Red/green:** duplicate old authority or mixed-head evidence red; one I0 caller, exact real-workspace array, one wrapped root test and same-head evidence green.
- **Evidence:** fresh frozen install and exact final command list below; same-head Tester/Reviewer; CI run URL/ID and complete job results; all handoff hashes, changed paths, tree/merge-base, provenance, arrays, mutation count, compiler negative evidence, no-reread, changed races, watchdog cleanup, and custody checks.
- **Invalidation:** any P0/master/owned path/tool/lockfile/workflow/fixture/ledger/provenance change requires recomputation and fresh evidence. I1 cannot claim acceptance until all final gates pass.

## 7. Handoff, merge, and invalidation protocol

Every slice handoff is append-only and must include actual values, never a branch-name substitute:

```text
slice / owner-role
contract-parent-sha256
base-commit / base-tree
parent-commit / parent-tree
head-commit / head-tree
merge-base
complete changed-path manifest
owned matrix rows / check IDs / red IDs / green IDs / mutation IDs
consumed interfaces and exact signatures
consumed parent handoff SHA-256
local commands, versions, complete results
case groups, exact counts, literal expected-array counts
mutation manifest, exact deltas, killed N/N
positive controls
provenance manifest SHA-256
invalidated-by
pending / artifacts / checksums
```

Merge order is exactly:

```text
master@612
  -> S0 A0
  -> S1 A/F
  -> S2 B/C/E
  -> S3 D
  -> S4 I0
  -> S5 L0 legacy gate
  -> S6 G1 executable ledger
  -> S7 G2 authority
  -> S8 I1 final evidence
```

The optional G1 schema-only child may land after PF-A0 as metadata-only work, but it cannot execute cases, claim policy, or change the executable dependency order. Each slice is independently mergeable against its exact parent and does not consume future output. No sibling edits another owner's surface. Any master/P0/package topology/source root/compiler/Bun/TypeScript/lockfile/workflow/root-script/I0/stage/fixture/ledger/provenance change invalidates the affected descendant chain; ordinary integration recomputes all identities and reruns the relevant preflight/review. Docs-only changes still run docs gates.

Before S0 dispatch, reverify PR #32/#35 tags, peeled commits, trees, merge-bases, remote refs, bundles and preservation manifests. After replacement A0 exists and custody is linked, PR #35 may be closed as superseded while retaining branch/tag/bundle. PR #32 remains retained through replacement final evidence and may be closed only after S8 final evidence; neither historical branch is deleted or repaired. Their CI runs never enter acceptance.

## 8. Exact final evidence protocol

From a fresh worktree at one exact S8 head/tree/merge-base, use frozen install and no raw unwrapped root test:

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

`bun run test` is the sole 180-second watchdog-wrapped root-test authority. The workflow and evidence manifest contain no standalone raw `bun test`; the wrapper's direct child runner is not a second root invocation. `check:boundaries` is the sole normal scanner command. Final manifest includes actual output for every command, versions, clean status, exact head/tree/merge-base/current master, complete changed paths, all handoff/provenance hashes, matrix map, all literal arrays, `changed` race records, source snapshot/no-reread proof, compiler negative diagnostics, `mutants killed N/N`, watchdog exits and descendant probe, scanner outcome, legacy migration, selector/aggregate (`docs_only=false`, docs skipped, workspace success, ci-required success), and exact CI URL/run ID.

Fresh independent Tester and Reviewer reports run only on that exact head/tree/base. Tester executes every case/mutant plus novel filesystem race/FIFO, reference, flow, fatal, and watchdog probes. Reviewer audits ownership, signatures, cardinality, blocked deltas, grammar/config tables, root exclusion, ledger/provenance/pairs, one scanner/root/workflow invocation, L0 migration, P0/master and historical custody. Mixed-head evidence is invalid. Only final coordinator evidence may claim G0 acceptance; this artifact does not.

## 9. Matrix classification and stop conditions

Steward classification is retained exactly: `CM-I41`, `CM-I43`, `CM-I44`, `CM-I45`, `CM-I46`, `CM-I47`, and `CM-I50` are `IN_SCOPE`. Public package/domain/capability-port/behavioral catalog changes are `OUT_OF_SCOPE`; accepted P0/master is a dependency. No domain-document update is owed because this replan changes no domain behavior, terminology, or boundary.

Stop with `needs-action`/`blocked` rather than inventing a local fix if any frozen hash changes; an interface or ID is expanded; root solutions enter compiler evidence; a stage rereads/reparses or takes a path after parse; a second scanner/root authority/workflow invocation appears; legacy authority remains at G2; a mutation is post-filtering or lacks exact deltas; a fixture uses callbacks/privilege; unsupported OS claims support; cleanup is unproven but called `124`; dynamic/config grammar is widened; fatal escapes or maps to clean/violation; a raw root test appears; provenance/expected arrays are scanner-derived; or P0/master/owned surfaces change without descendant invalidation. A public semantic or runtime dependency need routes a new decision record and cannot be absorbed here.

## Result protocol

```text
status: READY_FOR_A0_DISPATCH_AFTER_PREFLIGHT
planning_base: master@612ddcb0f23d0177b806942f89a158c50267b926
tree: 1216774a600c79894138a7a99d810617789ed0f8
replan_count: 4 / 4
attempt_count: 5; next implementation attempt: 6
implementation: none
repository/branch/PR mutation: none
acceptance: not claimed
human gate: not claimed
no-mistakes: not run
next role: not invoked
historical PR custody: preserved, acceptance-excluded
required next action: PF-A0 against an actual S0 handoff; no dispatch before PASS
```
