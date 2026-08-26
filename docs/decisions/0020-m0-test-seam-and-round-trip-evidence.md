---
name: m0_test_seam_and_round_trip_evidence
description: "Settle M0 test-only store timing and keep serialization round-trip evidence with the M1 provider codec."
type: decision
status: superseded
tags: [decisions, m0, testing, contracts]
generated: "Pi coding agent"
created_at: 2026-08-26T23:00:00+08:00
---

# 0020: M0 test seam and round-trip evidence

## Context

The M0 implementation plan requires the kernel/application path to be exercised
without a durable provider. It therefore names a test-only `InMemoryStore` and
deterministic `FixedClock`/`SeededRandomSource` helpers under
`@loredu/kernel/testing`. Decision 0016 instead says that the test subpath has no
test doubles until M1, while the current catalog puts T15 in M1. Those statements
would either block the M0 exit or make a T15 claim imply durable-provider behavior
that M0 does not own.

T06 has a separate boundary problem. Its phrase “through serialize/parse” sounds
like a codec contract, but the published provider-neutral kernel contracts do not
define a wire format. Markdown/YAML serialization is deliberately an M1
plain-file-adapter concern. Adding `JSON.stringify`/`JSON.parse` merely to claim
T06 would create an accidental public format and would not prove the M1 codec.

## Choice

### M0 test seam and T15

M0 includes test-only deterministic helpers and an `InMemoryStore` reference
implementation at `@loredu/kernel/testing`. They are permitted to exercise the
public kernel application API, the complete-record-in/position-only-out port
shape, reference checks, append failure behavior, and deterministic capability
wiring without filesystem or provider dependencies.

This seam is not a durable store and is not M1 conformance evidence. In particular,
M0 does not claim filesystem layout, Markdown/YAML parsing, replay across store
instances or processes, locking, atomic visibility, fsync/durable-before-return,
crash behavior, or any other provider guarantee. M1 adds the plain-file adapter and
the reusable store conformance suite; those tests establish the durable guarantees
of the port.

T15 is consequently an **M0** row. It remains deferred in
`catalog-status.json` until T1 supplies a real executable public-export test; T1
must then remove the deferred entry and claim T15 with `@covers`. Until that
happens, the status file's M0 entry is accounting, not a coverage claim. T15's
meaning is only that the domain/application layer compiles and runs against the
pure in-memory seam without Bun/fs imports in kernel production code.

This supersedes only the test-double timing statement in ADR 0016. ADR 0016's
type isolation, package exports, and kernel-purity choices remain in force.

### T06 and codec ownership

T06 remains **deferred to M1**. M0 owns record shape validation and in-memory
retention of valid namespaced metadata, but M0 defines no `serialize`/`parse` API
and no provider-shaped JSON or Markdown format. M1's Markdown/YAML adapter owns
the round-trip and schema-replay evidence, including preservation of unknown
namespaced metadata and actionable handling of unknown schemas.

This narrows the timing of the T06 evidence described in ADR 0019; it does not
weaken the metadata namespacing or schema acceptance rules. No M0 test may claim
T06 through a JSON stringify/parse surrogate or claim partial codec coverage.

## Consequences

- M0 can reach its stated application exit using only public kernel exports and
  test-only collaborators, without pretending that an in-memory object map is a
  durable provider.
- D1 may consume the complete-record `RecordStore` port and A1 may implement the
  application stamping path without adding a store-side clock, id generator, or
  codec dependency.
- T06 stays visible as M1 work in the catalog and the nearest test READMEs;
  moving it later requires an executable Markdown/provider test, not a new kernel
  format.
- T15 moves milestone ownership to M0 but is not implemented until a running T1
  test claims it. Catalog accounting remains exact throughout the handoff.

## Rule / follow-up

Keep `@loredu/kernel/testing` out of production imports. M0 test helpers may
support application tests, while M1 conformance tests must separately prove the
published durable `RecordStore` guarantees against each adapter. If a future
consumer needs a provider-neutral interchange format, record that as a new
contract decision rather than inferring it from T06.

Supersedes: the M0 test-support timing sentence in [ADR 0016](./0016-workspace-scaffold-and-kernel-type-isolation.md) and clarifies the T06 evidence timing in [ADR 0019](./0019-m0-validation-rules.md).

This decision is superseded as the complete closure authority by [ADR 0021](./0021-m0-record-contract-closure.md), which retains its M0 seam/T15 and M1 codec/T06 positions while closing the five-family contract and the remaining test-boundary wording.
