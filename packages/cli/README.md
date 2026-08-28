# `@loredu/cli` — the `lor` binary

Argv in, rendered commands out. The CLI is a rendering adapter over the
application API: it parses arguments, renders the response envelope and its
affordances as text or `--json`, and embeds the agent skill at compile time
([ADR 0011](../../docs/decisions/0011-repo-package-architecture.md),
[ADR 0008](../../docs/decisions/0008-cli-first-agent-reactive.md),
[ADR 0026](../../docs/decisions/0026-m15-application-cli-contract.md)).
No domain logic lives here.

```sh
bun run build     # bun build --compile → ./dist/lor
bun bin/lor.ts --version
```

## State

Scaffold. `--version`/`-v` is the only implemented invocation; anything else
prints an honest "no commands yet" line and exits nonzero. The
[application and CLI contract](../../docs/architecture/contracts/application-cli.md)
owns the exact M1.5 command/exit surface and its staged M2/M3 additions.
Compiled rendering, command, and exit evidence belongs in the CLI conformance suite at
[`../../tests/cli-conformance/`](../../tests/cli-conformance/README.md); the
surface-neutral application semantics are covered separately in
[`../../tests/application/`](../../tests/application/README.md).
