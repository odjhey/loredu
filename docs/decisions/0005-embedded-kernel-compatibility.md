---
name: decision_embedded_kernel_compatibility
description: "Frame Loredu as an embedded kernel for our own products, with a record compatibility policy and a two-consumer bar for calling contracts stable."
type: decision
tags: [decisions, framing, compatibility, consumers]
status: draft
generated: "Claude Fable 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T00:00:00+08:00
updated_at: 2026-08-26T00:00:00+08:00
---

# 0005: Embedded kernel, not a standalone product

## Context

Loredu is not sold or shipped on its own. It is a consistent knowledge core embedded by our own smaller products — extraction runbooks, docs assistants, attention ledgers, project-fact crawlers ([candidate consumers](../reports/candidate-consumers.md)). Those consumers own their writers, their extraction quality, their UI, and their domain vocabulary; Loredu owns record semantics, provenance, reconciliation, resolution, projections, and bounded disclosure.

This framing changes what "success" and "stability" mean. A kernel's value is measured by whether embedding it beats the notes-file each product would otherwise hand-roll, and its contracts become expensive to change the moment two products persist records against them.

## Options considered

- position Loredu as a standalone product with its own surfaces;
- build the kernel speculatively against hypothetical scenarios and declare contracts stable when fixtures pass;
- treat Loredu as an embedded kernel, stabilize contracts only against real consumers, and adopt an explicit record compatibility policy.

## Choice

Loredu is an embedded, vendor- and solution-agnostic kernel.

**Consumer-driven stabilization.** Hand-written fixtures may drive M0–M3, but no contract is declared stable until at least two real consumers embed it. Generalize from real callers, not from imagined ones. The first consumer should be wired in during v0.x, before contracts freeze.

**Record compatibility policy.**

- every persisted record carries an explicit schema identity (`schema: loredu.record/v1`);
- any record version that has ever been persisted by a consumer must remain replayable forever — projections and indexes may be discarded, canonical records may not be stranded;
- schema changes are additive within a version; anything else is a new schema version plus replay support for the old one;
- unknown namespaced metadata is preserved by adapters and ignored by readers that do not understand it.

**Embedding ergonomics are a contract.** The kernel must be cheap to adopt: a few calls from "I have a finding" to "appended entry + claim", and from "starting an activity" to "Working Lore in hand", with no runtime dependencies beyond the store adapter. If a product team would rather keep their markdown-and-grep hack, the kernel has failed regardless of its semantics.

## Consequences

- v0.x acceptance gains a developer-ergonomics criterion alongside the functional ones;
- Working Lore ranking follows the existing port pattern (`Extractor`, `Resolver`): deterministic baseline in the core, consumer-supplied rankers behind a port;
- the kernel resists consumer-specific accretion: a capability enters the core only when a second consumer needs it (the non-goals list in the product architecture is the constitution, this rule is the enforcement);
- record schema versioning and replay tests are M0/M1 work, not later hardening.

## Rule or follow-up

Before any contract is marked `status: current`, name the two consumers it was validated against. A replay test must cover every schema version that has ever shipped to a consumer.
