---
name: decision_record_api_shape
description: "Closes the record-contract shape and TypeScript API ambiguities required before M0 record types can be public."
type: decision
tags: [decisions, contracts, records, validation, api]
generated: "OpenAI GPT-5.4, 2026-08-26"
created_at: 2026-08-26T23:00:00+08:00
---

# 0020: Record shape and validation API

## Context

The record contract and decision 0019 pin validation semantics but intentionally leave several language-level and shape details open. M0 work on identity, policy, storage, and append must share one answer rather than infer incompatible types: Relation endpoints, draft schema ownership, source-bearing families, unknown fields, timestamp representation, validation results, and TypeScript names.

## Options considered

- make record shapes extensible and let adapters preserve unknown top-level fields;
- put `schema` on caller drafts or let the application add it with the history stamps;
- model Relation endpoints as generic arrays, a subject/object pair, or an explicit directed pair;
- throw validation exceptions, return one error, or return all field/path errors;
- expose classes/builders or immutable data plus functions.

## Choice

The TypeScript v1 contract is immutable data plus total validation functions:

- Relation uses directed `from` and `to` record ids and closed `relation_type`. Both endpoints may name any of the five record families; the append application checks existence. Direction is meaningful even for relation types whose interpretation is symmetric.
- `schema` is absent from every draft, like `id` and `recorded_at`. The application supplies the supported `loredu.record/v1` identity when it stamps a successful append attempt. Runtime draft validation rejects all three fields.
- Entry, Claim, Relation, and Resolution may carry `sources: SourceRef[]`. Verification instead carries its purpose-specific, required `verified_against` basis and does not also carry `sources`.
- Record, draft, and their defined nested objects are closed shapes. Unknown fields are rejected with their exact path. Extensibility belongs under foreign namespaced `metadata`; metadata object values remain JSON and may therefore be structural.
- All instants are strings in RFC 3339 date-time form with an explicit `Z` or numeric offset. Validation rejects impossible calendar/time values and preserves the accepted spelling; it does not normalize offsets or infer temporal consistency between fields.
- Public validation returns `ValidationResult<T>`: `{ ok: true, value }` or `{ ok: false, errors }`. Each `ValidationError` has `path`, stable `code`, and actionable `message`; validators accumulate independent errors. Successful values are detached, recursively frozen snapshots.
- Public TypeScript functions are `validateDraft`, `validateRecord`, `validateRecordId`, `canonicalClaimKey`, `claimKeysEqual`, `canonicalizeJsonValue`, and `jsonValuesEqual`. `validateRecord` is the schema acceptance/replay boundary. Canonicalization failures use the same result/error vocabulary.

## Consequences

- Future additive record fields require a schema-contract change; they cannot appear accidentally through structural TypeScript values.
- W2 owns id generation but may rely on `validateRecordId`. W3 may rely on canonical claim keys and JSON equality. W4 may accept `LoreduRecord` and copy/freeze at its boundary. W5 may accept `LoreduDraft`, reject erased-type smuggling with `validateDraft`, and add schema/id/time exactly once.
- Validation does not throw for malformed caller or replay input, and callers can report every actionable field in one response.
- Relation direction and endpoint family checks are no longer adapter guesses.

## Rule or follow-up

Changes to these public shapes or result conventions require a superseding decision and corresponding record-contract update. Provider errors and application orchestration errors remain later work; this decision only owns domain validation.
