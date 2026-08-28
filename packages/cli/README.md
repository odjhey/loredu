# `@loredu/cli` — the `lor` binary

Argv in, rendered commands out. The target boundary keeps query and health
mechanics in the application API while the CLI parses arguments, renders the
response envelope and its affordances as text or `--json`, and embeds the agent
skill at compile time ([ADR 0011](../../docs/decisions/0011-repo-package-architecture.md),
[ADR 0008](../../docs/decisions/0008-cli-first-agent-reactive.md),
[ADR 0026](../../docs/decisions/0026-m15-application-cli-contract.md)). The
first-slice containment exception is recorded below.

```sh
bun run build     # bun build --compile → ./dist/lor
bun bin/lor.ts --version
```

## State

The first compiled-binary slice is implemented: exact store selection and `init`,
all five record mutation forms, `show`, `head`, stdin Entry bodies, JSON/text
rendering, bare empty-store orientation, direct version/help, stable failure
categories, production host capabilities, and the build-time embedded `lor skill`.
For this slice, direct `show`/`head` reads and unpaginated status health and
advisories are contained in the CLI so bare orientation and `status --check` are
live. The application query/feedback crew still owns their application-layer
forms and Claim feedback; the query integration crew supplies `history`,
`claims`, pagination, and the complete agent chain. M2/M3 still own `current`
and `lore`.

Compiled-binary evidence lives in
[`../../tests/cli-conformance/`](../../tests/cli-conformance/README.md). T50–T52
and T58 are complete; T60 and T65 remain catalog-deferred until their application
feedback and complete query-chain portions land. The surface-neutral application
semantics are covered separately in
[`../../tests/application/`](../../tests/application/README.md).
