---
name: record_store_contract
description: "Provider-neutral persistence port for append-only Loredu records."
type: contract
tags: [contracts, storage, ports]
generated: "ChatGPT GPT-5.6 Sol and OpenAI coding agent, 2026-08-27"
created_at: 2026-08-26T12:10:00+08:00
---

# Record store port

The application depends on record semantics, never provider paths, tables, SDK objects, or query languages. [Decision 0020](../../decisions/0020-m0-public-contract-closure.md) deliberately stages this port.

## M0 public slice

```text
RecordStore.append(record: PersistedRecord) -> Promise<StreamPosition>
RecordStore.get(id: RecordId) -> Promise<PersistedRecord | undefined>
application.append(draft) -> Promise<{ record: PersistedRecord, position: StreamPosition }>
```

These typed semantics are public even if language spelling differs. Store append receives a complete validated, deeply frozen record and assigns only position; it never creates or rewrites schema, id, or time. Application success returns exactly record plus position. Failure publishes/returns no record, and stamped values are unobservable except through collaborator call counts.

At the TypeScript boundary, `StreamPosition` is opaque/branded and is a nonnegative safe integer. Successful append positions are positive, strictly increase from the previous position in that store, and commit ordering. `0` is reserved for empty head when `head` arrives. Disk representation remains adapter-private.

M0 append rejects duplicate ids without replacing the original and reports `DUPLICATE_RECORD_ID`. A generated-id collision surfaces; application append does not retry, draw entropy again, or sample another clock value. Reads return canonical deeply frozen records detached from caller/store aliases. Append-result and get object identity is not promised; structural identity is.

`InMemoryStore` implements this exact slice in M0 and is exported only from `@loredu/kernel/testing`. It is test support, not a durable provider. It preserves duplicate, monotonic-position, and immutability semantics required by application tests.

## Application-owned references

Before stamping, application append validates and reads every record reference in the order fixed by the [record contract](./records.md). Missing or wrong-kind references produce `REFERENCE_CHECK_FAILED`; external SourceRefs never cause store lookups. The store is semantics-ignorant and does not enforce reference relationships. Writers append referents before referrers, preserving prefix validity.

## M1 extension — not inferred from M0

M1 extends the port with the settled forms of:

```text
scan(filter) -> ordered records
stream(after-position?) -> ordered records
head() -> current stream position
```

M1, not M0, owns filter shape, cursors, full reads, stream/head behavior, replay-stable positions, read-your-writes across those methods, reusable conformance, crash durability, atomic visibility, locking, and provider codecs/layout. The M0 two-method port makes no claim about them.

For durable adapters, successful append is the single-record commit point: returned position means durable, reads reflect it, writers become visible in append order, and no torn record is visible. M1 conformance runs against InMemoryStore and PlainFileStore; it does not ask stores to validate domain references.

v0.x remains single-writer. A durable adapter must fail loudly when safe access is unavailable. Multi-record transactions and multi-writer coordination are deferred; prefix validity makes interrupted workflows unfinished rather than corrupt.

## Plain-file boundary

The M1 adapter uses Markdown/YAML, locking, atomic rename, fsync, stable replay, and named store roots. These are provider rules, not M0 record transport. M0's public JSON-value encoder/decoder is storage-neutral evidence only. A future canonical provider or disposable index may use another representation without changing the kernel port.
