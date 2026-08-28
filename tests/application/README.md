# application — M1.5 and M2-R surface-neutral services

Public application tests for M1.5 response envelopes, filters, disclosure, and
pinned cursor pagination plus M2-R exact pair feedback and overlap-aware status
health. These tests use only
`@loredu/kernel` and `@loredu/kernel/testing`; CLI parsing, rendering, host
capabilities, and the compiled binary remain in `tests/cli-conformance/`.

Contracts: [application and CLI](../../docs/architecture/contracts/application-cli.md),
[ADR 0026](../../docs/decisions/0026-m15-application-cli-contract.md).
