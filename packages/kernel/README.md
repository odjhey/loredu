# `@loredu/kernel`

The application kernel: record semantics, ports, and (as M0/M2 land) the append
path, reconciliation, projections, and Working Lore.

## Invariants this package is built to keep

- **Zero runtime dependencies.** The manifest declares none, and may not declare
  the adapter or CLI packages ([ADR 0011](../../docs/decisions/0011-repo-package-architecture.md)).
- **No environment-specific APIs.** No `node:*`, bare Node built-in, or `bun:*`
  imports, and no ambient Bun/Node globals. `tsconfig.json` sets `"types": []` and
  `"lib": ["ES2023"]`, so `process`, `Buffer`, `__dirname`, and `Bun.*` are
  *undeclared identifiers* here: using one fails `bun run typecheck`. That is the
  guardrail, not a convention — see
  [ADR 0016](../../docs/decisions/0016-workspace-scaffold-and-kernel-type-isolation.md).

Anything the kernel needs from its environment arrives through a port in
`src/ports/`, implemented by an adapter.

## Layout

```text
src/domain/    records, ids, claim keys, validation
src/ports/     RecordStore, and later ClaimPolicy, Extractor, Resolver, Ranker
testing/       M0 test-only reference store and deterministic capability
               helpers; M1 portable logical and durable-provider conformance
               suites; published only as @loredu/kernel/testing
```

`@loredu/kernel/testing` is test support, never product surface: production code in
any package must not import it.

## State

Scaffold. `src/` currently holds the record-kind vocabulary and the `RecordStore`
port declaration; no record is validated and no record is stored yet. M0 will add
an `InMemoryStore`, `FixedClock`, and `SeededRandomSource` only under the testing
subpath so public application tests can run without a provider. M1 adds separate
portable logical conformance cases and durable-provider evidence; only the latter
proves filesystem, locking, fsync, crash, or cross-instance replay guarantees,
and the M0 seam does not claim durability or codec behavior. The exact boundary is
[ADR 0021](../../docs/decisions/0021-m0-record-contract-closure.md). Behavior
arrives against the [behavioral catalog](../../docs/v0.x/execution/first-user-journey.md)
(M0 starts at T01).
