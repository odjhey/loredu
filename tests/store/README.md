# store — M1, the plain-file store

Catalog rows **T10–T19**: monotonic and replay-stable positions; replay of a store
directory reproduces the identical ordered stream; duplicate id rejected with the
original untouched; hand-written Markdown records picked up on replay; store-root
resolution and isolation (**T17**); append-is-commit under a simulated crash
(**T18**); reference-before-referrer rejection (**T19**); and the kernel compiling
and testing against a pure in-memory store (**T15**).

Two things belong here: the shared **store conformance suite** from
`@loredu/kernel/testing`, run against both the in-memory reference store and
`@loredu/store-plainfile` — a guarantee proven for one adapter and not the other is
a guarantee the port does not own — and plain-file-specific tests (on-disk layout,
locking, atomic rename).

Isolate by pointing `LOREDU_HOME` at a temp directory; never write to a real home.

Contract: [store](../../docs/architecture/contracts/store.md).
