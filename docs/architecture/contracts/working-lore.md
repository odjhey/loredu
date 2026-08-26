---
name: working_lore_contract
description: "Bounded Working Lore prepared for an activity, with progressive-disclosure levels and stable drill-down handles."
type: contract
tags: [contracts, context, progressive-disclosure]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T12:10:00+08:00
---

# Working Lore contract

Working Lore is a bounded projection prepared for one Activity. It is not the entire knowledge store.

## Core invariant

> Storage growth must not imply activity-context growth.

A caller supplies activity intent, scope/corpus information when available, and a budget. Loredu returns the most useful compact knowledge plus stable handles for deeper inspection.

## Suggested shape

```yaml
activity: caller-defined-activity-kind
scope: {}
corpus: optional-corpus-ref
snapshot: optional-snapshot
orientation:
  current_count: 0
  candidate_count: 0
  attention_count: 0
current: []
patterns: []
attention:
  candidates: []
  conflicts: []
  needs_revalidation: []
budget:
  max_items: 40
  max_chars: 12000
```

Token budgets may be supported by adapters that can measure them reliably; the core should also support implementation-neutral item/character bounds.

## Disclosure levels

```text
0  orientation / compact state
1  Working Lore for the current activity
2  claim detail
3  evidence, relations, and history
4  full Entry and external source reference
```

Default views should carry enough identifiers and summaries for a caller to choose the next level without loading the entire history.

## Selection dimensions

The default implementation may rank using cheap deterministic signals first:

- scope specificity;
- activity relevance;
- current versus stale/superseded state;
- authority/confidence;
- recency or verification freshness when relevant.

Lexical search, SQLite FTS, embeddings, graph traversal, and model reranking are implementation options, not required parts of the contract.

## Trust sections

Working Lore should distinguish at least:

- current/preferred knowledge;
- reusable patterns;
- candidate knowledge/hints requiring verification;
- conflicts and material attention items;
- stale or changed-source items needing revalidation.

Superseded history is normally omitted from the default packet but remains discoverable.
