# G0 replan 2 Contract Steward decision

Task: `loredu-g0-replan2-contract-steward--01M1157FK6N2S54TG9EYGW6A0X`
Planning artifact: `loredu-g0-replanner-2--01M114QXHW7RS0KY190TGBN527/g0-replan-2.md`
Decision scope: internal workspace-boundary assurance only; no product/package contract change.

## Authority consumed

- G0 replan 2, including the frozen A0 interfaces, eight production check IDs, and A0 → A/F → B/C/E → D → G1 → G2 → I order.
- `docs/v0.x/execution/implementation-plan.md` M0, ADR 0011, ADR 0012, ADR 0016, ADR 0018, and the package contracts.
- Pinned toolchain at the planning base: Bun `1.4.0` (`.bun-version`), TypeScript `5.9.3` (`bun.lock`), `moduleResolution: bundler`, `moduleDetection: force`, `target/lib: ES2023`, and `types: []` inherited by the kernel.
- Attempt-5 exact-head evidence: `a945521af7d3a8415f071322b577be6865f9ed8f`, tree `06c42f72db78d83e084b39b4c281a59ab7929335`, merge-base `612ddcb0f23d0177b806942f89a158c50267b926`, CI `33052334867`, preservation manifest and bundle.
- The exact final Reviewer and Tester handoffs for attempt 5. Their failures are treated as evidence of incomplete models, not as authority for changing the rules.

## Verdict and classification summary

| Gate / matrix area | Classification | Steward disposition |
|---|---|---|
| CM-I41 testing seam and test surface | `EXISTING_CONTRACT_CONSEQUENCE` | ADR 0011 already makes `/testing` test-only. The exact source-surface and syntactic-before-resolution rules below are internal enforcement detail. |
| CM-I43 package DAG and kernel runtime dependency law | `EXISTING_CONTRACT_CONSEQUENCE` | Enforce the settled `kernel ← store-plainfile ← cli` graph and kernel zero external runtime dependencies; no new edge or package API. |
| CM-I44 environment imports/directives/globals | `EXISTING_CONTRACT_CONSEQUENCE` | ADRs 0011/0016/0018 already require this. The complete AST inventory and fail-closed uncertainty behavior below are internal proof rules. |
| CM-I45 ambient time/random capability flow | `EXISTING_CONTRACT_CONSEQUENCE` | ADR 0018 fixes the capability boundary. D may choose private data structures, but not a weaker semantic result. |
| CM-I46 effective kernel compiler isolation | `EXISTING_CONTRACT_CONSEQUENCE` | ADR 0016 fixes the kernel's effective `types: []`, `lib: [ES2023]` and negative compiler proof. |
| CM-I47 source/control/export inventory and resolver target law | `EXISTING_CONTRACT_CONSEQUENCE` | ADR 0011/0016 require structural enforcement; the target and substitution limits below make that enforcement executable. |
| CM-I50 total discovery, one authority, CI and watchdog | `INTERNAL_ASSURANCE_DECISION` | ADR 0012 requires fail-closed CI, but does not specify command watchdog durations or exit mapping. The G2 rules below close that internal gap. |
| Public/package/domain semantics | `NO_CHANGE` | No public export, package edge, kernel capability, record contract, terminology, or behavioral T-number is changed. No domain-doc update is owed. |

No item is `NEEDS_DECISION` in the public/package sense. The three historical gates and the watchdog gap are now resolved as internal assurance policy. The result is not permission to implement a new package semantic: all rules below belong to the repository checker and its tests.

## 1. Pinned TypeScript 5.9.3 reference grammar

### 1.1 Version and authority boundary

The reference inventory is pinned to TypeScript `5.9.3` as resolved by the lockfile and Bun `1.4.0`. A change to TypeScript, Bun, module resolution, source extensions, or the package topology is an assurance change: it invalidates the inventory reconciliation and requires a new Contract Steward review before the boundary guard can be accepted. A semver range in a manifest does not authorize silently accepting a newly resolved compiler; `bun install --frozen-lockfile` and the lockfile identity are the operative pin.

TypeScript's `preProcessFile(text, true, true)` is a reconciliation oracle for compiler-recognized source references, not the sole policy parser. In particular, it does not enumerate every CommonJS loader spelling (for example, `require.resolve` and many aliases). Those loader forms are covered by the AST/checker extractor's explicit loader table. A preprocessor item not attributable to a claimed reference is uncertainty, not an invitation to ignore it.

### 1.2 Supported reference forms

Every reference gets a `ModuleReference` with a source location and one of the frozen syntax values. The extractor must use public TypeScript AST/checker APIs; it must not use a regex over source bytes as a fallback.

