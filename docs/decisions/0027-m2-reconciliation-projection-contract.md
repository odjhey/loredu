---
name: m2_reconciliation_projection_contract
description: "Closes M2 deterministic pair semantics, ClaimPolicy advice, Resolution precedence, bitemporal Current Knowledge, evidence/history summaries, and cache invalidation before implementation."
type: decision
tags: [decisions, m2, reconciliation, projection, temporal, policy]
generated: "OpenAI coding agent, 2026-08-28"
created_at: 2026-08-28T08:00:00+08:00
---

# 0027: Close deterministic reconciliation and Current Knowledge before M2 implementation

## Context

The M2 plan named duplicate detection, support/conflict, policy mediation, temporal projections, explicit Resolution application, and rebuild behavior, but it did not define one implementable API or derived shape. In particular, it left duplicate versus corroboration unspecified, did not say how optional policy advice could return without crossing ClaimKey identity, did not order Resolution/Relation/mechanical precedence, and allowed “current” to depend on ambient time without putting that semantic input in Basis. Separate implementation crews could pass the existing T20–T30/T86 prose with incompatible state vocabularies, interval boundaries, evidence counts, or cache rules.

ADR 0026 deliberately stopped M1.5 at exact-key overlap and reserved `current`/temporal flags for M2. ADR 0024 also deliberately rejects advice on the M0 policy shape until a later contract records the additive callback and ruleset consequences. M2-C is that closure; it must not pretend the engine or catalog rows already exist.

## Options considered

- Let implementation tests choose relation names, Resolution precedence, and point-time defaults. Rejected: this would make the catalog the accidental domain design and make parallel work incompatible.
- Treat latest stream position, confidence, or actor class as automatic truth preference. Rejected: those are provenance/order facts, not judgment, and would violate the mechanical-versus-judgment boundary.
- Let bare `current` consult wall time without recording the resolved valid point. Rejected: identical Basis values could then produce different content.
- Add persisted derived Relations or a projection/evidence database. Rejected: derived content must remain disposable and canonical records sufficient for rebuild.
- Add one bounded surface-neutral `current` operation, put its resolved valid point in Basis, expose exact bounded history/evidence summaries with record affordances, and make policy output advisory-only. Chosen.

## Choice

The exact [projection contract](../architecture/contracts/projection.md) governs M2.

### One bitemporal, bounded application projection

`LoreduApplication.current(query?)` returns the application envelope with an operation-specific `{computed_at, items}` result and `page`; its exact type omits the mutation `reconciliation` member and replaces it with `ProjectionReconciliationSummary`. Query input is scope plus optional `as_of` and `valid_at`, or a cursor. Bare current uses one Clock sample as both `computed_at` and the resolved valid point; `as_of=A` alone uses A as the valid point; explicit `valid_at=V` always wins. The resolved canonical `valid_at` is always in Basis query. `computed_at` remains outside Basis and does not affect derived content.

`as_of` includes records with `recorded_at <= A`. Claim intervals and Resolution effectiveness are inclusive. The full atomic scan head remains the Basis position, so v0.x staleness stays conservatively store-wide. Pagination uses the existing opaque cursor and carries the first page's computed time without consuming Clock on continuation.

M2 adds no second canonical history or evidence store. Current items expose bounded value representatives, exact-key Claim affordances, a two-relation history preview plus full counts, and mechanical Entry/SourceRef/Verification counts. Existing `claims`, `show`, and record-centered `history` are the complete disclosure path.

### Closed relation and state vocabulary

Derived pair relations are exactly `duplicate`, `corroboration`, `support`, `conflict`, `coexistence`, and `temporal-succession`. They are never appended records. Same-key interval-disjoint pairs are temporal succession. Overlapping different values are conflict under `exclusive` and coexistence under `coexisting`. Overlapping equal values are duplicate only for an equal semantic fingerprint plus equal Actor or a nonempty equal evidence basis; otherwise independent actor/evidence yields corroboration and the remaining same-actor reinforcement is support. Canonical JSON equality governs values.

Current Knowledge states are exactly `preferred`, `coexisting`, `disputed`, and `retracted`. “Preferred” means the deterministic precedence rules leave one value; it is not a truth claim. Results never break ties by latest append, confidence, actor, lexical value, Verification, or policy advisory.

### ClaimPolicy remains mediation, not identity or judgment

Core still constructs and owns the exact declared ClaimKey. Projection invokes validation and `exclusive|coexisting` semantics once per selected key. M2 additively accepts optional `advise(context)`. Its frozen context contains exactly scope-selected, recorded-visible, valid-time-applicable Claims; recorded-visible/backward-valid Relations only when both endpoints are in that set; and recorded-visible/effective/backward-valid Resolutions only when every Claim target/replacement is in the set and every Relation target is admitted. One irrelevant target excludes the whole Resolution from policy input.

