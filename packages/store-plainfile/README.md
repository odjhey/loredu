# `@loredu/store-plainfile`

The alpha `RecordStore` adapter: one directory per store, records as Markdown with
YAML frontmatter, hand-inspectable and Git-friendly
([ADR 0003](../../docs/decisions/0003-plain-files-first.md),
[store contract](../../docs/architecture/contracts/store.md)).

Being an adapter, this package *may* use `node:*`/`bun:*` APIs and ambient globals —
that asymmetry with `@loredu/kernel` is the point of the boundary. It depends on
`@loredu/kernel` and nothing else.

## State

Scaffold. Only store-root path resolution exists. The append path, replay,
lock-file + atomic-rename durability, and the conformance run against
`@loredu/kernel/testing` land with M1 (catalog T10–T19) — including the parts of
store-root resolution this file deliberately leaves out (existence errors,
`--store` precedence: T17).
