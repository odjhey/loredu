---
name: decision_explicit_version_basis
description: "Every layer carries an explicit version identity; derived views are stamped with the basis (stream position, ruleset version, query) they were computed from."
type: decision
tags: [decisions, versioning, projections, staleness]
status: draft
generated: "Claude Fable 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T00:00:00+08:00
updated_at: 2026-08-26T00:00:00+08:00
---

# 0006: Versioning is explicit at every layer

## Context

Earlier decisions already version knowledge (append-only history, supersession, bitemporal queries — [0002](./0002-append-only-record-model.md)) and record schemas (`schema: loredu.record/v1` with a never-break replay policy — [0005](./0005-embedded-kernel-compatibility.md)). But derived views have no version identity yet: nothing ties a projection or Working Lore packet to the record-stream state and ruleset it was computed from.

That gap is not hypothetical. The xatu artifact-intelligence candidate consumer ([candidate consumers](../reports/candidate-consumers.md)) — an existing tool that would embed Loredu — stores evidence bundles with an ID but no basis, so nothing can detect that a bundle went stale relative to updated facts. A kernel whose core promise is bounded, trustworthy context must let a consumer ask "is this packet still current?" without replaying history.

## Options considered

- leave staleness to consumers (each invents its own watermark);
- version only canonical records and treat projections as always-fresh throwaways;
- make version identity explicit at every layer and stamp every derived view with its basis.

## Choice

Each layer has one explicit version identity:

| Layer | Identity | Where |
|---|---|---|
| Record schema | `schema: loredu.record/vN` | record envelope ([0005](./0005-embedded-kernel-compatibility.md)) |
| Knowledge | append-only history, supersession, `recorded_at`/valid time | records ([0002](./0002-append-only-record-model.md)) |
| Record stream | monotonic position returned by `append`, head position readable | store port |
| Ruleset | version identifier for the reconciliation/resolution rule bundle | application core |
| Derived views | `basis` block stamped on every projection and Working Lore packet | projection / Working Lore contracts |

The `basis` block records at minimum:

```yaml
basis:
  stream_position: <position of the last record included>
  ruleset: <reconciliation ruleset version>
  query: { as_of: ..., valid_at: ..., scope: ... }
  computed_at: <timestamp>
```

Staleness detection is then a cheap comparison: a packet whose `basis.stream_position` is behind the store head (for the relevant scope) may be stale; equal positions with an equal ruleset guarantee the packet is current. Two views with the same basis and query are byte-comparable; a reproducibility failure is a bug, not noise.

## Consequences

- consumers can cache Working Lore packets safely and invalidate them deterministically — the xatu bundle-staleness gap closes by construction;
- "changes since the previous run" queries key off the previous packet's `stream_position` instead of consumer-side bookkeeping;
- ruleset changes are visible: bumping the ruleset version invalidates cached views without touching canonical records;
- store adapters must provide a monotonic position; for the plain-file adapter this is an adapter detail (e.g. derived from deterministic replay order), not a domain-visible file layout.

## Rule or follow-up

`append` returns a position; the store exposes its head position. Every projection and Working Lore packet includes a `basis` block. A v0.x acceptance test must show a cached Working Lore packet detected as stale after one new relevant record, and reproduced byte-identically when basis and query are unchanged.
