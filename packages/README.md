# Packages

Three packages, one-way dependency DAG ([ADR 0011](../docs/decisions/0011-repo-package-architecture.md)):

```text
cli ───────────────► kernel
 │                    ▲
 └──► store-plainfile ─┘
```

| Package | Name | Role |
|---|---|---|
| `kernel/` | `@loredu/kernel` | records, ports, application semantics. Zero runtime dependencies, no environment-specific APIs. |
| `store-plainfile/` | `@loredu/store-plainfile` | the plain-file `RecordStore` adapter. May use `node:*`/`bun:*`. |
| `cli/` | `@loredu/cli` | the `lor` binary: argv in, rendered affordances out. |

Package `exports` point at TypeScript sources: Bun runs and bundles TS directly, so
there is no build step between packages. Only `cli` builds, and only to compile the
binary (`bun run build`). `bun run check:workspace-boundaries` resolves static imports,
re-exports, and dynamic imports to package/subpath ownership, rejects production access
to `@loredu/kernel/testing`, and enforces the DAG even for relative paths. It is a
purpose-built guard, separate from dependency-cruiser.

Behavioral tests live centrally in [`../tests/`](../tests/README.md), shaped by the
behavioral catalog rather than by this tree.