| TypeScript syntax / loader | Static rule | Result |
|---|---|---|
| `ImportDeclaration` | `moduleSpecifier` must be a string literal or no-substitution template literal | `import`; validate the specifier before resolution |
| `ExportDeclaration` | `moduleSpecifier` must be a string literal or no-substitution template literal | `export`; validate before resolution |
| `ImportEqualsDeclaration` | `ExternalModuleReference.expression` must be one static string; `import x = M.x` is not an external module reference | `import-equals`; validate before resolution |
| `ImportTypeNode` | `argument` must be a string literal/no-substitution template literal; this includes qualified and `typeof import("x")` forms and supported import attributes | `import-type`; validate even though it is type-only |
| `import(...)` call | exactly one argument, or exactly two arguments where the second is a supported import-attributes object; first argument must be static | `dynamic-import`; static first argument is checked normally |
| ambient unshadowed `require(...)` | call must have exactly one static argument; only a checker-proven ambient `require` counts | `require`; local/parameter/imported `require` is ordinary code and is not claimed as a loader |
| `require.resolve(...)` | ambient unshadowed `require`, literal `.resolve`, exactly one static argument | `require-resolve`; aliases/chains are accepted only when checker/flow facts prove this same loader |
| `module.require(...)` | ambient unshadowed `module`, literal `.require`, exactly one static argument | `module-require`; aliases/chains are accepted only when proven |
| supported JSDoc `@import` | TypeScript 5.9.3 `JSDocImportTag.moduleSpecifier`, including `@import type` where the pinned parser exposes the module specifier, must be static | `jsdoc-import` |
| JSDoc type forms | Traverse the pinned JSDoc tag's `typeExpression` and claim every nested `ImportTypeNode`; this covers `@type`, `@param`, `@returns`, `@typedef`, and other tags when the parser materializes an import type | `import-type` (the enclosing tag remains provenance) |
| triple-slash `path` | pinned preprocessor `referencedFiles` entry, static by directive grammar | `triple-slash`; validate the target as a workspace control/source reference |
| triple-slash `types` / `lib` | pinned `typeReferenceDirectives` / `libReferenceDirectives` entries | `triple-slash`; kernel production sources reject these as `kernel-reference`, while the inventory still records them |

Static means one literal value represented by the pinned AST. A no-substitution template literal is static; concatenation, a template substitution, identifier, property expression, or other computed expression is not. The compiler preprocessor's tendency to report only a first literal from a concatenated loader expression does not make that expression static.

The loader table is statement-ordered and symbol-aware. It recognizes identifier aliases and member chains for `require`, `require.resolve`, and `module.require` only while the checker can prove the alias's reaching fact is the ambient loader. A local binding shadows the ambient loader. An unknown computed member, reassignment, closure capture, or unresolvable declaration is not guessed clean: it emits uncertainty at the relevant call/reference. This closes the attempt-5 aliases without treating every function named `require` as a module loader.

### 1.3 JSDoc and comments

The extractor parses each policy source with the pinned TypeScript parser and additionally inspects JSDoc AST/tag APIs in the documented JavaScript parse mode when needed, because TypeScript 5.9.3 does not expose all comment-attached JSDoc nodes through ordinary `forEachChild` on a `.ts` source file. It walks `ts.getJSDocTags` and nested `typeExpression` trees; it never searches comment text for the word `import`. Thus prose, strings, regex literals, and comments that resemble imports are inert, while real `@import {X} from "m"` and `import("m")` type forms are claimed.

A JSDoc tag with a non-static or malformed module specifier is uncertainty. An unsupported JSDoc tag that the pinned parser does not materialize as an import-bearing node is not invented as a reference; if the preprocessor or a future parser exposes it, the reconciliation rule below makes it red. `@import type` is accepted only in the exact shape that TypeScript 5.9.3 materializes; a different future grammar is not silently accepted.

### 1.4 Deterministic uncertainty

`boundary-ast-uncertain` is the canonical fail-closed diagnostic for all of these cases:

1. a recognized dynamic/loader form has no statically known module string;
2. a recognized node has an unsupported arity, attribute shape, or loader chain;
3. the AST/preprocessor reconciliation finds a reference-bearing compiler item that has no extractor claim;
4. a future TypeScript node, JSDoc form, directive form, or loader form is encountered but is not in the pinned table;
5. a source parse is sufficiently uncertain that the extractor cannot prove the reference set.

The diagnostic includes root-relative source path, location, syntax kind when available, and a stable reason. The guard stops semantic processing of that reference, but continues independent files/stages. It never resolves an uncertain reference and never reports it clean. `boundary-dynamic` is not a second policy outcome; if retained as a historical implementation label, it must be normalized to `boundary-ast-uncertain` in the stage output and case ledger. `source-parse` remains reserved for a file-level TypeScript parse diagnostic.

A reconciliation test must compare all `importedFiles`, `referencedFiles`, `typeReferenceDirectives`, and `libReferenceDirectives` from the pinned preprocessor with the extractor's claims, subtracting only the explicitly documented CommonJS loader extensions (`require.resolve` and proven aliases) that the preprocessor does not report. Any other subtraction fails the test and emits uncertainty. A TypeScript upgrade changes this comparison table and cannot merge without refreshed red/green grammar cases.

### 1.5 Syntax-first package identity

For every static `ModuleReference`, policy ordering is fixed:

1. extract the static string and classify uncertainty;
2. classify the raw specifier's syntax (`@loredu/*`, protocol/builtin, relative, or external) and owner edge;
3. only for relative and permitted non-workspace aliases invoke TypeScript resolution;
4. classify the resolved target using the inventory/config graph.

A `compilerOptions.paths` or `baseUrl` result cannot change the identity of a raw `@loredu/*` specifier. Known package names, exact public export subpaths, `./testing`, private subpaths, unknown `@loredu/*`, and package-edge restrictions are decided from syntax first. This is an implementation ordering rule for the settled ADR 0011 law, not a new package API.

## 2. Total config graph and malformed-shape policy

### 2.1 Required controls and one classifier

