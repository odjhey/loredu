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

The first compiled-binary slice is implemented: exact store selection and `init`,
all five record mutation forms, `show`, `head`, stdin Entry bodies, JSON/text
rendering, bare empty-store orientation, direct version/help, stable failure
categories, production host capabilities, and the build-time embedded `lor skill`.
Mutations, `show`, `head`, and status delegate to the surface-neutral application
operations landed in M15-K; only argv, store composition, rendering, and process
exit selection remain here. The query integration crew supplies `history`,
`claims`, list pagination, and the complete agent chain. M2/M3 still own
`current` and `lore`.

Compiled-binary evidence lives in
[`../../tests/cli-conformance/`](../../tests/cli-conformance/README.md). T51, T52,
and T58 are complete; literal T50 and T65 remain catalog-deferred until M15-Q
makes every M1.5 semantic command and the complete query chain executable. The
surface-neutral application semantics, including T60, are
covered separately in
[`../../tests/application/`](../../tests/application/README.md).
