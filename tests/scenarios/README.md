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

A scenario test earns its place by crossing milestones — store, reconciliation,
projection, and rendering together. Anything provable inside one group belongs in
that group's directory instead.