The A/F inventory owns one `lstat`-first classifier with the frozen `PathKind` values: `absent`, `regular-file`, `directory`, `symlink`, `other`, and `unreadable`. `lstat` is the first operation for every policy path. A dangling symlink is `symlink`, never `absent`; no `realpath`, `readFile`, `readdir`, JSON parse, resolver, or compiler program follows a failed required classification. A changed-between-inspection/read or stat/readdir error is `unreadable`/`changed`, not absence and not a thrown process failure.

Required control files are the root `package.json`, root `tsconfig.base.json`, each known package's `package.json`, and each known package's `tsconfig.json`. Required package/source roots must be real readable directories. An optional package `testing/` root is green only when `lstat` returns true `absent`; any regular file, directory with an invalid shape, ordinary/dangling symlink, special file, or unreadable state is red. Expected export targets must be regular readable non-symlink files in their expected package surface.

The exact diagnostic ownership is:

| Condition | Owning stage/rule |
|---|---|
| root/package/control path missing, symlink (including dangling), nonregular, unreadable, or changed | A/F `project-config`, `package-location`, `source-tree`, or `package-exports` according to position |
| malformed JSON or top-level `null`/array/wrong scalar in `package.json` | A/F `package-manifest` |
| malformed JSON or top-level `null`/array/wrong scalar in a tsconfig | A/F `project-config` |
| invalid shape in `extends`, `references`, `compilerOptions.paths`, `baseUrl`, or a recursive config target | A/F `project-config` |
| valid config reference crosses a forbidden package edge | A/F `workspace-edge` |
| effective kernel `types`/`lib` mismatch | B/C/E `kernel-tsconfig` |
| forbidden source triple-slash directive | B/C/E `kernel-reference` |
| source-module resolver target is missing/outside/ignored/test/symlinked | B/C/E `boundary-target` |

A malformed control graph is still scanned to the extent independent paths are safe, and its graph node/edge is retained with a violation. It never gets delegated to `ts.readConfigFile` or `ts.parseJsonConfigFileContent` as a permissive fallback.

### 2.2 Shape rules

Relevant object fields are validated independently before dereference; unrelated TypeScript compiler options may be passed to TypeScript after the graph shape is safe.

- `extends`, when present, is a nonempty string. `null`, arrays, objects, numbers, booleans, and empty strings are `project-config` errors.
- `references`, when present, is an array. Every element is a plain object with a nonempty string `path`; supported TypeScript boolean fields, if present, must be booleans. `null`, arrays, strings, missing/non-string paths, and unsupported shapes are `project-config` errors.
- `compilerOptions.paths`, when present, is a plain object, not `null` or an array. Each key is a string with at most one `*`; each value is a nonempty array of nonempty strings, and every substitution is a supported relative pattern. A scalar, `null`, array value, empty value, object value, non-string substitution, absolute path, URL/protocol, bare package target, or escaping `..` target is `project-config` red. `baseUrl`, when present, is a string resolving to a real readable workspace directory; the same symlink/outside rules apply.
- The relevant manifest dependency maps (`dependencies`, `optionalDependencies`, and `peerDependencies`) are plain objects with string package-version values. Their names are checked against the workspace graph before any source resolver result is trusted. `exports` is the exact plain key/value map already fixed by the package contract; arrays, conditions, wildcards, `null`, and non-string targets are malformed rather than resolver choices.

### 2.3 Recursive targets and graph scope

The graph traversal follows every `extends` and project `references` edge recursively, records each edge once, uses a visited/in-progress set, and reports a cycle as `project-config` without recursing forever. A target is checked before it is opened. Missing, unreadable, malformed, symlinked, dangling, outside-workspace, or unsupported targets are all red and never treated as a successful TypeScript fallback.

Allowed `extends` target forms are TypeScript 5.9.3's relative JSON config forms only: an exact `.json` file or a relative extensionless path resolved by the `.json` substitution. Directory/index, source-file, package-name, `node_modules`, URL, and external config substitutions are unsupported and red. A package config may extend the root `tsconfig.base.json` or a config owned by the same package; cross-package package-config extends are forbidden. The root config may not extend outside the workspace.

Allowed project-reference target forms are a workspace-contained exact config path or a workspace-contained package directory resolved to its `tsconfig.json`, with the same regular-file/no-symlink requirement. A root solution config may reference known package projects. A package may reference its own project or a package on the existing DAG's dependency side: kernel may not reference store/CLI; store may reference kernel; CLI may reference kernel/store. Unknown package roots and reverse edges are `workspace-edge`/`project-config` violations. A base config is an `extends` ancestor, not a package project target.

`paths` patterns are configuration inputs, not permission to create a package edge. Their substitutions resolve relative to the effective `baseUrl` and must stay inside the workspace and inventoried source/control surfaces. A wildcard path need not have a file until an import uses it; when used, normal TypeScript 5.9.3 bundler resolution and target classification decide whether it is valid. A missing used expansion is `boundary-target`; a malformed or escaping declaration is `project-config`. No path mapping can launder a syntactic `@loredu/*` identity.

This policy is deliberately stricter than TypeScript's ability to resolve package-style `extends` or arbitrary path targets. The guard is proving the repository's control closure, not accepting every host compiler feature. That is an internal assurance restriction and does not alter package consumers' public API.

## 3. Reference/extends target scope and resolution

