---
name: record_contract
description: "Immutable Loredu record envelope and the Entry, Claim, Relation, Resolution, and Verification record families."
type: contract
tags: [contracts, records, provenance]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
---

# Record contract

## Common envelope

Every persisted record has at least:

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
```

IDs must be stable, opaque to domain meaning, and globally unique enough for the selected store — with one human affordance: every id starts with a three-letter kind prefix so a reader identifies what an id refers to at a glance:

```text
ent_…  entry      clm_…  claim      rel_…  relation
res_…  resolution ver_…  verification
```

The suffix is random, identifier-safe, and carries no meaning (ordering comes from `recorded_at` and stream positions, and sharding is a non-concern). Validation asserts that the prefix agrees with `kind`; beyond that, no logic may parse or derive meaning from an id. Suffix length and alphabet are fixed by the [clock and identity contract](./clock-and-identity.md): 16 symbols of lowercase Crockford base32.

### Field rules

Shape rules the kernel validates, pinned by [decision 0019](../../decisions/0019-m0-validation-rules.md) so every implementation and adapter agrees:

- **Identifier-safe token** — `subject.type`, `subject.id`, `predicate`, `perspective`, `actor.id`, and both halves of a scope pair:

  ```text
  ^[a-z0-9]([a-z0-9._:/-]*[a-z0-9])?$      max 128 characters
  ```

  Lowercase only, no whitespace, no leading or trailing separator. Separators inside a token let consumers express their own namespacing (`code-area/command-registration`) without the kernel learning their vocabulary. Lowercase is *enforced, not normalized*: two keys differing only in case would read as identical to a human while reconciling as distinct.

- **`scope`** — a flat, unordered map of identifier-safe key to identifier-safe value; no nesting. Absent and `{}` are the same thing. Because scope is part of the claim key, identity compares the **set of pairs, order-insensitively**: pair order never changes a key, and adding a pair always does.

- **`metadata`** — a flat map whose keys are `<namespace>.<name>`, both halves identifier-safe. A key with no namespace is rejected, which is what makes "unknown namespaced metadata is preserved" a guarantee. `loredu.` is reserved for the kernel; other namespaces are preserved verbatim and ignored by readers that do not understand them.

- **`sources[].ref`** — deliberately *not* identifier-safe: a ref may be a URL, path, or vendor id, so it is any non-empty trimmed string up to 1024 characters.

- **`actor`** — required on every draft. `type` is closed; `id` is identifier-safe.

- **`schema`** — must be exactly a schema identity this kernel can replay. Unknown identities are rejected on write and surfaced as an actionable error on read, never silently skipped.

- **Closed vocabularies** (unknown values rejected, because kernel mechanics depend on them): `kind`, `actor.type`, relation type, resolution `decision`, verification `result`, `confidence`.
- **Open vocabularies** (recommended values; unknown values accepted and preserved, because the kernel never branches on them): `entry_type`, `claim_class`.

### Draft vs persisted record

Callers never construct a complete record — they construct a **draft**: the caller-owned fields only (kind payload, actor, scope, permitted sources, metadata). `schema` is absent from a draft alongside `id` and `recorded_at`; the application supplies the supported schema identity when it stamps the other persisted-envelope fields. The application append path assigns what only the kernel may assign before handing a complete record to storage:

```text
EntryDraft ── application append ──► Entry ── RecordStore.append() ──► + stream position
                 + id          (kernel format over the injected random source)
                 + recorded_at (sampled from the injected clock immediately
                                before the durable append attempt)

                 the store assigns the position and nothing else; it never
                 fabricates or rewrites id or recorded_at
```

The type model must make history backdating **unrepresentable**: a draft has no `id` or `recorded_at` field to fill in, rather than having ones that are validated away. This split also reinforces reference-before-referrer ordering by construction — a referrer cannot be drafted until its referent has been appended and has an id.

### Time ownership

`recorded_at` is **assigned by the kernel/application append path**, never caller-authoritative — `as_of` only has a stable meaning if Loredu owns the timestamp attached to canonical history. The distinct time concepts:

- `recorded_at` — the kernel timestamp sampled immediately before attempting the durable append. It becomes part of canonical history only if the store append succeeds; it is not defined as the exact durability instant ([clock and identity](./clock-and-identity.md));
- `valid_from` / `valid_until` — when a claim applies in the external world (caller-declared);
- stream position — canonical append ordering and the store-level fact that the append committed successfully;
- an actor's own observation time, if ever needed, is a separate future field (`observed_at`) or consumer metadata — it is not `recorded_at`.

Unknown namespaced metadata should be preserved by storage adapters when practical and ignored by readers that do not understand it.

## Entry

An Entry is the canonical free-form knowledge payload.

```yaml
kind: entry
title: optional short title
entry_type: finding | observation | lesson | decision | constraint | question | incident
sources:
  - ref: source-defined-stable-reference
    locator: optional section/page/line/path
    snapshot: optional source version
