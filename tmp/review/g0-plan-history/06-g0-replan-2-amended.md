# Loredu G0 material replacement replan 2 — amended

**Task:** `loredu-g0-replanner-2--01M114QXHW7RS0KY190TGBN527`  
**Artifact:** `g0-replan-2-amended.md`  
**Disposition:** `READY_FOR_FRESH_MATRIX_RE-AUDIT`  
**Attempt count:** 5 completed; next implementation attempt 6; limit unchanged at 20  
**Replan count:** 2 of 4; unchanged  
**Planning base:** `master@612ddcb0f23d0177b806942f89a158c50267b926`  
**Scope:** planning only. No implementation, merge, PR repair, no-mistakes run, or human-gate claim is made here.

This is a complete replacement of the prior replan artifact, not a pointer or an addendum. It consumes and incorporates all R2-MR-01 through R2-MR-07 corrections and the Contract Steward's closed authority.

## 1. Identity-bound authority and failure custody

### Consumed authority

| Artifact | Immutable identity |
|---|---|
| Prior replan | `/Users/tiny/.rozoro/tasks/loredu-g0-replanner-2--01M114QXHW7RS0KY190TGBN527/g0-replan-2.md`; SHA-256 `9d25ec0a5c025a7ec22c46ac4abd0fe2f08c0d06793f3323b6130322fa3c2a64` |
| Contract Steward authority | `/Users/tiny/.rozoro/tasks/loredu-g0-replan2-contract-steward--01M1157FK6N2S54TG9EYGW6A0X/contract-decisions.md`; SHA-256 `8aef1c4fa99499e6eb8557a65ad15eacf6949d3f9ac547d47b70bbaea2765a32` |
| Matrix Reviewer audit | `/Users/tiny/.rozoro/tasks/loredu-g0-replan2-matrix-review--01M1157FK6MQNHGHJQ3YQ8P9MX/g0-replan-2-matrix-audit.md`; SHA-256 `998f838ef60df2f45ce7ba1285d403a9347e95c7beef68e2030786bb92fca55e` |
| Rejected PR #35 attempt 5 | commit `a945521af7d3a8415f071322b577be6865f9ed8f`; tree `06c42f72db78d83e084b39b4c281a59ab7929335`; base `612ddcb0f23d0177b806942f89a158c50267b926`; CI `33052334867` |
| PR #35 retention | tag object `4407b365f4d09ad42eca0b36295bf9e0b69b00c4`, peeled commit `a945521af7d3a8415f071322b577be6865f9ed8f` |
| PR #35 custody | `/Users/tiny/.rozoro/tasks/loredu-g0-replanner-2--01M114QXHW7RS0KY190TGBN527/evidence/preservation-manifest.md`; bundle `evidence/g0-pr35-attempt5-a945521.bundle`; SHA-256 `6b08ae21c8bc67327b3f64f340cf8ffdfd18e08b821e08877d821f1e369ff7e1` |

The Steward classified CM-I41, I43, I44, I45, I46, and I47 as existing-contract consequences; CM-I50 as an internal assurance decision. No public, package, domain, terminology, capability, or behavioral-catalog contract changes. The three former ambiguity gates are closed as internal assurance policy by the Steward artifact and are reproduced below. No worker may reopen them locally or weaken them.

### Replacement decision

PR #35 is retired as historical evidence, not a repair line. No valid implementation slice is extracted from it. Replacement slices start from clean `master@612ddcb0`; children may be stacked on accepted replacement parents but never on PR #35. PR #32 and PR #35 branches, tags, bundles, and reports remain preserved.

The green exact-head CI run on `a945521` is historical evidence only. The accepted replacement requires a new exact-head run after all slices and the P0/master fan-in are complete.

## 2. Frozen matrix, terminology, and ownership law

### Matrix rows

- **CM-I41:** test-only `/testing` seam, narrow test surfaces, and no production test imports.
- **CM-I43:** kernel zero external runtime dependencies and one-way `kernel <- store-plainfile <- cli` graph.
- **CM-I44:** forbidden environment imports, protocols, directives, workspace edges, and ambient Bun/Node capability reads.
- **CM-I45:** ambient time/random invocation, aliases, indirect calls, escapes, and conservative controls.
- **CM-I46:** effective kernel `types: []`, `lib: [ES2023]`, compiler isolation, and negative compile proof.
- **CM-I47:** complete source/control/export inventory and resolver target law.
- **CM-I50:** total/no-throw discovery, one authority, CI selection, mutation authority, watchdog, and exact evidence.

G0 case IDs use the `G0-*` namespace and never resemble behavioral T-numbers. No `@covers` marker or catalog-status row changes.

### Sole owner per fact and policy

| Fact/policy | Sole owner | Consumers; prohibited duplicate authority |
|---|---|---|
| Filesystem kind/readability, source/control/test/ignored membership | A/F inventory | All later stages consume `WorkspaceInventory`; none stats/reclassifies paths |
| Package manifest JSON shape, dependency facts, normalized export map and export-target regularity | A/F manifest model | B/C/E asks the model; it does not parse manifests or own export facts |
| Config nodes, edges, shape, recursive target status, containment, cycles | A/F config graph | B/C/E consumes graph; it does not reinterpret config shape |
| One source read/snapshot and source parse result | A/F read/snapshot plus B/C/E source-parse stage | D and reference stage consume the same `SourceInput`; no reread/reparse |
| Raw source syntax/package identity and reference extraction | B/C/E syntax/reference stages | A/F does not scan source syntax; D does not extract references |
| Permitted source resolution and source-target policy | B/C/E references/resolution | It uses A/F ownership facts and does not classify path kinds itself |
| Compiler isolation and source directive policy | B/C/E compiler stage | A/F supplies effective config graph; no second compiler guard |
| Capability meaning, symbols, scopes, flow/fixpoint, sinks | D | No name-regex or reference-stage capability interpretation |
| Case metadata, literal expectations, pairs, provenance | G1 | Not a production scanner or expectation oracle |
| Mutation/authority/watchdog evidence | G2 | Not a second boundary policy implementation |
| Production orchestration, one invocation, aggregation and canonical sort | I | The sole `scanWorkspace`; tests may invoke it, no second scanner |
| Fixture mutation primitive | A0 `FixtureOperation` support | A/F fixture helpers compose it; no ad hoc callback/write vocabulary |