Workspace containment is lexical and canonical: a target must be beneath the checked-out workspace root, must not escape through `..`, and must be represented by an inventoried regular file in an allowed source/control surface. Symlinks are not followed to launder containment; a symlink at a policy target is itself a violation, including a dangling one. Targets below ignored `node_modules`, `dist`, `build`, `generated`, or hidden trees are not same-package production and are red as ignored targets. Targets in test-only surfaces are red when reached by production source.

The accepted TypeScript substitutions are precisely those used by the pinned `moduleResolution: bundler` resolver after syntax law: extensionless lookup, `.js` → `.ts`/`.tsx`/`.d.ts`, `.mjs` → `.mts`/declaration forms, `.cjs` → `.cts`/declaration forms, supported declaration/index lookup, and effective non-workspace `paths` aliases that remain within the workspace. The implementation may call `ts.resolveModuleName` to obtain the candidate, but resolver success is never sufficient: inventory ownership, regular-file status, ignored/test status, and package DAG rules are applied afterward.

For a source import:

- a known `@loredu/<package>` name must use an exact exported subpath and an allowed owner edge; unknown `@loredu/*` and private subpaths are red before resolution;
- `@loredu/kernel/testing` is always a test-only seam and is red from production, even if a path alias maps it elsewhere;
- kernel production rejects every bare external runtime package and every Node/Bun protocol or runtime builtin; this is generic, not a finite SDK list;
- adapter production may use a declared external runtime dependency and environment builtin according to ADR 0011, but may not introduce a forbidden workspace edge; a source import does not become valid merely because an undeclared external package happens to resolve;
- relative references are resolved and then owned by the target package/surface. Kernel → store/CLI, store → CLI, package-testing, ignored, outside, symlinked, and unresolved targets are red;
- a local/relative import cycle within an otherwise allowed surface is not itself a violation; config-graph cycles are always red because they compromise control closure.

`compilerOptions.paths` is valid only for non-workspace alias names under the shape/scope rules above. An alias that syntactically impersonates any `@loredu/*` name is classified by the raw package law first and cannot turn an unknown, private, testing, or forbidden workspace reference into a local import. Export target checks are exact and key-order independent; target regularity is independently owned by A/F.

## 4. G2 watchdog and CI authority

ADR 0012 already fixes the full workspace suite, explicit fail-closed selection, and `if: always()` aggregate. It does not fix a duration or process exit mapping. The following is now the internal CM-I50/G2 contract.

### 4.1 Canonical wrapper

The sole command-level watchdog is the root `run-with-watchdog` wrapper. It accepts a positive finite duration in seconds and a command. Invalid invocation exits `2` without starting a child. G2 uses these fixed budgets:

- `check:boundaries`: **60 seconds**;
- root `test` (which runs the complete Bun test command): **180 seconds**.

The wrapper starts the child without a shell, inherits standard input/output/error, observes completion, and arms the timer before waiting. At timeout it emits a stable diagnostic, terminates the child/process group using platform-supported Bun APIs, and exits **124**. Timeout is never converted to the child's exit code or success. Implementations must ensure a synchronous child hang is terminated; if a platform cannot expose a process-group operation, the direct child must still be killed and the wrapper must remain nonzero. A future process-tree strategy is an implementation detail only if these observable semantics remain.

If the child exits before timeout with status `0`, the wrapper exits `0`. If it exits before timeout with a normal nonzero status, the wrapper preserves that status. If the host reports only a signal/no numeric status, the wrapper exits a deterministic nonzero status (`1`); it never maps a terminated child to `0`. These mappings are platform-neutral; the timeout code `124` is the only wrapper-owned timeout result. The wrapper must not use shell-specific `timeout`, POSIX-only signals, or platform-specific success conventions.

### 4.2 CI ceiling and authority precedence

The GitHub Actions `workspace-suite` job has an explicit `timeout-minutes: 10`. This is a defense-in-depth hard ceiling, not a replacement for the command watchdog and not evidence that a command completed. It is longer than the 60-second boundary and 180-second test budgets plus install/lint/typecheck/build overhead. If the GitHub ceiling cancels or times out the job, the job result is not `success`; the `if: always()` aggregate must therefore fail closed. A platform default is never accepted as the timeout authority.

The single root `check:boundaries` command is the only production invocation of the scanner and is run explicitly in the selected full workspace suite. The full test command is invoked through the root watchdog exactly once; no stale direct `bun test` step may run beside it. G2 searches the workflow and package scripts for duplicate scanner/test authority and tests the wrapper's normal-success, normal-failure, and synchronous-hang outcomes. CI timeout cancellation, a killed child, a missing selected suite, or an aggregate dependency result other than the expected success is failure, never green evidence.

The command watchdog is the semantic authority for terminating a hung command and preserving its result; GitHub `timeout-minutes` is the outer job authority for bounding CI resource use. Neither authority can weaken the other. Changing either duration, wrapper exit mapping, workflow timeout, or invocation count is a CM-I50 assurance decision and requires a new recorded review.

## 5. Effects on A0 and later slices

### A0

A0 may land these decisions as references in its internal contract/case schema, without implementing a scanner or root command:

