---
name: borrowed_design_patterns
description: "Prior-art ideas Loredu intends to reuse while deliberately avoiding unnecessary platform and scaling dependencies."
type: report
tags: [reports, prior-art, design]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
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

The concrete reference is [axi's 10 principles](https://github.com/kunchenguid/axi#the-10-principles) for agent-ergonomic tools. Loredu is inspired by them, not bound to them — the kernel's own contracts (append-only records, basis, hypermedia envelope) decide the shape. Mapping each:

| axi principle | Loredu stance |
|---|---|
| 1. Token-efficient output | Partially adopted: compact line-oriented text mode mirrors the `--json` envelope. TOON is not a core format — JSON is the machine contract, and a caller that wants TOON pipes for it (`lor claims --json \| toon`), the same composition rule as querying. |
| 2. Minimal default schemas | Adopted: default list/lore output is compact lines (key, value, handle, state) — full records only behind `show`. |
| 3. Content truncation with escape hatches | Adopted via handles instead of a `--full` flag: bounded packets state full counts and carry runnable continuation/expansion commands ([decision 0009](../decisions/0009-hypermedia-pagination.md)). |
| 4. Pre-computed aggregates | Adopted: Working Lore `orientation` counts and `lor status` totals avoid enumeration round trips. |
| 5. Definitive empty states | Adopted: an empty scope returns a definitive empty packet with a basis, exit 0 — never an error (journey 1). |
| 6. Structured errors, exit codes, idempotent mutations | Adopted for errors/exit codes (stable, distinct, actionable; no interactive prompts). Deliberate divergence on idempotent mutations: `append` is append-only by design — a retried write creates a second record, and reconciliation surfaces it as a duplicate/corroboration rather than the store deduplicating silently. |
| 7. Ambient context | Adapted, inverted order: the skill ships inside the binary (`lor skill`); session integrations are thin wrappers that defer to it ([decision 0008](../decisions/0008-cli-first-agent-reactive.md)). |
| 8. Content first | Adopted: bare `lor` prints the orientation/status view, not help text. |
| 9. Contextual disclosure | Adopted as core semantics, stricter than the source: `advice` next steps are deterministic and non-speculative, a contract rule rather than a UX nicety. |
| 10. Consistent help | Adopted: concise per-subcommand reference alongside `lor skill` for the full agent guide. |

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
