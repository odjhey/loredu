---
name: docs_index
description: "Flat index of the initial Loredu design and v0.x documents."
type: index
tags: [docs, meta]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
---

# Loredu docs index

## Architecture

| Document | Purpose |
|---|---|
| [Architecture](./architecture/README.md) | Architecture reading path |
| [Product architecture](./architecture/product-architecture.md) | Product thesis, boundaries, ports, flows, and non-goals |
| [Ubiquitous language](./architecture/ubiquitous-language.md) | Canonical domain terms |
| [Contracts](./architecture/contracts/README.md) | Published core contract index |
| [Record contract](./architecture/contracts/records.md) | Immutable Entry, Claim, Relation, Resolution, and Verification records |
| [Store port](./architecture/contracts/store.md) | Provider-neutral append/read/scan persistence boundary |
| [Clock and identity ports](./architecture/contracts/clock-and-identity.md) | Capability ports for `recorded_at` and record id entropy, and the single stamping point in the append path |
| [Projection contract](./architecture/contracts/projection.md) | Current and historical temporal views |
| [Working Lore contract](./architecture/contracts/working-lore.md) | Bounded progressive-disclosure context for an activity |

## Decisions

| Document | Purpose |
|---|---|
| [Decision records](./decisions/README.md) | ADR-lite format and index |
| [0001: Application core first](./decisions/0001-application-core-first.md) | Keep CLI, models, crawlers, and providers outside the core |
| [0002: Append-only record model](./decisions/0002-append-only-record-model.md) | Preserve history and rebuild projections from immutable records |
| [0003: Plain files first](./decisions/0003-plain-files-first.md) | Markdown/frontmatter adapter for alpha; indexes remain replaceable |
| [0004: Claim identity is a declared key](./decisions/0004-claim-identity-key.md) | Caller-declared claim keys scope deterministic reconciliation |
| [0005: Embedded kernel, not a standalone product](./decisions/0005-embedded-kernel-compatibility.md) | Consumer-driven stabilization and the record compatibility policy |
| [0006: Versioning is explicit at every layer](./decisions/0006-explicit-version-basis.md) | Stream positions, ruleset versions, and basis stamps on derived views |
| [0007: TypeScript on Bun](./decisions/0007-typescript-bun.md) | Strict TypeScript core, bun:test suites, CLI compiled to a single binary |
| [0008: CLI before full reconciliation; agent-reactive responses](./decisions/0008-cli-first-agent-reactive.md) | Ship `lor` after M1 with deterministic next-step advice; agents chain until healthy |
| [0009: Hypermedia responses and basis-pinned pagination](./decisions/0009-hypermedia-pagination.md) | Responses embed runnable affordances; lists paginate by basis-pinned cursor with explicit counts |
| [0010: The ClaimPolicy extension seam](./decisions/0010-claim-policy-seam.md) | One versioned seam for consumer claim semantics; kernel invariants stay in core |
| [0011: Repository and package architecture](./decisions/0011-repo-package-architecture.md) | Bun workspaces (kernel · store-plainfile · cli), structural dependency law, catalog-shaped tests |
| [0012: Developer experience and CI gating](./decisions/0012-dx-and-ci-gating.md) | Biome + cspell, single fail-closed ci-required gate with fail-safe path selection, catalog drift check, AGENTS.md symlink convention |
| [0013: Agent decision authority](./decisions/0013-agent-decision-authority.md) | Agents decide and land without sign-off until production; the obligation is the record, not the gate |
| [0014: Minimal frontmatter](./decisions/0014-minimal-frontmatter.md) | Git owns last-changed time; `status` gets a vocabulary with real signal and no draft-by-default |
| [0015: Catalog accounting and the docs gate](./decisions/0015-catalog-accounting-and-docs-gate.md) | Every T-number implemented via `@covers` or deferred in `catalog-status.json`; structural gate over the corpus; both gates self-tested |
| [0016: Workspace scaffold and kernel type isolation](./decisions/0016-workspace-scaffold-and-kernel-type-isolation.md) | Bun workspaces with TypeScript sources as exports; kernel purity enforced as a typecheck error |
| [0019: M0 validation rules](./decisions/0019-m0-validation-rules.md) | Identifier-safe token shape, scope structure and identity, value equality, closed vs open vocabularies, metadata namespacing, schema acceptance |
| [0020: M0 test seam and round-trip evidence](./decisions/0020-m0-test-seam-and-round-trip-evidence.md) | M0 test-only in-memory seam and M1 ownership of serialize/parse evidence |
| [0018: Capability ports for time and identity](./decisions/0018-capability-ports.md) | `Clock` and `RandomSource` injected; the application stamps `id`/`recorded_at`, the store assigns only the position |
| [0017: Branch protection posture](./decisions/0017-branch-protection-posture.md) | `ci-required` the only required status, zero reviews, squash-only, no bypass actors, up-to-date-before-merge on |

## Agents and process

| Document | Purpose |
|---|---|
| [AI / agent policy](./ai/README.md) | Agent policy index |
| [Agent policy](./ai/agent-policy.md) | Discovery sequence, trust rules, human gates, worktrees, closure evidence |
| [Agent policy (YAML)](./ai/agent-policy.yaml) | Machine-readable companion to the agent policy |
| [Playbooks](./playbooks/README.md) | Repo-operational playbook index |
| [Domain doc update](./playbooks/domain-doc-update.md) | Triggers and update order when domain behavior, terms, or boundaries change |

## Reports

| Document | Purpose |
|---|---|
| [Reports](./reports/README.md) | Assessment index |
| [Borrowed design patterns](./reports/borrowed-design-patterns.md) | Prior-art ideas Loredu adopts without importing the surrounding platforms |
| [Candidate consumers](./reports/candidate-consumers.md) | Real internal tools mapped to Loredu concepts and the first-consumer choice |

## v0.x

| Document | Purpose |
|---|---|
| [v0.x](./v0.x/README.md) | Initial delivery index |
| [Representative activities](./v0.x/use-cases.md) | Technical, project/process, and policy/legal scenarios |
| [Scope](./v0.x/scope/README.md) | v0.x scope index |
| [Goal and scope](./v0.x/scope/goal-and-scope.md) | What v0.x proves and explicitly does not build |
| [Execution](./v0.x/execution/README.md) | v0.x execution index |
| [Implementation plan](./v0.x/execution/implementation-plan.md) | M0–M4 delivery sequence (including the M1.5 CLI milestone) and acceptance scenarios |
| [First user journey](./v0.x/execution/first-user-journey.md) | Expected CLI usage journeys and the automated behavioral test catalog |
| [Agent skill draft](./v0.x/execution/agent-skill.md) | The guide embedded in the binary and printed by `lor skill` |
| [Catalog status](./v0.x/execution/catalog-status.json) | Which behavioral-catalog T-numbers are deferred, and to which milestone |