- include `boundary-ast-uncertain` as the canonical uncertainty outcome in case expectations;
- identify loader aliases and JSDoc forms as B/C/E cases, not as a new public syntax API;
- identify `project-config` as the A/F owner for malformed graph/control closure and `workspace-edge` for valid-but-forbidden config edges;
- identify 60s/180s/10-minute watchdog authority as G2 metadata only;
- retain the eight frozen production check IDs and five G1/G2 IDs exactly.

A0 must not add a package export, root scanner invocation, CI step, or product contract. It does not claim any rule is implemented merely because this artifact classifies it.

### A/F

A/F implements the one lstat-first inventory and recursive config graph. Its tests must include every malformed category named above: `null`, array, wrong scalar, non-string, missing, unreadable, malformed JSON, symlink/dangling symlink, cycle, outside target, unsupported substitution, malformed `paths`, and valid optional-testing absence. Its violations must be independently authored and must not be inferred from TypeScript's parser/resolver diagnostics.

### B/C/E

B/C/E owns syntax-first raw identity, the pinned AST/preprocessor reconciliation, loader aliases/chains, `ImportTypeNode`, JSDoc, triple-slash references, resolver substitutions, and compiler isolation. It may consume A/F outputs but cannot invoke resolution before raw package-law classification. It must use the exact uncertainty rule and keep TypeScript upgrade mismatch red.

### D

D owns the already-settled ambient capability semantics and may choose private CFG/fixpoint representations. It must retain the frozen ten-fact vocabulary, symbol/scope/flow joins, unknown-derived fail-closed behavior, and explicit green controls. It must not reinterpret loader or config decisions.

### G1/G2

G1 carries each rule as a fixture-grounded exact case with matrix row, layer, provenance, paired green control, and literal expected diagnostics. G2 mutates real stage execution before the stage runs, not output arrays, and reports every frozen check ID plus watchdog/authority controls. A case cannot be justified by an unrelated violation.

### I

I composes exactly one authoritative `scanWorkspace`, one root boundary command, and one explicit workflow invocation. It verifies the final P0/master base and reruns the complete local and exact-head CI protocol. Historical green CI on `a945521` remains failure evidence only.

## Durable review / issue route

This is an internal assurance decision, not a docs/domain contract change. It is recorded here as the task's durable decision artifact and has been posted to labeled GitHub issue #18 (the existing `spike` issue for the boundary-checker decision), with the exact classifications, pinned versions, loader/config/scope/watchdog rules, and A0/later-slice effects. No repository file, scanner, test, package, workflow, PR #32, or PR #35 was mutated in making this decision.

Acceptance of this decision does not accept attempt 5 and does not unlock implementation by itself; it removes the four Contract Matrix ambiguity gates so the planned A0 implementation can begin. The historical false greens remain mandatory red cases in G1/G2.

# Addendum: R2 matrix audit closure

Consumed after the initial decision: `/Users/tiny/.rozoro/tasks/loredu-g0-replan2-matrix-review--01M1157FK6MQNHGHJQ3YQ8P9MX/g0-replan-2-matrix-audit.md`, including every finding R2-MR-01 through R2-MR-07. The audit's `NEEDS_REPLAN` disposition is closed as to Contract Steward authority by this addendum. It remains a Planner work item where the replan text must be amended to carry these frozen contracts; no implementation is authorized by prose alone.

## R2-MR-01 — composable stage and source contracts

**Classification:** Steward decision: `INTERNAL_ASSURANCE_DECISION`, no public semantic. Planner amendment: update the replan's frozen-interface block and each slice's handoff section with these types and dependencies.

The scanner pipeline uses one immutable source snapshot and typed stage results. The following are the normative shapes; private fields may be added only without changing these discriminants or ownership:

```ts
type StageName = "inventory" | "config-graph" | "syntax" | "references" |
  "compiler" | "manifest-exports" | "capability-flow";

type ReadOutcome =
  | { readonly kind: "read"; readonly snapshot: SourceSnapshot }
  | { readonly kind: "failed"; readonly violation: Violation };

interface SourceSnapshot {
  readonly path: string;              // root-relative, portable separators
  readonly text: string;              // bytes decoded once, preserved exactly
  readonly byteLength: number;
  readonly contentDigest: string;    // implementation may choose the hash algorithm,
                                      // but it is stable within one scan
}

interface SourceInput {
  readonly snapshot: SourceSnapshot;
  readonly sourceFile: ts.SourceFile; // pinned public TypeScript type; never re-read
}

type StageResult<T> =
  | { readonly stage: StageName; readonly status: "ok"; readonly value: T; readonly violations: readonly [] }
  | { readonly stage: StageName; readonly status: "blocked"; readonly value: undefined; readonly violations: readonly Violation[] }
  | { readonly stage: StageName; readonly status: "partial"; readonly value: T; readonly violations: readonly Violation[] };

type BoundaryCheckId =
  | "G0-A-INVENTORY" | "G0-B-SYNTAX" | "G0-C-REFERENCES"
  | "G0-C-SOURCE-PARSE" | "G0-D-CAPABILITY-FLOW" | "G0-E-COMPILER"
  | "G0-E-CONFIG-GRAPH" | "G0-F-MANIFEST-EXPORTS";

type ScanMutation = {
  readonly kind: "disable-stage";
  readonly checkId: BoundaryCheckId;
};

type InventoryStage = (root: string) => StageResult<WorkspaceInventory>;
type ConfigGraphStage = (inventory: WorkspaceInventory) => StageResult<ConfigGraph>;
type SourceParseStage = (inventory: WorkspaceInventory) => StageResult<readonly SourceInput[]>;
type ReferenceStage = (input: SourceInput, graph: ConfigGraph) => StageResult<readonly ModuleReference[]>;
type CompilerStage = (inventory: WorkspaceInventory, graph: ConfigGraph) => StageResult<CompilerEvidence>;
type CapabilityStage = (input: SourceInput) => StageResult<CapabilityFacts>;
```

