# records — M0, records and application append

Catalog rows **T01–T08, T19, T80, T83–T85** live here. Drive only public
`@loredu/kernel` and `@loredu/kernel/testing` exports.

Cover all five exact family shapes; closed envelopes and reserved/excess fields;
portable JSON rejection/equality; detached deep freezing; canonical timestamps;
JSON-value encode/stringify/parse/decode; exact id fixtures/collisions; and structured
code + RFC6901 paths. T19 checks every record-reference field through application
append against InMemoryStore, including missing and wrong-kind refs before stamping;
SourceRefs are never lookups. Spy failures prove validation → references → entropy →
Clock → append and exact consumption. No filesystem or provider codec belongs here.

T86 remains M2 conflict evidence even though its canonical equality primitive and
noncatalog adversarial vectors land in M0.

Contracts: [records](../../docs/architecture/contracts/records.md),
[clock/identity](../../docs/architecture/contracts/clock-and-identity.md),
[ADR 0020](../../docs/decisions/0020-m0-public-contract-closure.md).