G1 and G2 may have separate assurance tests. “One authority” means one production scanner and one normal root command, not one test file.

### R2-MR-01..07 closure map

This map is an index only; the normative contracts are fully contained in this artifact:

| Audit correction | Complete incorporated contract |
|---|---|
| R2-MR-01 | §3 exact source snapshot/read outcome, `StageResult`, config node/edge, check/mutation types, stage signatures, no-reread/no-throw propagation |
| R2-MR-02 | §2 sole-owner table; §9 per-slice owned surfaces; A/F manifest/export fact ownership versus B/C/E source-target consumption; G1/G2 assurance distinction |
| R2-MR-03 | §9 strict dependency graph and slice caveat: A0 → A/F → B/C/E → D → G1 → G2 → I; only G1 schema scaffolding may run parallel |
| R2-MR-04 | §7 one-to-one check → owner → canonical red → paired green → pre-execution mutant table and separate layer/trivial mutants |
| R2-MR-05 | §8 literal ledger, typed fixture/provenance/pair contracts, stale/delete/duplicate/pair/order/isolation/masking meta-mutants |
| R2-MR-06 | §4 complete pinned TypeScript grammar/JSDoc/loader/preprocessor table and §5 complete config shape/scope/target table |
| R2-MR-07 | §10 exact 60s/180s/10-minute watchdog, process-group/descendant, exit mapping, single-invocation and CI aggregate mutants |

No R2 correction is delegated to a source artifact or loose pointer. The consumed Steward and Reviewer files are identity evidence for this amended text, not runtime authorities.

## 3. Frozen composable stage contracts

The internal contract module is the only shared authority. These are exact observable shapes; implementations may add private fields without changing discriminants, ownership, or semantics. None is a Loredu package export.

```ts
type PathKind =
  | "absent"
  | "regular-file"
  | "directory"
  | "symlink"
  | "other"
  | "unreadable";

interface Violation {
  readonly path: string;    // root-relative portable separators
  readonly rule: string;    // stable rule name
  readonly detail: string;  // exact detail/location text
}

interface SourceSnapshot {
  readonly path: string;
  readonly text: string;          // decoded once and preserved exactly
  readonly byteLength: number;
  readonly contentDigest: string; // stable within one scan
}

type ReadOutcome =
  | { readonly kind: "read"; readonly snapshot: SourceSnapshot }
  | { readonly kind: "failed"; readonly violation: Violation };

interface InventoryEntry {
  readonly path: string;
  readonly kind: PathKind;
  readonly readable: boolean;
  readonly policySurface:
    | "workspace" | "package" | "source" | "test"
    | "control" | "ignored" | "unknown";
}

interface WorkspaceInventory {
  readonly root: string;
  readonly entries: readonly InventoryEntry[];
  readonly packages: readonly PackageInventory[];
  readonly sourceReads: readonly ReadOutcome[];
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

type ConfigNodeKind =
  | "root-manifest" | "root-tsconfig" | "package-manifest"
  | "package-tsconfig" | "extends-target" | "project-reference-target";
type ConfigNodeStatus =
  | "valid" | "absent" | "malformed" | "unreadable"
  | "symlink" | "outside" | "cycle" | "unsupported";
interface ConfigNode {
  readonly id: string; // unique normalized root-relative path
  readonly kind: ConfigNodeKind;
  readonly owner: "workspace" | "kernel" | "store-plainfile" | "cli";
  readonly pathKind: PathKind;
  readonly status: ConfigNodeStatus;
}
type ConfigEdgeKind = "extends" | "project-reference" | "path-substitution";
interface ConfigEdge {
  readonly from: string;
  readonly kind: ConfigEdgeKind;
  readonly raw: string;
  readonly to: string | undefined;
  readonly status:
    | "valid" | "forbidden" | "missing" | "malformed"
    | "unreadable" | "symlink" | "outside" | "cycle" | "unsupported";
}
interface ConfigGraph {
  readonly nodes: readonly ConfigNode[];
  readonly edges: readonly ConfigEdge[];
  readonly violations: readonly Violation[];
}

interface SourceInput {
  readonly snapshot: SourceSnapshot;
  readonly sourceFile: ts.SourceFile; // pinned public TS type; never reread
}

type StageName =
  | "inventory" | "config-graph" | "syntax" | "references"
  | "compiler" | "manifest-exports" | "capability-flow";
type StageResult<T> =
  | { readonly stage: StageName; readonly status: "ok";
      readonly value: T; readonly violations: readonly [] }
  | { readonly stage: StageName; readonly status: "blocked";
      readonly value: undefined; readonly violations: readonly Violation[] }
  | { readonly stage: StageName; readonly status: "partial";
      readonly value: T; readonly violations: readonly Violation[] };

type BoundaryCheckId =
  | "G0-A-INVENTORY" | "G0-B-SYNTAX" | "G0-C-REFERENCES"
  | "G0-C-SOURCE-PARSE" | "G0-D-CAPABILITY-FLOW"
  | "G0-E-COMPILER" | "G0-E-CONFIG-GRAPH"
  | "G0-F-MANIFEST-EXPORTS";
type ScanMutation = {
  readonly kind: "disable-stage";
  readonly checkId: BoundaryCheckId;
};

interface InventoryStage {
  (root: string): StageResult<WorkspaceInventory>;
}
interface ConfigGraphStage {
  (inventory: WorkspaceInventory): StageResult<ConfigGraph>;
}
interface SourceParseStage {
  (inventory: WorkspaceInventory): StageResult<readonly SourceInput[]>;
}
interface ReferenceStage {
  (input: SourceInput, graph: ConfigGraph):
    StageResult<readonly ModuleReference[]>;
}
interface CompilerStage {
  (inventory: WorkspaceInventory, graph: ConfigGraph):
    StageResult<CompilerEvidence>;
}
interface CapabilityStage {
  (input: SourceInput): StageResult<CapabilityFacts>;
}
```

