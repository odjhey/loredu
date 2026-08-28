# `@loredu/store-plainfile`

The alpha `RecordStore` adapter: one directory per store, records as Markdown with
YAML frontmatter, hand-inspectable and Git-friendly
([ADR 0003](../../docs/decisions/0003-plain-files-first.md),
[store contract](../../docs/architecture/contracts/store.md),
[plain-file provider contract](../../docs/architecture/contracts/plain-file-store.md)).

Being an adapter, this package *may* use `node:*`/`bun:*` APIs and ambient globals —
that asymmetry with `@loredu/kernel` is the point of the boundary. It depends on
`@loredu/kernel` and nothing else.

## State

M1 is complete. The adapter implements the strict Markdown/frontmatter codec,
filename-derived contiguous positions, canonical replay, and the full `RecordStore`
port. The unchanged `@loredu/kernel/testing` conformance suite runs against this
adapter and the M1-complete in-memory reference adapter.

Initialization is explicit through `initializePlainFileStore`; ordinary construction
and reads never create a missing store. Root selection, named-root containment,
append locking, durable publication, and uncertain whole-record recovery follow the
[plain-file provider contract](../../docs/architecture/contracts/plain-file-store.md).
T19 remains M0 application/reference evidence: `PlainFileStore` is semantics-ignorant
and does not validate record relationships.
