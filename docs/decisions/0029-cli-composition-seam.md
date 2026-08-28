---
name: cli_composition_seam
description: "Exposes the CLI parser/renderer as one composition seam with explicit application policy and host-capability ports while the shipped lor entry retains production defaults."
type: decision
tags: [decisions, m1.5, cli, application, policy, capabilities]
generated: "OpenAI coding agent gpt-5.6-sol, 2026-08-28"
created_at: 2026-08-28T14:30:00+08:00
---

# 0029: Expose one CLI composition seam without changing `lor` grammar

## Context

ADR 0026 keeps Claim feedback in the application and makes the CLI only a parser,
composition root, and renderer. The shipped `lor` entry correctly assembles the
default ClaimPolicy, system Clock, and cryptographic RandomSource. That fixed entry
can demonstrate default `exclusive` feedback, but it cannot exercise the already
public custom-policy `coexisting` behavior through the same compiled parser and
renderer. Reimplementing rendering in a fixture, adding policy semantics to the CLI,
or introducing a hidden environment/argv policy switch would weaken the boundary.
Deterministic compiled conformance also needs explicit host capability ports without
changing production defaults.

## Options considered

- Add a `lor` option or environment variable that selects policy semantics. Rejected:
  policy selection is embedding composition, not command grammar, and a string switch
  would duplicate policy ownership in the adapter.
- Keep the runner fixed and test custom feedback only through application tests.
  Rejected: that cannot prove the compiled CLI adapter preserves every supported
  application feedback shape or exact mutation envelope.
- Build a second test renderer. Rejected: duplicated adapter mechanics could drift
  while tests remained green.
- Export one runner seam that accepts optional explicit ClaimPolicy, Clock, and
  RandomSource ports, with production defaults when omitted. Chosen.

## Choice

`@loredu/cli` exports its existing `run(argv, io, options?)` entry with an optional
closed composition object containing `claimPolicy`, `clock`, and `randomSource`.
Each supplied value is passed unchanged to `createLoreduApplication`; validation,
feedback classification, stamping, and capability failure mapping remain
application-owned. Omitted values instantiate `DEFAULT_CLAIM_POLICY`, `SystemClock`,
and `CryptographicRandomSource` respectively.

The shipped `packages/cli/bin/lor.ts` passes no options, so its grammar, environment,
outputs, policy, time, and entropy behavior do not change. Embedded consumers and
compiled conformance entries may supply explicit valid ports while reusing the exact
same parser, store composition, application calls, renderer, and exit mapping. No
policy selector is added to argv or the environment, and no test-only branch exists
in shipped behavior.

## Consequences

- A compiled custom-policy entry can prove `coexisting` feedback end to end without
  moving semantics into the CLI or weakening the production binary.
- Deterministic conformance can compare complete mutation envelopes against direct
  application responses under equivalent stores and capabilities.
- The CLI package gains a narrow durable embedding boundary; callers supplying ports
  own their host implementations and policy versioning.
- `lor` continues to use secure production capabilities and the default policy.

## Rule / follow-up

Keep the options object limited to application assembly dependencies. New command
semantics still require the application/CLI contract; do not use this seam for hidden
argv behavior, test flags, alternate stores, or a second renderer.
