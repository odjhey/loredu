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

ADR 0009 requires every bounded section to disclose truncation and continue against one pinned Basis. ADR 0010 requires anything that changes Working Lore selection to have version identity, while keeping Ranker separate from ClaimPolicy. ADR 0027 narrows replay equality to semantic content and fixes the Current Knowledge states/evidence that M3 consumes. Separate M3 implementation crews could otherwise satisfy T40–T45/T75 with incompatible ranking and budget behavior. Review also exposed three boundary failures in the first closure: a section ordinal alone could not detect a same-version Ranker changing its permutation across pages; full Scope/ClaimKey copies made structural payload growth unbounded despite item/summary budgets; and the shared structural `basisEquals` could ignore Working Lore Ranker identity. Text rendering also needed an unambiguous five-count rule. A later review found that bounding representative handles without assigning their selection/order left packet disclosure, corrective advice, and replay underdetermined.

## Options considered

- Let M3 implementation tests choose packet/API fields and treat Ranker as an internal function. Rejected: consumers could not embed or substitute ranking through a stable boundary.
- Add Ranker to the existing exact RulesetIdentity for every operation. Rejected: that would change implemented M0–M2 Basis values even where ranking is irrelevant.
- Let Ranker filter, classify, and synthesize packet content. Rejected: full counts, deterministic section membership, and the mechanical-versus-judgment boundary would depend on an unconstrained extension.
- Return raw Current Knowledge values and count serialized response bytes. Rejected: one arbitrarily large JSON value could defeat bounded activity context or make a continuation unable to advance.
- Trust Ranker determinism while binding only a section ordinal. Rejected: a same-id/version Ranker could change order on continuation and silently duplicate/skip occurrences.
- Add a pair-count maximum to shared Scope decoding. Rejected: M0–M2 canonical history permits arbitrary finite Scope cardinality, so this would break decode/replay compatibility.
- Bind a pure-SHA-256 permutation digest and exact occurrence resume identity; replace repeated full Scope/ClaimKey copies with bounded M3 descriptors and add anchored exact-key Claim disclosure. Chosen.
- Build compact core-owned section occurrences, let a versioned Ranker return only a validated permutation, budget deterministic summaries, and paginate each section against an M3-specific extended Basis. Chosen.

## Choice

The exact [Working Lore contract](../architecture/contracts/working-lore.md) governs M3.

### One additive application operation and one narrow port

`LoreduApplication.lore(query)` accepts required activity plus optional scope/corpus and exact item/character budgets, or one section cursor. It samples Clock once for a cursorless current valid point, performs one atomic scan, and returns a detached frozen application response containing `computed_at`, a packet, and an M3-specific `WorkingLoreBasis`.

Assembly additively accepts `ranker?: Ranker`. Core constructs every section occurrence and gives the Ranker a frozen bounded query descriptor plus indexed compact candidates; neither contains the full caller Scope or ClaimKey. Ranker returns a complete permutation of those indexes; it cannot filter, duplicate, reclassify, synthesize, or mutate. The default `{id:loredu.baseline,version:"1"}` returns core's fixed order: conflicts, revalidation, candidates, current, patterns, each mechanically ordered by contributing position and key. Invalid callback output is a fresh validation failure with no partial packet. Identical input and version must reproduce the permutation; changed behavior requires a version bump.

### Closed packet sections and compact disclosure

The packet sections are exactly current, patterns, candidates, conflicts, and needs revalidation. They are derived from M2 Current Knowledge, applicable Claim confidence/class, visible `needs_revalidation` Verifications, and an exact evidence-backed corpus filter/snapshot comparison. Working Lore uses ClaimPolicy validation/semantics but does not invoke M2's optional projection-wide advice callback; those policy details remain a `current` concern. One group may intentionally occur in more than one section. Retracted, superseded, and nonapplicable history is omitted from defaults but remains reachable through representative history and exact-key Claim affordances.

Each included knowledge occurrence carries a bounded deterministic summary, key/state/count/evidence/history metadata, exactly one or two representative handles, and complete disclosure affordances rather than raw unbounded values. Packet items and Ranker candidates use `WorkingLoreKeyDescriptor`: anchor Claim id, a Scope preview with the full pair count and first at most two canonical pairs, subject, predicate, and optional perspective. The packet uses one `WorkingLoreFilterDescriptor` with the same Scope preview and optional bounded corpus instead of echoing full Scope. Summary construction canonicalizes `{key:<descriptor>,state,values}` and uses a 512-Unicode-scalar cap.

