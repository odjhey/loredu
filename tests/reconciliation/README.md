# reconciliation — M0 identity primitives and M2 behavior

M0 rows **T81–T82** now cover public primitives only: Basis equality contains
exactly stream position, structural core+policy ruleset identity, and canonical query
while separate computed times do not participate; exact-shape tests reject
missing/excess/`computed_at`, and inequality covers each stream/ruleset/query
component. Default ClaimPolicy validates the exact declared key, selects `exclusive`,
emits no policy advice, and rejects remapping; custom policy assembly and structural
identity validation are deterministic and do not execute callbacks. Generic Claim
append policy execution is specified by the [kernel API contract](../../docs/architecture/contracts/kernel-api.md)
and covered by the records suite.

M2-R rows **T20–T23 and T86** now cover the executable deterministic engine
foundation: exact pair classes and canonical equality, preferred/disputed primitives,
active-cycle behavior, strict exact-key isolation, admitted frozen policy context, and
the 200/201 advisory boundary. Public `current`, temporal projection, complete
Resolution application, summaries/evidence, replay, and invalidation remain deferred
under **T24–T30** for M2-P/E. T86 uses the M0 structural JSON equality primitive but
remains M2 because this is its first use in pair classification. M1.5 T68 continues to
own the generic cross-key hint as versioned core mechanics, not policy advice.

Drive application/public primitives with InMemoryStore and no filesystem. The bounded
M2-R engine test imports the internal foundation module directly because ADR 0027
forbids adding a public reconciliation runtime function before `current`; package
entrypoint/export audits prove that this implementation seam did not become API.
Contracts: [projection](../../docs/architecture/contracts/projection.md),
[ADR 0010](../../docs/decisions/0010-claim-policy-seam.md),
[ADR 0020](../../docs/decisions/0020-m0-public-contract-closure.md).
