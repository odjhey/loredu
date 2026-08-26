---
name: m0_record_contract_closure
description: "Close the M0 five-family record contract and the C0 test/documentation authority findings without adding implementation or a wire format."
type: decision
tags: [decisions, m0, contracts, records, testing, storage]
generated: "Pi coding agent"
created_at: 2026-08-27T00:00:00+08:00
---

# 0021: M0 record-contract closure

## Context

D1 stopped at the exact C0 candidate because the five-family public and
persisted record model still left durable choices open. The independent C0
review also found one authority contradiction and three documentation boundary
findings. This successor closes those gaps from C0 without implementing the
kernel, store, tests, package API, or G0 guardrails.

This record supersedes ADR 0020 as the complete C0b closure decision. It
explicitly supersedes only the contradictory test-support assertions in ADR
0016: the statements that `@loredu/kernel/testing` has no test doubles and
exports only `StoreUnderTest`. ADR 0016's testing-subpath boundary, separation
from default runtime exports, TypeScript type isolation, and kernel-purity
rules remain in force. ADR 0016 itself is not otherwise superseded.

The complete field-level contract is [records](../architecture/contracts/records.md);
the provider boundary is [store](../architecture/contracts/store.md). This ADR
is the durable explanation for the choices those contracts now state.

## Adopted bounded dispositions

### D-REL — directed binary Relation

A Relation draft and persisted Relation contain exactly one required
`relation_type`, one required ordered `from` endpoint, and one required ordered
`to` endpoint. Each endpoint is exactly `{id, kind}`, with singular fields and
`kind` allowed to be any of `entry | claim | relation | resolution |
verification`. The id prefix must agree with its endpoint kind, and both
referents must exist before the relation is appended. `relation_type` is closed
to `supports | contradicts | duplicates | supersedes | derived_from |
related_to`.

The persisted direction is `from` → `to`; the kernel does not synthesize an
inverse, reorder endpoints, or apply a type-specific semantic judgment. A
consumer may judge whether a relation is useful or appropriate, and any future
narrowing is a compatibility decision rather than an undocumented validator
change.

### D-ENV — application-owned envelope and defaults

The public draft omits `schema`, `id`, and `recorded_at`. The application owns
the fixed persisted `schema: loredu.record/v1`, generates `id`, and samples
`recorded_at` from its injected clock immediately before the store append
attempt. The public append boundary rejects erased caller objects carrying any
of those three fields; the application adds them exactly once. The store
receives a complete record and returns only a stream position.

Draft `scope` and `metadata` are optional and default to explicit persisted `{}`
when absent. Draft common `sources` is likewise optional and defaults to
persisted `[]`; family-specific collection rules are in D-CARD. Persisted
records always carry `schema`, `scope`, `metadata`, and `sources`, even when
empty. Unknown schema identities are rejected on write and produce an
actionable read error, never a skipped record.

### D-SRC — common provenance and distinct Verification basis

All five record kinds own the same optional draft `sources: SourceRef[]`
field. Persisted records always carry it, canonicalized to `[]` when omitted.
`SourceRef` is exactly `{ref: string, locator?: string, snapshot?: string}`:
`ref` is required, the other fields are optional and singular, and each present
string must be non-empty after trimming and at most 1024 characters. The
supplied spelling is preserved; the kernel does not trim, normalize, or treat
these values as identifier tokens.

Verification additionally owns a required non-empty `verified_against` array of
basis objects exactly `{source: string, snapshot?: string}`. `source` is
required and `snapshot` optional/singular; both use the same non-empty,
max-1024, preserved source-reference string rule. This basis is semantically
distinct from common provenance: it states what was checked, rather than where
the Verification record came from. Verification does not embed a `SourceRef` in
place of this basis.

### D-CARD — collection, text, and time rules

The following cardinalities and validation rules are adopted:

- common `sources` and Claim `derived_from` are optional on drafts and persist
  as possibly-empty `[]`; `derived_from`, when non-empty, contains Entry ids
  only;
- Relation `from` and `to` are required singular endpoints;
- Resolution `targets` and Verification `targets` are required non-empty arrays;
  Resolution targets are Claim or Relation ids, Verification targets are Claim
  ids;
