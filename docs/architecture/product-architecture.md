---
name: product_architecture
description: "Loredu product thesis, ownership boundaries, application ports, core flow, progressive-disclosure posture, and non-goals."
type: architecture
tags: [architecture, core, ports, progressive-disclosure]
generated: "ChatGPT GPT-5.6 Sol and OpenAI coding agent, 2026-08-28"
created_at: 2026-08-26T12:10:00+08:00
---

# Product architecture

## Thesis

Loredu is an embedded operational knowledge kernel — a utility for our own products to build on, not a standalone product ([decision 0005](../decisions/0005-embedded-kernel-compatibility.md)). Activities append what they learn as immutable, provenance-carrying records; structured claims declare identity keys ([decision 0004](../decisions/0004-claim-identity-key.md)) so knowledge about the same fact meets instead of piling up, and history is preserved along both recorded time and external validity time.

The kernel's dividing line is **mechanical versus judgment**. Loredu detects deterministically — duplicates, corroboration, conflict candidates, key divergence, dangling provenance, stale views — and never makes open-ended judgments. Humans, agents, and programs judge; their resolutions are appended as records with the same provenance discipline as everything else. This is why the kernel needs no model runtime: extraction and resolution are caller capabilities, not core assumptions.

The kernel is **reactive** ([decision 0008](../decisions/0008-cli-first-agent-reactive.md)): mutations return mechanical reconciliation feedback, responses expose deterministic affordances where applicable, and status reports health. A writer — especially an agent — can follow those actions in the same session until the store is healthy. Advice is derived only from mechanical checks; the kernel points, it never speculates.

Every derived view is **bounded and versioned** ([decisions 0006](../decisions/0006-explicit-version-basis.md) and [0027](../decisions/0027-m2-reconciliation-projection-contract.md)): stamped with the Basis (stream position, ruleset, query) it was computed from, so consumers cache safely, detect staleness by comparison, and reproduce semantic content exactly. Storage may grow without bound; a caller's context never has to.

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

- immutable knowledge records and their exact caller-declared identities; a ClaimPolicy may validate but never remap a ClaimKey;
- generic key-divergence detection as versioned core mechanics; default policy advice is empty;
- consumer ClaimPolicy mediation for `exclusive|coexisting` and bounded deterministic policy advisories, without identity remapping or preference;
- provenance links from claims back to entries and sources;
- deterministic same-key reconciliation with closed pair/state vocabularies;
- explicit Resolution records and their precedence over explicit `supersedes` and temporal mechanics;
- bitemporal Current Knowledge with bounded history/evidence summaries and record-level disclosure;
- bounded Working Lore and progressive-disclosure contracts;
- storage/application ports required to preserve those semantics, including the capability ports the kernel is assembled with (`Clock`, `RandomSource` — [clock and identity](./contracts/clock-and-identity.md)).

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

The domain and application layers must not depend on a CLI, agent harness, model SDK, crawler, or persistence vendor. Provider-native types stop at adapters. M0's RecordStore boundary is intentionally only typed `append(PersistedRecord) → StreamPosition` and `get(RecordId) → PersistedRecord|undefined`; application append owns validation, references, stamping, and the `{record, position}` result. M1 additively closes atomic snapshot `scan` with a kind-only provider filter, snapshot-bounded incremental `stream`, `head`, and reusable conformance in the [store contract](./contracts/store.md). M1.5 composes claim filters, exact-key feedback, health, Basis-pinned cursors, and semantic affordances above that port; the CLI only parses/renders them and supplies host Clock/secure RandomSource implementations at its composition root ([application and CLI contract](./contracts/application-cli.md)). M2 additively derives Current Knowledge from one atomic snapshot under the active structural core/policy ruleset: policy may advise but cannot merge keys or choose truth, while `computed_at` stays outside semantic Basis ([projection contract](./contracts/projection.md)). Markdown bytes, roots, locks, and fsync stay in the [plain-file provider contract](./contracts/plain-file-store.md), outside the kernel/domain boundary.

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
