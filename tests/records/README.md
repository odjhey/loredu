# records — M0, records and application append

Catalog rows **T01–T08, T19, T80, T83–T85, T87** live here. The live `public-entry-append.test.ts` and `record-foundation.test.ts` suites implement T01–T08, T84, T85, and T87; policy, reference-orchestration, and remaining append rows stay deferred to their owning M0 slices. Drive only public `@loredu/kernel` and `@loredu/kernel/testing` exports.

Cover all five exact family shapes; closed envelopes and reserved/excess fields;
portable JSON rejection/equality; detached deep freezing; canonical timestamps;
JSON-value encode/stringify/parse/decode; exact id fixtures/collisions; and structured
code + RFC6901 paths. T19 checks every record-reference field through application
append against InMemoryStore, including missing and wrong-kind refs before stamping;
SourceRefs are never lookups. T87 proves exact assembly/imports, branded positive increasing positions, `createStreamPosition`, no failure advancement, and helper separation. Spy failures prove validation → references → entropy → Clock → append and exact consumption.

Supplemental vectors cover all family/subtype shapes; Verification basis snapshots/nonempty/duplicates; every timestamp range/calendar/offset/fraction/validity edge; repeated/order-sensitive JSON arrays and repeated aliases; cycles and every JS-only value; nested accessors, symbols, custom prototypes and excess fields; codec detachment; every capability failure/reference kind/path/collision; and final exact export allowlists. No filesystem or provider codec belongs here.

T86 remains M2 conflict evidence even though its canonical equality primitive and
noncatalog adversarial vectors land in M0.

Contracts: [records](../../docs/architecture/contracts/records.md),
[clock/identity](../../docs/architecture/contracts/clock-and-identity.md),
[ADR 0020](../../docs/decisions/0020-m0-public-contract-closure.md),
[ADR 0021](../../docs/decisions/0021-strict-rfc3339-instant-domain.md).
