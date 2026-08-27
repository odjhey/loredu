---
name: kernel_api_contract
description: "Exact M0 kernel surface plus the additive M1 RecordStore and reusable testing-conformance exports."
type: contract
tags: [contracts, kernel, api, typescript]
generated: "OpenAI coding agent and ChatGPT GPT-5.6 Sol, 2026-08-28"
created_at: 2026-08-27T12:30:00+08:00
---

# Kernel API contract

At M0 completion `@loredu/kernel` publishes exactly `.` and `./testing`. Consumers use only these entrypoints; deep imports are unsupported. Names not listed here are internal. Future public additions require a contract/ADR update.

## Normal entrypoint

Runtime values, exactly:

```text
RECORD_SCHEMA_ID
RECORD_ID_PREFIX
recordKindOfIdPrefix
LoreduError
decodeRecordDraft
decodePersistedRecord
encodePersistedRecord
jsonValuesEqual
claimKeyOf
claimKeysEqual
createInstant
createStreamPosition
createRulesetIdentity
createBasis
basisEquals
DEFAULT_CLAIM_POLICY
DEFAULT_RULESET_IDENTITY
createLoreduApplication
```

Type-only exports, exactly:

```text
RecordSchemaId RecordKind RecordIdPrefix RecordId
EntryId ClaimId RelationId ResolutionId VerificationId
JsonPrimitive JsonValue JsonObject ActorType Actor Scope Metadata SourceRef
Confidence RelationType ResolutionDecision VerificationResult
EntryDraft ClaimDraft RelationDraft ResolutionDraft VerificationDraft RecordDraft
Entry Claim Relation Resolution Verification PersistedRecord PersistedRecordFor
ClaimKey ClaimSemantics ClaimPolicy Instant Clock RandomSource StreamPosition RecordStore
RulesetIdentity Basis LoreduErrorCode LoreduIssueCode LoreduIssue AppendRecordResult
LoreduApplicationDependencies LoreduApplication
```

Family ids, `Instant`, and `StreamPosition` are opaque branded types. Ordinary strings/numbers are not assignable without validated public construction/behavior.

## Exact API

```ts
interface Clock { now(): Instant }
interface RandomSource { nextBytes(count: number): Uint8Array }
interface RecordStore {
  append(record: PersistedRecord): Promise<StreamPosition>
  get(id: RecordId): Promise<PersistedRecord | undefined>
}

type ClaimSemantics = "exclusive" | "coexisting"
interface ClaimPolicy {
  readonly id: string
  readonly version: string
  validateClaimKey(key: ClaimKey): readonly LoreduIssue[]
  semantics(key: ClaimKey): ClaimSemantics
}

interface LoreduApplicationDependencies {
  readonly store: RecordStore
  readonly clock: Clock
  readonly randomSource: RandomSource
  readonly claimPolicy?: ClaimPolicy
}
type PersistedRecordFor<D extends RecordDraft> =
  D extends EntryDraft ? Entry :
  D extends ClaimDraft ? Claim :
  D extends RelationDraft ? Relation :
  D extends ResolutionDraft ? Resolution :
  D extends VerificationDraft ? Verification :
  never

interface AppendRecordResult<R extends PersistedRecord = PersistedRecord> {
  readonly record: R
  readonly position: StreamPosition
}
interface LoreduApplication {
  append<D extends RecordDraft>(draft: D):
    Promise<AppendRecordResult<PersistedRecordFor<D>>>
}
function createLoreduApplication(
  dependencies: LoreduApplicationDependencies,
): LoreduApplication

function recordKindOfIdPrefix(prefix: string): RecordKind | undefined
function decodeRecordDraft(input: unknown): RecordDraft
function decodePersistedRecord(input: unknown): PersistedRecord
function encodePersistedRecord(record: PersistedRecord): JsonObject
function jsonValuesEqual(left: JsonValue, right: JsonValue): boolean
function claimKeyOf(claim: Claim | ClaimDraft): ClaimKey
function claimKeysEqual(left: ClaimKey, right: ClaimKey): boolean
function createInstant(epochMilliseconds: number): Instant
function createStreamPosition(value: number): StreamPosition
function createRulesetIdentity(policy: ClaimPolicy): RulesetIdentity
function createBasis(input: Basis): Basis
function basisEquals(left: Basis, right: Basis): boolean
```

`recordKindOfIdPrefix` accepts only the exact prefix strings `ent`, `clm`, `rel`, `res`, and `ver`, returning respectively `entry`, `claim`, `relation`, `resolution`, and `verification`. Every other string returns `undefined`; the function does not accept a trailing underscore and performs no case folding, trimming, or other normalization.

`createInstant` enforces safe-integer epoch milliseconds in inclusive `-62_167_219_200_000..253_402_300_799_999`, the exact range that renders canonical four-digit-year RFC3339 from `0000-01-01T00:00:00.000Z` through `9999-12-31T23:59:59.999Z`. Application append validates the actual runtime return from every custom Clock against the same domain; branding is not a runtime trust grant. `createStreamPosition` enforces a nonnegative safe integer; `0` is valid for future empty head, while successful append positions are positive. These constructors let host adapters implement ports without unsafe casts.

The runtime port boundary enforces the declared `Uint8Array` return: entropy is an actual Uint8 element typed array of exactly the requested length, without array or typed-array coercion. Capability and store failures are normalized to their phase-owned operational codes; only an exact store `DUPLICATE_RECORD_ID` passes through.

