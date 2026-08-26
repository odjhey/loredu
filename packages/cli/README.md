# `@loredu/cli` — the `lor` binary

Argv in, rendered commands out. The CLI is a rendering adapter over the
application API: it parses arguments, renders the response envelope and its
affordances as text or `--json`, and embeds the agent skill at compile time
([ADR 0011](../../docs/decisions/0011-repo-package-architecture.md),
[ADR 0008](../../docs/decisions/0008-cli-first-agent-reactive.md)).
No domain logic lives here.

```sh
bun run build     # bun build --compile → ./dist/lor
bun bin/lor.ts --version
```

## State

Scaffold. `--version` is the only implemented invocation; anything else prints an
honest "no commands yet" line and exits nonzero. The journey commands (`init`,
`add`, `lore`, `status`, `show`, `history`, `resolve`, `skill`) and the exit-code
contract land with M1+ (catalog T50–T58), together with the CLI conformance suite
in [`../../tests/cli-conformance/`](../../tests/cli-conformance/README.md).
