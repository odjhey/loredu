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

Every record carries a kernel-assigned `id` and `recorded_at` ([record contract](../architecture/contracts/records.md)). [Decision 0016](./0016-workspace-scaffold-and-kernel-type-isolation.md) gives the kernel a type environment with no host globals at all, which makes the mechanics of assigning those two values a design question rather than an implementation detail: the kernel has no clock and no source of randomness within reach.

A second question surfaced alongside it. The [store contract](../architecture/contracts/store.md) described `append` as taking a draft and assigning `id` and `recorded_at` at commit, while the record contract and the [M0 plan](../v0.x/execution/implementation-plan.md) place that assignment in the kernel. Both readings are defensible from the prose, and they lead to different systems: one where every storage adapter carries a clock and an id scheme, and one where adapters carry neither. Left ambiguous, independent implementers resolve it independently.

## Options considered

- **Kernel reads time and randomness directly** — impossible for randomness under decision 0016, and it would make `recorded_at` untestable;
- **the store adapter stamps both** — each adapter needs a clock and an id scheme, and two adapters can disagree about record identity;
- **inject both as capability ports, and stamp in the application append path.**

## Choice

**`Clock` and `RandomSource` are injected capability ports**, supplied when the application core is assembled. Shapes and guarantees: [clock and identity contract](../architecture/contracts/clock-and-identity.md).

**The two ports exist for different reasons, and the distinction is worth keeping visible.** `RandomSource` is a *necessity* — with no host types in scope there is no secure random to call. `Clock` is a *discipline* — a language's own date facility usually lives in the standard library and would compile inside the kernel, so the port is what makes `recorded_at`, and therefore every `as_of` query, reproducible instead of dependent on when the suite ran. Calling them the same kind of thing invites an implementation that treats the clock as optional.

**The kernel owns id format; the port supplies only entropy.** `RandomSource` returns bytes and knows nothing about records; the kernel derives the prefixed id. An adapter cannot substitute an id scheme because it is never asked for an id.

**Id suffix pinned:** 16 symbols of lowercase Crockford base32, 80 bits. The record contract deferred this to M0; pinning it in the contract rather than in code keeps independently-built adapters and fixtures in agreement.

**Stamping happens in the application append path, and the store receives a complete record.** `RecordStore.append` takes a record and returns a stream position — it assigns position and nothing else, and never rewrites `id` or `recorded_at`. This resolves the ambiguity above in favor of the record contract and [decision 0001](./0001-application-core-first.md): storage stays ignorant of record semantics, and there is exactly one stamping point in the system.

**Deterministic substitutes are the same code path.** A fixed clock and a seeded random source yield byte-identical records for the same draft. Tests get different ports, never a different append path.

## Consequences

- Store contract signature changes from `append(draft) -> record id + stream position` to `append(record) -> stream position`. The application API is what takes a draft. This is a contract change, which is why it is recorded here ([decision 0013](./0013-agent-decision-authority.md)).
- Assembling the application requires supplying two more collaborators. Accepted: they are the price of a kernel that can be fully determined by its inputs.
- `recorded_at` is stamped immediately before the store call, so it means *when the kernel committed this to canonical history* — not when the caller observed the thing, which is what `observed_at` would be if it is ever needed.
- Nothing yet prevents kernel code from calling the ambient date facility directly, since that would typecheck. The structural test scans kernel sources for environment *imports* only. A source scan for direct time and randomness access is the natural extension, and belongs with the boundary-checker work (#18).
- Catalog gains [T84](../v0.x/execution/first-user-journey.md): the same draft with a fixed clock and seeded random source produces an identical record.

## Rule / follow-up

- Contracts of record: [clock and identity](../architecture/contracts/clock-and-identity.md), with [records](../architecture/contracts/records.md) and [store](../architecture/contracts/store.md) updated to match.
- If a future adapter genuinely needs its own identity scheme, that is a superseding record, not a local exception.
