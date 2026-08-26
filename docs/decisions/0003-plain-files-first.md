---
name: decision_plain_files_first
description: "Use Markdown with YAML frontmatter as the first canonical RecordStore adapter while keeping storage semantics provider-neutral."
type: decision
tags: [decisions, storage, alpha]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
---

# 0003: Plain files first

## Context

The alpha should make the knowledge model inspectable and easy to experiment with without bringing graph, vector, service, or database infrastructure into the foundation.

## Options considered

- require SQLite as canonical storage;
- require a graph/vector database;
- use plain files first behind a provider-neutral store port.

## Choice

The first canonical adapter uses ordinary Markdown files with YAML frontmatter. The Markdown representation is an adapter implementation, not the Loredu domain model.

## Consequences

Benefits include human inspection, Git/rsync/tar friendliness, grepability, simple agent access, and minimal runtime dependencies.

A derived SQLite database may be added as a disposable index/cache for filtering, full-text search, joins, and projections. SQLite or another database may later become an alternative canonical `RecordStore` if scale/concurrency requires it.

## Rule or follow-up

The complete alpha knowledge state must remain reconstructable from the canonical plain-file records. Do not make application semantics depend on file paths or Markdown parsing details.