Representative selection is owned entirely by M2. After a whole group passes M3's corpus filter, Working Lore forms a newly detached, recursively frozen tuple by literally mapping the corresponding `CurrentKnowledgeItem.values` to their `representative` handles in M2 exposed-value order. It neither selects, sorts, filters, replaces, prefers, nor deduplicates handles; Ranker, section, corpus-per-value, budgets, and continuation have no influence. M2 already orders values by earliest surviving Claim position and chooses a selected Resolution replacement or otherwise that value's earliest surviving Claim. Retracted zero-value groups are omitted; one exposed value yields one handle; two or more yield M2's first two. Thus A/B/C yields `[A,B]`. The separately chosen earliest contributing `anchor_claim` may differ and never replaces or reorders a representative. A conflict occurrence emits anchored claims first, then representative shows in tuple order; for disputed A/B/C that is claims, show A, show B, while C remains reachable through the anchored list. General top-level affordance deduplication can suppress only a later repeated show across occurrences, never mutate an item tuple. Coexisting occurrences emit no corrective top-level advice.

The complete Scope remains internal for semantics and once in normalized Basis query (and in each opaque stateless cursor), but no full Scope or ClaimKey is repeated in packet items, Ranker candidates, packet filters, or exact-key affordances. Existing Scope decoding remains unchanged. Preview pairs are disclosure only and never define equality, grouping, filtering, or reconciliation. Each key descriptor's anchor is the earliest contributing applicable Claim. The exact-key action is fixed-size `{query:{same_key_as:anchor_claim}}`; M3 additively adds the mutually exclusive `ClaimFilters.same_key_as`/`lor claims --same-key-as` form, which resolves the visible anchor and paginates all Claims under its complete exact key.

### Global first-packet budgets and per-section continuation

This decision narrowly supersedes [ADR 0009](./0009-hypermedia-pagination.md) only where its generic rule requires every Working Lore section to accept `--limit`. M3 instead uses the exact `max_items`/`--max-items` and `max_chars`/`--max-chars` controls for both global first-packet selection and section-only continuation. ADR 0009 remains in force for opaque Basis-pinned cursors, explicit returned/full-total counts, no silent truncation, deterministic ordering, and application-owned disclosure/affordances; its `--limit` rule remains unchanged for Claims, history, and other ordinary paginated collections.

The first packet has defaults `max_items=40` and `max_chars=12000`; accepted bounds are 1–200 items and 512–1,000,000 summary characters. Character accounting is exactly the sum of Unicode scalar values in returned summaries. Closed fixed-cardinality item descriptors plus the item bound constrain store-induced per-item structural growth; caller Scope in Basis/cursor transport remains outside this guarantee. Core selects the longest ranked prefix satisfying both limits and never skips an oversized next occurrence.

All five sections state `returned` and full pinned `total`, including zero. Text always renders all five count lines in `current`, `patterns`, `candidates`, `conflicts`, `needs_revalidation` order; only item details are conditional. Every truncated section has its own opaque continuation and affordance.

After validating the Ranker's dense global permutation, core computes `base64url-no-padding(SHA-256(UTF-8(JSON.stringify(permutation))))`; permutation JSON has no whitespace and the digest is exactly 43 characters. SHA-256 is pure deterministic kernel code with no dependency or host capability. Every section cursor binds algorithm `sha256`, global candidate count and digest, section, and either `before-first` or `after:{section_ordinal,occurrence_index}`. The occurrence index is core's pre-ranking index, so `(section,occurrence_index)` is exact identity. All cursors from one packet share count/digest; budgets never affect them.

Closed shape/budget validation precedes callbacks. Pinned head/anchor, operation/query, and complete core/policy/Ranker identity mismatch is `CURSOR_MISMATCH` before callbacks. Core then rebuilds pinned M2 semantics, invokes Ranker once, validates output, compares digest/count, and verifies the exact bound occurrence/ordinal before budgeting. Malformed Ranker output remains fresh `VALIDATION_FAILED`; a valid changed permutation or impossible resume is `CURSOR_MISMATCH`, with no partial packet. Continuation consumes no Clock and persists neither derived items nor a full permutation; beyond the shared cursor version, operation/query, Basis, pinned-head anchor, valid point, and computed-time metadata, only bounded algorithm/digest/count/section/resume ranking material exists in each cursor. Representative ids do not enter the permutation digest or occurrence identity; equal-Basis rebuild must reproduce their semantic ids/order, and Ranker, section, budget, or continuation changes cannot alter them.

### Working Lore Basis without M0–M2 drift

