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

Only `@loredu/kernel` and `@loredu/kernel/testing` are entrypoints; deep imports are unsupported. The exact final M0 value/type allowlists and signatures are the [kernel API contract](../../docs/architecture/contracts/kernel-api.md). The current M0-P runtime exports the five draft/record families, portable JSON codec/equality, ClaimKey, Instant/position constructors, versioned ClaimPolicy/default semantics, structural RulesetIdentity/Basis primitives, and the landed Entry append assembly slice. Testing exports exactly InMemoryStore, FixedClock, and SeededRandomSource. Scaffold-only `AppendResult`, `RecordRef`, `stream`, `head`, and `StoreUnderTest` do not survive M0.

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

The landed P0 Entry behavior remains intact. M0-R adds all five public draft/record families, strict timestamp/id/field validation, detached recursively frozen canonical data, portable JSON transport/equality, and ClaimKey/scope identity. M0-P adds the closed versioned policy port/default, remap rejection, and canonical structural RulesetIdentity/Basis construction and equality. Catalog rows T01–T08, T81, T82, T84, T85, and T87 are executable. Ordered reference validation, custom-policy execution during Claim append, and the complete generic append orchestration remain M0-A.
