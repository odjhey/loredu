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
│   │   └── src/
│   │       ├── domain/            records, ids, claim keys, validation
│   │       ├── application/       append path (recorded_at stamping), health,
│   │       │                      envelope + affordances, basis, default ClaimPolicy
│   │       └── ports/             RecordStore, ClaimPolicy, Extractor, Resolver, Ranker
│   │                              + InMemoryStore reference adapter + port conformance kit
│   ├── store-plainfile/           @loredu/store-plainfile
│   └── cli/                       lor — argv parsing, affordance→command rendering,
│                                  embedded skill, bun build --compile
├── tests/                         central, catalog-shaped behavioral suite
└── package.json                   workspace root: test / typecheck / build
```

**Dependency law.** Arrows point one way: `cli → store-plainfile → kernel`. Enforced by `package.json` dependencies, so a violation (a Bun or fs import in kernel, a kernel import of an adapter) fails structurally rather than in review. `@loredu/kernel` has zero runtime dependencies.

**Port conformance kit lives in kernel.** The store contract's guarantees (append-is-commit, monotonic positions, torn-read safety) are an exported test suite; `store-plainfile` — and any future SQLite/Postgres store — runs the same suite. The `InMemoryStore` reference adapter also ships in kernel, making "kernel tests with no filesystem" (T15) natural rather than mocked. This is how "the port owns the guarantees" becomes executable.

**The cli package is the rendering adapter.** Kernel/application emit affordances (`{rel, action, params}`); cli's whole identity is argv in, rendered commands out, skill embedded. A future HTTP or library surface is a sibling package consuming the same application API, with no kernel change.

**Central catalog-shaped test tree.** `tests/` mirrors the [behavioral test catalog](../v0.x/execution/first-user-journey.md), not the code layout — the catalog is the contract, so the tree is organized by its groups (records, store, reconciliation, working lore, CLI conformance, acceptance scenarios). Drift mitigations: every test file names the T-numbers it covers, and the whole tree typechecks against the packages. The application suite drives package APIs; the CLI conformance suite and acceptance scenarios drive the compiled binary.

**Skill text: docs are the source.** The cli build embeds `docs/v0.x/execution/agent-skill.md` at compile time; `lor skill` prints it. One source of truth, at the cost of a build-time coupling to the docs tree — accepted deliberately.

**Deferred by rule-of-two.** No `contracts` package until a second in-repo consumer of the types alone exists. Lockstep versions across packages (independent semver is ceremony an internal kernel does not need). Publishing to a registry remains a later, separate decision ([0007](./0007-typescript-bun.md)).

## Consequences

- hexagonal boundaries are compile-time facts: the kernel cannot acquire an adapter dependency silently;
- `@loredu/kernel` is the embedding surface from day one — the M4 consumer imports it, and publishing becomes a flag flip, not a refactor;
- new store adapters start from a ready conformance suite instead of re-deriving the guarantees;
- the test tree reads like the catalog, so coverage gaps are visible by comparing directories to tables;
- the docs→binary skill coupling means editing the skill doc changes the next build's `lor skill` output — intended.

## Rule or follow-up

CI runs, per commit: typecheck across the workspace, the full `tests/` tree, and a compile smoke of the `lor` binary. A package may be added only when a decision record names the boundary it enforces or the second consumer that forces it.
