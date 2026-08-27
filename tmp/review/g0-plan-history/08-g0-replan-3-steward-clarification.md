# Loredu G0 pre-replan3 contract clarification — superseding authority

Task: `loredu-g0-replan3-steward--01M116S6VPWKX60NM9PPS8V7J8`

This clarification supersedes the conflicting portions of Steward artifact
`8aef1c4fa99499e6eb8557a65ad15eacf6949d3f9ac547d47b70bbaea2765a32` and closes
Reviewer findings against amended replan2
`ee64309175e3034a4179ac9a3c04f623eb0d008404dcd0502a4c2219d19ba63c`.
It is internal G0 assurance authority. It changes no Loredu package, domain,
terminology, capability-port, or behavioral-catalog contract.

## Classification

| Item | Classification | Frozen disposition |
|---|---|---|
| Stage vocabulary, ownership, source/program context, and no-reread propagation | Existing-contract consequence, completed by internal assurance decision | Existing ADR/package/compiler boundaries are made executable; these types are internal and are not exports. |
| `ScanMutation` injection and mutation result semantics | Internal assurance decision | Test-support-only pre-execution seam; unreachable from normal CLI. |
| Fixture operation vocabulary | Internal assurance decision | Data-only, deterministic, unprivileged filesystem/failure/race vocabulary; no callbacks. |
| TypeScript 5.9.3 project-reference boolean fields | Existing-contract consequence, completed by internal assurance decision | Exactly the fields in the pinned public `ProjectReference` declaration are recognized; no local extras. |
| Watchdog process-group/tree cleanup and escalation | Internal assurance decision superseding the earlier fallback wording | Complete owned-tree cleanup is mandatory on every supported CI platform; direct-child-only fallback is not accepted. |
| Root-test acceptance authority | Existing ADR 0012 consequence, completed by internal assurance decision | Only the 180-second watchdog-wrapped root test is acceptance evidence; an unwrapped root test is forbidden in the final protocol. |

No item requires a public decision. If implementation discovers a change to a
published package/domain meaning, it must stop and route a new public decision;
this clarification does not authorize one.

## 1. Internal stage contracts and sole ownership

All names below are internal to the workspace-boundary checker and test support.
They are not Loredu package exports. `A/F` owns filesystem, source-snapshot,
manifest, export, dependency, and config facts. `B/C/E` owns source parsing,
syntax, reference extraction/resolution, source-target policy, and compiler
isolation. `D` owns capability interpretation and flow. `I` owns the one
production orchestrator and final violation aggregation. G1/G2 own assurance
evidence only.

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
```

`SourceProgramContext` is created from the already-read snapshots by a
snapshot-backed TypeScript host. The host returns the pre-read text/source and
never opens the path. It supplies one `ts.Program` and one `ts.TypeChecker` per
project context. `source-parse` owns parse diagnostics and creates the
`SourceInput`; `compiler` consumes those inputs to validate effective compiler
isolation and records `CompilerEvidence`. Compiler does not create a second
program or parse. Reference and capability stages consume the same
`SourceInput`; they do not accept paths and do not read, stat, decode, or parse.

The required stage signatures carry mutation context explicitly:

```ts
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
  (inventory: WorkspaceInventory, context: StageContext): StageResult<readonly ManifestModel[]>;
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

The optional orchestrator context defaults to `{ mutation: undefined }` for
normal invocation. It is not exported through a Loredu package or CLI. A/F
produces one `ReadOutcome` per inventoried readable source. A failed read is a
blocked input with its A/F violation; no guessed result is emitted. A parse
failure is owned by `G0-C-SOURCE-PARSE` and blocks only that file. Independent
files continue. A stage catches owned operational errors into its violations;
an unexpected failure is a deterministic nonzero scan failure, never a clean
result. I invokes each applicable stage once, passes only typed results, and
solely sorts the final concatenated violations by portable path, rule, and
detail using Unicode scalar order. It never filters, deduplicates, reinterprets,
or rereads.

## 2. Exact mutation seam

The production check IDs and mutation identities are a one-to-one closed map.
The discriminated union below is the complete `ScanMutation` vocabulary:

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

The mapping is positional and exact: each `MUT-G0-X` carries the matching
`G0-X` and matching `<stage>.pre-execution` branch. Test support is the only
constructor/import surface. The normal CLI calls `scanWorkspace(root)` and
cannot supply a mutation. The branch is evaluated before the named stage does
any policy work; it cannot be an output-array filter or post-execution bypass.

A disabled stage returns `status: "blocked"`, `value: undefined`, and an empty
violation list. Its dependent stage receives no substitute facts and likewise
cannot guess; independent stages still run. The mutated complete output is
the exact baseline output minus the disabled stage's canonical diagnostic(s),
with all unrelated diagnostics retained and in canonical order. For a clean
paired control, baseline and mutated outputs are both its literal expected
array. Each mutation test asserts exact baseline and exact mutant arrays and
also proves the normal CLI cannot reach the branch. Whole-layer omissions and
the trivial empty orchestrator are separate G2 mutations, not `ScanMutation`
values.

## 3. Fixture vocabulary

