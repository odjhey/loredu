---
name: v0x_goal_and_scope
description: "v0.x outcomes, acceptance boundaries, included application capabilities, and explicit non-goals."
type: plan
tags: [v0.x, scope]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
---

# v0.x goal and scope

## Goal

Prove that Loredu can maintain small, inspectable, provenance-aware operational knowledge across repeated activities without depending on a model runtime, crawler framework, graph/vector database, daemon, or external service — and that embedding it in one of our real products beats the notes-file that product would otherwise hand-roll ([decision 0005](../../decisions/0005-embedded-kernel-compatibility.md)). The `lor` CLI ships early as an adapter over these contracts ([decision 0008](../../decisions/0008-cli-first-agent-reactive.md)), but the application core itself never depends on it ([decision 0001](../../decisions/0001-application-core-first.md)).

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
11. Two actors recording the same fact with different free text but the same declared claim key are reconciled (corroboration or conflict), and the same fact under different perspectives coexists without destructive conflict ([decision 0004](../../decisions/0004-claim-identity-key.md)).
12. Embedding ergonomics: a consumer reaches "appended entry + claim" and "Working Lore in hand" in a few calls with no runtime dependencies beyond the store adapter.
13. At least one real consumer from [candidate consumers](../../reports/candidate-consumers.md) is wired in before any contract is marked `status: current`.
14. Every projection and Working Lore packet carries a `basis`; a cached packet is detected as stale after one new relevant record and reproduces identically when basis and query are unchanged ([decision 0006](../../decisions/0006-explicit-version-basis.md)).

## Included

- domain/application records and invariants;
- `RecordStore` port;
- Markdown + YAML frontmatter canonical adapter;
- deterministic reconciliation baseline;
- explicit resolution application;
- current and historical projections;
- bounded Working Lore representation;
- simple filtering/ranking sufficient for fixtures;
- the agent-operable `lor` CLI as an adapter (M1.5, [decisions 0007](../../decisions/0007-typescript-bun.md)–[0009](../../decisions/0009-hypermedia-pagination.md), closed exactly by [decision 0026](../../decisions/0026-m15-application-cli-contract.md));
- conformance and end-to-end tests around the published contracts.

## Explicitly deferred

- daemon/service topology;
- HTTP/API server;
- Rozoro orchestration integration beyond embedding the kernel in the watchtower attention ledger as the first consumer ([candidate consumers](../../reports/candidate-consumers.md));
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
