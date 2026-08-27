---
name: m0_public_contract_closure
description: "Closes the M0 record, append, store, policy, basis, error, and testing-support semantics before implementation."
type: decision
tags: [decisions, m0, contracts, records, ports]
generated: "OpenAI coding agent, 2026-08-27"
created_at: 2026-08-27T11:46:00+08:00
---

# 0020: Close the M0 public contract before implementation

## Context

M0 could not be implemented independently from the existing contracts: Relation had no endpoint shape; draft defaults, JSON values, timestamps, errors, capability order, the M0 store slice, transport evidence, policy identity, basis identity, and test-helper timing were ambiguous. Issue [#30](https://github.com/odjhey/loredu/issues/30) records the reviewable decision request.

## Options considered

- Leave the details to implementation. Rejected because independently correct implementations would expose incompatible public behavior.
- Pull durable storage, CLI, reconciliation, and projection behavior into M0. Rejected because those remain M1, M1.5, and M2 work.
- Close only the M0 primitives, reject ambiguous data, and preserve later milestone boundaries. Chosen.

## Choice

The governing contracts carry the complete field-level rules. The following closure is normative.

1. A Relation is binary and directed: `relation_type`, one `from`, and one `to`. Endpoints are distinct existing records; `derived_from` is Claim to Claim.
2. A draft requires `kind` and `actor`, may contain `scope`, `metadata`, and `sources`, and must not own `schema`, `id`, or `recorded_at`. Canonical records always contain fresh `scope`, `metadata`, and `sources` containers, defaulting to `{}`, `{}`, and `[]`. Unknown fields reject. Caller `loredu.*` metadata rejects and M0 stamps none.
3. Canonical records are detached recursive copies and recursively frozen. Public types are recursively readonly. Structural, not object, identity is promised.
4. Values are portable JSON data: null, booleans, well-formed Unicode strings, finite numbers except negative zero, dense arrays, and plain data objects. Undefined, non-finite numbers, bigint, symbols, functions, sparse arrays, cycles, platform objects, accessors, symbol keys, and custom prototypes reject. Repeated acyclic aliases and repeated JSON-array elements are legal and copied. Object keys canonicalize by Unicode scalar order; equality ignores object-key order, preserves array order and repeated values, compares exact strings (including whitespace) without normalization, and never coerces types.
5. `Instant` is an integer epoch-millisecond safe integer in the ECMAScript TimeClip range. Canonical timestamps are UTC RFC3339 with exactly three fractional digits. Caller timestamps accept calendar-valid RFC3339 with `T`, seconds 00–59, `Z` or a known offset no greater than 14:00, and one to three optional fractional digits, then normalize. Date-only, local, leap-second, unknown-offset, and finer-than-millisecond values reject. Claim validity satisfies `valid_from <= valid_until`.
6. Field cardinalities, trimming, limits, duplicate handling, and reference kinds are exactly those in the record contract. In particular, Resolution `replacement` is zero or one Claim id, not an array; Verification targets Claims and has a nonempty `SourceRef` basis with every snapshot present.
7. Ten random bytes encode as one MSB-first 80-bit stream using digits `0`–`9` followed by `a b c d e f g h j k m n p q r s t v w x y z`, producing 16 symbols without padding. Collisions surface as duplicate-id failures and are not retried inside an append call.
8. Append order is aggregate draft validation, deterministic reference reads, one entropy call, one clock call, pure construction/freezing, then immediate store append. Failures consume only capabilities already reached and never retry.
9. M0 `RecordStore` is `append(PersistedRecord) -> Promise<StreamPosition>` plus `get(RecordId) -> Promise<PersistedRecord | undefined>`. Application append returns exactly `{record, position}`. `StreamPosition` is an opaque nonnegative safe integer; successful positions are positive and strictly increase, with `0` reserved for an empty future head. Full scan/stream/head/replay/durability/conformance remains M1.
10. M0 exposes storage-neutral encode-to-detached-JSON-value and decode-from-unknown functions. It promises semantic JSON round-trip, not bytes, Markdown, or provider layout.
11. All record references are checked by the application before stamping and append. SourceRefs are external and are never store lookups. This evidence is T19 in M0, not store conformance.
12. `RulesetIdentity` is `{core: "loredu.reconciliation/v1", claim_policy: {id, version}}`; the default policy is `{id: "loredu.default", version: "1"}`. `Basis` is exactly `{stream_position, ruleset, query}`. Query is canonical JSON data; `computed_at` is outside Basis and equality. M0 supplies construction, validation, and equality primitives, not projections.
13. Core constructs the exact declared ClaimKey. A ClaimPolicy may validate/reject it, choose `exclusive|coexisting`, and emit optional mechanical policy advice; it may not transform identity. Default semantics are declared-key, exclusive, and no policy advice. Generic same-value/different-key advice is versioned core mechanics, does not reconcile across keys, and remains M1.5 behavior.
14. Public failures are structured `LoreduError` values with readonly `code`, nonempty `message`, and ordered readonly issues containing stable `code`, RFC6901 `path`, and human message. Validation aggregates safely discoverable issues ordered by path then code; reference issues aggregate in field/index order. Contracts define the stable M0 codes.
15. Runtime validation inspects descriptors without invoking accessors. Accepted containers are normal arrays without holes or extra keys and objects with exactly `Object.prototype` or null prototype; schema fields are enumerable own data properties. Proxies are unsupported and validation is not a hostile-Proxy sandbox.
16. `InMemoryStore`, `FixedClock`, and `SeededRandomSource` ship in M0 only from `@loredu/kernel/testing`; production code may not import that subpath. Full reusable store conformance remains M1.

This decision **partially supersedes** [ADR 0010](./0010-claim-policy-seam.md) only where it allowed policy to “derive” identity or assigned the generic key-divergence hint to default-policy advice. Policy validates the declared key; the generic hint is core mechanics. All other ADR 0010 choices remain.

This decision **partially supersedes** [ADR 0016](./0016-workspace-scaffold-and-kernel-type-isolation.md) only where its scaffold timing deferred the in-memory store/test doubles to M1. The three M0 helpers above now land in M0; type isolation, source exports, and every other ADR 0016 choice remain.

This decision **partially supersedes** [ADR 0019](./0019-m0-validation-rules.md) section 3 only where “insignificant whitespace” could imply whitespace inside string values is removed. JSON transport whitespace outside string tokens disappears during parsing; whitespace inside strings is exact and significant. This decision's JSON-array and exact-string rules govern. ADR 0019 remains historical and otherwise in force.

## Consequences

- CM-A01–A18 are closed for M0. CM-N01–N04 are in M0; CM-N05 remains M1.
- T19 moves to M0. T81 and T82 test only M0 basis/policy primitives. T86 stays M2 although its equality primitive lands in M0.
- T87 provides M0 public assembly/branded-position evidence; narrowed T10 remains M1 full-port cross-adapter conformance. The catalog now contains 67 deferred rows before implementation.
- Contracts remain pre-`current`; two real consumers are still required before stabilization.
- Plain-file bytes/durability/conformance remain M1, CLI and actual generic advice remain M1.5, and reconciliation/projections remain M2.

## Rule / follow-up

M0 implementations must follow the exact contracts and may choose only internal decomposition and algorithms that do not alter accepted values, equality, ordering, capability consumption, exports, or error semantics. The exact two-entrypoint API is fixed by the [kernel API contract](../architecture/contracts/kernel-api.md), including branded `createInstant` and `createStreamPosition`. Implement T01–T08, T19, T80–T85, and T87 through public kernel/testing exports; keep T86 deferred to M2.

Duplicate rejection applies exactly to common `sources`, Claim `derived_from`, Resolution `targets`, Verification `targets`, and Verification `verified_against`. Arbitrary JSON arrays in Claim values or metadata preserve repeated elements and order; future schema arrays require an explicit uniqueness rule.

T87 owns M0 reference/application position evidence: branded positive strictly increasing successful positions, no advancement on failure, exact public assembly, and testing-helper separation. T10 owns M1 reusable conformance over PlainFileStore and M1-complete InMemoryStore, including matching `head`. This changes no graph edge or owner.
