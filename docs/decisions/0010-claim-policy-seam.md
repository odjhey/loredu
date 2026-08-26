---
name: decision_claim_policy_seam
description: "One versioned ClaimPolicy extension seam owns consumer claim semantics (identity, coexistence, advisories); its version participates in the basis; kernel invariants stay in core."
type: decision
tags: [decisions, extensions, claims, reconciliation, versioning]
generated: "Claude Fable 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T00:00:00+08:00
---

# 0010: The ClaimPolicy extension seam

## Context

Several remaining semantic questions are consumer-domain questions, not kernel questions ([issue #6](https://github.com/odjhey/loredu/issues/6)). The clearest: whether differing values under one claim key are exclusive or may coexist. A technical consumer wants `default_frontend` exclusive but `supported_frontend` coexisting; a process consumer wants documented/observed perspectives to coexist and their divergence surfaced; a legal consumer has base-document/amendment semantics the kernel should never learn. Baking any of these into core grows a predicate ontology — the "source-code-specific product" failure mode generalized.

The ownership split is:

- **core** owns mechanics every implementation must agree on: immutable records, append/commit semantics, provenance, stream positions, replay/schema compatibility, temporal projection semantics, explicit Resolutions, bounded Working Lore;
- **extensions/policies** own consumer semantics that legitimately vary: how claim identity is constructed, whether values conflict or coexist, optional deterministic cross-claim advisories;
- **surface adapters** render semantic affordances as CLI commands, HTTP links, or library calls ([0009](./0009-hypermedia-pagination.md)).

## Options considered

- bake value semantics into core (cardinality fields, predicate ontology);
- many small ports (`ScopeNormalizer`, `CardinalityProvider`, `PerspectiveMatcher`, …);
- one narrow, versioned `ClaimPolicy` seam with a built-in default.

## Choice

One seam, conceptually:

```ts
interface ClaimPolicy {
  // Derive or validate the exact deterministic identity reconciliation uses.
  identity(claim): ClaimKey
  // Whether differing values under this identity are exclusive or may coexist.
  // Intentionally tiny in v0.x: 'exclusive' | 'coexisting'.
  semantics(claimOrKey): ClaimSemantics
  // Optional deterministic, non-judgmental advisories across related claims
  // (e.g. documented vs observed divergence).
  advise?(claims): MechanicalAdvisory[]
}
```

The exact API shape is an implementation decision; the ownership boundary is the contract.

**Rules of the seam:**

1. Core never interprets consumer vocabulary (repository/project/contract/domain terms).
2. Mechanical reconciliation never crosses the exact key the policy returns/validates.
3. Policy output is deterministic for the same inputs and policy version — policy is consumer-supplied *mechanics*, never judgment; the mechanical/judgment split ([0008](./0008-cli-first-agent-reactive.md)) is unchanged.
4. Any policy that can change reconciliation, projections, health/advisory output, or Working Lore selection carries a stable version identity.
5. That version participates in the `ruleset` component of every basis ([0006](./0006-explicit-version-basis.md)), so replay stays meaningful when policy changes and a policy bump invalidates cached views without touching canonical records.
6. No splitting into micro-ports unless real consumers force it.
7. `Extractor`, `Resolver`, and `Ranker` remain separate capability boundaries; this seam covers deterministic claim-domain policy only.

**Default policy ships in core.** Zero configuration: identity is the declared key of [0004](./0004-claim-identity-key.md) (shape-validated, vocabulary consumer-owned), every key's values are `exclusive`, no advisories beyond the built-in key-divergence hint. v0.x and M1.5 behavior are exactly as already specified; the first custom policy arrives with a real consumer (M4), per the stabilization bar of [0005](./0005-embedded-kernel-compatibility.md).

## Consequences

- consumers supply claim identity, coexistence, and advisory semantics without core changes or new record kinds;
- `ClaimSemantics` stays a two-value enum in v0.x — merge functions, cardinality counts, and richer ontologies are refused until a consumer demonstrates the need;
- coexisting values under one key corroborate a *set* instead of raising conflict candidates; exclusive keys behave as today;
- policy-produced advisories obey the same rules as all advice: deterministic, non-blocking, never speculative;
- the basis/ruleset now names (core ruleset version + active policy version), keeping byte-reproducibility checkable.

## Rule or follow-up

Anything that can alter derived views must be versioned inside the basis — no exceptions for policies. When the first custom policy lands (M4), a conformance test must show: same records + same policy version → identical projections; policy version bump → cached views invalidated, canonical records untouched.
