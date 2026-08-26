---
name: v0x_goal_and_scope
description: "v0.x outcomes, acceptance boundaries, included application capabilities, and explicit non-goals."
type: plan
tags: [v0.x, scope]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T12:10:00+08:00
---

# v0.x goal and scope

## Goal

Prove that Loredu can maintain small, inspectable, provenance-aware operational knowledge across repeated activities without depending on a CLI, model runtime, crawler framework, graph/vector database, daemon, or external service.

## v0.x must prove

1. The application can accept immutable Entries from arbitrary actors.
2. Claims can be submitted manually or programmatically and retain provenance.
3. Deterministic reconciliation can identify obvious duplicate, support, and conflict relationships.
4. Explicit Resolutions can change the preferred projection without modifying earlier records.
5. Current knowledge can be rebuilt from canonical records.
6. Historical `as_of` projections work.
7. Valid-time queries can distinguish what was later learned to have been effective at an earlier date.
8. Working Lore produces a bounded context rather than returning the whole history.
9. A plain-file `RecordStore` can persist and replay the complete alpha state.
10. The same core contracts can represent at least one technical and one non-technical activity fixture.

## Included

- domain/application records and invariants;
- `RecordStore` port;
- Markdown + YAML frontmatter canonical adapter;
- deterministic reconciliation baseline;
- explicit resolution application;
- current and historical projections;
- bounded Working Lore representation;
- simple filtering/ranking sufficient for fixtures;
- conformance and end-to-end tests around the published contracts.

## Explicitly deferred

- CLI design;
- daemon/service topology;
- HTTP/API server;
- Rozoro-specific integration;
- automatic code/web/document crawling;
- PDF extraction/OCR;
- LLM/model dependency;
- embeddings/vector stores;
- graph databases;
- automatic runbook rewriting;
- source-specific change adapters beyond fixture-level source/snapshot refs;
- distributed/multi-node coordination;
- super-scale optimization.

## Success criterion

A fresh checkout can replay a small plain-file corpus and correctly answer current, historical, provenance, and bounded-context questions for the representative acceptance scenarios.
