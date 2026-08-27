---
name: clock_and_identity_contract
description: "Capability ports for deterministic recorded_at stamping and production-grade record-id entropy. Fixes where in the append path each is called."
type: contract
tags: [architecture, contracts, ports, kernel]
generated: "Claude Opus 5, OpenAI coding agent, and ChatGPT GPT-5.6 Sol, 2026-08-28"
created_at: 2026-08-26T21:00:00+08:00
---

# Clock and identity ports

The kernel alone renders `recorded_at` and record ids, using injected capabilities:

```ts
interface Clock { now(): Instant }
interface RandomSource { nextBytes(count: number): Uint8Array }
function createInstant(epochMilliseconds: number): Instant
```

Both capability calls are synchronous. `Instant` is an opaque branded safe-integer number of milliseconds since Unix epoch in inclusive `-62_167_219_200_000..253_402_300_799_999`. The extrema render as `0000-01-01T00:00:00.000Z` and `9999-12-31T23:59:59.999Z`. Host adapters construct it through validating `createInstant`; ordinary numbers are not assignable. The application also validates every actual `Clock.now()` result at runtime against this domain. The kernel renders every accepted Instant as canonical UTC RFC3339 with exactly four year digits and three fractional digits: `YYYY-MM-DDTHH:mm:ss.sssZ`. The clock returns an instant, never formatted record text.

RandomSource supplies exactly the requested bytes or fails and knows nothing about ids. A successful `nextBytes(10)` result is an actual Uint8 element typed array compatible with `Uint8Array`, of length exactly ten; ordinary arrays, array-like values, clamped or wider typed arrays, and `DataView` do not satisfy the port. Production assembly supplies qualified cryptographic entropy; seeded sources are test-only. Both ports are injected once at application assembly, are never ambient/global/store dependencies, and do not permit `Date.now()`, zero-argument `new Date()`, or `Math.random()` bypasses in production kernel source.

## Record id format

```text
<kind-prefix>_<16 symbols>
```

The alphabet by index is digits `0`–`9`, then `a b c d e f g h j k m n p q r s t v w x y z`. Treat the ten bytes as one unsigned 80-bit bit stream in byte order, most-significant byte and bit first. Emit consecutive 5-bit groups from most to least significant, without padding:

```text
00 00 00 00 00 00 00 00 00 00 -> 0000000000000000
ff ff ff ff ff ff ff ff ff ff -> zzzzzzzzzzzzzzzz
00 44 32 14 c7 42 54 b6 35 cf -> 0123456789abcdef
```

The kind prefix is `ent|clm|rel|res|ver`; suffixes carry no structure. Store duplicate rejection is the second defense. On a collision, append fails with `DUPLICATE_RECORD_ID`: no retry and no second entropy/clock call within that invocation. A new caller invocation is a new attempt.

## Exact append order and failure consumption

One application append call performs:

1. complete descriptor-safe structural validation and, for a structurally valid Claim, the custom-policy validation/semantics phase specified by the [kernel API contract](./kernel-api.md);
2. read and aggregate record references in deterministic field/index order;
3. call `RandomSource.nextBytes(10)` exactly once and format the id;
4. call `Clock.now()` exactly once and render canonical time;
5. perform only pure synchronous construction, detachment, and deep freezing;
6. immediately call `RecordStore.append(record)`.

No external capability or store operation occurs after Clock and before append. Validation failure consumes no reads, entropy, time, or append. Reference failure consumes reads but no entropy/time. Random failure consumes no clock/store call. Clock failure consumes entropy but no append. Store rejection consumes both values and does not retry. Rejection before provider publication publishes no record; an M1 durable provider has the narrow uncertain whole-record outcome after atomic publication but before acknowledgement fixed by [decision 0022](../../decisions/0022-m1-store-and-plain-file-contract.md), recovered by checking the attempted id.

Operational errors are owned by the phase that encountered them. A RandomSource throw or malformed entropy result maps to a fresh `RANDOM_SOURCE_FAILED`; a Clock throw or runtime result outside the Instant domain maps to `CLOCK_FAILED`; and any store throw maps to `STORE_APPEND_FAILED` except an exact `DUPLICATE_RECORD_ID`, which passes through. Foreign `LoreduError` codes, issues, causes, and messages do not leak through these mappings. The fresh M1 store-failure human message identifies the attempted stamped record id so an uncertain durable-provider outcome can be checked, but message wording is not a compatibility surface. No later phase runs after such a failure.

Two fresh applications with the same draft, fixed Instant, and identically initialized deterministic source produce the same first stamped record. Sequential appends consume new entropy. `SeededRandomSource` does not promise a cross-runtime PRNG sequence; the byte-to-id fixtures above are the public encoding contract.

## Placement

M0 exports `FixedClock` and `SeededRandomSource`, alongside `InMemoryStore`, only from `@loredu/kernel/testing`. Production code cannot import the testing subpath. CLI and future embedded consumers provide host capabilities at their composition roots; no dedicated clock/random package exists.

Related: [records](./records.md), [store](./store.md), [ADR 0018](../../decisions/0018-capability-ports.md), [ADR 0020](../../decisions/0020-m0-public-contract-closure.md), [ADR 0021](../../decisions/0021-strict-rfc3339-instant-domain.md), [ADR 0022](../../decisions/0022-m1-store-and-plain-file-contract.md), [ADR 0025](../../decisions/0025-m0-application-append-phase-boundaries.md).
