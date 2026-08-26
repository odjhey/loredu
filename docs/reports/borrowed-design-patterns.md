---
name: borrowed_design_patterns
description: "Prior-art ideas Loredu intends to reuse while deliberately avoiding unnecessary platform and scaling dependencies."
type: report
tags: [reports, prior-art, design]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T12:10:00+08:00
---

# Borrowed design patterns

Loredu is intentionally small. Existing memory/knowledge platforms solve adjacent problems at much larger scale; the useful move is to preserve proven ideas without inheriting their infrastructure by default.

## Temporal knowledge graph systems

Borrow:

- preserve the raw episode/entry separately from extracted structure;
- link every derived claim back to source evidence;
- invalidate/supersede old knowledge without destroying it;
- derive compact higher-order observations from many supporting records;
- retrieve bounded context rather than dumping history.

Do not require:

- graph databases;
- graph-scale optimization;
- hosted knowledge infrastructure;
- LLM-driven reconciliation as the only path.

## Self-improving knowledge pipelines

Borrow:

- completed activities can improve future activities;
- separate immediate knowledge accumulation from slower procedure/runbook improvement;
- retain evidence for proposed procedural changes.

Do not require a general ingestion/pipeline framework.

## Agent memory filesystems

Borrow:

- hot/current knowledge versus deep historical knowledge;
- progressively load detail only when requested;
- allow future compaction/reorganization of derived views without changing canonical history.

Do not make Loredu an agent runtime or agent-owned mutable memory filesystem.

## Memory extraction libraries

Borrow:

- extraction is independent from storage;
- extraction can happen inline or later;
- humans, agents, and deterministic software can all create structured knowledge.

Do not bind the core to an orchestration framework.

## Agent-ergonomic interface principles

Borrow:

- minimal default schemas;
- content-first orientation;
- truncation with explicit full-detail escape hatches;
- precomputed summaries that avoid unnecessary round trips;
- contextual disclosure and stable drill-down handles;
- definitive empty/attention states;
- hypermedia-style responses (REST's "hypertext as the engine of application state"): every response embeds the runnable affordances to continue, so callers navigate by link instead of memorized surface.

These apply to Loredu application views and future surfaces; a CLI is not required for the core.

## Application-first product architecture

Borrow:

- stable domain contracts before provider sophistication;
- external systems behind ports/anti-corruption layers;
- indexes/retrieval stores are projections when external sources remain authoritative;
- source identity plus locators/version information for provenance;
- progressive documentation with frontmatter, local indexes, a flat index, freshness, and supersession.

## Event sourcing and bitemporal ideas

Borrow:

- immutable event history and rebuildable projections;
- distinguish when Loredu learned something from when it was valid in the external world;
- preserve what was believed at an earlier date as well as what is now believed about that earlier date.

Do not require a specialized event store or temporal database in v0.x.

## Design rule

Prefer semantic extension points such as `RecordStore`, `Extractor`, `Resolver`, source/snapshot integration, and Working Lore ranking over technology-specific provider abstractions such as vector database, graph database, or model-vendor plugins.
