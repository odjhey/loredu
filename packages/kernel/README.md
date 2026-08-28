# `@loredu/kernel`

The application kernel: record semantics, ports, append path, reconciliation,
projections, and the M3 Working Lore application.

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

## Public surface

Only `@loredu/kernel` and `@loredu/kernel/testing` are entrypoints; deep imports are unsupported. The exact value/type allowlists and signatures are the [kernel API contract](../../docs/architecture/contracts/kernel-api.md). The normal runtime exports the five draft/record families, portable JSON codec/equality, ClaimKey, Instant/position constructors, versioned ClaimPolicy/default semantics, structural RulesetIdentity/Basis primitives, and the assembled application. M1 adds the full RecordStore query types; M1.5 adds type exports for surface-neutral responses, queries, diagnostics, and affordances; M2 adds ADR 0027's pair/state, policy-context/advisory, positioned-record, Current Knowledge, temporal query, summary, and projection-response type shapes while keeping reconciliation runtime helpers internal. M3 adds the closed Working Lore/Ranker types and the sole new runtime value `DEFAULT_RANKER`. Testing exports exactly InMemoryStore, FixedClock, SeededRandomSource, and the runner-neutral `recordStoreConformance`; its fixture, subject, and case shapes are type-only exports.

## Layout

```text
src/domain/    records, ids, JSON codec/equality, claim keys, Basis, validation
src/ports/     M1 RecordStore, Clock, RandomSource, ClaimPolicy
testing/       M1 InMemoryStore, FixedClock, SeededRandomSource, conformance kit;
               published only as @loredu/kernel/testing
```

`@loredu/kernel/testing` is test support, never product surface: production code in
any package must not import it. Its pure in-memory adapter implements the full M1
port. Concrete adapter status lives in the
[`@loredu/store-plainfile` README](../store-plainfile/README.md).

## State

M0, M1, M1.5, and M2 remain intact. M3-L now exposes `lore` with mechanical five-section membership, M2-owned representatives, compact descriptors, global and section budgets, validated versioned Ranker permutations, digest-bound continuation, conservative staleness, and anchored exact-key Claim disclosure. The engine never appends or caches derived records. M3-E still owns CLI wiring, rendering, skill text, and compiled journeys; adapter status is in [`packages/cli`](../cli/README.md).
