# cli-conformance — the compiled binary

Compiled-binary assertions **T40**, **T50–T58**, **T65**, and **T73–T74** belong here.
T75 is implemented by the M3-L public application continuation tests; the compiled
suite adds only unannotated reinforcement for that already-owned row.
T50–T53 also prove that the CLI adapts and renders the surface-neutral semantics
covered by **T60–T64**, **T66–T68**, and **T70–T72** in
[`tests/application`](../application/README.md). The
[behavioral catalog](../../docs/v0.x/execution/first-user-journey.md) owns the
exact assertions. Executable `@covers` annotations here and
[`catalog-status.json`](../../docs/v0.x/execution/catalog-status.json) together own
current implementation/deferment accounting. The
[application and CLI contract](../../docs/architecture/contracts/application-cli.md)
owns the protocol those rows exercise.

These tests **spawn the compiled `lor`** (`bun run build` → `packages/cli/dist/lor`),
not the library: the point is that the shipped artifact behaves, including its exit
codes and stdout/stderr split. A compiled conformance entry additionally supplies
explicit policy/Clock/RandomSource ports through ADR 0029's production composition
seam; it reuses the exact parser and renderer and does not add shipped grammar. Parse
`--json` output; assert on the envelope, never on prose wording. Point `LOREDU_HOME`
at a temp directory per test.

The deterministic compiled A/B/C narratives use the scenario fixtures under
[`tests/scenarios`](../scenarios/README.md). Scenario A owns T54 and extends the M2
technical/manual comparison through 10× history growth, Working Lore revalidation,
pinned continuation, staleness, and exact disclosure. Scenario B owns T55. One separate
fresh-store compiled session owns T56 from orientation through lore continuation. The
narratives reopen the same plain-file store in separate compiled processes and compare
the complete owned artifact tree before and after reads to prove no derived write or
cache appears; scenario C proves malformed Claim-key rejection leaves the head unchanged.

Decision: [ADR 0026](../../docs/decisions/0026-m15-application-cli-contract.md).
