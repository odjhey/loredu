---
name: clock_and_identity_contract
description: "Capability ports for deterministic recorded_at stamping and production-grade record-id entropy. Fixes where in the append path each is called."
type: contract
tags: [architecture, contracts, ports, kernel]
generated: "Claude Opus 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T21:00:00+08:00
---

# Clock and identity ports

Two values on every record are assigned by the kernel and by nothing else: `recorded_at` and `id` ([record contract](./records.md)). The kernel is isolated from host-specific capabilities — no `Bun.*`, no `process`, no `node:*`, and no host globals ([decision 0016](../../decisions/0016-workspace-scaffold-and-kernel-type-isolation.md)). Time and production-grade entropy therefore arrive as **capability ports**, supplied by the caller assembling the application.

```text
Clock         now() -> Instant
RandomSource  nextBytes(count) -> bytes
```

Exact method names are language-specific and are not part of this contract.

## Why ports rather than direct access

The two ports exist for different reasons, and conflating them causes implementations to drift:

- **`RandomSource` is required by the id contract.** ECMAScript does expose `Math.random()`, but Loredu does not accept it as a production identity source: it does not provide the entropy-quality guarantee the record-id contract relies on. Host cryptographic randomness is outside the kernel type environment, so a production assembly must inject a source that can supply sufficiently strong random bytes.
- **`Clock` is a discipline.** A language's own date facility is available without a host-specific import, so a careless implementation could read wall time directly. The port exists so that `recorded_at`, and therefore every `as_of` query, is reproducible under test rather than dependent on when the suite ran.

## Guarantees

- **The kernel owns id format; the port supplies only entropy.** `RandomSource` returns exactly the requested number of bytes or fails. It knows nothing about records. The kernel derives the id, including the three-letter kind prefix and the prefix-agrees-with-kind rule ([record contract](./records.md)). An adapter cannot substitute its own id scheme, because it is never asked for an id.
- **Production entropy is an assembly responsibility.** A production `RandomSource` must provide cryptographically strong or equivalently qualified random bytes for record identity. Deterministic/seeded substitutes are for tests and controlled reproducibility, not a production default.
- **`Clock` returns an instant, not a formatted record field.** Rendering `recorded_at` is kernel work, so a clock adapter cannot change the recorded shape.
- **Both are injected once, at application assembly.** They are constructor/factory inputs to the application core, never global state, never looked up from ambient singletons.
- **Deterministic substitutes use the same code path.** Two freshly assembled application instances given the same draft, the same fixed clock value, and random sources initialized to the same deterministic state produce the same first stamped record. Repeated appends in one running instance continue consuming entropy and therefore produce distinct ids; Loredu records are not content-addressed.
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
- `recorded_at` is the application timestamp sampled immediately before the durable append attempt. It becomes canonical only if `RecordStore.append` succeeds and returns a position. The timestamp is not the exact durability instant; the returned stream position is the canonical ordering/commit fact. A failed append leaves no canonical record, and the stamped values from that attempt are discarded.
- A caller-supplied `recorded_at` is rejected by the application API rather than quietly overwritten — the draft type has no such field, and the runtime guard refuses objects carrying one anyway, because types erase.

## Assembly and test placement

Do not create dedicated clock/random packages for v0.x.

- `@loredu/kernel/testing` may provide deterministic helpers such as `FixedClock` and `SeededRandomSource` for kernel/application tests.
- The `lor` CLI composition root supplies host implementations for wall time and secure randomness when it assembles the application.
- An embedded M4 consumer supplies its own implementations at its composition boundary.

These are capability implementations around the kernel, not new runtime dependencies of `@loredu/kernel`.

## Capability bypass guard

The port contract is only meaningful if production kernel code cannot silently bypass it. The existing workspace structural guard should reject direct ambient time/randomness access such as `Date.now()`, zero-argument `new Date()`, and `Math.random()` in `packages/kernel` production sources. This is separate from dependency-cruiser issue #18: import-graph tooling cannot see calls that require no import. Temporal parsing/construction from an explicit value (for example `new Date(value)` if implementation needs it) is not the same as reading ambient wall time.

## Related

- [Record contract](./records.md) — envelope, the draft/persisted split, time ownership
- [Store port](./store.md) — what the store does and does not assign
- [Decision 0018](../../decisions/0018-capability-ports.md) — why these are ports, and the boundary it fixes
- [Decision 0016](../../decisions/0016-workspace-scaffold-and-kernel-type-isolation.md) — the kernel type environment

Parent index: [contracts](./README.md)