`CompilerEvidence`, `ModuleReference`, and `CapabilityFacts` are internal types whose exact fields are frozen below. A stage never throws across its boundary. A caught operational failure becomes an owned violation; an unexpected stage failure is a deterministic nonzero scan failure and cannot produce a clean result.

### Stage result and source propagation rules

- A/F creates one `SourceSnapshot` per inventoried readable source and one `ReadOutcome`.
- B/C/E parses each readable snapshot once into `SourceInput`; it never opens the path again.
- Reference extraction and D consume that same `SourceInput`; neither accepts a root path or rereads bytes.
- A failed read is `blocked`/`ReadOutcome.failed` with the A/F diagnostic. Later stages receive no substitute input and emit no guessed result for that file; independent files continue.
- A parse failure is owned by `G0-C-SOURCE-PARSE`; that file is blocked from reference/capability guessing. Parseable files may be `partial` only while retaining their own explicit violations.
- I invokes each stage exactly once in dependency order and canonical-sorts the concatenated violations. I never reinterprets stage facts, filters diagnostics, or rereads source.

## 4. Pinned TypeScript and complete grammar authority

### Toolchain identity

The grammar is pinned to Bun `1.4.0`, TypeScript `5.9.3` from `bun.lock`, `moduleResolution: bundler`, `moduleDetection: force`, target/lib `ES2023`, and kernel-inherited `types: []`. A TypeScript/Bun/module-resolution/package-topology change invalidates grammar reconciliation and requires a fresh authority review before acceptance. Frozen install is mandatory.

`ts.preProcessFile(text, true, true)` is a reconciliation source for compiler-recognized imports, referenced files, type directives, and lib directives. It is not the sole loader parser: it does not enumerate all CommonJS forms. Any preprocessor item not attributed to a claimed node is uncertainty, except the explicitly documented CommonJS extensions below.

### Complete reference table

| Form | Static/shape rule | Frozen syntax/result |
|---|---|---|
| `ImportDeclaration` | module specifier is string literal or no-substitution template | `import`; validate raw specifier before resolution |
| `ExportDeclaration` | module specifier is string literal or no-substitution template | `export`; validate before resolution |
| `ImportEqualsDeclaration` | `ExternalModuleReference.expression` is one static string; `import x = M.x` is not external | `import-equals` |
| `ImportTypeNode` | argument is string literal/no-substitution template; includes qualified and `typeof import("x")`, plus supported attributes | `import-type`; type-only is still checked |
| dynamic `import(...)` | one argument, or two with supported attributes object; first is static | `dynamic-import`; uncertain otherwise |
| ambient `require(...)` | exactly one static argument and checker-proven ambient `require` | `require`; local/parameter/imported binding is ordinary code |
| ambient `require.resolve(...)` | ambient loader, literal `.resolve`, one static argument | `require-resolve`; aliases/chains only when reaching fact proves loader |
| ambient `module.require(...)` | ambient `module`, literal `.require`, one static argument | `module-require`; aliases/chains only when proven |
| JSDoc `@import` | TypeScript 5.9.3 materialized `JSDocImportTag.moduleSpecifier`, including supported `@import type` | `jsdoc-import` |
| JSDoc type forms | walk nested materialized `ImportTypeNode` in `@type`, `@param`, `@returns`, `@typedef`, and all other tags | `import-type`; retain enclosing-tag provenance |
| triple-slash `path` | pinned preprocessor `referencedFiles` item | `triple-slash`; target policy applies |
| triple-slash `types`/`lib` | pinned type/lib reference directives | `triple-slash`; kernel production rejects as `kernel-reference` |

Static is exactly one literal represented by the pinned AST. No-substitution templates are static; concatenation, substitutions, identifiers, property expressions, spreads, and computed values are not. A preprocessor literal from a concatenated expression does not make the source static.

The extractor walks public TypeScript AST/checker APIs and documented JSDoc APIs. It uses no regex over source bytes. A JSDoc tag that TypeScript 5.9.3 does not materialize is not invented as a reference; if the preprocessor/future parser exposes it, reconciliation makes it red.

### Loader aliases and uncertainty

Loader aliases/chains are statement-ordered and checker/flow aware. They are claimed only while the reaching fact proves ambient `require`, `require.resolve`, or `module.require`. Local shadowing, reassignment, closure capture, unknown computed member, unsupported arity, malformed attributes, and unresolvable declaration produce uncertainty, not clean. A local binding named `require` is not a loader reference.

The canonical uncertainty rule is `boundary-ast-uncertain`, including dynamic/non-static loaders, unsupported arity/attribute/chain, unclaimed preprocessor node, future syntax, or parse uncertainty. `boundary-dynamic` is not a second accepted outcome. `G0-C-SOURCE-PARSE` remains for file-level parse diagnostics. Uncertainty stops that reference but does not stop independent files.