```

`body` carries the free text and is **required and non-empty** — an entry with nothing in it records nothing. `title` is optional. Adapters may store the body as a Markdown document body rather than a frontmatter field; that is a serialization choice, not a shape difference. Entries are useful even when no structured claim is extracted.

## Claim

A Claim is a structured proposition:

```yaml
kind: claim
derived_from: [entry-id]
subject:
  type: caller/domain-defined-type
  id: stable-subject-id
predicate: stable_predicate
value: any-serializable-value
claim_class: state | pattern | exclusion | rule | capability | relation | event
perspective: optional-domain-perspective
confidence: candidate | observed | corroborated | confirmed | authoritative
valid_from: optional timestamp
valid_until: optional timestamp
sources: []
```

`value` is **required** and must be JSON-serializable. Equality between values is structural over a canonical form and never coerces types, so `1` and `"1"` under one key are a conflict candidate rather than a duplicate ([decision 0019](../../decisions/0019-m0-validation-rules.md)).

`derived_from` holds **entry ids only**. Claim-to-claim derivation is expressed as an explicit Relation, which keeps provenance to evidence distinct from reasoning between propositions.

A Claim may be submitted directly by a human/program without automated extraction, but provenance should still identify its basis when available.

### Claim identity

The claim key is declared at write time and is the unit of deterministic reconciliation ([decision 0004](../../decisions/0004-claim-identity-key.md)):

```text
claim_key = (scope, subject.type, subject.id, predicate, perspective?)
```

`subject.id` and `predicate` are stable identifiers, not free prose. Two claims reconcile automatically (duplicate, support, conflict, temporal precedence) only when their keys match; differing `perspective` values produce distinct keys so alternative views coexist. Validation rejects claims with missing or malformed key fields — unkeyed knowledge belongs in an Entry.

## Relation

Relations connect records without mutating them. They use a directed `from` record id, `to` record id, and `relation_type`. Either endpoint may identify any record family; the application requires both records to exist before append. Direction remains explicit even where a consumer interprets a relation symmetrically. Initial vocabulary:

```text
supports
contradicts
duplicates
supersedes
derived_from
related_to
```

Reconciliation may generate rebuildable relations; explicit relations may also be persisted when they are meaningful historical evidence.

## Resolution

A Resolution records judgment over claims or relations:

```yaml
kind: resolution
targets: [claim-id]
decision: prefer | supersede | retract | leave_disputed
replacement: [optional-claim-id]
effective_at: optional timestamp
reason: short auditable rationale
```

`targets` may reference **claim or relation ids** — both are things a judgment can be made about. `reason` records the decision basis, not hidden chain-of-thought.

## Verification

A Verification records that knowledge was checked against a stated basis. Targets are claim ids — a Pattern is a *class of claim*, not a separate record kind, so it is verified as the claim it is:

```yaml
kind: verification
targets: [claim-id]
verified_against:
  - source: source-ref
    snapshot: source-version
result: confirmed | contradicted | unchanged | needs_revalidation
```

## Validation and extension shape

Entry, Claim, Relation, and Resolution may carry `sources`; Verification instead carries the required purpose-specific `verified_against` basis. Drafts, records, and their defined nested objects reject unknown fields. Consumers extend records only through foreign namespaced `metadata`, whose values may be any JSON value.

Every timestamp is a preserved RFC 3339 date-time string with an explicit offset or `Z`; invalid calendar/time values are rejected, but the kernel neither normalizes accepted spellings nor invents temporal consistency rules.

The TypeScript API returns accumulated structured validation errors (`path`, stable `code`, actionable `message`) rather than throwing for malformed input. Successful validation returns a recursively frozen snapshot detached from caller input. Exact names and result forms are fixed by [decision 0020](../../decisions/0020-record-api-shape.md).

## Invariants

1. Persisted records are immutable.
2. New understanding is appended as new records.
3. Entries are not required to be structured claims.
4. Claims preserve provenance to entries/evidence when available.
5. Contradictory claims are legal historical data.
6. Current truth is a projection, not a mutable field on a canonical record.
7. The complete projection must be reconstructable from canonical records.
8. Every claim declares a well-formed claim key; deterministic reconciliation never crosses key boundaries.
9. Every persisted record schema version remains replayable; schema evolution is additive or versioned, never breaking ([decision 0005](../../decisions/0005-embedded-kernel-compatibility.md)).
10. `id` and `recorded_at` are assigned by the kernel/application append path; callers submit drafts and cannot backdate canonical history — the draft type has no such fields to supply.
