---
name: decision_hypermedia_pagination
description: "Responses embed runnable affordances (hypermedia for agents); all lists are cursor-paginated, basis-pinned, with explicit truncation counts."
type: decision
tags: [decisions, cli, pagination, disclosure, agents]
status: draft
generated: "Claude Fable 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T00:00:00+08:00
updated_at: 2026-08-26T00:00:00+08:00
---

# 0009: Hypermedia responses and basis-pinned pagination

## Context

Bounded context is the kernel's core promise, and the progressive-disclosure levels (orientation → Working Lore → claim detail → evidence → raw source) already assume a caller can go deeper on demand. But two mechanisms were unspecified: how large result sets truncate (pagination), and how a caller knows the way deeper without memorizing the CLI surface. For an agent, the second is context management: if every response carries the exact runnable commands to continue, the agent's context holds one packet and a set of links — not a mental model of the tool. This is REST's "hypermedia as the engine of application state" adapted to a CLI. The watchtower ledger consumer already proved the pattern locally with opaque cursors, `--limit`, and its `next:` continuation tokens.

## Options considered

- unbounded list output, filtering left to pipes alone;
- offset/limit pagination with implicit ordering;
- cursor pagination pinned to the response basis, with every response embedding runnable affordances for both correction and navigation.

## Choice

**The response is the interface.** Every response embeds runnable follow-ups: corrective advice (`advice`, per [0008](./0008-cli-first-agent-reactive.md)) and navigational affordances — continuation of a truncated list, expansion of any printed id. An agent starting from a Working Lore packet reaches raw source references purely by running embedded commands. No dead ends: every id a response prints is a handle resolvable by an embedded or well-known command.

**Cursor pagination, basis-pinned.** Every list-returning command (`claims`, `history`, projections, Working Lore sections) accepts `--limit` and `--cursor` and returns:

```json
"page": { "returned": 20, "total": 143, "cursor": "opaque-token" }
```

with a matching navigational entry in `advice` (`"143 total; continue with:" → "lor claims ... --cursor <token>"`). Cursors are opaque and embed the basis position: continuation pages replay against the same stream position, so a chain of pages is consistent — no duplicates or skips — even while writers append. A fresh (cursorless) query picks up the new head.

**Truncation is always explicit.** `returned`/`total` counts appear whenever a bound applies; definitive empty states remain. Silent truncation is a contract violation — a bounded view that looks complete is worse than an unbounded one.

**Ordering is deterministic.** Every list has a stable sort (position or timestamp, record id as tiebreak) so pagination, pipes, and byte-reproducibility ([0006](./0006-explicit-version-basis.md)) all hold.

## Consequences

- agent context stays small by construction: hold the packet, follow links on demand, drop them after use;
- pagination composes with the basis rules: a page chain is a consistent snapshot; staleness of the whole chain is detectable by comparing the cursor's embedded position to `head`;
- the Working Lore packet needs per-section continuation handles when a section hits its budget;
- navigational affordances obey the same rule as advice: deterministic, derived from actual state, never speculative;
- an invalid or foreign cursor fails with an actionable error, never silently restarts.

## Rule or follow-up

No list output without a bound; no bound without explicit counts and a continuation handle; no printed id without a resolution path. The link-following behavioral test (a fresh agent navigates disclosure levels 0→4 using only embedded commands) gates the M1.5 exit.
