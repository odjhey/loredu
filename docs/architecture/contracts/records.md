---
name: record_contract
description: "Immutable Loredu record envelope and the Entry, Claim, Relation, Resolution, and Verification record families."
type: contract
tags: [contracts, records, provenance]
generated: "ChatGPT GPT-5.6 Sol and OpenAI coding agent, 2026-08-28"
created_at: 2026-08-26T12:10:00+08:00
---

# Record contract

[Decision 0020](../../decisions/0020-m0-public-contract-closure.md) closes the M0 runtime contract below. This contract is agreed but remains pre-`current` until it has two real consumers.

## Closed envelopes

A draft is a plain-data object requiring `kind` and `actor`. It may carry the family payload plus common `scope`, `metadata`, and `sources`. It has no `schema`, `id`, or `recorded_at`; any such own property, even `undefined`, fails with `RESERVED_FIELD`. The application creates this exact persisted common envelope:

```yaml
schema: loredu.record/v1
kind: entry | claim | relation | resolution | verification
id: ent_0123456789abcdef
recorded_at: 2026-08-26T04:00:00.000Z
actor: { type: agent, id: example.agent }
scope: {}
metadata: {}
sources: []
```

Absent draft `scope`, `metadata`, and `sources` become fresh `{}`, `{}`, and `[]`. All three are always present in a persisted record. No other defaulting or normalization occurs. `sources` is common provenance for every family. Every envelope, payload, Actor, Subject, SourceRef, and verification-basis object is closed: excess fields reject rather than being discarded. Namespaced metadata is the sole v1 extension bag.

The public model is a closed discriminated union. Every record reference must be a complete id whose prefix matches its referenced kind:

```text
ent_ entry   clm_ claim   rel_ relation   res_ resolution   ver_ verification
```

The suffix is exactly 16 lowercase Crockford symbols as defined by the [clock and identity contract](./clock-and-identity.md). It is opaque and contains no time, order, shard, or domain meaning.

## Runtime data boundary and immutability

Draft and decoder containers are inert data. Arrays must have the normal array prototype, be dense, and have no extra own keys. Objects must have exactly `Object.prototype` or null prototype. Schema fields are enumerable own data properties. Validation rejects accessors without invoking them, symbol keys, non-enumerable extras, custom prototypes, array holes/extra properties, and every excess string key. Descriptor/prototype inspection failures are validation failures. Proxies are unsupported; this boundary is not a sandbox against hostile Proxies.

Claim and metadata values use the portable JSON domain recursively: `null`, booleans, well-formed Unicode scalar strings, finite ECMAScript numbers except `-0`, dense arrays, and plain data objects. Reject `undefined`, `NaN`, infinities, `-0`, bigint, symbols, functions, cycles, Date/Map/Set/typed arrays/class instances, accessors, symbol keys, custom prototypes, and unpaired surrogates. A repeated acyclic alias is legal and copied by value. Own enumerable data keys such as `__proto__`, `constructor`, and `prototype` are ordinary portable JSON keys and are preserved without invoking prototype setters or changing any prototype; object-literal `__proto__` that actually creates a custom input prototype still rejects.

Canonicalization orders dynamic-map keys by Unicode-scalar lexicographic comparison: compare code points at the first difference, with a shorter equal prefix first. Native UTF-16 code-unit sorting is insufficient. This traversal applies to JsonObject, Metadata, Scope/ClaimKey scope, and Basis query maps; fixed-schema object fields keep schema-defined order. It does not promise raw `Object.keys` or `JSON.stringify` byte order. Structural equality ignores object-property order, compares key sets and values recursively, preserves array order and repeated elements, compares strings exactly—including internal/edge whitespace—without normalization/case-folding/trimming, and compares numbers by exact ECMAScript numeric value without coercion. Thus `["a", "a"]` is valid and differs from `["a"]`, and `1 !== "1"`. JSON syntax whitespace outside string tokens disappears during parsing; it is not value whitespace. Every accepted mutable container is recursively copied into canonical plain containers and the complete output is recursively frozen. Public types are recursively readonly. Draft mutation cannot alter the store input, append result, or later `get`; decoder and store reads return canonical deeply frozen records. Object identity is not promised, structural identity is.

M0 exports `decodeRecordDraft(input: unknown)`, `decodePersistedRecord(input: unknown)`, and `encodePersistedRecord(record: PersistedRecord): JsonObject`. `encodePersistedRecord → JSON.stringify → JSON.parse → decodePersistedRecord` preserves semantics, repeated nested metadata-array elements, and unknown non-`loredu.*` namespaced metadata recursively. This promises neither JSON byte identity nor Markdown/frontmatter/provider layout.

