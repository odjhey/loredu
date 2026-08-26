---
name: decision_append_only_records
description: "Choose immutable canonical records with event-sourced projections and explicit supersession/resolution."
type: decision
tags: [decisions, records, event-sourcing, temporal]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
---

# 0002: Append-only record model

## Context

Loredu must preserve provenance, support corrections and changing knowledge, and answer both current and historical questions. Mutating one master knowledge document would erase how the current interpretation was reached.

## Options considered

- mutate current facts in place;
- keep editable Markdown knowledge pages as canonical state;
- append immutable records and derive current/historical projections.

## Choice

Canonical Loredu records are immutable. New findings, claims, contradictions, verifications, and resolutions are appended. Current knowledge is a derived projection.

## Consequences

- contradictory historical claims are legal;
- supersession does not delete the earlier claim;
- projections and indexes may be discarded and rebuilt;
- `recorded_at` and external-world validity can answer different temporal questions;
- storage adapters must preserve replay semantics.

## Rule or follow-up

Reconciliation never edits claims. Resolution is recorded explicitly. A v0.x acceptance test must rebuild current and historical projections from canonical records alone.
