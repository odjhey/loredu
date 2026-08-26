---
name: record_contract
description: "Immutable Loredu record envelope and the Entry, Claim, Relation, Resolution, and Verification record families."
type: contract
tags: [contracts, records, provenance]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T12:10:00+08:00
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

IDs must be stable, opaque to domain meaning, and globally unique enough for the selected store. The exact ID algorithm is an implementation decision.

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
