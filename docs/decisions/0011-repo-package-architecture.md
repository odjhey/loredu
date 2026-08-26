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

`store-plainfile` depends on `kernel`; `cli` depends on both the application API and the concrete plain-file adapter. `kernel` depends on neither adapter. Workspace/package dependencies make cross-package direction explicit, but they cannot by themselves forbid runtime-specific built-ins such as `node:fs` or Bun globals. CI therefore includes a small architecture-boundary check that rejects Bun/Node filesystem/runtime imports from `kernel` and rejects kernel dependencies on adapter packages. `@loredu/kernel` has zero runtime dependencies.

**Test support is not product surface.** The store contract's guarantees (append-is-commit, monotonic positions, torn-read safety) become an exported conformance suite under an explicit test-only subpath, `@loredu/kernel/testing`. The same subpath provides an `InMemoryStore` reference adapter for application/kernel tests. Neither belongs to the default `@loredu/kernel` runtime export. `store-plainfile` — and any future SQLite/Postgres store — runs the same conformance suite. This makes "the port owns the guarantees" executable without making a concrete store part of the kernel's normal API.

**The cli package is the rendering adapter.** Kernel/application emit affordances (`{rel, action, params}`); cli's whole identity is argv in, rendered commands out, skill embedded. A future HTTP surface is a sibling adapter consuming the same application API. Embedded TypeScript consumers use `@loredu/kernel` directly rather than a separate "library adapter" package.

**Central catalog-shaped test tree.** `tests/` mirrors the [behavioral test catalog](../v0.x/execution/first-user-journey.md), not the code layout — the catalog is the contract, so the tree is organized by its groups (records, store, reconciliation, working lore, CLI conformance, acceptance scenarios). Drift mitigations: every test file names the T-numbers it covers, and the whole tree typechecks against the packages. Behavioral/application tests exercise public package exports; CLI conformance and acceptance scenarios drive the compiled binary. Low-level package-local tests may still be colocated when they test implementation details rather than published behavior.

**Skill text: docs are the source.** The cli build embeds `docs/v0.x/execution/agent-skill.md` at compile time; `lor skill` prints it. One source of truth, at the cost of a build-time coupling to the docs tree — accepted deliberately.

**Deferred by rule-of-two.** No `contracts` package until a second in-repo consumer of the types alone exists. Lockstep versions across packages are also deferred; independent package semver is ceremony an internal kernel does not yet need. Publishing to a registry remains a later, separate decision ([0007](./0007-typescript-bun.md)).

## Consequences

- cross-package hexagonal direction is a workspace dependency fact, while runtime-specific import bans are enforced by an explicit architecture check;
- `@loredu/kernel` is the embedding surface from day one without exposing concrete stores in its normal runtime API;
- reusable store conformance and the in-memory reference adapter remain available through a clearly test-only subpath;
- new store adapters start from a ready conformance suite instead of re-deriving the guarantees;
- the test tree reads like the catalog, so coverage gaps are visible by comparing directories to tables;
- the docs→binary skill coupling means editing the skill doc changes the next build's `lor skill` output — intended.

## Rule or follow-up

CI runs, per commit: typecheck across the workspace, the full behavioral test tree, the kernel boundary check, and a compile smoke of the `lor` binary. A package may be added only when a decision record names the boundary it enforces or the second consumer that forces it.