`ts.SourceFile` and `CompilerEvidence` are internal implementation types in this pseudocode: the repository uses the pinned public TypeScript declarations, and neither crosses a Loredu package export. A `SourceSnapshot` is produced once by A/F's inventory/read stage. Source parsing is then performed once by B/C/E and its parsed `SourceInput` is passed to both reference analysis and D. No later stage opens, stats, decodes, reparses, or independently inventories the same path. If a read fails, the result is `blocked`/`ReadOutcome.failed` with the A/F-owned diagnostic; B/C/E and D receive no source input for that path and emit no substitute. Independent paths continue. If one file parses with a diagnostic, `G0-C-SOURCE-PARSE` owns that diagnostic and the file is blocked from reference/capability guessing; files that parse are returned as `partial` only when their own explicit violations are retained. A stage never throws across its boundary: caught operational failures become its owned violations; an unexpected stage failure is a deterministic nonzero scan failure and cannot produce a clean result.

The stage functions are signatures, not requirements to expose these functions publicly. I calls them once in dependency order and passes their typed outputs; it never passes raw root paths to a later stage as an excuse to re-read.

The config graph types are:

```ts
type ConfigNodeKind = "root-manifest" | "root-tsconfig" | "package-manifest" |
  "package-tsconfig" | "extends-target" | "project-reference-target";
type ConfigNodeStatus = "valid" | "absent" | "malformed" | "unreadable" |
  "symlink" | "outside" | "cycle" | "unsupported";
interface ConfigNode {
  readonly id: string;                  // unique normalized root-relative path
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
  readonly to: string | undefined;      // absent when malformed/unresolved
  readonly status: "valid" | "forbidden" | "missing" | "malformed" |
    "unreadable" | "symlink" | "outside" | "cycle" | "unsupported";
}
interface ConfigGraph {
  readonly nodes: readonly ConfigNode[];
  readonly edges: readonly ConfigEdge[];
  readonly violations: readonly Violation[];
}
```

A malformed edge remains represented with `to: undefined` and its A/F violation; it is not dropped. `ScanMutation` is constructed only by test support, is accepted only at the pre-execution stage branch, and is not importable/reachable from the normal CLI/root command. The source-level whole-orchestrator/trivial-return mutant is a separate G2 mutation and is not represented as a production `BoundaryCheckId`.

Stage output ownership is fixed:

```text
A/F inventory       -> WorkspaceInventory + SourceSnapshot/ReadOutcome
A/F config graph    -> ConfigGraph
A/F manifests       -> ManifestModel (including normalized export map facts)
B/C/E syntax        -> syntax classifications and source parse results
B/C/E references    -> ModuleReference[] + resolver/target violations
B/C/E compiler      -> effective compiler evidence + negative-compile result
D capability        -> CapabilityFacts per expression/sink + violations
G1/G2               -> assurance evidence only; never production policy facts
I                  -> deterministic concatenation of stage violations
```

I concatenates all stage violations and applies the single canonical sort; it does not reinterpret a stage's result or re-read source. A stage may report a fact and a violation for the same path only when its frozen rule explicitly requires both (for example, a malformed config node retained in the graph plus `project-config`).

## R2-MR-02 — one owner per fact and policy

**Classification:** Steward decision: the fact/policy split below is fixed. Planner amendment: revise slice descriptions and owned surfaces to remove overlapping authority language.

- **A/F** is the sole owner of filesystem facts, source/control/test/ignored surface membership, package manifest JSON shape, normalized export-map facts and target regularity, config nodes/edges/shape/target status, and package dependency facts. It publishes these as typed models.
- **B/C/E** is the sole owner of raw source syntax classification, module-reference extraction, resolver invocation for permitted source references, source-target policy (`boundary-target`), compiler-isolation policy (`kernel-tsconfig`), and source directive policy (`kernel-reference`). It consumes A/F models; it does not re-parse manifests or reclassify path kinds. It asks A/F's `ManifestModel` whether a public export/subpath is allowed; it does not own export-map facts.
- **D** is the sole owner of capability meanings, symbol/scope/flow facts, and capability violations. It consumes B/C/E's parsed `SourceInput`/checker context and never extracts module references or reads files.
- **G1** owns case metadata, literal expectations, provenance, pair validation, and execution of cases against the already-composed production scanner. **G2** owns mutation/authority evidence and watchdog evidence. Neither is a second production scanner.
- **I** is the sole owner of production orchestration and aggregation. It invokes each stage once in dependency order and exposes the only normal `scanWorkspace` authority.

A0's `fixture-operations.ts` is the sole low-level fixture mutation vocabulary. A/F's filesystem fixture helpers may compose those operations but may not write files through a second ad hoc operation type. G1/G2 tests may execute a fixture operation through the support harness; they may not manufacture expected violations by calling the scanner.

## R2-MR-03 — dependency and merge correction

