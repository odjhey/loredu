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
capabilities, and the build-time embedded `lor skill`. Store-backed operations
delegate to the surface-neutral application API; only argv, store composition,
recursive runnable rendering, and process exit selection remain here. M2/M3
still own `current` and `lore`.

Compiled-binary evidence lives in
[`../../tests/cli-conformance/`](../../tests/cli-conformance/README.md). The M1.5
CLI rows T50–T53, T57–T58, T65, T73, and T74 are complete. T56 remains deferred
until the M2/M3 commands complete its staged journey. The exported runner accepts explicit
application policy and host-capability ports for embedded composition and conformance while
the shipped `lor` entry keeps the default policy and production Clock/RandomSource. Surface-neutral
application semantics are covered separately in
[`../../tests/application/`](../../tests/application/README.md).
