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
| [`records/`](./records/README.md) | M0 records/application (T01–T08, T19, T80, T83–T85, T87) |
| [`store/`](./store/README.md) | M1 durable plain-file conformance (T10–T18) |
| [`application/`](./application/README.md) | M1.5 surface-neutral responses, reads, feedback, health, and cursors (T60–T64, T66–T68, and T70–T72; T65 remains CLI-owned) |
| [`reconciliation/`](./reconciliation/README.md) | M0 identity primitives (T81–T82); M2 reconciliation/projections (T20–T30, T86) |
| [`working-lore/`](./working-lore/README.md) | M3 — Working Lore (T40–T45) |
| [`cli-conformance/`](./cli-conformance/README.md) | Compiled CLI conformance (T50–T58, T65, T73–T75) plus adapter/rendering checks over application semantics |
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

Current implementation accounting is owned by executable `@covers` annotations and
[`catalog-status.json`](../docs/v0.x/execution/catalog-status.json), with
`check-catalog.mjs` enforcing that each row is implemented or deferred. The group
directories and their READMEs say what belongs where. An empty `describe()` or a
`test.todo` cannot claim coverage. As a milestone lands, its real assertions move
T-numbers out of the status file and into this tree.

M0 also audits the exact normal/testing export allowlists, all-family imports through public package names, no deep imports, helper absence from normal exports, and no production testing-subpath imports. T87 owns assembly/branded-position evidence; supplemental assurance vectors stay with their existing rows.

Structural tests that guard the scaffold itself (the package DAG, the kernel
boundary) live at the root of this tree and claim no T-number — they test the
repository, not the product's behavior.
