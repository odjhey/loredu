# cli-conformance — the compiled binary

Catalog rows **T50–T58**, **T60–T68**, and **T70–T75** belong here. The
[behavioral catalog](../../docs/v0.x/execution/first-user-journey.md) owns their
exact assertions, and
[`catalog-status.json`](../../docs/v0.x/execution/catalog-status.json) owns their
staged M1.5/M2/M3 implementation milestones. The
[application and CLI contract](../../docs/architecture/contracts/application-cli.md)
owns the protocol those rows exercise.

These tests **spawn the compiled `lor`** (`bun run build` → `packages/cli/dist/lor`),
not the library: the point is that the shipped artifact behaves, including its exit
codes and stdout/stderr split. Parse `--json` output; assert on the envelope, never
on prose wording. Point `LOREDU_HOME` at a temp directory per test.

Decision: [ADR 0026](../../docs/decisions/0026-m15-application-cli-contract.md).
