---
name: projection_contract
description: "Event-sourced current and historical projections, including recorded-time and valid-time queries."
type: contract
tags: [contracts, projection, temporal, event-sourcing]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
---

# Projection contract

A Projection is derived from immutable records and may be rebuilt at any time.

## Two time dimensions

Loredu distinguishes:

- **recorded time** — when Loredu learned or recorded the information;
- **valid time** — when the claim is believed to have applied in the external world.

The core does not require a specialized temporal database. The record/event model must preserve enough information to answer both dimensions.

## Query semantics

| Query | Meaning |
|---|---|
| current | What do we believe now using all available records? |
| `as_of=A` | What did Loredu know/believe using only records available by A? |
| `valid_at=V` | What do we currently believe applied at V? |
| `as_of=A, valid_at=V` | Using only knowledge available by A, what did we believe applied at V? |

Example: a change became effective on July 10 but was only discovered on August 20. A July 15 `as_of` projection still shows the earlier belief; a current `valid_at=July 15` projection may show the later-discovered effective state.

## Reconciliation and resolution

Reconciliation is deterministic and may identify:

- same-scope/same-subject/same-predicate/same-value support;
- exact or source-level duplicates;
- property-value conflicts with overlapping validity;
- temporal precedence that can be inferred mechanically;
- records needing resolution.

Reconciliation does not rewrite claims.

Resolution records may alter which claims a projection prefers, supersede, retract, or leave disputed. Historical records remain addressable.

## Basis

Every projection is stamped with the basis it was computed from ([decision 0006](../../decisions/0006-explicit-version-basis.md)):

```yaml
basis:
  stream_position: position of the last record included
  ruleset: reconciliation ruleset version
  query: { as_of: ..., valid_at: ..., scope: ... }
computed_at: timestamp
```

`computed_at` is informational and excluded from basis identity: two projections with identical basis are identical, whenever computed. The `ruleset` names the versioned rule bundle including any active claim policy version ([decision 0010](../../decisions/0010-claim-policy-seam.md)).

A consumer compares `basis.stream_position` against the store head to detect staleness without replaying history. In v0.x this check is conservatively **store-wide** — the comparison is against the global `head()`, so a packet may be flagged stale by records outside its scope; scope-filtered watermarks are a future optimization, not a required new port. Same basis must reproduce the same projection.

## Changes since a point

A separate event-stream style query may expose records and derived changes since a stream position. This supports recurring activities asking what Loredu learned since the previous run — keyed off the previous packet's `basis.stream_position` — without rebuilding their own change log.

## Rebuild invariant

Deleting any materialized/current projection and replaying canonical records must reproduce the same projected knowledge for the same query and the same (versioned) reconciliation/resolution ruleset. A ruleset version bump invalidates cached views without touching canonical records.
