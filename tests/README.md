# Behavioral test tree

This tree is shaped by the [behavioral test catalog](../docs/v0.x/execution/first-user-journey.md),
not by the code layout: the catalog is the contract, so its groups are the
directories ([ADR 0011](../docs/decisions/0011-repo-package-architecture.md)).
Tests here exercise **published package exports** or the compiled `lor` binary —
never internals. Package-local tests for implementation details may be colocated
in `packages/*` instead.

```sh
bun test                       # whole tree
bun test tests/store           # one group
```

## Groups

| Directory | Catalog group |
|---|---|
| [`records/`](./records/README.md) | M0 — records and validation (T01–T05, T07–T08, T15, T84–T85) |
| [`store/`](./store/README.md) | M1 — plain-file store (T06, T10–T14, T16–T19) |
| [`reconciliation/`](./reconciliation/README.md) | M2 — reconciliation, resolution, projections (T20–T30) |
| [`reconciliation/`](./reconciliation/README.md) | M0 — kernel invariants and the policy seam (T80–T83), located here as a test-location exception |
| [`working-lore/`](./working-lore/README.md) | M3 — Working Lore (T40–T45) |
| [`cli-conformance/`](./cli-conformance/README.md) | CLI conformance (T50–T58), agent-reactive envelope (T60–T68), pagination and link-following (T70–T75) |
| [`scenarios/`](./scenarios/README.md) | acceptance scenarios A/B/C, end to end |

## Claiming a catalog T-number

A test claims a T-number with a `@covers` annotation — in the test title or a
comment directly above it — inside a `*.test.ts` file under `tests/`
([ADR 0015](../docs/decisions/0015-catalog-accounting-and-docs-gate.md)):

```ts
// @covers T01
test('accepts a free-text entry and returns its id', () => { /* … */ })

test('append returns monotonic positions — @covers T10, T12', () => { /* … */ })
```

Every catalog T-number must be either claimed by a real test here or deferred in
`docs/v0.x/execution/catalog-status.json` — never both, never neither, and never
faked. `bun docs/scripts/check-catalog.mjs` enforces that accounting, and rejects a
claim whose file asserts nothing or is `.skip`/`.todo`.

**Therefore this tree currently contains no catalog tests at all.** Nothing is
implemented, so nothing may claim coverage; every T-number is deferred in the status
file. The group directories and their READMEs say what belongs where; an empty
`describe()` or a `test.todo` would say something false. As a milestone lands, its
tests move T-numbers out of the status file and into this tree.

Structural tests that guard the scaffold itself (the package DAG, the kernel
boundary) live at the root of this tree and claim no T-number — they test the
repository, not the product's behavior.

T80–T83 are M0-owned kernel invariants even though their direct application tests
remain under `reconciliation/` for the existing test-tree location. The
`reconciliation/README.md` records that exception; it does not make these rows
M2 behavior.
