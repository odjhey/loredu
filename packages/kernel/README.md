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

## Public M0 surface

Only `@loredu/kernel` and `@loredu/kernel/testing` are entrypoints; deep imports are unsupported. The exact value/type allowlists and signatures are the [kernel API contract](../../docs/architecture/contracts/kernel-api.md). Normal runtime includes validated `createInstant`/`createStreamPosition`, codecs/equality, ClaimKey/Basis/policy primitives, and `createLoreduApplication`. Testing exports exactly InMemoryStore, FixedClock, and SeededRandomSource. Scaffold-only `AppendResult`, `RecordRef`, `stream`, `head`, and `StoreUnderTest` do not survive M0.

## Layout

```text
src/domain/    records, ids, JSON codec/equality, claim keys, Basis, validation
src/ports/     M0 append/get RecordStore, Clock, RandomSource, ClaimPolicy
testing/       M0 InMemoryStore, FixedClock, SeededRandomSource; M1 conformance,
               published only as @loredu/kernel/testing
```

`@loredu/kernel/testing` is test support, never product surface: production code in
any package must not import it. M0's three helpers implement the public contracts;
full scan/stream/head and reusable durable-store conformance remain M1.

## State

Scaffold. `src/` currently holds the record-kind vocabulary and the `RecordStore`
port declaration; no record is validated and no record is stored yet. Behavior arrives against the [behavioral catalog](../../docs/v0.x/execution/first-user-journey.md), including T87 public assembly/position evidence.
