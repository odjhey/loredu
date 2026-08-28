# cli-conformance — the compiled binary

Compiled-binary assertions **T50–T58**, **T65**, and **T73–T75** belong here.
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

M2-E's deterministic compiled A/B/C narratives use the scenario fixtures under
[`tests/scenarios`](../scenarios/README.md). Scenario B owns executable T55 evidence;
scenario A stops before M3 Working Lore/revalidation and therefore does not claim T54.
The narratives reopen fresh plain-file stores between commands. Scenario A compares the
complete owned artifact tree before and after projection reads to prove that they append
nothing and create no cache; scenario B follows both evidence chains, and scenario C
proves malformed Claim-key rejection leaves the head unchanged.

Decision: [ADR 0026](../../docs/decisions/0026-m15-application-cli-contract.md).
