# scenarios — acceptance scenarios, end to end

The [implementation plan](../../docs/v0.x/execution/implementation-plan.md) owns the
three acceptance scenarios. Their cross-layer narrative coverage is:

- **S A** — compiled T54 covers three investigation runs, `as_of` replay,
  derived/manual reconciliation review, 10× history growth, Working Lore revalidation,
  pinned continuation, staleness, and exact disclosure without derived mutation;
- **S B** — a 30→60-day amendment recorded late answers all four temporal query
  combinations and discloses both evidence chains (**T55**);
- **S C** — cross-actor corroboration and conflict remain mechanical, process
  perspectives stay distinct, malformed keys do not append, and a versioned custom
  policy changes semantics and Basis identity.

The deterministic M2 fixture helpers live in [`m2-exit-fixtures.ts`](./m2-exit-fixtures.ts).
The executable narratives live in the
[compiled CLI suite](../cli-conformance/compiled-binary.test.ts), where they cross
plain-file persistence, reconciliation, projection, application envelopes, and
rendering through the compiled conformance entry. Scenario A's mapped derived/manual
disagreement remains inspectable evidence and never changes canonical history. The
[CLI conformance group](../cli-conformance/README.md) owns the separate fresh-store
journey.

A scenario test earns its place by crossing milestones — store, reconciliation,
projection, and rendering together. Anything provable inside one group belongs in
that group's directory instead.
