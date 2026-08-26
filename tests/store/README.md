# store — M1, the plain-file store

Catalog rows **T06, T10–T14, T16–T19**: the M1 Markdown/YAML codec preserves
unknown namespaced metadata through serialize/parse (**T06**); positions are
monotonic and replay-stable; replay of a store directory reproduces the identical
ordered stream; duplicate id is rejected with the original untouched; hand-written
Markdown records are picked up on replay; store-root resolution and isolation
(**T17**); append-is-commit under a simulated crash (**T18**); and
reference-before-referrer rejection (**T19**). The pure in-memory application seam
is T15 and belongs to M0's records group; it does not establish durable-provider
behavior.

Two things belong here: the shared **store conformance suite** from
`@loredu/kernel/testing`, run against both the in-memory reference store and
`@loredu/store-plainfile` — a guarantee proven for one adapter and not the other is
a guarantee the port does not own — and plain-file-specific tests (on-disk layout,
locking, atomic rename).

Isolate by pointing `LOREDU_HOME` at a temp directory; never write to a real home.

Contract: [store](../../docs/architecture/contracts/store.md).
