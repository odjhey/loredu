---
name: kernel_api_contract
description: "Exact M0 TypeScript entrypoints, exports, ports, constructors, and application assembly API."
type: contract
tags: [contracts, kernel, api, typescript]
generated: "OpenAI coding agent, 2026-08-27"
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

`createInstant` enforces safe-integer epoch milliseconds inside TimeClip range. `createStreamPosition` enforces a nonnegative safe integer; `0` is valid for future empty head, while successful append positions are positive. These constructors let host adapters implement ports without unsafe casts.

Assembly captures exactly one store, clock, random source, and policy. Omitted policy selects `DEFAULT_CLAIM_POLICY`; there is no singleton lookup or per-append override. M0 application exposes only generic `append`, preserving family-specific result narrowing. M0 ClaimPolicy has no `advise`; later policy advice is additive, while generic key-divergence remains core M1.5 mechanics.

`RulesetIdentity` is closed with literal core `loredu.reconciliation/v1` and `{claim_policy:{id,version}}`. `Basis` is closed to `stream_position`, `ruleset`, and `query: JsonObject`; `createBasis` validates, detaches, canonicalizes, and freezes it and rejects `computed_at`.

## Testing entrypoint

`@loredu/kernel/testing` exports exactly three M0 values and no others:

```ts
new InMemoryStore()
new FixedClock(instant: Instant)
new SeededRandomSource(seed: number)
```

Seed is a nonnegative safe integer. Equal initialized instances are deterministic within a released implementation, but the PRNG bytes are not a cross-implementation fixture. Helpers implement normal-entrypoint interfaces. They are absent from the normal entrypoint and production packages cannot import `./testing`. `StoreUnderTest` and reusable conformance exports arrive in M1.

Scaffold-only `AppendResult`, `RecordRef`, `stream`, `head`, and `StoreUnderTest` are not M0 public API.
