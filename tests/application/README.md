# application — M1.5 surface-neutral services

Public application tests for M1.5 response envelopes, exact-key feedback, filters,
health/advisories, disclosure, and pinned cursor pagination. These tests use only
`@loredu/kernel` and `@loredu/kernel/testing`; CLI parsing, rendering, host
capabilities, and the compiled binary remain in `tests/cli-conformance/`.

Contracts: [application and CLI](../../docs/architecture/contracts/application-cli.md),
[ADR 0026](../../docs/decisions/0026-m15-application-cli-contract.md).
