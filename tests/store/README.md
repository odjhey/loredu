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

Two distinct things belong here. Portable logical RecordStore cases from the
shared **store conformance suite** in `@loredu/kernel/testing` may run against
both the in-memory reference store and `@loredu/store-plainfile`. Provider and
durability conformance—on-disk layout, locking, atomic rename/visibility,
fsync, crash survival, and replay across instances—runs against
`@loredu/store-plainfile` and future durable adapters only. The in-memory seam
is a logical reference, never durability evidence; a guarantee proven for one
provider is not silently attributed to another.

Isolate by pointing `LOREDU_HOME` at a temp directory; never write to a real home.

Contract: [store](../../docs/architecture/contracts/store.md).
Closure: [ADR 0021](../../docs/decisions/0021-m0-record-contract-closure.md).
