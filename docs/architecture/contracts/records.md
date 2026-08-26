---
name: record_contract
description: "Immutable Loredu record envelope and the Entry, Claim, Relation, Resolution, and Verification record families."
type: contract
tags: [contracts, records, provenance]
generated: "Pi coding agent"
created_at: 2026-08-26T12:10:00+08:00
---

# Record contract

Loredu has five persisted record kinds. A **draft** is caller input; a
**persisted record** is the application-stamped, complete value passed to the
provider-neutral store. Validation errors are actionable and identify the
invalid field path and rule. The kernel rejects malformed input rather than
normalizing it or silently dropping unknown data.

## Common envelope and ownership

Every persisted record has exactly these common fields in addition to its
kind-specific payload:

```yaml
schema: loredu.record/v1
kind: entry | claim | relation | resolution | verification
id: opaque-stable-id
recorded_at: 2026-08-26T12:00:00+08:00
actor:
  type: human | agent | program | system
  id: caller-defined-id
scope: {}
metadata: {}
sources: []
```

| Field | Owner and presence | Cardinality/default | Validation and errors |
|---|---|---|---|
| `schema` | Application-owned; absent from every public draft | Exactly one; persisted as `loredu.record/v1` | A caller-supplied `schema` is rejected. A persisted value other than the fixed identity is rejected on write and surfaced as an actionable unknown-schema read error; records are never skipped. |
| `kind` | Caller-owned on a draft | Exactly one; one of the five kinds | Closed vocabulary; an absent or unknown value names `kind` in the error. |
| `id` | Application/kernel-owned; absent from drafts | Exactly one on persisted records | Application generation uses the kind prefix and injected entropy. Caller-supplied `id` is rejected; persisted ids must match the kind prefix and exact opaque format. |
| `recorded_at` | Application/kernel-owned; absent from drafts | Exactly one on persisted records | Sampled from the injected `Clock` immediately before the store append attempt. Caller-supplied values are rejected, never overwritten; a failed append does not make the stamped value canonical. |
| `actor` | Caller-owned | Exactly one object | Required on drafts and persisted records; `type` is closed and `id` is identifier-safe. Missing or malformed nested fields identify their paths. |
| `scope` | Caller-owned on a draft; application canonicalizes it | Optional draft; persisted explicitly as `{}` when absent | A flat map of identifier-safe key/value pairs; nesting, malformed keys, and malformed values are rejected. Pair order has no identity effect. |
| `metadata` | Caller-owned on a draft; application canonicalizes it | Optional draft; persisted explicitly as `{}` when absent | A flat namespaced map of JSON values. Invalid keys/values and every `loredu.*` key are rejected; non-kernel namespaces are preserved verbatim. |
| `sources` | Caller-owned common provenance | Optional draft; persisted explicitly as `[]` when absent | An array of `SourceRef`; each element is validated at its field path. No family may use a second hidden provenance channel. |

A public append boundary rejects erased-type objects carrying `schema`, `id`, or
`recorded_at`; the application-only construction step adds those fields exactly
once. `RecordStore.append` receives the resulting complete record and returns
only a stream position. The store never stamps, rewrites, or infers record
fields.

### Shared scalar rules

- **Identifier-safe token** — `subject.type`, `subject.id`, `predicate`,
  `perspective`, `actor.id`, and both halves of every scope pair match this
  pattern and are at most 128 characters:

  ```text
  ^[a-z0-9]([a-z0-9._:/-]*[a-z0-9])?$
  ```

  Lowercase is enforced, not normalized; separators may occur only internally.
- **Actor** — `type` is exactly `human | agent | program | system`; `id` is one
  identifier-safe token. The application does not infer an actor.
- **SourceRef** — the exact common shape is `{ ref: string, locator?: string,
  snapshot?: string }`. `ref` is required; `locator` and `snapshot` are optional
  singular strings. Each present value must be non-empty after trimming and at
  most 1024 characters. The supplied spelling is preserved; validation does
  not trim, case-fold, or token-normalize it. `ref` is not identifier-safe.
- **Metadata** — keys are `<namespace>.<name>`, with both parts identifier-safe;
  values are JSON-serializable. The M0 kernel-owned registry is empty, so every
  valid `loredu.*` key is rejected both on caller drafts and persisted input.
  Every other valid namespace and its value is retained verbatim, including
  unknown names.
- **Open vocabulary strings** — optional `entry_type` and `claim_class` are
  strings owned by the caller. They are not identifier-safe or closed-vocabulary
  fields: unknown values are accepted and preserved without kernel judgment.
- **JSON value** — Claim `value` is required and JSON-serializable. Equality is
  structural (sorted object keys, array order retained, exact strings, no type
  coercion, and `null` distinct from absence); this primitive does not normalize
  caller data.