**Classification:** Planner decomposition amendment, not a new policy choice. A/F is a hard dependency of B/C/E and D because it supplies the source snapshot, source ownership, manifest model, and config graph. B/C/E is a hard dependency of D because D consumes the parsed source/checker input. G1 schema-only scaffolding may proceed after A0, but executable G1 depends on completed A/F, B/C/E, and D contracts. G2 depends on executable G1 and all production stages. I depends on all of them and on the accepted P0/master base.

Required dependency order is therefore:

```text
A0 -> A/F -> B/C/E -> D -> G1 -> G2 -> I
          \-> (A/F facts are consumed by D through the B/C/E source input seam)
A0 -> G1-schema-only (parallel only; not executable policy evidence)
```

Every child slice must record parent contract version/hash and exact base/head/tree/merge-base. A schema-only slice is not allowed to claim a stage result or G0 invariant. This corrects the replan's contradictory statement that D can be independently implemented after A0 while listing A/F as an input.

## R2-MR-04 — closed one-to-one check ratchet

**Classification:** Steward decision: the ownership map and independent mutation meaning are fixed. Planner amendment: add this table to A0/G2 and require one canonical case/pair/mutant per row.

Every production `BoundaryCheckId` has exactly one owner stage, one pre-execution injection branch, one canonical red case, one paired green case, and one mutation record. Additional regression cases may map to a row but cannot replace its canonical evidence:

| Check ID | Sole stage owner | Canonical red case | Paired green control | Mutation |
|---|---|---|---|---|
| `G0-A-INVENTORY` | A/F inventory | required-root-read-failure | regular complete workspace | disable inventory before traversal |
| `G0-B-SYNTAX` | B/C/E syntax | unknown/forbidden raw `@loredu/*` identity | allowed raw workspace edge | disable syntax before identity classification |
| `G0-C-REFERENCES` | B/C/E references | ambient aliased loader/static-reference extraction | local bound loader/no module claim | disable references before extraction/resolution |
| `G0-C-SOURCE-PARSE` | B/C/E source parse | malformed source file | valid source file | disable parse diagnostics before parse result |
| `G0-D-CAPABILITY-FLOW` | D capability flow | globalThis alias or ambient escape | local parameter/definitely-clean reassignment | disable flow before analysis |
| `G0-E-COMPILER` | B/C/E compiler isolation | effective kernel `types`/`lib` widening | exact inherited kernel config | disable compiler check before effective proof |
| `G0-E-CONFIG-GRAPH` | A/F config graph | `extends: null` or missing recursive target | valid recursive config graph | disable config graph before traversal |
| `G0-F-MANIFEST-EXPORTS` | A/F manifest/exports | swapped/missing export target or forbidden manifest edge | exact normalized manifests | disable manifest/export policy before validation |

The canonical red fixture is isolated: from a valid clean seed it produces the listed exact violation delta and no unrelated violation. The paired green fixture is also isolated and must compare equal to the exact expected empty array (or its separately literal expected array); absence of the intended string is not enough. A disabled stage must remove or change its own diagnostic while retaining unrelated stage diagnostics, and the test must assert both the exact baseline and mutant arrays. A shared lower-level helper may be called by two stages only when each check's branch and mutation evidence remains independently observable; disabling one ID may not disable another ID implicitly.

The trivial `[]` scanner mutant is a separate whole-orchestrator G2 mutation, not a ninth production check ID. Whole-layer omission mutants for inventory, syntax, references, capability, compiler, config, and manifest/exports are likewise separate assurance IDs and cannot be counted as killing any production check twice. `ScanMutation` is unreachable from normal CLI/root invocation.

## R2-MR-05 — ledger, provenance, pair, and isolation semantics

**Classification:** Steward decision: exact accounting rules are fixed. Planner amendment: add the types and meta-mutant obligations to G1/G2 and the committed case-manifest surface.

The frozen internal case types are:

