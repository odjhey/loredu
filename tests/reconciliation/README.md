# reconciliation — M2, plus the kernel invariants

Catalog rows **T20–T30**: corroboration and candidate conflicts under one declared
key; perspective gaps that are not conflicts; claims under different keys never
auto-reconciling; `resolve --decision prefer` flipping projection preference while
mutating no record; `as_of` / `valid_at` and their combination; replay reproducing an
identical projection for the same basis; and every projection carrying its `basis`.

Also rows **T80–T83** — the kernel invariants and the ClaimPolicy seam:
`recorded_at` stamped at commit and never open to backdating, `computed_at` outside basis
identity, the default policy being byte-identical with M1.5 behavior while naming
its version in `basis.ruleset`, and the draft/record split enforced at both compile
time and runtime.

Drive the application API directly; projections are pure functions of the record
stream, so these tests want the in-memory store and no filesystem.

Contracts: [projection](../../docs/architecture/contracts/projection.md),
[ADR 0006](../../docs/decisions/0006-explicit-version-basis.md),
[ADR 0010](../../docs/decisions/0010-claim-policy-seam.md).