- **Caller-declared timestamps** — `valid_from`, `valid_until`, and
  `effective_at`, when present, are one RFC3339/ISO-8601 instant with an
  explicit `Z` or numeric offset and a valid calendar value. The original
  spelling is preserved. If both validity bounds are present,
  `valid_until` must not precede `valid_from`; no other temporal judgment is
  made in M0. `recorded_at` follows application clock ownership above.

## Draft and persisted forms

Callers construct only the fields in this table. Optional common fields are
canonicalized by the application as described above; all family-specific
fields keep their stated presence and cardinality.

| Kind | Draft/persisted family fields and exact rules |
|---|---|
| `entry` | `body` is caller-owned, required, singular, and must contain at least one non-whitespace character; its supplied content is preserved byte-for-byte and is at most 1 MiB. `title` is caller-owned, optional and singular; when present it must contain a non-whitespace character and be at most 1024 characters, with supplied content preserved. `entry_type` is optional and open. |
| `claim` | `subject` is caller-owned, required, singular, and has required identifier-safe `type` and `id`. `predicate` is required, singular, and identifier-safe. `value` is required, singular JSON. `claim_class` and `perspective` are optional singular fields; `perspective`, when present, is identifier-safe. `confidence` is required, singular, and closed to `candidate | observed | corroborated | confirmed | authoritative`. `valid_from` and `valid_until` are optional singular caller timestamps, with the non-inverted interval rule above. `derived_from` is optional and defaults to persisted `[]`; when present it is an array (possibly empty) of existing Entry ids only. |
| `relation` | `relation_type` is caller-owned, required, singular, and closed to `supports | contradicts | duplicates | supersedes | derived_from | related_to`. `from` and `to` are caller-owned, required, singular ordered endpoint objects `{id, kind}`. Each endpoint has one id and one of all five record kinds; id/prefix agreement is required and the referenced record must exist before this relation is appended. Direction is persisted. No inverse is synthesized and no type-specific semantic judgment is performed in M0. |
| `resolution` | `targets` is caller-owned, required, and a non-empty array of existing Claim or Relation ids. `decision` is required, singular, and closed to `prefer | supersede | retract | leave_disputed`. `replacement` is optional and singular; when present it is an existing Claim id. `effective_at` is optional and singular. `reason` is required and singular, must contain a non-whitespace character, and is at most 2048 characters; supplied content is preserved. |
| `verification` | `targets` is caller-owned, required, and a non-empty array of existing Claim ids. `verified_against` is caller-owned, required, and a non-empty array of basis objects `{source: string, snapshot?: string}`. `source` is required; `snapshot` is optional singular. Both are non-empty after trimming and at most 1024 characters, with supplied spelling preserved. This basis is deliberately distinct from common `sources`: it states what was checked. `result` is required, singular, and closed to `confirmed | contradicted | unchanged | needs_revalidation`. |

For all arrays, cardinality is part of the contract: `[]` is legal only where
the table says optional and possibly empty; required judgment/basis collections
reject empty arrays. All referenced ids are validated for kind and existence at
the application boundary. A malformed id, wrong-kind reference, missing
referent, invalid timestamp, inverted interval, reserved metadata key, or
invalid field value is an actionable rejection naming that field; the store
itself remains ignorant of these domain references.

## IDs and common invariants

IDs are opaque-stable values with these human affordances:

```text
ent_…  entry       clm_…  claim       rel_…  relation
res_…  resolution  ver_…  verification
```

The suffix is exactly 16 lowercase Crockford-base32 symbols. Only prefix/kind
agreement is semantic; no logic parses the suffix or derives domain meaning from
it. The application owns id generation over the injected `RandomSource`.

1. Persisted records are immutable.
2. New understanding is appended as new records; no record is replaced.
3. Entries are not required to become structured claims.
4. Claims preserve provenance to entries/evidence when available.
5. Contradictory claims are legal historical data.
6. Current truth is a projection, not a mutable canonical field.
7. Projections are reconstructable from canonical records.
8. Every claim declares a well-formed claim key:
   `(scope, subject.type, subject.id, predicate, perspective?)`; scope pair order
   is ignored, while adding a pair changes identity.
9. Every persisted schema remains replayable; unknown schemas fail loudly.
10. `id` and `recorded_at` are application-owned and stamped exactly once; the
    store assigns only the stream position.

The kernel remains mechanical: these validations detect malformed data and
structural conflicts but never decide whether a relation, resolution, or
verification is substantively correct. Claim-key policy remains deterministic,
versioned, non-judgmental, and defaults to declared-key identity plus exclusive
values. `computed_at` remains outside basis identity and T86 remains M2; a
reusable equality primitive in M0 does not claim that catalog row.
