---
name: record_store_contract
description: "Provider-neutral M0 append/get and M1 snapshot scan, replay stream, head, commit, and conformance contract."
type: contract
tags: [contracts, storage, ports]
generated: "ChatGPT GPT-5.6 Sol and OpenAI coding agent, 2026-08-28"
created_at: 2026-08-26T12:10:00+08:00
---

# Record store port

The application depends on record mechanics, never provider paths, tables, SDK objects, query languages, or filesystem layout. [Decision 0020](../../decisions/0020-m0-public-contract-closure.md) stages M0; [decision 0022](../../decisions/0022-m1-store-and-plain-file-contract.md) closes the M1 extension.

## M0 public slice

```ts
interface RecordStore {
  append(record: PersistedRecord): Promise<StreamPosition>
  get(id: RecordId): Promise<PersistedRecord | undefined>
}
interface LoreduApplication {
  append<D extends RecordDraft>(draft: D):
    Promise<AppendRecordResult<PersistedRecordFor<D>>>
}
```

These typed semantics are public even if language spelling differs. Store append receives a complete validated, deeply frozen record and assigns only position; it never creates or rewrites schema, id, or time. Application success returns exactly record plus position. Failure publishes/returns no record, and stamped values are unobservable except through collaborator call counts.

At the TypeScript boundary, `StreamPosition` is opaque/branded and is a nonnegative safe integer. Adapters construct it through `createStreamPosition(value: number)`; `0` is valid for empty head, while successful append returns only positive positions. Ordinary numbers are not assignable. Disk representation is adapter-private unless a provider contract says otherwise.

Append rejects duplicate ids without replacing the original and reports `DUPLICATE_RECORD_ID`. A generated-id collision surfaces; application append does not retry, draw entropy again, or sample another clock value. Reads return canonical deeply frozen records detached from caller/store aliases. Append-result and get object identity is not promised; structural identity is.

`InMemoryStore` implements this slice in M0 and is exported only from `@loredu/kernel/testing`. It canonicalizes and snapshots a direct append input before allocating position, returns a fresh detached deeply frozen canonical snapshot from `get`, and allocates no position for malformed or duplicate append. It remains semantics-ignorant: references and ClaimPolicy belong to the application. It is test support, not a durable provider ([decision 0025](../../decisions/0025-m0-application-append-phase-boundaries.md)).

## Application-owned references

Before stamping, application append validates and reads every record reference in the order fixed by the [record contract](./records.md). Missing or wrong-kind references produce `REFERENCE_CHECK_FAILED`; external SourceRefs never cause store lookups. The store is semantics-ignorant and does not enforce reference relationships. Writers append referents before referrers, preserving prefix validity.

## M1 exact extension

At M1 the same normal entrypoint adds these types and exact methods:

```ts
interface RecordFilter {
  readonly kinds?: readonly RecordKind[]
}

interface PositionedRecord {
  readonly position: StreamPosition
  readonly record: PersistedRecord
}

interface RecordScan {
  readonly head: StreamPosition
  readonly records: readonly PositionedRecord[]
}

interface RecordStreamOptions {
  readonly after?: StreamPosition
}

interface RecordStore {
  append(record: PersistedRecord): Promise<StreamPosition>
  get(id: RecordId): Promise<PersistedRecord | undefined>
  scan(filter?: RecordFilter): Promise<RecordScan>
  stream(options?: RecordStreamOptions): AsyncIterable<PositionedRecord>
  head(): Promise<StreamPosition>
}
```

### Position and head

Each acknowledged successful append is one commit in a total order and returns the next positive position. M1 adapters expose a contiguous committed sequence `1..head`; duplicate rejection and failures before provider publication allocate nothing. `head()` returns `0` for an empty store and otherwise the latest committed position. A returned position commits ordering even when two records have equal `recorded_at`; record timestamps and ids never order the stream.

After append returns, `get`, `scan`, `stream`, and `head` reflect it. A returned durable-provider position also means the provider-specific durability contract has completed. A durable adapter whose host fails after atomic publication but before acknowledgement may reject with no append result while replay exposes one complete next record; its provider contract defines that narrow uncertain-whole-commit recovery by the attempted record id. It never exposes a torn record, gap, or position without a record.

