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

Loredu is an embedded operational knowledge kernel — a utility our own products build on, not a standalone product ([decision 0005](../decisions/0005-embedded-kernel-compatibility.md)). Activities append what they learn as immutable, provenance-carrying records; structured claims declare identity keys ([decision 0004](../decisions/0004-claim-identity-key.md)) so knowledge about the same fact meets instead of piling up, and history is preserved along both recorded time and external validity time.

The kernel's dividing line is **mechanical versus judgment**. Loredu detects deterministically — duplicates, corroboration, conflict candidates, key divergence, dangling provenance, stale views — and never makes open-ended judgments. Humans, agents, and programs judge; their resolutions are appended as records with the same provenance discipline as everything else. This is why the kernel needs no model runtime: extraction and resolution are caller capabilities, not core assumptions.

The kernel is **reactive** ([decision 0008](../decisions/0008-cli-first-agent-reactive.md)): every interaction answers with the resulting knowledge health and deterministic next actions, so a writer — especially an agent — can chain corrections in the same session until the store is healthy. Advice is derived only from mechanical checks; the kernel points, it never speculates.

Every derived view is **bounded and versioned** ([decision 0006](../decisions/0006-explicit-version-basis.md)): stamped with the basis (stream position, ruleset, query) it was computed from, so consumers cache safely, detect staleness by comparison, and reproduce views exactly. Storage may grow without bound; a caller's context never has to.

Loredu is not the activity itself. Consumers own their writers, extraction quality, surfaces, vocabulary, and namespacing; Loredu owns the consistent record, detection, resolution, and disclosure semantics underneath — machine-readable at every boundary so downstream filtering composes with ordinary tools. It should remain useful whether the caller is a human, a crawler, a review tool, an agent, an orchestrator, a future CLI, or another application. Concrete candidate consumers are catalogued in [candidate consumers](../reports/candidate-consumers.md).

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
