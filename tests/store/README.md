# store — M1, durable plain-file conformance

Catalog rows **T10–T18** cover the M1 extension. Narrowed T10 is reusable full-port conformance over PlainFileStore and M1-complete InMemoryStore, proving positive increasing positions and matching latest `head`; M0 T87 is the first reference-position evidence. Remaining rows cover: replay-stable positions and stream,
duplicate preservation, hand-inspectable Markdown replay, roots/isolation, locking,
atomic visibility, durable append, scan/stream/head, and crash-safe prefix behavior.

M1-K ships the reusable conformance kit under `@loredu/kernel/testing` and runs it
against the M1-complete InMemoryStore for T10, T13, and T15. The same cases run
unchanged against PlainFileStore. Provider tests own T11, T12, and T14 replay/codec
evidence plus T16–T18 locking, initialization/root isolation, durable commit order,
and injected-failure plus process-kill prefix evidence at every commit boundary. T19
is not store conformance: application reference
semantics live in M0 records tests, and a semantics-ignorant store must not reject
references.

Isolate durable tests with a temporary `LOREDU_HOME`; never write to a real home.
Contract: [store](../../docs/architecture/contracts/store.md).
