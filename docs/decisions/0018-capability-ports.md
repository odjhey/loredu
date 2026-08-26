---
name: decision_capability_ports
description: "Clock and RandomSource are injected capability ports; the application append path stamps id and recorded_at, and the store receives a complete record and assigns only the stream position."
type: decision
tags: [decisions, contracts, ports, kernel]
generated: "Claude Opus 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T21:00:00+08:00
---

# 0018: Capability ports for time and identity

## Context

Every record carries a kernel-assigned `id` and `recorded_at` ([record contract](../architecture/contracts/records.md)). [Decision 0016](./0016-workspace-scaffold-and-kernel-type-isolation.md) isolates the kernel from host-specific runtime capabilities, which makes assigning those values an application-boundary question rather than a storage implementation detail.

A second question surfaced alongside it. The [store contract](../architecture/contracts/store.md) described `append` as taking a draft and assigning `id` and `recorded_at` at commit, while the record contract and the [M0 plan](../v0.x/execution/implementation-plan.md) place that assignment in the kernel. Both readings are defensible from the prose, and they lead to different systems: one where every storage adapter carries a clock and an id scheme, and one where adapters carry neither. Left ambiguous, independent implementers resolve it independently.

## Options considered

- **Kernel reads time and randomness directly** — ambient wall time would make `recorded_at` nondeterministic under test, and `Math.random()` does not satisfy the production entropy guarantee required for record identity; host cryptographic randomness is outside the kernel environment;
- **the store adapter stamps both** — each adapter needs a clock and an id scheme, and two adapters can disagree about record identity;
- **inject both as capability ports, and stamp in the application append path.**

## Choice

**`Clock` and `RandomSource` are injected capability ports**, supplied when the application core is assembled. Shapes and guarantees: [clock and identity contract](../architecture/contracts/clock-and-identity.md).

**The two ports exist for different reasons, and the distinction is worth keeping visible.** `RandomSource` is required because the kernel must not derive production record identity from `Math.random()` and cannot reach host cryptographic randomness directly; the production assembly supplies qualified random bytes. `Clock` is a discipline because ambient wall time is otherwise reachable without an import; the port makes `recorded_at`, and therefore `as_of`, reproducible under test. Calling them the same kind of incidental helper invites implementations to bypass one or both.

**The kernel owns id format; the port supplies only entropy.** `RandomSource` returns bytes and knows nothing about records; the kernel derives the prefixed id. An adapter cannot substitute an id scheme because it is never asked for an id. The port returns exactly the requested byte count or fails; production assemblies must use a cryptographically strong or equivalently qualified source.

**Id suffix pinned:** 16 symbols of lowercase Crockford base32, 80 bits. The record contract deferred this to M0; pinning it in the contract rather than in code keeps independently-built adapters and fixtures in agreement.

**Stamping happens in the application append path, and the store receives a complete record.** `RecordStore.append` takes a record and returns a stream position — it assigns position and nothing else, and never rewrites `id` or `recorded_at`. This resolves the ambiguity above in favor of the record contract and [decision 0001](./0001-application-core-first.md): storage stays ignorant of record semantics, and there is exactly one stamping point in the system.

**Deterministic substitutes are the same code path.** Two freshly assembled application instances with the same fixed clock and random sources initialized to the same deterministic state yield the same first stamped record for the same draft. Repeated appends in one running instance continue consuming entropy and produce distinct ids. Loredu records are not content-addressed.

## Consequences

- Store contract signature changes from `append(draft) -> record id + stream position` to `append(record) -> stream position`. The application API is what takes a draft. This is a contract change, which is why it is recorded here ([decision 0013](./0013-agent-decision-authority.md)).
- Assembling the application requires supplying two more collaborators. Accepted: they are the price of a kernel whose record construction can be reproduced from explicit inputs.
- `recorded_at` is sampled immediately before the durable store append attempt. It becomes canonical only if `RecordStore.append` succeeds and returns a stream position. It is therefore **not** the exact durability instant; stream position is the canonical append-order/commit fact. `recorded_at` also remains distinct from an actor observation time such as a future `observed_at`.
- `@loredu/kernel/testing` may provide deterministic test implementations such as a fixed clock and seeded random source. The CLI composition root supplies host wall time and secure randomness; an embedded consumer supplies its own implementations. No dedicated clock/random package is introduced.
- Production kernel code must not bypass these ports with calls to `Date.now` or `Math.random`, regardless of supplied arguments, or with zero-argument `new Date()`. This belongs in the existing lightweight workspace structural guard now; it does **not** need to wait for dependency-cruiser issue #18, because import-graph tooling cannot see calls with no import.
- Catalog gains [T84](../v0.x/execution/first-user-journey.md): independently assembled deterministic applications reproduce the same first stamped record, while repeated appends in one instance still produce distinct ids.

## Rule / follow-up

- Contracts of record: [clock and identity](../architecture/contracts/clock-and-identity.md), with [records](../architecture/contracts/records.md) and [store](../architecture/contracts/store.md) updated to match.
- Done: the ambient-capability rule in `tests/workspace-boundary.ts` rejects calls to `Date.now` and `Math.random` regardless of supplied arguments, and zero-argument `new Date()` in kernel production sources, proven RED-then-GREEN in `tests/workspace-structure.test.ts`. Keep dependency-cruiser #18 focused on graph complexity when that complexity justifies it.
- If a future adapter genuinely needs its own identity scheme, that is a superseding record, not a local exception.