## Shared field rules

Lengths count Unicode scalar values.

- Identifier-safe tokens use the following shape, maximum 128. They are rejected, never lowercased or trimmed. This applies to Actor id, Subject type/id, predicate, perspective, scope keys/values, open `entry_type`/`claim_class`, and policy identity tokens.

  ```text
  ^[a-z0-9]([a-z0-9._:/-]*[a-z0-9])?$
  ```
- Actor is required and exactly `{type, id}`; type is `human|agent|program|system`.
- Scope is a flat unordered token-to-token map. Absent and `{}` are identical. Claim-key equality compares its pair set independent of insertion order.
- Metadata keys are `<namespace>.<name>` with token-safe halves. Caller-supplied `loredu.*` keys reject; M0 stamps no reserved metadata. Values use the JSON domain. Unknown other namespaces are preserved verbatim.
- SourceRef is exactly `{ref, locator?, snapshot?}`. `ref` and optional `locator` are trimmed, nonempty strings of at most 1024 scalars; optional `snapshot` is trimmed, nonempty, and at most 256. Optional means the own property may be absent; when present, including with `undefined`, it must validate as its declared type. This present-own rule applies to every optional schema field, including Entry `title` and `entry_type`. A missing SourceRef `ref` is `REQUIRED`; present-own `ref: undefined` is `TYPE`.
- Every array is dense and preserves caller order. Duplicate rejection applies exactly to the five set-like schema arrays: common `sources`, Claim `derived_from`, Resolution `targets`, Verification `targets`, and Verification `verified_against`. Arbitrary JSON arrays in Claim values and metadata allow and preserve repeats. Future schema arrays have no implicit uniqueness rule. There is no arbitrary M0 maximum cardinality.
- Closed vocabularies reject unknown values: record kind, Actor type, Relation type, Resolution decision, Verification result, and confidence. Optional `entry_type` and `claim_class` are open identifier-safe vocabularies.
- Unknown persisted schemas fail with `UNKNOWN_SCHEMA`; malformed/excess persisted fields fail validation.

## Timestamp

An accepted caller timestamp is calendar-valid RFC3339 with exactly four year digits, `T`, seconds `00`–`59`, `Z` or a numeric known offset no greater than `14:00`, and optional one-to-three fractional digits. After applying the explicit offset it must remain inside the inclusive Instant range `-62_167_219_200_000..253_402_300_799_999`, and it normalizes to UTC with exactly milliseconds: `YYYY-MM-DDTHH:mm:ss.sssZ`. Date-only, expanded-year, local/no-offset, leap-second, unknown `-00:00` offset, invalid calendar/offset, out-of-range normalized instant, and greater-than-millisecond precision reject. `recorded_at` is rendered from the injected epoch-millisecond Instant; `effective_at`, `valid_from`, and `valid_until` use the same canonical timestamp type. When both validity bounds exist, `valid_from <= valid_until`.

## Families

### Entry

Entry requires `body`: at least one non-whitespace Unicode scalar, preserved exactly as a JavaScript string, with no kernel maximum. Optional `title` is trimmed, nonempty, and at most 256. Optional `entry_type` is an open token.

```yaml
kind: entry
body: "Exact free text."
title: optional short title
entry_type: optional-open-token
```

### Claim

Claim requires exact `subject: {type, id}`, `predicate`, JSON-domain `value` (including `null`), and `confidence`. Optional fields are `claim_class`, `perspective`, `valid_from`, and `valid_until`. `derived_from` defaults to `[]`; when nonempty it contains unique Entry ids.

```yaml
kind: claim
subject: { type: code-area, id: command-registration }
predicate: location
value: src/commands
confidence: observed
derived_from: [ent_0123456789abcdef]
```

The exact declared ClaimKey is `(scope, subject.type, subject.id, predicate, perspective?)`. Core constructs it from persisted fields. A ClaimPolicy may validate or reject it but cannot normalize, replace, merge, split, or return another key. The M0 runtime rejects an `identity` member at policy assembly and ruleset construction rather than retaining a remapping callback ([decision 0024](../../decisions/0024-m0-policy-and-basis-runtime-boundaries.md)). The built-in policy validates this closed declared shape and selects `exclusive`; generic Claim append executes custom validation and semantics before reference reads under the [kernel API contract](./kernel-api.md). Reconciliation never crosses exact keys. Unkeyed knowledge is an Entry.

### Relation

Relation is a binary directed edge:

```yaml
kind: relation
relation_type: supports | contradicts | duplicates | supersedes | derived_from | related_to
from: clm_0123456789abcdef
to: clm_fedcba9876543210
```

`from` and `to` are ordered, distinct, complete ids of existing records. All initial types may connect any persisted family except `derived_from`, which requires Claim `from` and Claim `to`. Direction remains canonical even if a projection later interprets a type symmetrically. v1 has no self-edge, multi-endpoint relation, or endpoint list.

### Resolution

Resolution requires a nonempty unique `targets` array of Claim-or-Relation ids, a closed `decision`, and `reason`: trimmed, nonempty, at most 4096. Optional `replacement` is one Claim id (a scalar, never an array); optional `effective_at` is canonical time.

```yaml
kind: resolution
targets: [clm_0123456789abcdef]
decision: prefer | supersede | retract | leave_disputed
replacement: clm_fedcba9876543210
reason: verified against the cited snapshot
```

The reason is an auditable rationale, not hidden chain-of-thought.

### Verification

Verification requires nonempty unique Claim-id `targets`, a nonempty `verified_against` SourceRef array, and closed `result`. Every verification-basis SourceRef requires `snapshot`; complete SourceRef equality determines duplicates. Common `sources` separately records provenance for the act of verification.

```yaml
kind: verification
targets: [clm_0123456789abcdef]
verified_against:
  - ref: https://example.test/source
    snapshot: revision-7
result: confirmed | contradicted | unchanged | needs_revalidation
```

A source or projection is not a persisted Verification target in `loredu.record/v1`; represent the proposition as a Claim or use a future schema.

## Reference and append rules

Before stamping, application append validates every record id for complete shape and field-specific kind, then reads references sequentially in deterministic field/index order. It checks Claim `derived_from`; Relation `from` then `to`; Resolution `targets` then `replacement`; and Verification `targets`. Every referent must already exist and have the required kind; the returned family must also agree with the complete id prefix, including on Relation fields that otherwise permit every family. Missing and wrong-kind results aggregate in traversal order. A store-read throw or malformed returned record stops this phase as a fresh `REFERENCE_CHECK_FAILED` without leaking foreign details. SourceRefs are external evidence and are never RecordStore lookups ([decision 0025](../../decisions/0025-m0-application-append-phase-boundaries.md)).

Application append succeeds with exactly `{record, position}`. Validation, reference, capability, duplicate, lock, and pre-publication store failures publish and return no record. M1 durable providers have one unavoidable uncertain-outcome exception: host failure after atomic whole-record publication but before acknowledgement returns no result, while replay may expose that complete record; recovery checks the attempted id as fixed by [decision 0022](../../decisions/0022-m1-store-and-plain-file-contract.md). Full capability order and consumption are in [clock and identity](./clock-and-identity.md); the store/application split is in [store](./store.md).

## Public errors

Kernel public failures are structured `LoreduError` values with readonly top-level `code`, nonempty human `message`, and readonly ordered `issues`. Each issue has a stable `code`, RFC6901 JSON Pointer `path` (root is `""`), and human message. Human wording and raw causes are not byte-stable compatibility surfaces.

Stable M0 top-level codes are `VALIDATION_FAILED`, `REFERENCE_CHECK_FAILED`, `DUPLICATE_RECORD_ID`, `RANDOM_SOURCE_FAILED`, `CLOCK_FAILED`, and `STORE_APPEND_FAILED`. Stable issue codes include `REQUIRED`, `TYPE`, `FORMAT`, `RANGE`, `UNKNOWN_FIELD`, `RESERVED_FIELD`, `DUPLICATE`, `UNKNOWN_SCHEMA`, `REFERENCE_NOT_FOUND`, and `REFERENCE_KIND_MISMATCH`.

Structural validation collects all safely discoverable issues and sorts by pointer then code. A duplicate complete SourceRef reports `DUPLICATE` at the later element pointer such as `/sources/1`, never `FORMAT`. If any issues exist, no policy/reference/capability/store call occurs. For a structurally valid Claim, custom-policy validation and semantics are part of this pre-reference validation phase under the exact callback/result rules in the [kernel API contract](./kernel-api.md). Reference validation then aggregates missing/wrong-kind issues in deterministic field/index order. Operational failures carry one top-level failure.

## Invariants

1. Canonical records are detached, deeply immutable append-only history.
2. Contradictions are legal; projections and Resolution records interpret rather than mutate history.
3. Every persisted schema remains replayable through the public decoder.
4. The kernel application alone assigns schema, id, and `recorded_at`; the store assigns only position.
5. Every record reference is complete, kind-correct, and points backward; SourceRefs are not record references.