Reconciliation compares all pinned `importedFiles`, `referencedFiles`, `typeReferenceDirectives`, and `libReferenceDirectives` with extractor claims. Only explicitly documented `require.resolve` and proven CommonJS aliases may be absent because the preprocessor does not report them. A TypeScript upgrade cannot merge until the inventory and corpus are refreshed.

### Syntax-first package law

For every reference: (1) establish static string/uncertainty; (2) classify raw `@loredu/*`, protocol/builtin, relative, or external identity and owner edge; (3) only then resolve permitted relative/non-workspace aliases; (4) classify the canonical target using A/F ownership facts. `paths` and `baseUrl` cannot launder raw `@loredu/*` identity, testing seams, private subpaths, or forbidden edges.

## 5. Total config graph and resolution policy

### A/F required path policy

A/F has one lstat-first classifier for every policy path:

```text
absent | regular-file | directory | symlink | other | unreadable
```

Required controls are root `package.json`, root `tsconfig.base.json`, each package `package.json`, and each package `tsconfig.json`. Required package/source roots are real readable directories. Optional `packages/kernel/testing` is green only for true `absent`. Expected export targets are regular readable non-symlink files in the expected package surface. Every lstat/read/stat/readdir/parse race or failure is a deterministic `unreadable`/`changed` violation, never absence and never a throw.

| Position | Required/allowed state | Failure owner |
|---|---|---|
| root/packages/known package roots | real readable directories, not symlink | A/F inventory |
| source roots and CLI `bin/` | real readable nonempty directories | A/F inventory |
| optional testing root | true absence, or valid real readable directory | A/F inventory |
| package/tsconfig control files | regular readable non-symlink files | A/F inventory/config |
| export targets | regular readable non-symlink expected files | A/F manifest/export |
| discovered source/control-looking entries | supported regular files or real directories | A/F inventory |
| ignored `node_modules`, `dist`, `build`, generated, hidden trees | not traversed as source; imports into them red | A/F facts, B/C/E target policy |

No failed classification is followed by `realpath`, `readFile`, `readdir`, JSON parsing, resolver creation, or program creation.

### Config node/edge semantics

A/F records every node and edge, including malformed/unresolved edges. It follows `extends`, project `references`, and effective `paths` substitutions recursively with visited/in-progress sets. Cycles are represented and red; traversal is bounded. A target is classified before opening it.

| Field | Required shape and policy |
|---|---|
| top-level manifest/tsconfig | plain object; not null, array, scalar, or malformed JSON |
| `extends` | if present, nonempty string only; null/array/object/number/boolean/empty red |
| `references` | if present, array of plain objects with nonempty string `path`; null/string/array element/missing/non-string path red; supported boolean fields remain booleans |
| `compilerOptions.paths` | plain object; not null/array; each key has at most one `*`; each value is nonempty string array of relative patterns |
| `baseUrl` | string resolving to real readable workspace directory; symlink/outside red |
| dependency maps | plain objects with string versions; names checked against workspace graph |
| `exports` | exact plain key/string map fixed by package contract; arrays/conditions/wildcards/null/non-string targets red |

`ConfigNode` status is `valid`, `absent`, `malformed`, `unreadable`, `symlink`, `outside`, `cycle`, or `unsupported`. `ConfigEdge.to` is undefined only when the malformed/unresolved state requires it; the edge remains in the graph with its exact status.

### Recursive target scope and substitutions

Allowed `extends` targets are workspace-contained relative JSON or extensionless paths resolved by `.json`, rooted in the root config or same package. Package-name, URL, `node_modules`, directory/index, source-file, outside, symlinked, dangling, missing, unreadable, malformed, cyclic, and unsupported targets are red. A package may not extend another package's config.

Allowed project-reference targets are workspace-contained exact config paths or known package directories resolving to `tsconfig.json`. A root solution may reference known package projects. Package project references must follow the existing DAG: kernel none; store may reference kernel; CLI may reference kernel/store. Reverse/unknown/outside edges are red. A base config ancestor is not automatically a project reference.

`paths` substitutions resolve relative to effective `baseUrl` and remain inside the workspace and allowed source/control surfaces. An unused valid pattern need not resolve to a file; a used missing expansion is `boundary-target`. Absolute, URL/protocol, bare package, escaping, malformed, ignored, hidden, generated, outside, symlinked, or test-only target is red. A syntactic `@loredu/*` name is judged before any mapping.

### Source resolution and target ownership

After syntax law, B/C/E may use pinned `ts.resolveModuleName` for extensionless, `.js`→`.ts`/`.tsx`/`.d.ts`, `.mjs`→`.mts`/declarations, `.cjs`→`.cts`/declarations, index, and allowed non-workspace alias substitutions. Resolution success never bypasses A/F path kind/surface ownership. Kernel rejects all bare external runtime packages and Node/Bun runtime builtins; adapter use remains limited by declared dependencies and DAG. Relative cycles are allowed if surfaces are allowed; config cycles are always red.

## 6. Capability flow contract

D owns symbol identity, lexical scope, capability facts, flow, fixpoint, and sinks. It consumes `SourceInput` and does not read paths or extract module references. Stable public TypeScript APIs are mandatory; checker-private internals and regex/name fallback are forbidden.

The exact possible-fact vocabulary is:

```text
GlobalObject | DateConstructor | DateNow | MathObject | MathRandom |
BunGlobal | ProcessGlobal | BufferGlobal | Clean | UnknownCapabilityDerived
```

Facts are possible-value sets; joins union possibilities. An unproven/unknown reaching capability is `UnknownCapabilityDerived` and is rejected at use/escape. The CFG is statement ordered and iterates to a fixpoint over branches, loops, backedges, closures, and recursive functions. `const` facts are stable; mutable facts change only through definite writes and joins conservatively. A future declaration cannot hide an earlier read. A closure captures the joined fact at its boundary; later writes cannot retroactively clean an escaped value.