Advice is called exactly once on every admitted first page and continuation, including empty context, after pinned reconciliation/context construction and before full count/order/pagination; omitted advice and invalid pre-admission cursors cause zero calls. Continuation preserves Basis/ruleset/head/valid point/computed time, consumes no Clock, stores no advice output, and deterministically recomputes the combined stream before resume. Its closed output names one or two visible Claims plus a code/details object. Core descriptor-validates the returned Array and own length first. More than 200 drafts fails with a fresh `VALIDATION_FAILED` before density or element validation, sorting, counting, or pagination and returns no partial result; accepted output must be dense before its elements are validated and canonically ordered. The literal maximum adds no public constant.

Policy advisories may cross keys but cannot create relations, merge identities, choose values, close health, or suppress core key-divergence. The default policy still emits none. Adding/changing callback behavior requires a policy version bump, already represented structurally in RulesetIdentity. `createRulesetIdentity` never invokes executable callbacks.

This decision additively supersedes ADR 0024's M0 rule that public `advise` is rejected: M0 behavior remains correct for that milestone; M2 assembly permits this one exact optional field. It closes ADR 0010's previously conceptual `advise` shape while retaining ADR 0020's declared-key/no-remapping correction to ADR 0010's older `identity` sketch.

It also narrowly supersedes ADR 0006 only where that decision calls same-Basis derived views byte-identical or byte-comparable. M2 guarantees semantic-content equality for items, reconciliation/counts/order, and surface-neutral affordance actions/params. Separate `computed_at`, human `why` prose, surface rendering such as CLI `run`, and private cursor bytes are excluded. ADR 0006's structural Basis, version identity, staleness, and ruleset invalidation rules remain in force.

### Resolution first, explicit Relation second, mechanics third

For each exact key, core first builds the nonempty set of scope-selected, recorded-visible Claims applicable at the resolved valid-time point; every preference tier is confined to that set. A Resolution changes group state only when it is visible/effective/backward-valid, directly targets every member, and satisfies its decision/replacement rule. Highest stream position wins among complete Resolutions. `prefer` and `supersede` require the replacement to be a directly targeted member of the applicable set; `retract` and `leave_disputed` require no replacement. Incomplete or incompatible Resolutions remain canonical history but do not partially choose a group; a later uncovered applicable Claim reopens it.

A Resolution can separately activate/deactivate a targeted persisted Relation without substituting for Claim coverage or making its endpoints applicable. In the absence of a complete Resolution, active same-key `supersedes` Relations establish precedence only when both endpoints belong to the applicable set. Any participating directed cycle forces disputed regardless of policy or equal values; cyclic edges remove no member, so a one-value cycle is disputed with one exposed value. Mechanical temporal succession is last. Future or otherwise nonapplicable targets remain history but cannot cover, replace, select, or remove an applicable Claim. Reconciliation never crosses an exact key at any tier.

### Upgrade M1.5 without replacing its protocol

The envelope, application/CLI failure forms, exits, list limits, handles, store selection, and cursor transport remain unchanged. M2 adds `current`, `current.read` affordances, `--as-of`/`--valid-at`, and a projection reconciliation summary. Claim-add feedback gains exact `duplicate|corroboration|support|temporal-succession` states with bounded `{state,key,related_count,related:[earliest handle],claims}` shapes. With earlier same-key Claims, selection is conflict-candidate > duplicate > corroboration > support > coexisting > temporal-succession and related fields cover only that class; `new-key` means no earlier same-key Claim. Succession is non-blocking and emits no corrective advice. Append does not execute projection-wide policy advice.

M2 status shares the pair classifier: only overlapping validity intervals with different values under `exclusive` form a conflict set, whose endpoint union owns count and Resolution completeness. Purely interval-disjoint succession is non-blocking history, samples no Clock, and a later Claim reopens health only by joining an overlapping conflict pair. This narrows ADR 0026's M1.5 broad same-key/different-value health rule when the M2 classifier exists; it does not retroactively claim the M1.5 implementation had temporal reconciliation.

## Consequences

- T20–T30 and T86 now have one deterministic contract to implement, including exact interval endpoints, pair classification, state names, ordering, Resolution precedence, and structural equality use.
- Current Knowledge can be cached and replayed without hidden wall-time semantics because its resolved valid point is part of query identity.
- Consumers inspect complete canonical history/evidence through existing bounded disclosure instead of depending on an unbounded nested projection or a second source of truth.
- Custom policy can surface deterministic process/perspective gaps without teaching core consumer vocabulary or changing exact-key reconciliation.
- The stricter complete-Resolution rule may leave more groups disputed, but it never fabricates judgment from a partial record.
- Pair derivation can be quadratic inside one key; M2 correctness and bounded output take precedence over optimization. Derived indexing may be added later without changing results.

## Rule / follow-up

M2 implementation must use only public RecordStore snapshots and the active assembled ClaimPolicy, add no persisted inferred records, and move catalog rows only with real executable evidence. T20–T30 and T86 remain deferred until those tests exist; this docs-only decision neither implements nor removes a deferred row.

A future change to temporal defaults, relation/state vocabulary, duplicate fingerprint, policy advice input/output, Resolution precedence, current result shape, evidence counts, cursor semantics, or cache validity requires a superseding decision. M3 consumes these projection states but does not redefine them.
