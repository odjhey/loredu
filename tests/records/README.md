# records — M0, records and validation

Catalog rows **T01–T05, T07–T08, T15, T84–T85**: an entry is accepted and gets
an id; every record carries `schema`, `recorded_at`, and an actor; a claim missing
a key field or carrying prose in `subject.id` is rejected with a message naming the
field; records are value-immutable; the same logical input twice yields two records;
ids carry the three-letter kind prefix and a record whose prefix disagrees with its
`kind` is rejected; and the application tests through the pure in-memory
`@loredu/kernel/testing` seam with deterministic capability helpers. T15 is an M0
seam test only and does not claim durable-provider behavior. T06's serialize/parse
round-trip is M1 adapter evidence, not a kernel test.

Also the draft/record split (**T83**) and `recorded_at` ownership (**T80**) once the
append path exists — see `../reconciliation/README.md` for the rest of the kernel
invariants.

Drive `@loredu/kernel`'s public exports with the in-memory reference store from
`@loredu/kernel/testing`. No filesystem, no `lor`.

Contracts: [records](../../docs/architecture/contracts/records.md),
[ADR 0004](../../docs/decisions/0004-claim-identity-key.md).
