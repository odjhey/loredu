---
name: clock_and_identity_contract
description: "Capability ports the kernel needs but cannot reach for itself: Clock for recorded_at and RandomSource for record id entropy. Fixes where in the append path each is called."
type: contract
tags: [architecture, contracts, ports, kernel]
generated: "Claude Opus 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T21:00:00+08:00
---

# Clock and identity ports

Two values on every record are assigned by the kernel and by nothing else: `recorded_at` and `id` ([record contract](./records.md)). The kernel is a pure domain layer with no ambient environment — no `Bun.*`, no `process`, no `node:*`, and no host globals ([decision 0016](../../decisions/0016-workspace-scaffold-and-kernel-type-isolation.md)) — so it cannot read a clock or draw randomness on its own. Both arrive as **capability ports**, supplied by the caller assembling the application.

```text
Clock         now() -> Instant
RandomSource  nextBytes(count) -> bytes
```

Exact method names are language-specific and are not part of this contract.

## Why ports rather than direct access

The two ports exist for different reasons, and conflating them causes implementations to drift:

- **`RandomSource` is a necessity.** With no host types in scope, the kernel has no `crypto`, no secure random, nothing. Entropy must be handed in or record ids cannot exist.
- **`Clock` is a discipline.** A language's own date facility is typically part of the standard library and would compile inside the kernel — so nothing stops a careless implementation from reading the wall clock directly. The port exists so that `recorded_at`, and therefore every `as_of` query, is reproducible under test rather than dependent on when the suite ran.

## Guarantees

- **The kernel owns id format; the port supplies only entropy.** `RandomSource` returns bytes and knows nothing about records. The kernel derives the id, including the three-letter kind prefix and the prefix-agrees-with-kind rule ([record contract](./records.md)). An adapter cannot substitute its own id scheme, because it is never asked for an id.
- **`Clock` returns an instant, not a formatted record field.** Rendering `recorded_at` is kernel work, so a clock adapter cannot change the recorded shape.
- **Both are injected once, at application assembly.** They are constructor/factory inputs to the application core, never global state, never re-read per call site.
- **Deterministic substitutes are the same code path.** A fixed clock and a seeded random source produce byte-identical records for the same draft. Tests do not get a special append path; they get different ports.
- **Neither port is a storage concern.** A `RecordStore` adapter never receives, calls, or needs either one.

## Record id format

The [record contract](./records.md) leaves suffix length and alphabet to implementation. Pinned here so independently-built adapters and fixtures agree:

```text
<kind-prefix>_<16 symbols>       ent_3k9f2r7w4q8x5n6t
```

- **Alphabet**: lowercase Crockford base32 — digits `0`–`9` and letters `a`–`z` excluding `i`, `l`, `o`, `u`. Thirty-two symbols, chosen so ids survive being read aloud, retyped, and pasted into paths and URLs without ambiguity.
- **Length**: 16 symbols, 80 bits of entropy. Comfortably beyond collision concern at any store size this kernel targets, and short enough to appear in CLI output without wrapping.
- **No structure in the suffix.** No timestamp, no counter, no shard hint. Ordering comes from `recorded_at` and stream positions; nothing may parse an id beyond its prefix.
- **Duplicate ids are still rejected at the store boundary** ([store contract](./store.md)) — entropy is the first defense, not the only one.

## Where each port is called

The append path has exactly one stamping point. This is the boundary a caller can rely on:

```text
caller
  │  EntryDraft            (no id, no recorded_at — the fields do not exist)
  ▼
application append
  │  validate draft, check reference-before-referrer
  │  recorded_at ← Clock.now()
  │  id          ← kernel format over RandomSource.nextBytes()
  ▼
RecordStore.append(record)  ── complete record in, stream position out
  │
  ▼
persisted record + stream position
```

- The **application** layer stamps. The **store** receives a complete record and assigns only the stream position; it never fabricates or rewrites `id` or `recorded_at`, and reads return exactly what was appended.
- `recorded_at` is stamped immediately before the record is handed to the store, so it reads as *when the kernel committed this to canonical history*. A record whose append does not return a position never entered history, and its stamped values are discarded with it.
- A caller-supplied `recorded_at` is rejected by the application API rather than quietly overwritten — the draft type has no such field, and the runtime guard refuses objects carrying one anyway, because types erase.

## Related

- [Record contract](./records.md) — envelope, the draft/persisted split, time ownership
- [Store port](./store.md) — what the store does and does not assign
- [Decision 0018](../../decisions/0018-capability-ports.md) — why these are ports, and the boundary it fixes
- [Decision 0016](../../decisions/0016-workspace-scaffold-and-kernel-type-isolation.md) — the kernel type environment that makes them necessary

Parent index: [contracts](./README.md)