Assembly captures exactly one store, clock, random source, and policy. Omitted policy selects `DEFAULT_CLAIM_POLICY`; there is no singleton lookup or per-append override. M0 application exposes only generic `append`, preserving family-specific result narrowing. M0 ClaimPolicy has no `advise`; later policy advice is additive, while generic key-divergence remains core M1.5 mechanics.

Policy assembly and `createRulesetIdentity` are runtime validation boundaries ([decision 0024](../../decisions/0024-m0-policy-and-basis-runtime-boundaries.md)). Policy `id` and `version` are identifier-safe tokens, both callbacks are callable, and public own fields are closed to the four interface fields. An `identity` field rejects without invocation rather than restoring the superseded remapping seam; `advise`/`advisories` fields likewise reject in M0. Ruleset construction snapshots id/version and invokes no callback. The default policy is frozen, validates the closed declared ClaimKey shape into frozen ordered issues, always selects `exclusive`, and has no identity or advice member.

Generic Claim append follows [decision 0025](../../decisions/0025-m0-application-append-phase-boundaries.md): assembly captures the validated callback functions and receiver; append calls `validateClaimKey` once with the core-constructed frozen declared key; and only an empty, descriptor-safe exact `LoreduIssue[]` result permits one `semantics` call. Returned policy issues reject before references, and semantics must be exactly `exclusive|coexisting`. Callback throws, malformed issue arrays, malformed issue objects/pointers, and unsupported semantics become fresh `VALIDATION_FAILED` failures without foreign details. A rejecting validator consumes no semantics call, and neither callback can remap identity.

`RulesetIdentity` is closed with literal core `loredu.reconciliation/v1` and `{claim_policy:{id,version}}`. `Basis` is closed to `stream_position`, `ruleset`, and `query: JsonObject`; `createBasis` validates descriptors and exact nested shapes, detaches, canonicalizes, and freezes it and rejects `computed_at` with `VALIDATION_FAILED`. `basisEquals` compares constructed values across stream position, both structural ruleset components, and portable-JSON query equality; it does not repair forged malformed values.

## Testing entrypoint

`@loredu/kernel/testing` exports exactly three M0 values and no others:

```ts
new InMemoryStore()
new FixedClock(instant: Instant)
new SeededRandomSource(seed: number)
```

Seed is a nonnegative safe integer. Equal initialized instances are deterministic within a released implementation, but the PRNG bytes are not a cross-implementation fixture. Helpers implement normal-entrypoint interfaces. They are absent from the normal entrypoint and production packages cannot import `./testing`. `StoreUnderTest` and reusable conformance exports arrive in M1.

Scaffold-only `AppendResult`, `RecordRef`, `stream`, `head`, and `StoreUnderTest` are not M0 public API.

## Additive M1 surface

[Decision 0022](../../decisions/0022-m1-store-and-plain-file-contract.md) adds no entrypoint and no normal-entrypoint runtime value. It adds these type-only normal exports exactly:

```text
RecordFilter PositionedRecord RecordScan RecordStreamOptions
```

At M1, `RecordStore` is replaced by its additive full-port shape:

```ts
interface RecordFilter {
  readonly kinds?: readonly RecordKind[]
}
interface PositionedRecord {
  readonly position: StreamPosition
  readonly record: PersistedRecord
}
interface RecordScan {
  readonly head: StreamPosition
  readonly records: readonly PositionedRecord[]
}
interface RecordStreamOptions {
  readonly after?: StreamPosition
}
interface RecordStore {
  append(record: PersistedRecord): Promise<StreamPosition>
  get(id: RecordId): Promise<PersistedRecord | undefined>
  scan(filter?: RecordFilter): Promise<RecordScan>
  stream(options?: RecordStreamOptions): AsyncIterable<PositionedRecord>
  head(): Promise<StreamPosition>
}
```

The complete snapshot/filter/replay semantics are in the [store contract](./store.md). Stable M1 top-level error-code additions are `STREAM_POSITION_OUT_OF_RANGE`, `STORE_NOT_FOUND`, `STORE_ALREADY_EXISTS`, `STORE_LOCKED`, `STORE_CORRUPT`, and `STORE_IO_FAILED`; adapter methods report them as structured `LoreduError` values. Application append continues to pass through only exact `DUPLICATE_RECORD_ID` and normalizes other append-phase provider failures to `STORE_APPEND_FAILED` at the application boundary. The fresh failure's M1 human message identifies the attempted stamped id for uncertain-outcome recovery without leaking provider code/cause/message; message wording remains non-stable.

M1 adds exactly one testing runtime value:

```ts
function recordStoreConformance(
  subject: StoreUnderTest,
): readonly RecordStoreConformanceCase[]
```

and exactly three testing type exports:

```ts
interface RecordStoreFixture {
  readonly store: RecordStore
  dispose(): Promise<void>
}
interface StoreUnderTest {
  readonly name: string
  create(): Promise<RecordStoreFixture>
}
interface RecordStoreConformanceCase {
  readonly name: string
  run(): Promise<void>
}
```

`recordStoreConformance` is runner-neutral: it returns bound named async cases and imports no Bun/Node runner API. Each case owns a fresh empty fixture and always disposes it. `InMemoryStore` becomes M1-complete under the same `RecordStore` interface; `FixedClock` and `SeededRandomSource` are unchanged. No conformance or helper value moves to the normal entrypoint.