Fixture mutations are data only. The complete vocabulary is:

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

`inject-failure` is the deterministic authority for lstat/stat/read/readdir
failures and unreadable cases; `chmod` supplies a real permission case where
supported, but tests may not depend on running as root or on a privileged
workaround. `change-between` is applied exactly once by the fixture harness at
the named operation boundary, with no callback or scanner hook, and proves
inspection/read or inspection/stat races are `changed`/`unreadable`, never
absence. Symlink and dangling-symlink cases use `symlink` with a missing target.
`special-other` creates only a workspace-local unprivileged FIFO (or the
pinned platform-equivalent special object); it is never implemented by probing
an unrelated host path. Unsupported platform capability is a fixture-support
failure, not a skipped or green case. No operation can invoke the scanner,
transform output, or generate expectations.

## 4. TypeScript 5.9.3 project-reference fields

The pinned TypeScript 5.9.3 public declaration is:

```ts
interface ProjectReference {
  path: string;
  originalPath?: string;
  /** @deprecated */ prepend?: boolean;
  circular?: boolean;
}
```

For source `references` JSON, the only allowed object keys are:

- `path`: required, nonempty string;
- `prepend`: optional boolean;
- `circular`: optional boolean.

`prepend` and `circular` are the complete and only allowed TypeScript
project-reference boolean fields. `originalPath` is compiler-created metadata,
not an accepted source-config field. Unknown keys, missing/non-string/empty
`path`, and non-boolean `prepend` or `circular` are `project-config`
violations. `circular: true` does not legalize a Loredu config graph cycle;
config cycles remain red. `prepend` is validated as a boolean and cannot relax
workspace/package-edge policy.

## 5. Watchdog rule

Complete owned process-group/tree cleanup is mandatory on every supported CI
platform. The supported CI set is the POSIX and Windows GitHub runner
platforms supported by pinned Bun 1.4.0. POSIX uses the created process group;
Windows uses the available equivalent job/process-tree boundary. Direct-child
termination with a nonzero result is **not** an accepted fallback.

The wrapper starts one command directly, never through shell interpolation, and
arms its timer before waiting. Invalid invocation exits `2` without starting a
child. A normal child exit `0` is preserved; a normal nonzero is preserved; a
signal-only result maps to `1`. A timeout for which complete owned-tree cleanup
succeeds exits `124`. If process-boundary setup is unavailable before spawn, or
cleanup cannot be proven complete, the wrapper exits `125` with a stable
watchdog-capability/cleanup-failure diagnostic and G2 is blocked/escalates a
runtime-tool decision. It must not claim `124` success semantics, silently
fall back to direct-child kill, or leave an owned descendant as accepted
behavior.

The `check:boundaries` budget is 60 seconds and the complete root test budget
is 180 seconds. The GitHub job's 10-minute timeout remains an outer
fail-closed ceiling, not a replacement. Mandatory evidence includes a
synchronous hang and a descendant process, ordinary exits 0 and 9, invalid
invocation, timeout 124, and cleanup-failure 125 behavior, including proof no
owned descendant remains on supported platforms.

## 6. Root-test authority

The final acceptance protocol has exactly one root-test invocation: the root
`test` script run through the 180-second watchdog wrapper (the dedicated
watchdog command may be named by the implementation, but it must be the sole
root test authority). The workflow has one explicit invocation of that wrapper.
The final manifest records that wrapped command, its 180-second budget, exit,
and exact head/tree evidence.

An unwrapped root test, including a direct raw `bun test` invocation, is
forbidden in the final protocol and is not acceptance evidence. Focused test
runs may be used during development/debugging only; they cannot appear in the
final acceptance command list, CI authority, or evidence manifest. The
structural boundary tests are included by the root test and do not create a
second authority. A duplicate root-test invocation, raw invocation, or missing
watchdog is a G2 failure.

## Planner-owned inputs (not Steward decisions)

The next Planner must consume this artifact and the exact amended-replan2,
Steward, and Reviewer identities above. Planner—not this Steward—owns the
material replan3 decomposition and must explicitly resolve:

1. the executable G1/I ordering and dependency DAG so G1's schema-only work is
distinguished from executable case execution; this ordering remains Planner
authority;
2. slice boundaries, changed-path manifests, parent/base/head/tree/
merge-base identities, and per-slice handoff/evidence requirements;
3. assignment of these frozen interfaces to implementation surfaces without
creating a second fact owner, scanner, orchestrator, or test authority;
4. the exact root script/workflow names that realize the single 180-second
wrapped root-test authority and single boundary-check command;
5. integration with accepted P0/master and preservation/closure handling for
historical PR #32/#35 evidence;
6. the replan3 result protocol, attempt/replan counters, and any newly
encountered public-semantic decision route.

G1/I ordering is intentionally not decided here. The frozen constraint is that
executable ledger cases require the composed production scanner, while A0
schema-only metadata validation must not claim production policy; Planner must
choose and record a non-circular executable ordering.

## Result

Status: `PLANNER_INPUTS_READY`
Implementation: none. Repository policy/docs: unchanged. No G0 acceptance or
human gate claimed.
