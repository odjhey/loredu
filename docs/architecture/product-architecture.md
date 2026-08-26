---
name: product_architecture
description: "Loredu product thesis, ownership boundaries, application ports, core flow, progressive-disclosure posture, and non-goals."
type: architecture
tags: [architecture, core, ports, progressive-disclosure]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T12:10:00+08:00
---

# Product architecture

## Thesis

Loredu is an embedded operational knowledge kernel — a utility our own products build on, not a standalone product ([decision 0005](../decisions/0005-embedded-kernel-compatibility.md)). Activities record what they learn as durable entries; structured claims can be extracted by humans, agents, or deterministic software; Loredu preserves provenance and temporal history, performs deterministic reconciliation, records explicit resolutions, and exposes bounded working knowledge to later activities.

Loredu is not the activity itself. Consumers own their writers, extraction quality, surfaces, and domain vocabulary; Loredu owns consistent record, reconciliation, and disclosure semantics across all of them. It should remain useful whether the caller is a human, a crawler, a review tool, an agent, an orchestrator, a future CLI, or another application. Concrete candidate consumers are catalogued in [candidate consumers](../reports/candidate-consumers.md).

## Core loop

```text
Target corpus / environment
          │
          ▼
       Activity
          │
    uses Working Lore
          │
          ▼
       Findings
          │
          ▼
        Entry
          │
       extract
          ▼
        Claim
          │
      reconcile
          ▼
      Relations
          │
        resolve
          ▼
     Resolution
          │
          ▼
      Projection
          │
          └────────► future Activity
```

Extraction and resolution are capabilities, not assumptions about an LLM. Either may be performed by a human, agent, deterministic program, or future adapter.

## Ownership

Loredu owns:

- immutable knowledge records and their identities;
- provenance links from claims back to entries and sources;
- deterministic reconciliation semantics;
- explicit resolution records;
- current and historical projections;
- bounded Working Lore and progressive-disclosure contracts;
- storage/application ports required to preserve those semantics.

Loredu does not own:

- repository, web, or document crawling;
- PDF/OCR/parsing pipelines;
- legal interpretation or business-process analysis;
- agent orchestration;
- model runtimes or model selection;
- vector or graph databases;
- a particular user interface, CLI, HTTP API, or agent protocol;
- source-system-specific domain models;
- automatic mutation of a caller's runbooks.

## Application core first

```text
                  inbound adapters
          human / crawler / agent / future CLI
                         │
                         ▼
                 ┌───────────────┐
                 │ Loredu App    │
                 │               │
                 │ record        │
                 │ reconcile     │
                 │ resolve       │
                 │ project       │
                 │ prepare       │
                 └───────┬───────┘
                         │ ports
          ┌──────────┬───┴──────┬──────────┐
          ▼          ▼          ▼          ▼
        Store    Extractor   Resolver   Ranker
          │
   PlainFileStore
   first adapter
```

`Ranker` follows the same pattern as `Extractor` and `Resolver`: the core ships a deterministic baseline for Working Lore selection; a consumer may plug in lexical search, embeddings, or model reranking without the core knowing.

The domain and application layers must not depend on a CLI, agent harness, model SDK, crawler, or persistence vendor. Provider-native types stop at adapters.

## Progressive disclosure

Storage may grow without bound relative to a single activity, but active context must remain bounded. Loredu therefore treats disclosure as a core behavior:

```text
orientation
    ↓
Working Lore
    ↓
claim detail
    ↓
history / evidence
    ↓
entry / raw source reference
```

Default views should be small enough to let a caller decide what to inspect next. Deeper records remain addressable by stable identifiers.

## Authority and source-of-truth

Loredu stores knowledge about external material; it does not automatically become the authoritative copy of that material. A source reference identifies what an entry relied on. Source adapters may later provide snapshot identity and change detection, but the core remains source-system agnostic.

## Fast and slow learning

Repeated activities may immediately improve Working Lore by adding entries and claims. A separate, slower process may later decide that a recurring operational pattern should change an external runbook or procedure. Loredu records the evidence and candidate knowledge; it does not silently rewrite caller-owned procedures.

## Non-goals for the architecture

Avoid turning Loredu into:

- a generic RAG platform;
- a graph database product;
- an autonomous research agent;
- a crawler framework;
- an orchestration runtime;
- a provider abstraction for every AI model or vector store;
- a source-code-specific product;
- one giant mutable memory document.
