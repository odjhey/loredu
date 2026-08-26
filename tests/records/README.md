# records — M0, records and validation

Catalog rows **T01–T08**: an entry is accepted and gets an id; every record carries
`schema`, `recorded_at`, and an actor; a claim missing a key field or carrying prose
in `subject.id` is rejected with a message naming the field; records are
value-immutable; unknown namespaced metadata round-trips; the same logical input
twice yields two records; ids carry the three-letter kind prefix and a record whose
prefix disagrees with its `kind` is rejected.

Also the draft/record split (**T83**) and `recorded_at` ownership (**T80**) once the
append path exists — see `../reconciliation/README.md` for the rest of the kernel
invariants.

Drive `@loredu/kernel`'s public exports with the in-memory reference store from
`@loredu/kernel/testing`. No filesystem, no `lor`.

Contracts: [records](../../docs/architecture/contracts/records.md),
[ADR 0004](../../docs/decisions/0004-claim-identity-key.md).
