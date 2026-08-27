# `@loredu/store-plainfile`

The alpha `RecordStore` adapter: one directory per store, records as Markdown with
YAML frontmatter, hand-inspectable and Git-friendly
([ADR 0003](../../docs/decisions/0003-plain-files-first.md),
[store contract](../../docs/architecture/contracts/store.md)).

Being an adapter, this package *may* use `node:*`/`bun:*` APIs and ambient globals —
that asymmetry with `@loredu/kernel` is the point of the boundary. It depends on
`@loredu/kernel` and nothing else.

## State

M1-F implements the public strict Markdown/frontmatter codec, filename-derived
contiguous positions, canonical replay, and `PlainFileStore` append/get/scan/stream/head.
The unchanged `@loredu/kernel/testing` conformance suite runs against this adapter;
provider tests own T11, T12, and T14, including valid hand additions.

M1-D still owns initialization/root resolution (T17), append-scoped locking (T16),
and the temp-file/fsync/atomic-rename/crash-prefix protocol (T18). Until that slice
lands, tests establish an exact existing layout explicitly and append does not claim
durable-before-return behavior. T19 remains M0 application/reference evidence;
`PlainFileStore` is semantics-ignorant and does not validate record relationships.
