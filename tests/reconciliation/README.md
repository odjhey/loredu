# reconciliation — M2, with an M0 location exception

Catalog rows **T20–T30**: corroboration and candidate conflicts under one declared
key; perspective gaps that are not conflicts; claims under different keys never
auto-reconciling; `resolve --decision prefer` flipping projection preference while
mutating no record; `as_of` / `valid_at` and their combination; replay reproducing an
identical projection for the same basis; and every projection carrying its `basis`.

Rows **T80–T83** are **M0 kernel-invariant ownership**, located in this directory
only as an existing test-tree exception (they are not M2 rows): `recorded_at`
stamped at commit and never open to backdating, `computed_at` outside basis
identity, the default policy being byte-identical with M1.5 behavior while naming
its version in `basis.ruleset`, and the draft/record split enforced at both compile
time and runtime. This wording matches the root test README, records README, M0
plan, and catalog status.

Drive the application API directly; projections are pure functions of the record
stream, so these tests want the in-memory store and no filesystem.

Contracts: [projection](../../docs/architecture/contracts/projection.md),
[ADR 0006](../../docs/decisions/0006-explicit-version-basis.md),
[ADR 0010](../../docs/decisions/0010-claim-policy-seam.md),
[ADR 0021](../../docs/decisions/0021-m0-record-contract-closure.md).
