# scenarios — acceptance scenarios, end to end

The three acceptance scenarios in the
[implementation plan](../../docs/v0.x/execution/implementation-plan.md), each as one
narrative test rather than a row-by-row check:

- **S A** — three investigation runs over a changing codebase: earlier belief
  reproducible with `as_of`, revalidation surfaced, the packet staying bounded
  (catalog **T54**, and the growth property behind T41);
- **S B** — a 30→60-day amendment recorded late: all four temporal query
  combinations answering correctly (**T55**);
- **S C** — two agents recording the same fact in different words: corroboration
  where the key matches, candidate conflict where the value differs, no false
  conflict across perspectives.

The deterministic M2 fixture helpers live in [`m2-exit-fixtures.ts`](./m2-exit-fixtures.ts).
The executable A/B/C narratives live in the
[compiled CLI suite](../cli-conformance/compiled-binary.test.ts), where they cross
plain-file persistence, reconciliation, projection, application envelopes, and
rendering through the compiled conformance entry. Scenario B claims T55. Scenario A
covers only its M2 portion and deliberately leaves T54 deferred for M3 Working Lore
and revalidation; its mapped derived/manual disagreement remains inspectable evidence
and never changes canonical history.

A scenario test earns its place by crossing milestones — store, reconciliation,
projection, and rendering together. Anything provable inside one group belongs in
that group's directory instead.
