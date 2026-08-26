# `@loredu/kernel`

The application kernel: record semantics, ports, and (as M0/M2 land) the append
path, reconciliation, projections, and Working Lore.

## Invariants this package is built to keep

- **Zero runtime dependencies.** The manifest declares none, and may not declare
  the adapter or CLI packages ([ADR 0011](../../docs/decisions/0011-repo-package-architecture.md)).
- **No environment-specific APIs.** No `node:*`, bare Node built-in, or `bun:*`
  imports, and no ambient Bun/Node globals. `tsconfig.json` sets `"types": []` and
  `"lib": ["ES2023"]`, so `process`, `Buffer`, `__dirname`, and `Bun.*` are
  *undeclared identifiers* here: using one fails `bun run typecheck`. That is a
  guardrail, not a convention — see
  [ADR 0016](../../docs/decisions/0016-workspace-scaffold-and-kernel-type-isolation.md).
- **No ambient time or randomness.** Production sources may not read `Date.now()`,
  construct a zero-argument `new Date()`, or read `Math.random()`. The
  TypeScript-AST check (`bun run check:kernel-capabilities`) ignores comments and
  strings and permits `new Date(value)`; its focused tests prove every forbidden
  form red. Time and entropy arrive through the ports settled by
  [ADR 0018](../../docs/decisions/0018-capability-ports.md).

Anything the kernel needs from its environment arrives through a port in
`src/ports/`, implemented by an adapter.

## Layout

```text
src/domain/    records, ids, claim keys, validation
src/ports/     RecordStore, and later ClaimPolicy, Extractor, Resolver, Ranker
testing/       test-only reference store + store conformance suite,
               published only as @loredu/kernel/testing
```

`@loredu/kernel/testing` is test support, never product surface: production code in
any package must not import it.

## State

Scaffold. `src/` currently holds the record-kind vocabulary and the `RecordStore`
port declaration; no record is validated and no record is stored yet. Behavior
arrives against the [behavioral catalog](../../docs/v0.x/execution/first-user-journey.md)
(M0 starts at T01).