Reject ambient Bun/process/Buffer reads; direct/aliased/computed/optional capability calls; globalThis aliases/destructures; `Date()`; `Date.now`; zero/missing/uncertain/spread-only `new Date`; `Math.random`; `.call`, `.apply`, optional/indirect invocation; and return/export/property/array/spread/destructure/conditional/unknown-call escapes. Keep green explicit-value `new Date(value)`, `Date.parse`, deterministic Math, local/imported/parameter symbols named Date/Math/Bun/process/Buffer, labels, inert method/property/type names, and a mutable alias definitely overwritten with `Math.max` before use.

Required red cases include closure-before-alias, named/default/aggregate exports of `now`, all five globalThis destructures, literal and unknown computed properties, shorthand values, `d.now.call(d)`, `m.random.apply(m)`, branch joins, backedges, recursion, tainted→clean/clean→tainted joins, and every listed escape sink. Novel Tester cases must be outside the committed ledger.

## 7. Frozen checks, canonical cases, paired controls, and mutants

### One-to-one check ratchet

Every production check has exactly one owner, one pre-execution mutation branch, one isolated canonical red case, one isolated paired green control, and one mutation record. Additional cases are regressions, not substitutes.

| Check ID | Sole stage | Canonical isolated red | Paired isolated green | Pre-execution mutant |
|---|---|---|---|---|
| `G0-A-INVENTORY` | A/F inventory | required-root-read-failure | regular complete workspace | disable inventory before traversal |
| `G0-B-SYNTAX` | B/C/E syntax | forbidden/unknown raw `@loredu/*` identity | allowed raw workspace edge | disable syntax before identity classification |
| `G0-C-REFERENCES` | B/C/E references | ambient aliased loader/static reference | local bound loader/no module claim | disable reference extraction/resolution before execution |
| `G0-C-SOURCE-PARSE` | B/C/E source parse | malformed source file | valid source file | disable parse diagnostics before parse result |
| `G0-D-CAPABILITY-FLOW` | D flow | globalThis alias/ambient escape | local parameter/definitely-clean reassignment | disable flow before analysis |
| `G0-E-COMPILER` | B/C/E compiler | effective kernel types/lib widening | exact inherited kernel config | disable compiler proof before execution |
| `G0-E-CONFIG-GRAPH` | A/F config graph | `extends: null` or missing recursive target | valid recursive graph | disable config traversal before dereference |
| `G0-F-MANIFEST-EXPORTS` | A/F manifest/export facts | missing/swapped export target or forbidden manifest edge | exact normalized manifests | disable manifest/export policy before validation |

A shared helper is allowed only if each ID still has an independently observable branch and mutation delta. Disabling one ID may not silently disable another.

The separate assurance IDs are:

```text
G0-G1-CASE-LEDGER
G0-G1-PROVENANCE
G0-G2-MUTATION-INJECTION
G0-G2-WATCHDOG
G0-G2-AUTHORITY
```

Whole-layer omission mutants and a trivial `[]` orchestrator mutant are separate assurance mutations, not extra production check IDs.

## 8. Frozen ledger, provenance, pair, and ordering contract

### Types

