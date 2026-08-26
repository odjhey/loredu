---
name: projection_contract
description: "Event-sourced current and historical projections, including recorded-time and valid-time queries."
type: contract
tags: [contracts, projection, temporal, event-sourcing]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T12:10:00+08:00
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

## Changes since a point

A separate event-stream style query may expose records and derived changes since a cursor/time. This supports recurring activities asking what Loredu learned since the previous run without rebuilding their own change log.

## Rebuild invariant

Deleting any materialized/current projection and replaying canonical records must reproduce the same projected knowledge for the same query and reconciliation/resolution ruleset.
