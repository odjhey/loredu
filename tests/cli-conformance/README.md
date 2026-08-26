# cli-conformance — the compiled binary

Catalog rows **T50–T58** (`--json` on every command, exit codes distinct per failure
class, `--body -` reading stdin byte-exact, the reconciliation feedback line, the
scripted journey 0→8, command-count ergonomics, and content-first behavior for bare
`lor`, `--help`, and unknown flags), **T60–T68** (the agent-reactive envelope:
`ok`/`result`/`reconciliation`/`advice`/`basis`, runnable advice, determinism, the
advice chain ending at a healthy `status --check`, and `lor claims` filter
composition), and **T70–T75** (pagination, cursor stability under concurrent
appends, invalid-cursor errors, and disclosure levels 0→4 by link-following only).

These tests **spawn the compiled `lor`** (`bun run build` → `packages/cli/dist/lor`),
not the library: the point is that the shipped artifact behaves, including its exit
codes and stdout/stderr split. Parse `--json` output; assert on the envelope, never
on prose wording. Point `LOREDU_HOME` at a temp directory per test.

Contracts: [ADR 0008](../../docs/decisions/0008-cli-first-agent-reactive.md),
[ADR 0009](../../docs/decisions/0009-hypermedia-pagination.md),
[first user journey](../../docs/v0.x/execution/first-user-journey.md).
