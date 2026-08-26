---
name: record_store_contract
description: "Provider-neutral persistence port for append-only Loredu records."
type: contract
tags: [contracts, storage, ports]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T12:10:00+08:00
---

# Record store port

The application core depends on record semantics, not a persistence technology.

A minimal store provides equivalent capabilities to:

```text
append(record) -> record id + stream position
get(id) -> record | not-found
scan(filter) -> ordered records
stream(after-position?) -> ordered records
head() -> current stream position
```

Exact method names are language-specific and are not part of this contract.

## Required behavior

- `append` never silently replaces a record with the same identity;
- `append` returns a monotonic stream position; `head` exposes the latest position so derived views can be checked for staleness against their `basis` ([decision 0006](../../decisions/0006-explicit-version-basis.md));
- how a position is represented is an adapter detail (the plain-file adapter may derive it from deterministic replay order), but positions must be stable across replays.

## Concurrency ownership

The port defines the safety guarantees; each adapter implements them with whatever mechanism fits its medium:

- appends are atomic — a reader never observes a torn or partial record;
- positions remain monotonic under any interleaving the adapter permits;
- a writer that cannot obtain safe access fails loudly; it never corrupts or silently drops a record.

v0.x assumes a single writer at a time. The plain-file adapter satisfies the guarantees with lock-file + atomic-rename (the pattern proven in the watchtower ledger consumer); a database-backed canonical store would use transactions. Multi-writer coordination beyond this is explicitly deferred.

## Store roots

A store is a self-contained directory; nothing about a store lives outside its root. Callers may operate any number of stores side by side. Surfaces resolve the root explicitly — flag, then environment, then upward discovery from the working directory — and never fall back to a global per-user location. This keeps multiple projects independent and makes test isolation a temp directory, not a mocking exercise.
- reads return the original canonical record, not a projected/mutated representation;
- ordering/cursors are deterministic enough to replay projections;
- store adapters preserve record data required by the published record schema;
- application logic must not depend on provider-specific paths, tables, SDK objects, or query languages.

## Alpha adapter

The first adapter is planned as plain Markdown files with YAML frontmatter. That representation is an adapter detail, not the domain model.

An optional SQLite index/cache may later accelerate filtering, full-text search, joins, and projections. A derived index must be disposable and rebuildable from canonical records.

A future SQLite/Postgres/other canonical `RecordStore` may be added behind the same port if scale or concurrency justifies it.