### Scan snapshot and filter

`scan()` atomically captures one head and returns it with records at positions `1..captured head`, ascending. This explicit head remains meaningful when filtering returns no records and is suitable for `Basis.stream_position`. Appends committed after capture do not appear in that result.

M1 `RecordFilter` is deliberately closed to `kinds`. Omitted `kinds` matches every record. An empty list matches none. Duplicate kinds and list order do not affect the result. Matching is exact `record.kind` membership; result order always remains ascending position. Provider storage does not implement scope, actor, ClaimKey/value, provenance, validity, or arbitrary predicates—M1.5 application read services compose those above this mechanical scan.

### Incremental stream and replay

`stream()` is unfiltered and snapshot-bounded. `after` is exclusive; omission is position `0`. The iterator captures its upper head when iteration first starts and yields every positioned record satisfying `after < position <= captured head`, once, in ascending contiguous order. Later appends do not appear mid-iteration. A new iterator observes a new head.

If `after === captured head`, iteration is empty. If `after > captured head`, iteration throws a `LoreduError` with `STREAM_POSITION_OUT_OF_RANGE`; silently returning empty would hide use of a cursor from another store or lost history. Full replay is `stream()` with no options.

Every read returns detached, recursively frozen canonical records. `PositionedRecord`, `RecordScan`, and their arrays are readonly/detached. Snapshot semantics do not promise shared object identity between get/scan/stream calls.

## Conformance contract

`@loredu/kernel/testing` exposes a runner-neutral kit:

```ts
interface RecordStoreFixture {
  readonly store: RecordStore
  dispose(): Promise<void>
}
interface StoreUnderTest {
  readonly name: string
  create(): Promise<RecordStoreFixture> // fresh empty isolated store per call
}
interface RecordStoreConformanceCase {
  readonly name: string
  run(): Promise<void>
}
function recordStoreConformance(
  subject: StoreUnderTest,
): readonly RecordStoreConformanceCase[]
```

The function returns bound cases so a host runner can register each `{name, run}`. It imports no Bun/Node test API. Every case creates a fresh fixture and calls `dispose` in `finally`, including on assertion failure. The kit owns its canonical valid-record fixtures; adapters do not provide semantics-specific fixture builders.

The shared cases prove:

- empty `head`, scan head/records, and full stream;
- positive contiguous append positions and matching latest head;
- append/get/read-your-writes and ascending positioned scan/stream;
- stream's exclusive `after`, out-of-range error, and fixed snapshot boundary;
- scan's atomic head and exact kind-filter absent/empty/duplicate/order behavior;
- duplicate id leaves the original and scan/head unchanged;
- returned records and wrappers are detached, readonly, and deeply frozen.

The kit deliberately excludes host crash injection, filesystem bytes/layout, root resolution, lock mechanism, and domain-reference validation. M1 runs these exact cases against the M1-complete `InMemoryStore` and `PlainFileStore`. Provider tests own replay across instances, stable on-disk positions, hand addition, lock contention, and fsync/crash-prefix evidence.

## Durable and concurrency guarantees

For a durable adapter, acknowledged successful append is the single-record commit point: returned position means durable, all reads reflect it, and no torn record is visible. Atomic provider publication may precede acknowledgement only in the explicitly documented uncertain whole-record failure window. The stream remains prefix-valid after interruption. Multi-record transactions are not promised; an interrupted workflow is incomplete rather than corrupt.

v0.x is single-writer. A provider must fail loudly when it cannot establish its exact safe-write protocol. It may serve snapshot readers concurrently only when they see a complete prefix. Multi-writer waiting, distributed leases, and conflict resolution are deferred.

The M1 [plain-file provider contract](./plain-file-store.md) fixes Markdown/frontmatter bytes, filename positions, replay validation, append-scoped locking, atomic rename/fsync, initialization, and named roots. Those rules do not leak into this provider-neutral port. The public JSON-value codec remains storage-neutral, and a future canonical provider or disposable index may use another representation while passing this conformance contract.