```ts
type FixtureOperation =
  | { readonly kind: "mkdir" | "remove" | "symlink"; readonly path: string; readonly target?: string }
  | { readonly kind: "write"; readonly path: string; readonly contents: string }
  | { readonly kind: "chmod"; readonly path: string; readonly mode: number };

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
type CaseGroup = "filesystem-discovery" | "manifest-exports-config" |
  "module-syntax-workspace-law" | "typescript-resolution" |
  "ast-reference-inventory" | "ambient-symbol-flow" |
  "compiler-isolation" | "ci-authority";
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

`CaseSpec` is completed as follows: `fixtureMutation` is a nonempty readonly `FixtureOperation[]`; `pairedGreenControl` names exactly one other case; the pair is bijective and reciprocal, with neither side self-paired; `provenance` is a nonempty readonly `CaseProvenance[]`; `expected` is a literal readonly `Violation[]` in canonical order; and `killsCheckIds` is nonempty and contains only frozen IDs. Every case has exactly one group/layer and at least one matrix row. Fixture operations are data, not callbacks, imports, scanner calls, or output transforms.

The committed provenance manifest's IDs resolve to immutable commit/tree/merge-base and, where supplied, CI/artifact identities. Unknown IDs, missing required identity fields, mismatched tree/commit, changed bundle checksum, missing artifact, or a provenance reference whose source report cannot be identified are **stale** and fail the ledger meta-test. Provenance is historical evidence, not a runtime oracle; no case expected array may be generated from it or from scanner output. A future change to a referenced evidence identity requires a new case/provenance record, never silent mutation.

A red case starts from a clean fixture seed and is executed in its own temporary root. Its complete output must equal its literal `expected` array. Its paired green case runs in a separate temporary root from the same clean seed and must equal its own literal expected array (normally `[]`). A red case failing because an unrelated violation remains is a ledger failure. The ledger runner must assert no extra/missing diagnostics, not merely that the canonical diagnostic appears. It must not reuse mutable fixture roots between pairs.

The meta-suite must fail independently for: deleted case; duplicate case ID; unknown/stale provenance; missing or nonreciprocal pair; self-pair; unknown group/layer/matrix/check ID; missing/changed expected array; callback/non-fixture mutation; expected output derived from the scanner; red/green fixture contamination; and canonical-order violation. This closes the attempt-5 missing/stale-ledger false greens.

Canonical violation order is a stable lexicographic comparison of root-relative portable `path`, then `rule`, then `detail`, comparing Unicode scalar values and never host locale or filesystem enumeration order. The list is stable-sorted and is not filtered or deduplicated by the ledger.

## R2-MR-06 — grammar/config table closure

**Classification:** Steward decision, already recorded in sections 1–3 above; Planner amendment: copy the table references and ownership map into the A0/B/C/E/A/F acceptance text. No new public semantic is introduced.

The complete grammar table is the table in §1.2, with the pinned AST/preprocessor reconciliation in §1.4, the loader alias rule in §1.2, JSDoc rule in §1.3, and `boundary-ast-uncertain` as the only uncertainty outcome in §1.4. The complete config table is §2.1–§2.3: required regular non-symlink controls; explicit `null`/array/scalar/non-string/missing/malformed/unreadable/cycle/dangling/outside/unsupported handling; recursive `extends`/`references`; shape-checked `paths`; and workspace/package-edge ownership. These tables are closed internal policy. B/C/E and A/F may not add a local exception because TypeScript happens to resolve it.

## R2-MR-07 — watchdog/process boundary/CI authority closure

**Classification:** Steward decision: the observable timeout and CI semantics are fixed in §4; Planner amendment: add process-boundary evidence and single-invocation mutants to G2 and the workflow acceptance table.

The watchdog owns one directly spawned command, with no shell interpolation. The command is placed in an owned process boundary: on POSIX the implementation must terminate the complete process group it created; on Windows it must use the platform's equivalent owned process-tree/job termination available through the pinned Bun/runtime APIs. If the pinned runtime cannot provide that process-group behavior, G2 is blocked and must escalate a tool decision rather than claim a direct-child-only watchdog as complete. The synchronous hang fixture must therefore include a descendant probe in addition to a direct infinite loop, and evidence must show no owned descendant remains after timeout. The wrapper's observable mapping remains platform-neutral: invalid invocation `2`, timeout `124`, ordinary `0` preserved, ordinary nonzero preserved, signal-only termination `1`.

The command watchdog is the first hard authority for command execution. GitHub Actions `workspace-suite.timeout-minutes: 10` is the second, outer hard authority. A GitHub timeout/cancel is never translated to success; the `if: always()` aggregate sees a non-success workspace result and fails. The root `check:boundaries` script contains the sole scanner invocation, and the workflow has exactly one boundary step that invokes that root script; those are one execution, not two. There must be no second scanner command anywhere in scripts, tests, or workflow. The root test command is invoked exactly once through its 180-second watchdog, with no adjacent raw `bun test` step. G2 must kill a deleted-explicit-step mutant, a duplicate-invocation mutant, a missing-aggregate-failure mutant, and the trivial scanner mutant. Static checks verify the command strings; executable tests verify the wrapper behavior. This is not proof that a stale historical CI run accepted the guard.

## Steward decisions versus Planner amendments

| Audit finding | Steward decision now closed | Required Planner/decomposition amendment before A0 dispatch |
|---|---|---|
| R2-MR-01 | SourceSnapshot, ReadOutcome, StageResult, no-throw/upstream-failure propagation | Replace incomplete frozen interfaces and state exact stage function inputs/outputs and source handoff |
| R2-MR-02 | One owner per fact/policy and one production orchestrator | Remove overlapping A/F/B/C/E export/target/fixture authority and distinguish G1/G2 assurance tests from scanner authority |
| R2-MR-03 | A/F → B/C/E → D dependency is fixed | Correct D parallelism/dependency and mark G1 schema-only parallelism explicitly |
| R2-MR-04 | Closed ID-to-owner/case/pair/mutant map | Add the table and independent pre-execution mutation branches to A0/G2 acceptance |
| R2-MR-05 | Typed fixture/pair/provenance/ledger/isolation/order rules | Add committed manifest/meta-mutant and exact isolated execution requirements |
| R2-MR-06 | Grammar and config policies are fully closed above | Reference this artifact and prohibit local resolver/compiler exceptions |
| R2-MR-07 | Watchdog budgets, process boundary, exit mapping, CI ceiling and authority precedence | Add descendant cleanup and invocation/aggregate mutants plus exact workflow ownership |

The Planner amendments are decomposition/document corrections, not new contract gates. Until the planner records them in the complete replan (or an implementation handoff explicitly binds this addendum as its frozen contract), Watchtower must not dispatch A0. Once that amendment is recorded and identity-bound, A0 may be dispatched with no scanner implementation, root wiring, package change, or G0 acceptance claim.