Existing `RulesetIdentity`, `Basis`, and `createBasis` remain exact and unchanged. Working Lore uses an exact extension containing core, ClaimPolicy, and Ranker identities. The existing shared `basisEquals` runtime comparison preserves ordinary behavior, returns false when exactly one side has Ranker identity, and compares exact Ranker id/version when both do, in addition to head/core/policy/query. Its normalized query records operation, activity, resolved valid point, and present scope/corpus; budgets and cursor do not participate. A packet is reusable only at equal store head, all three equal identities, and equal normalized query. v0.x remains conservatively store-wide: any append makes the packet stale, which necessarily catches one new relevant record. Ranker version changes invalidate only Working Lore identity, not canonical records or unrelated M0–M2 responses.

Replay equality follows ADR 0027: section membership, summaries, counts, ordering, selected occurrences, representative ids/order, and surface-neutral actions/params are semantic; computed time, human why text, rendered CLI commands, and private cursor bytes are not.

### Additive CLI grammar

M3 adds `lor lore --activity <token>` with repeated scope, optional corpus JSON, item/character budgets, cursor continuation, JSON mode, and existing global store selection. It also adds `lor claims --same-key-as <claim-id> [--limit ...]`; that anchor is mutually exclusive with every other Claim filter and cursor. Cursor form forbids cursorless filters but permits new budgets. It retains the implemented envelope, recursive affordance rendering, store/error/exit behavior, and exact one-object JSON rule. Empty matching scope is successful with five definitive zero sections, Basis, computed time, and exit 0.

## Consequences

- T40–T45/T75 have one implementable application, packet, ranking, budget, continuation, disclosure, and staleness contract.
- Store-induced per-item structural growth is bounded by item count and fixed-cardinality descriptors, while `max_chars` caps summary scalars rather than serialized bytes. Caller Scope in Basis/cursor transport remains caller-input-proportional; callers follow stable anchors and handles for complete detail.
- Custom lexical, embedding, graph, or model reranking can be supplied later without teaching core that implementation, but its version is visible and its output cannot alter membership, counts, or M2-owned representative tuples.
- A global first-packet budget can omit every item from a later display section; explicit full totals and start-of-section cursors make that omission visible and recoverable.
- M3 reuses M2 reconciliation/evidence and does not append derived records, reinterpret Resolution, crawl sources, or create another projection store.

This decision additively closes ADR 0005/0010's conceptual Ranker boundary and ADR 0009's Working Lore continuation follow-up. It narrowly supersedes only ADR 0009's generic Working Lore `--limit` spelling with the exact two-budget controls above; ADR 0009's pagination and disclosure ownership rules remain in force. It specializes ADR 0006/0027 Basis and semantic-replay rules only for Working Lore, without changing existing Basis values.

## Rule / follow-up

M3 implementation must use public RecordStore snapshots and assembled ClaimPolicy/Ranker ports, preserve every implemented M0–M2/M1.5 surface, and move T40–T45/T75 only with executable evidence. Required permutation digest vectors are `[]→T1PNoYwrqgwDVLtfmj7L5e0Sq02OEbqHPC8RFhICuUU`, `[0]→0LyhEfhigTetxMFvEjSW3N0dWQ0Gy12azWizn-ZW-5c`, `[1,0]→Wq8eGD8frxLDJ9wvuMIjAi8EaExh_DRTO_9i5-Vyx3Y`, and `[0,2,1]→F-xKZQnI4WgcP4GTnO6egQd0keFR1WmtDMbwMZYgGBg`.

Implementation vectors must cover retracted omission; preferred and one-value disputed `[A]`; coexisting/disputed A/B and A/B/C preserving exact M2 `[A,B]` order and full count; disputed A/B/C advice `claims, show A, show B` and coexisting A/B/C no corrective advice; Resolution-selected representatives distinct from anchors; one representative for equal-value duplicate/corroborating Claims; identical tuples across sections despite custom Ranker order; tuple replay and budget/continuation invariance; unchanged and alternating same-version permutations, Ranker-version pre-callback mismatch, malformed output, changed budgets, `before-first`, duplicate cross-section occurrences, pinned append exclusion, Scope previews at 0/1/2/3/very-large cardinality, equal previews with distinct exact keys, bounded one-item huge-Scope packets, anchored full disclosure/pagination/errors, unchanged historical decode/replay, and ordinary/Working Lore Basis equality in both directions. This docs-only decision changes no code and no catalog row.

A future change to activity/corpus query identity, section membership, compact item shape, summary/accounting limits, Ranker input/output, section priority, cursor resume semantics, Working Lore ruleset identity, or CLI spelling requires a superseding decision. Ranking quality remains an M4 real-consumer judgment, not an M3 deterministic acceptance claim.
