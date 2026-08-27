# `@loredu/store-plainfile`

The alpha `RecordStore` adapter: one directory per store, records as Markdown with
YAML frontmatter, hand-inspectable and Git-friendly
([ADR 0003](../../docs/decisions/0003-plain-files-first.md),
[store contract](../../docs/architecture/contracts/store.md)).

Being an adapter, this package *may* use `node:*`/`bun:*` APIs and ambient globals —
that asymmetry with `@loredu/kernel` is the point of the boundary. It depends on
`@loredu/kernel` and nothing else.

## State

M1 is complete. The adapter implements the strict Markdown/frontmatter codec,
filename-derived contiguous positions, canonical replay, and the full `RecordStore`
port. The unchanged `@loredu/kernel/testing` conformance suite runs against this
adapter and the M1-complete in-memory reference adapter.

Initialization is explicit through `initializePlainFileStore`; ordinary construction
and reads never create a missing store. `resolveStoreRoot` handles discriminated
explicit path, validated named, and default selections without discovery. Named
stores live under `<LOREDU_HOME>/stores/` and remain isolated.

Every append acquires an immediate-failure append-scoped writer lock, replays under
the lock, writes an exclusive same-filesystem temp file, fsyncs it, atomically renames
it, fsyncs both affected directories, and releases the lock before returning. Only a
same-host owner proven dead may be quarantined and recovered. A failure after rename
is an uncertain whole-record outcome discoverable by the attempted id; it is never a
torn record. T19 remains M0 application/reference evidence: `PlainFileStore` is
semantics-ignorant and does not validate record relationships.
