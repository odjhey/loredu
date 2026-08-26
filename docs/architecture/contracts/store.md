---
name: record_store_contract
description: "Provider-neutral persistence port for append-only Loredu records."
type: contract
tags: [contracts, storage, ports]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
---

# Record store port

The application core depends on record semantics, not a persistence technology.

A minimal store provides equivalent capabilities to:

```text
append(draft) -> record id + stream position
get(id) -> record | not-found
scan(filter) -> ordered records
stream(after-position?) -> ordered records
head() -> current stream position
```

Exact method names are language-specific and are not part of this contract.

## Required behavior

- `append` never silently replaces a record with the same identity;
- `append` returns a monotonic stream position; `head` exposes the latest position so derived views can be checked for staleness against their `basis` ([decision 0006](../../decisions/0006-explicit-version-basis.md));
- how a position is represented is an adapter detail (the plain-file adapter may derive it from deterministic replay order), but positions must be stable across replays;
- reads return the original canonical record, not a projected/mutated representation;
- ordering/cursors are deterministic enough to replay projections;
- store adapters preserve record data required by the published record schema;
- application logic must not depend on provider-specific paths, tables, SDK objects, or query languages.

## Append is the commit point

There is no separate commit/transaction verb on the port. The unit of atomicity and durability is the single record:

- when `append` returns a position, the record is durable — it survives a crash (the plain-file adapter fsyncs before returning; a database adapter commits);
- `append` takes a **draft** and assigns `id` and `recorded_at` at commit time — the draft type has neither field, so the kernel's id generation and clock are authoritative by construction (records contract, draft vs persisted record);
- read-your-writes: after `append` returns, `get`, `scan`, and `head` reflect the record;
- appends from a writer become visible in the order they were made.

Multi-record workflows (e.g. supersede = claim + relation + resolution) stay crash-safe without transactions because of the **prefix-validity rule**: writers append referenced records before their referrers, so every prefix of a valid append sequence is itself a valid store. A crash mid-workflow leaves the store *unfinished*, never corrupt — and unfinished states are exactly what health checks surface and the advice envelope guides to completion.

The application layer enforces reference-before-referrer at write time (a claim whose `derived_from` does not exist is rejected); the store itself stays ignorant of record semantics. A batched all-or-nothing `append_many` may later be added as an adapter optimization; nothing in v0.x requires it.

Version control of a store directory (e.g. Git) is an external history/sync layer, not part of these semantics — the store must be correct with or without it.

## Concurrency ownership

The port defines the safety guarantees; each adapter implements them with whatever mechanism fits its medium:

- appends are atomic — a reader never observes a torn or partial record;
- positions remain monotonic under any interleaving the adapter permits;
- a writer that cannot obtain safe access fails loudly; it never corrupts or silently drops a record.

v0.x assumes a single writer at a time. The plain-file adapter satisfies the guarantees with lock-file + atomic-rename (the pattern the watchtower ledger — a [candidate consumer](../../reports/candidate-consumers.md) — already proved in its own codebase); a database-backed canonical store would use transactions. Multi-writer coordination beyond this is explicitly deferred.

## Store roots

A store is a self-contained directory; nothing about a store lives outside its root. Callers operate any number of named stores side by side under a relocatable home:

- an explicit path flag always wins;
- otherwise a store name resolves to `$LOREDU_HOME/stores/<name>` (`LOREDU_HOME` defaults to `~/.loredu`), keeping the home root free for configuration and other non-store concerns;
- with neither flag, the default store name is `default`, resolved the same way (`$LOREDU_HOME/stores/default`) — it enjoys no special creation rules;
- if the resolved store does not exist, the call **fails with an actionable error** — no upward discovery from the working directory, no silent creation outside `init`.

Predictability over magic: resolution never depends on where a command happens to be run from. Test isolation is pointing `LOREDU_HOME` at a temp directory, not a mocking exercise.

## Alpha adapter

The first adapter is planned as plain Markdown files with YAML frontmatter. That representation is an adapter detail, not the domain model.

An optional SQLite index/cache may later accelerate filtering, full-text search, joins, and projections. A derived index must be disposable and rebuildable from canonical records.

A future SQLite/Postgres/other canonical `RecordStore` may be added behind the same port if scale or concurrency justifies it.
