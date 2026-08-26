---
name: decision_repo_package_architecture
description: "Bun workspaces with three packages (kernel, store-plainfile, cli); structural dependency law; catalog-shaped central test tree; skill embedded from docs at build."
type: decision
tags: [decisions, repo, packages, testing, toolchain]
status: draft
generated: "Claude Fable 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T00:00:00+08:00
updated_at: 2026-08-26T00:00:00+08:00
---

# 0011: Repository and package architecture

## Context

Implementation is about to start ([0007](./0007-typescript-bun.md)). The hexagonal boundaries the contracts insist on — domain/application free of Bun and providers ([0001](./0001-application-core-first.md), [0007](./0007-typescript-bun.md)), the port/adapter line that must never blur ([0003](./0003-plain-files-first.md)), affordance rendering separated from application semantics ([0009](./0009-hypermedia-pagination.md), [0010](./0010-claim-policy-seam.md)) — can be enforced by review discipline in a flat `src/`, or structurally by package boundaries. Consumers will eventually embed "the TypeScript application API" ([0005](./0005-embedded-kernel-compatibility.md)), which needs a nameable package.

## Options considered

- flat single package with folder discipline;
- two packages (kernel with the store inside, cli);
- xatu-style finer split (contracts, domain, application, store, cli as separate packages);
- three packages: kernel, store-plainfile, cli.

## Choice

Bun workspaces, three packages, docs staying top-level as the repo's spine:

```text
loredu/
├── docs/                          contracts and decisions; code links back
├── packages/
│   ├── kernel/                    @loredu/kernel
│   │   ├── src/
│   │   │   ├── domain/            records, ids, claim keys, validation
│   │   │   ├── application/       append path (recorded_at stamping), health,
│   │   │   │                      envelope + affordances, basis, default ClaimPolicy
│   │   │   └── ports/             RecordStore, ClaimPolicy, Extractor, Resolver, Ranker
│   │   └── testing/               test-only InMemoryStore + port conformance kit
│   │                              exposed only as @loredu/kernel/testing
│   ├── store-plainfile/           @loredu/store-plainfile
│   └── cli/                       lor — argv parsing, affordance→command rendering,
│                                  embedded skill, bun build --compile
├── tests/                         central, catalog-shaped behavioral suite
└── package.json                   workspace root: test / typecheck / build
```

**Dependency law.** Runtime dependencies form a one-way DAG:

```text
cli ───────────────► kernel
 │                    ▲
 └──► store-plainfile ─┘
```

`store-plainfile` depends on `kernel`; `cli` depends on both the application API and the concrete plain-file adapter. `kernel` depends on neither adapter. Workspace/package dependencies make cross-package direction explicit, but they cannot by themselves forbid runtime-specific built-ins or globals.

**Kernel invariant:** `@loredu/kernel` has **zero external runtime dependencies** and does not depend on environment-specific APIs — runtime, filesystem, database, model, and surface dependencies belong to adapters. Importing `@loredu/kernel` must never drag a third-party runtime package or environment-specific API into a consumer.

That invariant is enforced in complementary layers:

1. **package manifests** — kernel declares no runtime dependencies and cannot declare adapter/CLI packages;
2. **kernel TypeScript environment** — the kernel tsconfig intentionally exposes no Bun or Node ambient globals/types, so direct uses such as `Bun.file(...)`, `process`, or `Buffer` fail kernel typecheck unless an explicit architecture decision changes the environment;
3. **architecture/import check** — rejects from production `packages/kernel/**` environment-specific imports (`node:*`, bare Node built-ins such as `fs`/`path`, `bun:*`), adapter/CLI dependencies, database/model SDKs, and production imports of the test-only `@loredu/kernel/testing` subpath.

The import checker and the TypeScript environment test different failure modes: an import graph tool cannot see ambient-global usage, while type isolation does not encode package-direction rules. Dev/test tooling at the workspace root may be arbitrarily rich; none of it may become a kernel runtime dependency.

**Test support is not product surface.** The store contract's guarantees (append-is-commit, monotonic positions, torn-read safety) become an exported conformance suite under an explicit test-only subpath, `@loredu/kernel/testing`. The same subpath provides an `InMemoryStore` reference adapter for application/kernel tests. Neither belongs to the default `@loredu/kernel` runtime export. `store-plainfile` — and any future SQLite/Postgres store — runs the same conformance suite. This makes "the port owns the guarantees" executable without making a concrete store part of the kernel's normal API.

**The cli package is the rendering adapter.** Kernel/application emit affordances (`{rel, action, params}`); cli's whole identity is argv in, rendered commands out, skill embedded. A future HTTP surface is a sibling adapter consuming the same application API. Embedded TypeScript consumers use `@loredu/kernel` directly rather than a separate "library adapter" package.

**Central catalog-shaped test tree.** `tests/` mirrors the [behavioral test catalog](../v0.x/execution/first-user-journey.md), not the code layout — the catalog is the contract, so the tree is organized by its groups (records, store, reconciliation, working lore, CLI conformance, acceptance scenarios). Behavioral/application tests exercise public package exports; CLI conformance and acceptance scenarios drive the compiled binary. Low-level package-local tests may still be colocated when they test implementation details rather than published behavior. Catalog accounting and deferred-test state are governed by [0012](./0012-dx-and-ci-gating.md); placeholder files do not count as implemented behavior.

**Skill text: docs are the source.** The cli build embeds `docs/v0.x/execution/agent-skill.md` at compile time; `lor skill` prints it. One source of truth, at the cost of a build-time coupling to the docs tree — accepted deliberately.

**Deferred by rule-of-two.** No `contracts` package until a second in-repo consumer of the types alone exists. Lockstep versions across packages are also deferred; independent package semver is ceremony an internal kernel does not yet need. Publishing to a registry remains a later, separate decision ([0007](./0007-typescript-bun.md)).

## Consequences

- cross-package hexagonal direction is a workspace dependency fact, while runtime-specific imports and globals are enforced by explicit architecture/type checks;
- `@loredu/kernel` is the embedding surface from day one without exposing concrete stores in its normal runtime API;
- reusable store conformance and the in-memory reference adapter remain available through a clearly test-only subpath;
- new store adapters start from a ready conformance suite instead of re-deriving the guarantees;
- the test tree reads like the behavioral catalog while explicit deferred-state accounting prevents placeholder coverage;
- the docs→binary skill coupling means editing the skill doc changes the next build's `lor skill` output — intended.

## Rule or follow-up

CI runs, per commit, according to [0012](./0012-dx-and-ci-gating.md): typecheck across the workspace, behavioral/catalog checks selected by path, the kernel boundary checks, and a compile smoke of the `lor` binary. A package may be added only when a decision record names the boundary it enforces or the second consumer that forces it.

**Boundary-checker selection is a spike, not a settled dependency.** Sequence: M0 scaffold → dependency-cruiser spike (workspace-root devDependency only; it may run under Node as a dev-only tool without making Node a Loredu runtime dependency) → prove it can express the import/dependency rules (environment-builtin bans in kernel, no kernel→adapter/CLI deps, one-way DAG, no production import of `/testing`) and run reliably in CI with Bun-workspace TypeScript resolution → separately prove the kernel tsconfig rejects Bun/Node ambient globals → only then name dependency-cruiser in CI docs. If it fights the toolchain, keep the architectural requirement and use another checker or a tiny purpose-built import scanner, itself tested against synthetic violations. A guardrail that has never failed on a deliberate violation is not considered proven.
