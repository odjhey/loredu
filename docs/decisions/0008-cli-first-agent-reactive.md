---
name: decision_cli_first_agent_reactive
description: "Ship the lor CLI right after M1 with mechanical key-overlap feedback; every response carries deterministic advice so agents chain calls until healthy."
type: decision
tags: [decisions, cli, sequencing, agents]
status: draft
generated: "Claude Fable 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T00:00:00+08:00
updated_at: 2026-08-26T00:00:00+08:00
---

# 0008: CLI before full reconciliation; agent-reactive responses

## Context

The original sequence (M0 → M1 → M2 → M3 → CLI) delays real usage until every projection exists. The first user wants to hand agents a binary as early as possible and let them record, reconcile, and resolve through it. The [ubiquitous language](../architecture/ubiquitous-language.md) already splits the work the right way: **reconcile is mechanical, resolve is judgment**. The judgment half never needed M2 — the agent is the Resolver, writing Relation and Resolution records that are already first-class in the record contract. And the cheapest mechanical slice — grouping claims by their declared key ([0004](./0004-claim-identity-key.md)) — is nearly free, while the expensive parts of M2 are temporal precedence and projection logic.

## Options considered

- keep the CLI after M2/M3 and use fixtures until then;
- ship an early CLI as a dumb record recorder with no feedback;
- ship the CLI right after M1 with the mechanical key-overlap slice powering agent-reactive feedback, and let agents perform all judgment manually.

## Choice

Insert an **agent-operable CLI milestone (M1.5)** between M1 and M2. The binary is `lor`.

**Agent-reactive response envelope.** Every command returns `{ok, result, reconciliation, next, basis}` in text and `--json`. `advice` is a list of runnable follow-up commands with reasons, derived **only from deterministic checks** — key overlap, dangling references, unresolved same-key groups, malformed records. The envelope never speculates and is byte-stable for the same store state. Its shape is fixed now; from M2 onward the full ruleset fills `reconciliation` instead of the key-overlap slice, and the advice gets richer without the shape changing.

**Chain until healthy.** `lor status` defines health mechanically (no unresolved same-key groups, no malformed records, no dangling refs) and terminates the agent's action loop; `--check` exits nonzero for scripts. An agent adds a record, reads the advice, inspects, verifies, resolves — all in one session — until status is healthy.

**Agent as Resolver (and, initially, Reconciler-of-record).** During M1.5 the agent records explicit Relations (`supports`, `contradicts`, `duplicates`, `supersedes`) and Resolutions through the CLI. These are canonical records, not throwaways.

**Self-documenting binary.** `lor skill` prints the agent guide; distributing the executable distributes the integration.

## Consequences

- usable weeks earlier: record → detect → judge → resolve works with only M0 + M1 + a thin adapter;
- dogfooding output becomes the M2 test corpus: agent-recorded relations from the manual phase are the fixtures that deterministic reconciliation must reproduce (diffing rule-derived vs agent-recorded relations validates the ruleset);
- the envelope is adapter surface, but its governing rule — advice derives only from deterministic checks — is core semantics;
- risk: manual relations may be inconsistent across agents; mitigated by M0 validation, `lor status` surfacing unrelated same-key groups, and the skill guide's judgment rules;
- projections (`current`, `as_of`, Working Lore) still arrive with M2/M3; until then orientation is `lor status` + key-scoped claim listing, which the skill guide reflects.

## Rule or follow-up

The `advice` field must remain deterministic and non-speculative — model-generated advice is banned from the envelope. When M2 lands, a conformance test diffs deterministic reconciliation output against the manual-phase relation corpus and flags disagreements for review rather than silently preferring either.