```ts
type FixtureOperation =
  | { readonly kind: "mkdir" | "remove" | "symlink";
      readonly path: string; readonly target?: string }
  | { readonly kind: "write";
      readonly path: string; readonly contents: string }
  | { readonly kind: "chmod";
      readonly path: string; readonly mode: number };

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

### Ledger rules

- `fixtureMutation` is nonempty data-only operations; no callbacks, scanner calls, output transforms, or expectation factories.
- Every case has exactly one known group/layer, at least one matrix row, one or more frozen check IDs, nonempty provenance, and a literal exact `Violation[]` in canonical order.
- Every red has exactly one green pair; pair links are reciprocal, bijective, non-self, and neither side may be a second-order/circular alias. Green executes in a separate temporary root from the same clean seed.
- Red and green complete outputs equal their own literal expected arrays. The test never asserts only absence/presence of a diagnostic. An unrelated violation invalidates the case.
- Provenance is a committed machine-readable manifest. Each identity binds artifact, commit, tree, merge-base, and optional CI/artifact checksum. Unknown, absent, mismatched, changed, or unavailable identity is stale and fails the ledger. Historical task handoffs are evidence inputs, not runtime oracles.
- Violation order is stable lexicographic Unicode scalar comparison by portable root-relative `path`, then `rule`, then `detail`; no locale/filesystem enumeration order. I performs the sole canonical sort; G1 does not deduplicate/filter.
- Cases are executed against the composed production scanner only after I; G1 schema-only tests do not claim policy.

### Mandatory historical and new coverage

The ledger carries every replan-1 closure: nested supported discovery and unsupported executable/unknown extensions; missing/unreadable roots; source/control/testing symlinks including dangling; ignored trees; unknown/external/builtin/workspace/testing references; resolver substitutions/declarations/index/outside targets; all import/export/import-equals/import calls/require/comments/attributes/dynamic uncertainty; triple-slash directives; capability aliases and green controls; exact/malformed export maps; inherited compiler options and negative compile; parent paths with spaces or `tests`; clean workspace; and CI ownership.

It adds exact pairs for path-collision syntax law; every `ImportTypeNode` outcome; preprocessor mismatch and TypeScript upgrade uncertainty; all loader/JSDoc forms; globalThis/destructure/shorthand/computed/unknown-computed; call/apply/optional/indirect/escape/branch/backedge/fixpoint/closure/recursive cases; malformed/missing/cyclic config graph; control-path symlinks; true optional absence; changed-between-inspection/read failures; process descendants; duplicate/missing invocation and aggregate mutants.

### Meta-mutants

The ledger meta-suite independently fails for deleted case IDs, duplicate IDs, unknown/stale provenance, missing/nonreciprocal/self pairs, unknown group/layer/matrix/check IDs, missing/changed expected arrays, callback/non-fixture mutations, contaminated red/green roots, canonical-order changes, scanner-derived expectations, and unrelated-violation masking. These are real ledger mutations, not output filters.

## 9. Strict slice decomposition and immutable handoffs

All slices are replacement branches rooted by ancestry at `master@612ddcb`. The only permitted implementation order is:

```text
A0 -> A/F -> B/C/E -> D -> G1 -> G2 -> I
A0 -> G1-schema-only (parallel scaffolding only; not executable policy evidence)
```

A/F is a hard dependency of B/C/E and D. B/C/E is a hard dependency of D because D consumes the parsed source/checker input seam. G1 executable evidence depends on all production stages. G2 depends on executable G1 and all production stages. I depends on all slices and accepted P0/master. Any child handoff must bind:

```text
slice name and owner
parent contract artifact SHA-256
base commit, base tree, parent commit, head commit, head tree, merge-base
changed-path manifest
consumed stage contracts and dependency closure
exact local commands/tool versions
case counts and exact mutant results
invalidation scope if parent/master changes
```

A branch name, PR number, or green CI without these identities is invalid evidence.

### A0 — contract/schema-only lock

- **Goal:** compile-check the exact stage/result/source/check/mutation/fixture/ledger/provenance/pair contracts; establish no-scanner/no-root-wiring boundary.
- **Owned surfaces:** new `scripts/workspace-boundaries/contracts.ts`; new `tests/support/workspace-boundaries/case-schema.ts`; new `fixture-operations.ts`; no root script, workflow, scanner, package, docs, or catalog.
- **Matrix:** vocabulary only for CM-I41/I43/I44/I45/I46/I47/I50; no policy closure.
- **IN_SCOPE:** closed unions/types, exact stage signatures, source snapshot/read propagation, typed pair/provenance/fixture constraints, canonical sort definition, frozen check IDs.
- **OUT_OF_SCOPE:** any scanner rule, resolver, capability result, config policy execution, CI/watchdog, T-number.
- **DEPENDENCY:** authority identities above, pinned toolchain, `master@612`.
- **AMBIGUOUS:** none after Steward closure; any newly discovered public semantic is an immediate stop and decision-record route.
- **Acceptance:** compiler checks pass; schema meta-tests reject all malformed metadata; no import/invocation of scanner; no root wiring; immutable handoff recorded. A0 does not claim a G0 invariant.

### A/F — inventory, manifests/exports, and total config graph

- **Goal:** own every filesystem/control/config/manifest fact before later analysis.
- **Owned surfaces:** `inventory.ts`, `config-graph.ts`, `manifest-model.ts`, A/F fixture compositions, no root command/workflow/scanner orchestration.
- **Matrix:** CM-I47, CM-I50; manifest edge facts for CM-I43; effective config facts for CM-I46.
- **IN_SCOPE:** one lstat classifier; snapshots/read outcomes; roots/surfaces/ignored entries; manifest JSON/dependency/export facts; recursive config nodes/edges, malformed shapes, cycles, scope, target status; exact A/F diagnostics.
- **OUT_OF_SCOPE:** raw module syntax, resolver calls, source target policy, capability meanings, CI/mutation/watchdog, product code.
- **DEPENDENCY:** A0 contracts; current package topology; pinned compiler config; accepted P0 files at I.
- **AMBIGUOUS:** none; the config table in §5 is closed. A deviation stops implementation.
- **Acceptance:** real temporary-tree cases for every kind/error/malformed graph; no throw; no unchecked post-failure operation; exact facts passed by typed handoff; immutable manifest recorded.

### B/C/E — syntax/reference/compiler stages

- **Goal:** enforce raw syntax-first package law, complete pinned reference grammar, permitted resolution, source parse, and compiler isolation.
- **Owned surfaces:** `syntax-law.ts`, `module-references.ts`, `resolution.ts`, `compiler-isolation.ts`; no manifest parser/export-fact authority, no config parser, no D, no root wiring.
- **Matrix:** CM-I41/I43/I44/I46/I47.
- **IN_SCOPE:** exact grammar table; `ImportTypeNode`; JSDoc; aliases/chains; triple slash; uncertainty/reconciliation; raw `@loredu/*` before resolution; resolver substitutions and target policy using A/F facts; compiler negative proof.
- **OUT_OF_SCOPE:** filesystem kind/config shape/manifest fact creation; capability dataflow; watchdog; product/runtime/package changes.
- **DEPENDENCY:** A0 and A/F typed inventory/config/manifest/source snapshot; pinned TS identity.
- **AMBIGUOUS:** none; future/unclaimed syntax is `boundary-ast-uncertain`, not a local exception.
- **Acceptance:** grammar table and preprocessor reconciliation; path-collision red; all loader/JSDoc/import-type red/green controls; exact compiler/directive negative proof; no resolver before syntax; immutable handoff.

### D — capability flow

- **Goal:** prove ambient capability use/escape conservatively with symbols, scopes, CFG joins, and fixpoint.
- **Owned surfaces:** `capability-facts.ts`, `capability-flow.ts`, D fixtures/cases; no source reads, reference extraction, manifest/config parsing, root wiring, or workflow.
- **Matrix:** CM-I44/I45 and complementary CM-I46.
- **IN_SCOPE:** frozen ten facts; checker symbols; statement order; branch/loop/backedge/closure/recursive fixpoint; all aliases/destructures/computed/shorthand/call/apply/escape sinks and green controls.
- **OUT_OF_SCOPE:** module/config/filesystem policy; loader grammar; capability-port contract changes; watchdog/CI.
- **DEPENDENCY:** A0; A/F source snapshots/inventory; B/C/E `SourceInput` and parsed checker input. D is not parallel-executable as a policy slice after A0.
- **AMBIGUOUS:** none; unsupported checker meaning becomes `UnknownCapabilityDerived`/red or stops for tool review.
- **Acceptance:** novel and committed red/green flow cases; fixpoint termination; no checker-private API/name fallback; exact flow violations; immutable handoff.

### G1 — complete ledger (schema-only caveat)

- **Goal:** account for every case with exact isolated output, provenance, pair, matrix, check, and historical coverage.
- **Owned surfaces:** `case-ledger.ts`, grouped committed case data, provenance manifest, ledger tests. No scanner policy and no root CI wiring.
- **Matrix:** all seven CM rows through cases; no product catalog.
- **IN_SCOPE:** schema-only scaffolding may run after A0 in parallel; executable ledger, all cases, pair/provenance/meta-mutants require A/F+B/C/E+D contracts and composed scanner.
- **OUT_OF_SCOPE:** inventing policy, altering expected output to fit implementation, product tests, CI watchdog.
- **DEPENDENCY:** A0; executable G1 hard-depends on A/F, B/C/E, D; prior evidence identities.
- **AMBIGUOUS:** none; unmapped historical behavior is a blocker, not a dropped case.
- **Acceptance:** exact ledger/meta-tests; each case isolated; red and green literal arrays; all historical/new cases; stale/delete/duplicate/pair/order/masking mutants fail for intended reasons; immutable handoff.

### G2 — mutation, watchdog, and CI authority

- **Goal:** establish true pre-execution mutation sensitivity, command/process boundaries, and one explicit fail-closed CI authority.
- **Owned surfaces:** `run-with-watchdog.ts`; mutation harness/tests; root `package.json` only one `check:boundaries` command; workflow only explicit step/timeout; no package runtime code.
- **Matrix:** CM-I50 plus check ownership across all rows.
- **IN_SCOPE:** eight pre-execution branches; whole-layer/trivial mutants; watchdog/process-group/exit semantics; one scanner/one command/one workflow invocation; aggregate authority.
- **OUT_OF_SCOPE:** policy changes, second scanner, output filtering, unrelated no-mistakes, domain behavior.
- **DEPENDENCY:** all production stages and executable G1; current ADR 0012 workflow; final P0 source.
- **AMBIGUOUS:** none; all budgets and exits are frozen below.
- **Acceptance:** every table row kills its own mutant; omission/duplicate/trivial mutants fail; novel descendant hang terminates; ordinary exits preserve; exact workflow static/executable authority tests pass; immutable handoff.

### I — one-authority integration and acceptance

- **Goal:** compose one `scanWorkspace`, one root command, one explicit workflow invocation, and final exact-head evidence.
- **Owned surfaces:** `scripts/check-workspace-boundaries.ts`; integrated `tests/workspace-structure.test.ts`; conflict resolution only for accepted P0/master; no new policy.
- **Matrix:** all CM rows.
- **IN_SCOPE:** typed stage order, one source snapshot, deterministic aggregation/sort, real workspace, ledger/mutation execution, P0 fan-in, exact evidence.
- **OUT_OF_SCOPE:** new vocabulary/policy/package edge/API/T-number/domain docs/history rewrite.
- **DEPENDENCY:** A0→A/F→B/C/E→D→G1→G2, accepted P0 on master, fresh install, same-head Tester/Reviewer, exact CI.
- **AMBIGUOUS:** any changed owned master surface stops integration for dependency review.
- **Acceptance:** only I may claim G0 acceptance; all final evidence and same-head independent approvals are required.

## 10. Watchdog and CI authority contract

### Command watchdog

The sole command-level wrapper starts one command directly, without shell interpolation. Invalid invocation exits `2` without starting a child. Fixed budgets are:

- `check:boundaries`: **60 seconds**;
- complete root `test`: **180 seconds**.

The wrapper arms the timer before waiting, inherits stdio, and at timeout terminates the entire owned process group/tree using pinned Bun/runtime APIs. POSIX must terminate the created process group; Windows must use the available equivalent job/process-tree boundary. If the pinned runtime cannot provide descendant cleanup, G2 is blocked and escalates a tool decision; direct-child-only termination is insufficient.

Timeout exits **124**. Child exit `0` is preserved as `0`; ordinary nonzero is preserved; signal-only/no numeric status maps deterministically to `1`. Timeout never becomes success or a child status. A novel synchronous infinite loop and a descendant process are mandatory fixtures. Evidence must prove no owned descendant remains.

### CI authority

`.github` `workspace-suite` has explicit `timeout-minutes: 10` (**10 minutes**). This outer ceiling is defense-in-depth and cannot replace the 60/180-second command budgets. A cancelled/timed-out job is non-success and the `if: always()` aggregate fails closed. The selector must choose `docs_only=false` for code/config/workflow changes; docs suite is skipped; workspace suite succeeds; aggregate succeeds.

The root package has exactly one scanner command, `check:boundaries`, and the workspace workflow has exactly one explicit boundary step invoking it. The complete root test is invoked exactly once through its 180-second watchdog; no adjacent raw `bun test` authority exists. G2 kills mutants for removed explicit boundary step, duplicate scanner invocation, duplicate test invocation, missing aggregate failure, trivial scanner return, and selector/skip laundering. Static checks and executable command tests are both required.

## 11. Exact mutant and assurance evidence

For every policy check: record mutation ID, source branch location, baseline output, mutated output, exact expected delta, canonical red/green case IDs, no-unrelated-violation assertion, and proof the mutation hook is unreachable from normal CLI. The hook is constructed only by test support and is accepted only at the pre-execution stage branch.

Required layer mutants: inventory omission; syntax omission; reference extraction omission; resolver target classification omission; capability-flow omission; compiler omission; config-graph omission; manifest/export omission; source-parse omission; trivial `[]` orchestrator. These are separately named from production check IDs. A surviving mutant is a failed slice, regardless of broad test green.

## 12. Exact local, CI, and independent-assurance protocol

### Final local evidence

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

The final manifest records all command outputs, versions, head/tree/merge-base/master, changed paths, matrix map, case counts by group, exact ledger/meta-mutant results, `mutants killed N/N`, negative compiler diagnostics, watchdog/descendant exits, real-workspace clean result, and one-authority proof.

### Exact GitHub result

Each code/config replacement PR must have selector success with `docs_only=false`; `docs-suite=skipped`; `workspace-suite=success`; and `ci-required=success`. The workspace suite must explicitly contain install, lint, spell, docs, catalog, gates, typecheck, one watchdog-wrapped full test, one explicit boundary command, and compile smoke. All job results and URL/run ID must bind to the exact head/tree. Historical CI `33052334867` cannot substitute.

### Independent roles

A fresh Tester and Reviewer run against the same exact final head/tree/merge-base. Tester repeats all committed cases and mutants, adds novel filesystem/module/flow probes, descendant hang, ordinary exit 0/9, and invocation mutants. Reviewer audits stage ownership/order, source snapshot no-reread, grammar/config tables, flow fixpoint/sinks, literal ledger/provenance/pairs/order, pre-execution mutation, process boundary, single invocation, and exact CI. Mixed-head evidence is invalid.

## 13. Merge, closure, and preservation timing

1. Before any implementation dispatch, reverify the retention tag object/peeled commit/tree/base, bundle checksum, remote tag, and PR #32/#35 branches. Do not move/delete/force-push them.
2. Dispatch A0 only after this identity-bound amended artifact and Steward authority are consumed. A0 is schema-only and cannot claim policy.
3. Stack replacement branches from `master@612` in strict A0 → A/F → B/C/E → D → G1 → G2 → I order. G1 schema-only scaffolding may be parallel after A0; executable G1 is not parallel.
4. Do not repair PR #35 or create a comparison PR. After replacement A0 exists and links custody, retire/close PR #35 as superseded while retaining its branch/tag/bundle. If operational policy requires waiting, close it no later than final replacement acceptance; never push a repair to it.
5. Keep PR #32 open until final replacement G0 is accepted/merged; then close it as superseded by the merged replacement, retaining branch/tag/bundle.
6. Accepted P0 must be on master before I. Any P0/master change touching package topology, compiler config, workflow, source roots, or owned scanner paths invalidates dependent manifests and requires re-review; no casual conflict resolution.
7. After any published replacement branch, do not force-push. Integrate later master by ordinary merge/rebase policy and regenerate identity-bound handoffs.
8. Only I, after fresh same-head Tester/Reviewer approval and exact-head CI, may claim G0 acceptance. Human/repository merge gate remains external and is not claimed here.

## 14. Required per-slice handoff template

Every A0, A/F, B/C/E, D, G1, G2, and I handoff appends one immutable block containing:

```text
slice: <exact slice>
verdict: done | blocked | needs-action | failed
owner: <role/identity>
parent-contract-sha256: <hash>
base/head/parent/tree/merge-base: <immutable identities>
changed-paths: <complete manifest>
owned-matrix: <rows>
owned-checks: <IDs or none>
consumed-interfaces: <exact names/signatures>
local-commands-and-versions: <complete results>
case-groups/counts: <exact counts>
mutants: <exact killed/total and intended deltas>
positive-controls: <exact controls>
invalidated-by: <master/contract/tool changes>
pending: <none or exact blocker>
artifacts: <paths/URLs/checksums>
```

`done` for a schema-only slice means only its schema/contract acceptance, never G0 policy acceptance. Any missing field, branch/tree mismatch, stale provenance, surviving mutant, uncontrolled reread, duplicate owner, or mixed-head evidence is `needs-action`/`failed`, not green.

## 15. Result protocol

```text
status: READY_FOR_FRESH_MATRIX_RE-AUDIT
summary: Replan 2 amended with Steward-closed stage/source/config/check/mutation/ledger/provenance/pair/watchdog contracts and R2-MR-01..07 corrections. Replacement order is A0 -> A/F -> B/C/E -> D -> G1 -> G2 -> I, with only G1 schema scaffolding permitted to run parallel after A0.
attempt_count: 5
next_attempt: 6
attempt_limit: 20
replan_count: 2
caused_by: broad repeated exact-head false greens on a945521 despite green local/CI checks; independent flow, reference, config-totality, ledger, and mutation authority were incomplete.
implementation: none
acceptance: not claimed
human_gate: not claimed
preservation: verified tag/bundle/manifest for a945521; PR #32/#35 retained
inputs-needed: none
```

No new replan count is created. This amended artifact completes replan 2. Fresh matrix re-audit may now evaluate the identity-bound text; A0 dispatch remains subject to that re-audit and the exact constraints above.

## 16. Domain/catalog impact

No domain behavior, terminology, package contract, public kernel API, package edge, capability-port meaning, or behavioral T-number changes. No repository docs or implementation files are changed by this plan. If a worker discovers that a public semantic, package topology, tool dependency, compiler version, or legal capability rule must change, stop and route the required decision record instead of extending G0 locally.
