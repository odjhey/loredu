# `@loredu/cli` — the `lor` binary

Argv in, rendered commands out. The target boundary keeps query and health
mechanics in the application API while the CLI parses arguments, renders the
response envelope and its affordances as text or `--json`, and embeds the agent
skill at compile time ([ADR 0011](../../docs/decisions/0011-repo-package-architecture.md),
[ADR 0008](../../docs/decisions/0008-cli-first-agent-reactive.md),
[ADR 0026](../../docs/decisions/0026-m15-application-cli-contract.md)).

```sh
bun run build     # bun build --compile → ./dist/lor
bun bin/lor.ts --version
```

## State

The complete M1.5 binary is implemented: exact store selection and `init`, all
five record mutation forms, `show`, `history`, filtered/paginated `claims`,
paginated `status --check`, `head`, stdin Entry bodies, JSON/text rendering, bare
orientation, direct version/help, stable failure categories, production host
capabilities, and the build-time embedded `lor skill`. M2-R additively exposes
exact duplicate/corroboration/support/temporal-succession Claim feedback and
overlap-aware status health through those existing commands. Store-backed
operations delegate to the surface-neutral application API; only argv, store
composition, recursive runnable rendering, and process exit selection remain
here. Later M2/M3 work still owns `current` and `lore`.

Compiled-binary evidence lives in
[`../../tests/cli-conformance/`](../../tests/cli-conformance/README.md); executable
`@covers` annotations and
[`catalog-status.json`](../../docs/v0.x/execution/catalog-status.json) own current
row-level implementation accounting. The exported runner accepts explicit application
policy and host-capability ports for embedded composition and conformance, while the
shipped `lor` entry keeps the default policy and production Clock/RandomSource.
Surface-neutral application semantics are covered separately in
[`../../tests/application/`](../../tests/application/README.md).
