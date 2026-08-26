---
name: decision_claim_identity_key
description: "Make claim identity an explicit, caller-declared key in the M0 record contract so reconciliation semantics stay consistent across consumers."
type: decision
tags: [decisions, records, reconciliation, identity]
generated: "Claude Fable 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T00:00:00+08:00
---

# 0004: Claim identity is a declared key

## Context

Deterministic reconciliation ([0002](./0002-append-only-record-model.md)) only fires when two claims are recognized as being about the same proposition. Without a shared identity discipline, claims written by different actors about the same fact — phrased differently, with ad-hoc subject names — never reconcile, and Loredu degrades into an append-only pile: no duplicate detection, no conflict surfacing, no supersession, and a Working Lore that grows instead of shrinking.

Because Loredu is an embedded kernel used by several products ([0005](./0005-embedded-kernel-compatibility.md)), leaving identity to each consumer's convention would make reconciliation semantics silently diverge across products — the exact failure the shared core exists to prevent. The core does not need to *compute* identity semantically (no LLM in the core), but it must *define* how identity is declared.

Two of the [candidate consumers](../reports/candidate-consumers.md) — existing internal tools that would embed Loredu — already demonstrate the pattern in their own codebases: the watchtower attention ledger supersedes items on the `(task, reason)` pair, and the no-mistakes extraction runbook identifies findings by `(pattern id, version)`. Both invented a local claim key; the kernel should own the discipline.

## Options considered

- leave claim identity implicit and let reconciliation guess from value/source overlap;
- compute identity semantically (embeddings/LLM matching) inside the core;
- require every claim to declare an explicit identity key built from fields the contract already has (`scope`, `subject`, `predicate`, `perspective`), and scope deterministic reconciliation to claims sharing a key.

## Choice

The claim key is a first-class part of the M0 record contract:

```text
claim_key = (scope, subject.type, subject.id, predicate, perspective?)
```

- The key is declared at write time by the actor (human, agent, or program). Validation rejects claims whose key fields are missing or malformed.
- Deterministic reconciliation (duplicate, corroboration, candidate conflict, temporal precedence) operates **only within a key**. Cross-key relationships require explicit Relations or a Resolution.
- `perspective` is part of the key: `documented_process` and `observed_process` claims about the same subject/predicate are different keys, so they coexist rather than auto-conflicting (the guardrail scenario).
- Subject IDs must be stable and deterministic for a given scope. The kernel validates **shape only** (identifier-safe characters, no free prose in `subject.id` / `predicate`); vocabulary and namespacing conventions are imposed by the consumer, not by Loredu. Convergence on shared keys is supported by discovery — a query engine that filters claims by any key/envelope field — and by cheap health advisories (e.g. the same value appearing under different keys in one scope suggests key divergence), not by kernel-enforced naming.
- Unkeyed knowledge is still welcome — as Entries. A claim without a valid key is not a claim.

## Consequences

- reconciliation hit-rate becomes a measurable property: claims sharing a key reconcile; keys that never repeat indicate a vocabulary problem in the consumer, visible rather than silent;
- the burden of semantic matching moves to write time, where the actor has the most context — an extractor adapter may later *propose* keys, but the core never guesses;
- key fields become part of compatibility guarantees: renaming a predicate is a knowledge migration, handled by supersession, not by editing records;
- Working Lore can group and count by key cheaply and deterministically.

## Rule or follow-up

M0 validation enforces key well-formedness. A v0.x acceptance test must show two actors recording the same fact with different free text but the same declared key, and reconciliation linking them (corroboration or conflict) — and the same fact under different perspectives coexisting without destructive conflict.
