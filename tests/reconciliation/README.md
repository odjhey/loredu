# reconciliation — M0 identity primitives and M2 behavior

M0 rows **T81–T82** now cover public primitives only: Basis equality contains
exactly stream position, structural core+policy ruleset identity, and canonical query
while separate computed times do not participate; exact-shape tests reject
missing/excess/`computed_at`, and inequality covers each stream/ruleset/query
component. Default ClaimPolicy validates the exact declared key, selects `exclusive`,
emits no policy advice, and rejects remapping; custom policy assembly and structural
identity validation are deterministic and do not execute callbacks. Generic Claim
append executes custom validation later in M0-A.

M2 rows **T20–T30 and T86** cover actual corroboration/conflict, cross-key guards,
Resolution application, temporal projections, deterministic replayed content, and
ruleset invalidation. T86 uses the M0 structural JSON equality primitive but remains
M2 because duplicate/conflict classification does not exist in M0. M1.5 T68 owns
execution of the generic cross-key hint as versioned core mechanics, not policy advice.

Drive application/public primitives with InMemoryStore and no filesystem.
Contracts: [projection](../../docs/architecture/contracts/projection.md),
[ADR 0010](../../docs/decisions/0010-claim-policy-seam.md),
[ADR 0020](../../docs/decisions/0020-m0-public-contract-closure.md).
