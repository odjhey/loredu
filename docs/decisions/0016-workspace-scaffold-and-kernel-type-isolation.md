---
name: decision_workspace_scaffold_type_isolation
description: "How the Bun workspace is wired: TypeScript sources as package exports, per-project typecheck with a default-deny type environment that makes kernel purity a compiler error, and Biome scoped to code."
type: decision
tags: [decisions, repo, toolchain, typescript, testing]
generated: "Claude Opus 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T21:00:00+08:00
---

# 0016: Workspace scaffold — TS sources as exports, and kernel purity as a compiler error

## Context

[ADR 0011](./0011-repo-package-architecture.md) settled *what* the packages are and *what*
must be true of them: three packages in a one-way DAG, a kernel with zero runtime
dependencies and no environment-specific APIs, a test-only `@loredu/kernel/testing`
subpath, and a central catalog-shaped `tests/` tree. [ADR 0012](./0012-dx-and-ci-gating.md)
settled the tooling posture: Biome for lint and format on code only, Bun's test runner,
CI as the supervisor. Neither says how the workspace is actually wired, and one of the
requirements — "the kernel tsconfig intentionally exposes no Bun or Node ambient
globals" — is a claim about a compiler configuration that either holds or does not.

Building the scaffold (issue #9 Phase A) forced the mechanics.

## Options considered

**Making kernel purity fail typecheck.** A lint rule banning `process`/`Bun` identifiers;
a per-package `tsconfig` that omits the type packages; a global type-shadowing trick that
declares `process` as `never`.

**Cross-package resolution.** Build each package to `dist/` and point `exports` at the
output (declaration files, project references, a build step before typecheck); or point
`exports` at the TypeScript sources and let Bun run them directly.

**Typecheck invocation.** One workspace-wide `tsc` pass; `tsc -b` with composite project
references; or one `tsc -p` per project, sequentially.

## Choice

**Type isolation is default-deny, and the kernel simply never opts in.**
`tsconfig.base.json` sets `"types": []` and `"lib": ["ES2023"]`. Nothing inherits ambient
globals by accident: a package that wants them writes `"types": ["bun"]` in its own
tsconfig, which `store-plainfile`, `cli`, and `tests` do and `packages/kernel` does not.
In the kernel, `process`, `Buffer`, `__dirname`, and `Bun` are undeclared identifiers and
`node:fs` is an unresolvable module — `bun run typecheck` fails with `TS2591`, `TS2868`,
`TS2304`, `TS2307`. This is preferred to a lint rule because it needs no rule list to stay
current: any environment API the kernel reaches for, present or future, is absent by
construction rather than absent from a blocklist. It is also the layer an import-graph
checker structurally cannot cover, which is why ADR 0011 asks for both.

**Package `exports` point at TypeScript sources; there is no inter-package build step.**
`@loredu/kernel` resolves to `./src/index.ts`. Bun runs and bundles TypeScript directly,
so a `dist/` between packages would buy nothing and cost a build ordering constraint on
every test run. The only build in the repo is the one that produces an artifact that must
exist — `bun build --compile` for the `lor` binary. If Loredu is ever published to a
registry (deferred in [ADR 0007](./0007-typescript-bun.md)), that decision brings its own
build outputs; nothing here needs to anticipate them.

**Typecheck is one `tsc -p` per project, run in sequence** — kernel, store-plainfile, cli,
tests — not one workspace-wide pass. A single pass would have one type environment, which
is exactly the thing that must differ between the kernel and its adapters: the kernel's
purity is a property of *its own project*, and it only means something if that project is
checked on its own terms. Project references were rejected as ceremony: they exist to
share build outputs, and there are no build outputs.

**Strictness beyond the three flags issue #9 named.** With `strict`,
`noUncheckedIndexedAccess`, and `verbatimModuleSyntax` come `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`, `isolatedModules`, and
`"moduleDetection": "force"`. The records contract is built on immutable envelopes with
optional fields, where "absent" and "present but undefined" are different facts; a config
that conflates them would let that distinction rot before the first record exists.
Cheapest at scaffold time, most expensive later.

**Biome covers code and excludes `docs/**` entirely.** ADR 0012 excludes markdown; this
extends the exclusion to the zero-dependency Node scripts under `docs/scripts/`, which are
the docs gate's own tooling, carry their own style, and must keep running under bare `node`
before this workspace exists. Bringing them under Biome is a follow-up with its own diff,
not a side effect of scaffolding.

**Bun's pin is consumed, not re-declared.** The root manifest states
`"engines": { "bun": ">=1.4.0" }`; the exact pin CI installs stays in the `.bun-version`
file, one fact in one place.

**The scaffold ships no catalog tests, and says so.** Every T-number in the
[behavioral catalog](../v0.x/execution/first-user-journey.md) is deferred per
[ADR 0015](./0015-catalog-accounting-and-docs-gate.md); `tests/` therefore holds six group
directories, each with a README naming the rows that belong to it and the contract they
answer to, and no `describe()`, `test.todo`, or `.skip` anywhere. A directory that
documents what is missing is honest; an empty test that runs green is not.

One thing does live in `tests/` today: the structural guardrails at the tree root
(`tests/workspace-structure.test.ts` — manifest DAG edges, kernel zero-dependency,
`/testing` published separately, no environment import in kernel production code, no
production import of `/testing`). They claim no T-number because they test the repository
rather than the product, and they overlap deliberately with the Phase C boundary-checker
spike — they are meant to be superseded by it, not to pre-empt its choice.

**`@loredu/kernel/testing` is a declared seam with no test doubles in it.** The subpath
exists and is typechecked, exporting only the `StoreUnderTest` shape a conformance suite
consumes. An `InMemoryStore` that did not honour append-is-commit, or a conformance suite
asserting guarantees no store implements, would be the placeholder coverage ADR 0012
forbids — in the one place it would be least visible.

## Consequences

- Kernel purity is enforced by the compiler on every `bun run typecheck`, locally and in
  CI, with no rule list to maintain and no way to satisfy it by silencing a lint.
- Adding a package means adding a `tsc -p` to the root `typecheck` script — deliberately
  manual, since each new project must state its own type environment anyway.
- Editing a kernel source file re-typechecks it under the adapters' projects too (they
  import its sources), so an adapter can never consume a kernel that does not compile.
- `bun test` currently runs exactly one file, the structural guardrails. That number is
  the honest count of executable coverage in this repo and should rise with M0.
- Scripts under `docs/scripts/` remain unlinted until a follow-up brings them in.

## Rule or follow-up

- The kernel's tsconfig may not gain a `types` entry, a wider `lib`, or a `node`/`bun`
  ambient reference without a decision record superseding this one. "The kernel needs a
  clock/random/filesystem" is answered by a port, not by a type package.
- Both guardrails must stay demonstrably red: a deliberate `process.env` or `node:fs` in
  kernel production code fails typecheck, and the same import fails
  `tests/workspace-structure.test.ts`. Both were demonstrated on the scaffold PR; issue #9
  Phase C owns making that a repeatable check rather than a one-off paste.
- When the Phase C checker lands, fold the scanning assertions of
  `tests/workspace-structure.test.ts` into it and keep the manifest-DAG assertions or move
  them, but do not leave both claiming to be the guardrail.
