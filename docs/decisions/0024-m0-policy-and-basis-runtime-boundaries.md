---
name: m0_policy_and_basis_runtime_boundaries
description: "Makes ClaimPolicy assembly and structural Basis construction explicit runtime validation boundaries without pulling Claim append or projection behavior into M0-P."
type: decision
tags: [decisions, m0, policy, basis, validation]
generated: "OpenAI coding agent, 2026-08-28"
created_at: 2026-08-28T03:20:00+08:00
---

# 0024: Validate M0 policy and Basis inputs at their public construction boundaries

## Context

[ADR 0020](./0020-m0-public-contract-closure.md) fixes the structural ClaimPolicy, RulesetIdentity, and Basis API, but implementation still had to decide how runtime JavaScript callers encounter malformed custom ports and forged typed objects. TypeScript types alone cannot reject an accessor-bearing Basis, an invalid policy identity, or an older policy that still exposes an identity-remapping callback. M0-P must make those failures observable without taking ownership of M0-A's generic Claim append, reference reads, or capability ordering.

## Options considered

- Trust every typed input and let malformed values fail incidentally. Rejected because the public constructors are also JavaScript runtime boundaries and the contract requires closed validation.
- Execute custom ClaimPolicy callbacks while constructing ruleset identity. Rejected because ruleset construction has no ClaimKey, callbacks do not define policy identity, and speculative execution would add side effects unrelated to construction.
- Add another public policy factory or validation function. Rejected because the frozen M0 normal-entrypoint allowlist has no such value and `createRulesetIdentity(policy)` plus application assembly already provide the required boundary.
- Validate structure at the existing public boundaries, snapshot only policy id/version for RulesetIdentity, and leave Claim callback execution to M0-A's Claim append path. Chosen.

## Choice

`createRulesetIdentity(policy)` and `createLoreduApplication(dependencies)` validate the M0 ClaimPolicy surface before accepting it. `id` and `version` must be identifier-safe tokens and both required callbacks must be callable. Own public fields outside `id`, `version`, `validateClaimKey`, and `semantics` reject. In particular, legacy `identity` remapping and M0-excluded `advise`/`advisories` fields reject without invoking them. Ruleset construction invokes no policy callback and snapshots only the validated id/version into a detached, deeply frozen structural identity.

The built-in policy is itself deeply frozen, validates the exact closed declared ClaimKey shape, returns a frozen ordered issue list, chooses `exclusive`, and exposes neither identity transformation nor advice.

`createBasis(input)` is the sole runtime canonicalization boundary for Basis. It descriptor-inspects the exact closed root and nested ruleset shapes, validates the nonnegative safe stream position and fixed core/policy identities, copies `query` through the existing portable-JSON canonicalization routine, and returns a detached deeply frozen Basis. `computed_at` is an unknown field at this boundary because it belongs beside Basis on a future projection. Malformed construction fails with `LoreduError` code `VALIDATION_FAILED` and ordered pointer-addressed issues.

`basisEquals` compares constructed Basis values structurally: stream position; core, policy id, and policy version; then object-order-insensitive portable-JSON query equality. It does not canonicalize or repair malformed forged values.

M0-P does not execute a custom policy against a Claim during append. That execution point, including validating callback outputs, belongs to M0-A when generic Claim append reaches the policy phase. Entry append only validates the assembled port shape and otherwise preserves landed P0 behavior.

## Consequences

- Runtime JavaScript cannot reintroduce the identity-derivation seam that ADR 0020 removed.
- Ruleset identity creation is deterministic and side-effect free even for a custom executable policy.
- Basis values have one canonical detached form, while equality remains a small pure operation over that form.
- T81 and T82 can exercise real public behavior without claiming projections, reconciliation, generic append, or policy advice.
- Custom policies may use private implementation state, but public own properties remain the exact M0 port surface.

## Rule / follow-up

M0-A must call `validateClaimKey` only with the core-constructed, frozen declared ClaimKey, reject any returned issues before stamping, validate `semantics` as exactly `exclusive|coexisting`, and never accept transformed identity. It must not weaken the assembly validation or add policy advice to the M0 interface. Any later additive advice API requires its own contract decision and ruleset-version consequences.
