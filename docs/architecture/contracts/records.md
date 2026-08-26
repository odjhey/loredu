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

### Draft vs persisted record

Callers never construct a complete record — they construct a **draft**: the caller-owned fields only (kind payload, actor, scope, sources, metadata). The append/commit path assigns what only the kernel may assign:

```text
EntryDraft ── application append ──► Entry ── RecordStore.append() ──► + stream position
                 + id          (kernel format over the injected random source)
                 + recorded_at (injected clock, stamped at commit)

                 the store assigns the position and nothing else; it never
                 fabricates or rewrites id or recorded_at
```

The type model must make history backdating **unrepresentable**: a draft has no `id` or `recorded_at` field to fill in, rather than having ones that are validated away. This split also reinforces reference-before-referrer ordering by construction — a referrer cannot be drafted until its referent has been appended and has an id.

### Time ownership

`recorded_at` is **assigned by the kernel at successful append**, never caller-authoritative — `as_of` only has a stable meaning if Loredu owns when a record entered canonical history. The distinct time concepts:

- `recorded_at` — when Loredu durably learned it (kernel-assigned at commit, from the injected clock — see [clock and identity](./clock-and-identity.md));
- `valid_from` / `valid_until` — when a claim applies in the external world (caller-declared);
- stream position — canonical append ordering (store-assigned);
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

The Markdown body or equivalent `body` field contains the free text. Entries are useful even when no structured claim is extracted.

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

A Claim may be submitted directly by a human/program without automated extraction, but provenance should still identify its basis when available.

### Claim identity

The claim key is declared at write time and is the unit of deterministic reconciliation ([decision 0004](../../decisions/0004-claim-identity-key.md)):

```text
claim_key = (scope, subject.type, subject.id, predicate, perspective?)
```

`subject.id` and `predicate` are stable identifiers, not free prose. Two claims reconcile automatically (duplicate, support, conflict, temporal precedence) only when their keys match; differing `perspective` values produce distinct keys so alternative views coexist. Validation rejects claims with missing or malformed key fields — unkeyed knowledge belongs in an Entry.

## Relation

Relations connect records without mutating them. Initial vocabulary:

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

`reason` records the decision basis, not hidden chain-of-thought.

## Verification

A Verification records that knowledge was checked against a stated basis:

```yaml
kind: verification
targets: [claim-or-pattern-id]
verified_against:
  - source: source-ref
    snapshot: source-version
result: confirmed | contradicted | unchanged | needs_revalidation
```

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
10. `id` and `recorded_at` are assigned by the kernel at append; callers submit drafts and cannot backdate canonical history — the draft type has no such fields to supply.
