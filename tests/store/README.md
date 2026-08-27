# store — M1, durable plain-file conformance

Catalog rows **T10–T18** cover the M1 extension. Narrowed T10 is reusable full-port conformance over PlainFileStore and M1-complete InMemoryStore, proving positive increasing positions and matching latest `head`; M0 T87 is the first reference-position evidence. Remaining rows cover: replay-stable positions and stream,
duplicate preservation, hand-inspectable Markdown replay, roots/isolation, locking,
atomic visibility, durable append, scan/stream/head, and crash-safe prefix behavior.

The reusable conformance kit arrives in M1 under `@loredu/kernel/testing` and runs
against InMemoryStore and PlainFileStore. M0's InMemoryStore already implements only
typed append/get, monotonic safe positions, duplicate rejection, and immutable reads.
T19 is not store conformance: application reference semantics moved to M0 records
tests, and a semantics-ignorant store must not reject references.

Isolate durable tests with a temporary `LOREDU_HOME`; never write to a real home.
Contract: [store](../../docs/architecture/contracts/store.md).
