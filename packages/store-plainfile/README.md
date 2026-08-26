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
lock-file + atomic-rename durability, Markdown/YAML serialize/parse (including
T06), and separate conformance runs land with M1 (catalog T06, T10–T14,
T16–T19): portable logical RecordStore cases may share the in-memory reference
seam, while filesystem layout, locking, atomic visibility, fsync, crash, and
cross-instance replay are PlainFileStore/provider evidence only. This includes
the parts of store-root resolution this file deliberately leaves out (existence
errors, `--store` precedence: T17). The M0 in-memory application seam (T15) is
not provider or adapter evidence; see [ADR 0021](../../docs/decisions/0021-m0-record-contract-closure.md).
