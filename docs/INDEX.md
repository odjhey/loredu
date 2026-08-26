---
name: docs_index
description: "Flat index of the initial Loredu design and v0.x documents."
type: index
tags: [docs, meta]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T12:10:00+08:00
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
| [Projection contract](./architecture/contracts/projection.md) | Current and historical temporal views |
| [Working Lore contract](./architecture/contracts/working-lore.md) | Bounded progressive-disclosure context for an activity |

## Decisions

| Document | Purpose |
|---|---|
| [Decision records](./decisions/README.md) | ADR-lite format and index |
| [0001: Application core first](./decisions/0001-application-core-first.md) | Keep CLI, models, crawlers, and providers outside the core |
| [0002: Append-only record model](./decisions/0002-append-only-record-model.md) | Preserve history and rebuild projections from immutable records |
| [0003: Plain files first](./decisions/0003-plain-files-first.md) | Markdown/frontmatter adapter for alpha; indexes remain replaceable |

## Reports

| Document | Purpose |
|---|---|
| [Reports](./reports/README.md) | Assessment index |
| [Borrowed design patterns](./reports/borrowed-design-patterns.md) | Prior-art ideas Loredu adopts without importing the surrounding platforms |

## v0.x

| Document | Purpose |
|---|---|
| [v0.x](./v0.x/README.md) | Initial delivery index |
| [Representative activities](./v0.x/use-cases.md) | Technical, project/process, and policy/legal scenarios |
| [Scope](./v0.x/scope/README.md) | v0.x scope index |
| [Goal and scope](./v0.x/scope/goal-and-scope.md) | What v0.x proves and explicitly does not build |
| [Execution](./v0.x/execution/README.md) | v0.x execution index |
| [Implementation plan](./v0.x/execution/implementation-plan.md) | M0–M3 delivery sequence and acceptance scenarios |
