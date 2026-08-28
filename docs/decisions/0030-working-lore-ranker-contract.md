---
name: m3_working_lore_ranker_contract
description: "Closes M3 Working Lore application, Ranker, bounded packet, section continuation, disclosure, and cache semantics before implementation."
type: decision
tags: [decisions, m3, working-lore, ranking, pagination, disclosure]
generated: "OpenAI coding agent, 2026-08-28"
created_at: 2026-08-28T15:19:22+08:00
---

# 0030: Close Working Lore and Ranker boundaries before M3 implementation

## Context

The M3 plan promised activity-scoped Working Lore, deterministic baseline ranking, separate trust/attention sections, item and character bounds, Ranker substitution, progressive disclosure, and a stale Basis. The existing Working Lore sketch did not define an application method, Ranker callback, packet item type, section membership, budget accounting, full counts, cursor resume rule, or CLI grammar. It also could not represent a custom Ranker in the exact M0–M2 RulesetIdentity without silently changing every existing response.

ADR 0009 requires every bounded section to disclose truncation and continue against one pinned Basis. ADR 0010 requires anything that changes Working Lore selection to have version identity, while keeping Ranker separate from ClaimPolicy. ADR 0027 narrows replay equality to semantic content and fixes the Current Knowledge states/evidence that M3 consumes. Separate M3 implementation crews could otherwise satisfy T40–T45/T75 with incompatible ranking and budget behavior.

## Options considered

- Let M3 implementation tests choose packet/API fields and treat Ranker as an internal function. Rejected: consumers could not embed or substitute ranking through a stable boundary.
- Add Ranker to the existing exact RulesetIdentity for every operation. Rejected: that would change implemented M0–M2 Basis values even where ranking is irrelevant.
- Let Ranker filter, classify, and synthesize packet content. Rejected: full counts, deterministic section membership, and the mechanical-versus-judgment boundary would depend on an unconstrained extension.
- Return raw Current Knowledge values and count serialized response bytes. Rejected: one arbitrarily large JSON value could defeat bounded activity context or make a continuation unable to advance.
- Build compact core-owned section occurrences, let a versioned Ranker return only a validated permutation, budget deterministic summaries, and paginate each section against an M3-specific extended Basis. Chosen.

## Choice

The exact [Working Lore contract](../architecture/contracts/working-lore.md) governs M3.

### One additive application operation and one narrow port

`LoreduApplication.lore(query)` accepts required activity plus optional scope/corpus and exact item/character budgets, or one section cursor. It samples Clock once for a cursorless current valid point, performs one atomic scan, and returns a detached frozen application response containing `computed_at`, a packet, and an M3-specific `WorkingLoreBasis`.

Assembly additively accepts `ranker?: Ranker`. Core constructs every section occurrence and gives the Ranker a frozen normalized query plus indexed compact candidates. Ranker returns a complete permutation of those indexes; it cannot filter, duplicate, reclassify, synthesize, or mutate. The default `{id:loredu.baseline,version:"1"}` returns core's fixed order: conflicts, revalidation, candidates, current, patterns, each mechanically ordered by contributing position and key. Invalid callback output is a fresh validation failure with no partial packet. Identical input and version must reproduce the permutation; changed behavior requires a version bump.

### Closed packet sections and compact disclosure

The packet sections are exactly current, patterns, candidates, conflicts, and needs revalidation. They are derived from M2 Current Knowledge, applicable Claim confidence/class, visible `needs_revalidation` Verifications, and an exact evidence-backed corpus filter/snapshot comparison. Working Lore uses ClaimPolicy validation/semantics but does not invoke M2's optional projection-wide advice callback; those policy details remain a `current` concern. One group may intentionally occur in more than one section. Retracted, superseded, and nonapplicable history is omitted from defaults but remains reachable through representative history and exact-key Claim affordances.

Each knowledge occurrence carries a bounded deterministic summary, key/state/count/evidence/history metadata, at most two representative handles, and complete disclosure affordances rather than raw unbounded values. Summary construction uses canonical compact JSON and a 512-Unicode-scalar cap.

### Global first-packet budgets and per-section continuation

The first packet has defaults `max_items=40` and `max_chars=12000`; accepted bounds are 1–200 items and 512–1,000,000 summary characters. Character accounting is exactly the sum of Unicode scalar values in returned summaries. Closed item shapes plus the item bound constrain structural overhead. Core selects the longest ranked prefix satisfying both limits and never skips an oversized next occurrence.

All five sections state `returned` and full pinned `total`, including zero. Every truncated section has its own opaque continuation and affordance. A continuation is bound to one section, preserves original activity/scope/corpus, valid point, computed time, head, rulesets, and rank order, and applies the page's complete budget to only that section. It consumes no Clock, stores no derived/ranking output, and rejects an impossible recomputed resume instead of restarting.

### Working Lore Basis without M0–M2 drift

Existing `RulesetIdentity` and `Basis` remain exact and unchanged. Working Lore uses an exact extension containing core, ClaimPolicy, and Ranker identities. Its normalized query records operation, activity, resolved valid point, and present scope/corpus; budgets and cursor do not participate. A packet is reusable only at equal store head, all three equal identities, and equal normalized query. v0.x remains conservatively store-wide: any append makes the packet stale, which necessarily catches one new relevant record. Ranker version changes invalidate only Working Lore identity, not canonical records or unrelated M0–M2 responses.

Replay equality follows ADR 0027: section membership, summaries, counts, ordering, selected occurrences, and surface-neutral actions/params are semantic; computed time, human why text, rendered CLI commands, and private cursor bytes are not.

### Additive CLI grammar

M3 adds `lor lore --activity <token>` with repeated scope, optional corpus JSON, item/character budgets, cursor continuation, JSON mode, and existing global store selection. Cursor form forbids cursorless filters but permits new budgets. It retains the implemented envelope, recursive affordance rendering, store/error/exit behavior, and exact one-object JSON rule. Empty matching scope is successful with five definitive zero sections, Basis, computed time, and exit 0.

## Consequences

- T40–T45/T75 have one implementable application, packet, ranking, budget, continuation, disclosure, and staleness contract.
- Storage and raw values may grow without causing an unbounded default packet; callers follow stable handles for detail.
- Custom lexical, embedding, graph, or model reranking can be supplied later without teaching core that implementation, but its version is visible and its output cannot alter membership/counts.
- A global first-packet budget can omit every item from a later display section; explicit full totals and start-of-section cursors make that omission visible and recoverable.
- M3 reuses M2 reconciliation/evidence and does not append derived records, reinterpret Resolution, crawl sources, or create another projection store.

This decision additively closes ADR 0005/0010's conceptual Ranker boundary and ADR 0009's Working Lore continuation follow-up. It does not supersede their ownership rules. It specializes ADR 0006/0027 Basis and semantic-replay rules only for Working Lore, without changing existing Basis values.

## Rule / follow-up

M3 implementation must use public RecordStore snapshots and assembled ClaimPolicy/Ranker ports, preserve every implemented M0–M2/M1.5 surface, and move T40–T45/T75 only with executable evidence. This docs-only decision changes no code and no catalog row.

A future change to activity/corpus query identity, section membership, compact item shape, summary/accounting limits, Ranker input/output, section priority, cursor resume semantics, Working Lore ruleset identity, or CLI spelling requires a superseding decision. Ranking quality remains an M4 real-consumer judgment, not an M3 deterministic acceptance claim.