- Verification `verified_against` is required and non-empty;
- Resolution `replacement` is optional and singular, and when present is a
  Claim id; M0 does not infer a replacement requirement from its `decision`;
- Entry `body` is required, singular, non-whitespace, preserved byte-for-byte,
  and at most 1 MiB; Entry `title` is optional and singular, non-whitespace
  when present, preserved, and at most 1024 characters;
- Resolution `reason` is required, singular, non-whitespace, preserved, and at
  most 2048 characters;
- caller-declared `valid_from`, `valid_until`, and `effective_at` are optional
  singular timestamps. Each must be a valid RFC3339/ISO-8601 instant with an
  explicit `Z` or numeric offset and valid calendar value; supplied spelling is
  preserved. A pair of validity bounds is valid only when `valid_until` is not
  earlier than `valid_from`. M0 adds no cross-record temporal interpretation.

An absent optional field is distinct from an explicitly present value where the
contract permits it; the stated collection defaults are the only canonicalizing
omissions. All failures identify the field and violated rule.

### D-META — empty M0 kernel-owned registry

Metadata remains a flat map of namespaced keys to JSON values. Every caller
and persisted `loredu.*` key is rejected in M0 because the kernel-owned key
registry is intentionally empty. The reserved prefix alone does not make a key
recognized. Every valid non-`loredu.` namespace and value is retained verbatim,
including unknown namespaces. A future kernel metadata key requires an additive
contract/registry decision before it is accepted or replayed.

## C0 review closure and retained boundaries

This same successor closes the four exact C0 findings:

1. The supersession above resolves ADR 0016's contradictory test seam wording.
   `@loredu/kernel/testing` remains a testing-only subpath, separate from
   default runtime exports; the kernel remains zero-runtime-dependency and
   type-isolated from Bun/Node ambient APIs. M0 deterministic helpers and
   `InMemoryStore` are permitted there. They are test support, not a durable
   provider.
2. T80–T83 remain M0 kernel-invariant rows. Their current physical test
   location under `tests/reconciliation/` is an explicit location exception,
   documented in the test READMEs; the group is not M2 ownership.
3. Portable logical RecordStore cases may run against both `InMemoryStore` and
   `PlainFileStore`. Provider/durability conformance—filesystem layout,
   locking, atomic visibility, fsync, crash behavior, and replay across
   instances—runs against `PlainFileStore` and future durable adapters only.
4. ADR 0015's catalog accounting prose now uses the verified count of 66.

No M0 wire format is introduced. T06 remains deferred to M1 Markdown/YAML
codec evidence. T15 remains an M0 decision and deferred row until a real
public-export test claims it. T86 remains M2; an M0 equality primitive does not
claim the catalog row. The catalog remains exactly `0 implemented + 66
deferred`.

## Consequences

- D1-r2 can implement one exact five-family draft/persisted model and
  field-specific validators without selecting behavior locally.
- The application remains the sole owner of schema, id, and `recorded_at`
  stamping; the store remains complete-record-in/position-only-out, consistent
  with ADR 0018.
- Common provenance is uniform while Verification's checked basis cannot be
  confused with record provenance.
- Broad Relation endpoint kinds preserve M0's mechanical boundary; applications
  and later policy decide substantive appropriateness.
- M0 validates and retains metadata but defines no serialization API or
  provider-specific representation.
- No catalog ownership moves: T15 is M0, T06 is M1, T86 is M2, and all 66 rows
  remain deferred until executable tests exist.

## Rule / follow-up

D1-r2 must start from the exact reviewed C0b head and treat any remaining
contract mismatch as a fail-closed escalation. A fresh independent
`contracts-closure-review` must check D-REL, D-ENV, D-SRC, D-CARD, D-META and
all four C0 findings against that exact C0b commit/tree before implementation
restarts. No G0 repair, production implementation, test claim, push, PR
mutation, merge, or fan-in is part of this decision.

Supersedes: [ADR 0020](./0020-m0-test-seam-and-round-trip-evidence.md).
Clarifies the partial supersession of [ADR 0016](./0016-workspace-scaffold-and-kernel-type-isolation.md)
without rewriting it; retained testing-subpath, export, type-isolation, and
purity boundaries remain authoritative.
