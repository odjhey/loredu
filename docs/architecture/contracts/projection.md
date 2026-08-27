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

## Basis and ruleset identity

The structural ruleset identity is exact ([decision 0020](../../decisions/0020-m0-public-contract-closure.md)):

```yaml
ruleset:
  core: loredu.reconciliation/v1
  claim_policy:
    id: loredu.default
    version: "1"
```

Policy id and version are identifier-safe tokens. Structural composition avoids ambiguous concatenated versions. Core behavior is covered by `core`; policy behavior by `claim_policy`. A generic same-value/different-key hint belongs to core mechanics, not default-policy advice.

`Basis` is exactly:

```yaml
stream_position: opaque nonnegative safe position
ruleset: { core: loredu.reconciliation/v1, claim_policy: { id: loredu.default, version: "1" } }
query: { as_of: ..., valid_at: ..., scope: ... }
```

`query` is a closed `JsonObject` value with object-order-insensitive structural identity. `computed_at` is a separate projection field, never a Basis field and rejected by `createBasis`. M0 exports `createRulesetIdentity(policy)`, `createBasis(input)`, and `basisEquals(left, right)` plus `DEFAULT_RULESET_IDENTITY`. `createRulesetIdentity` validates the exact M0 policy surface and snapshots id/version without invoking policy callbacks. `createBasis` descriptor-validates the root and nested ruleset, detaches, canonicalizes, and freezes the exact closed shape; malformed construction, including `computed_at`, is `VALIDATION_FAILED`. Equality compares stream position, structural core and policy identity, and portable-JSON query value. M0 supplies these primitives only. It does not claim a projection, cache, advice envelope, or deterministic derived bytes; those remain later milestones ([decision 0024](../../decisions/0024-m0-policy-and-basis-runtime-boundaries.md)).

Once projections exist, a consumer compares `basis.stream_position` against store head to detect staleness without replaying history. In v0.x this check is conservatively store-wide. Same basis reproducing the same derived content is an M2 projection guarantee, not an M0 primitive claim.

## Changes since a point

A separate event-stream style query may expose records and derived changes since a stream position. This supports recurring activities asking what Loredu learned since the previous run — keyed off the previous packet's `basis.stream_position` — without rebuilding their own change log.

## Rebuild invariant

Deleting any materialized/current projection and replaying canonical records must reproduce the same projected knowledge for the same query and the same (versioned) reconciliation/resolution ruleset. A ruleset version bump invalidates cached views without touching canonical records.
