---
name: domain_doc_update
description: "Playbook for updating domain documentation when domain behavior, terminology, or boundaries change."
type: guide
tags: [playbooks, agents, docs]
status: draft
created_at: 2026-08-26T15:40:00+08:00
updated_at: 2026-08-26T15:40:00+08:00
---

# Playbook: domain doc update

Run this before closing any plan or PR that touched domain behavior, terminology, or boundaries. If none were touched, record that explicitly instead of silently skipping.

## Trigger conditions

Any of these means the playbook applies:

- A domain term was introduced, renamed, narrowed, or dropped.
- A record type, its fields, or its invariants changed ([records contract](../architecture/contracts/records.md)).
- A port or boundary moved — what the kernel owns versus what the consumer owns ([product architecture](../architecture/product-architecture.md)).
- Detection, resolution, or disclosure semantics changed ([projection](../architecture/contracts/projection.md), [Working Lore](../architecture/contracts/working-lore.md)).
- A choice was made that a future reader would otherwise have to reverse-engineer → it needs an ADR.

## Update order

Work outward from the definition so nothing forks:

1. [Ubiquitous language](../architecture/ubiquitous-language.md) — the word first.
2. [Contracts](../architecture/contracts/README.md) — the family file that owns the behavior.
3. [Product architecture](../architecture/product-architecture.md) — only if a boundary or port moved.
4. [Decisions](../decisions/README.md) — a new ADR if a durable choice was made; supersede rather than rewrite history.
5. [v0.x plan](../v0.x/README.md) — scope, plan, or journey docs that quoted the old behavior.
6. Indexes — the directory `README.md` and [INDEX.md](../INDEX.md).

## Frontmatter and supersession

- Bump `updated_at` on every doc you materially edit.
- New docs: frontmatter first, then link them from the directory index and INDEX.md. A doc nothing links to is a bug.
- Superseding: set `status: superseded` on the old doc and link its replacement. Do not delete useful history — the same instinct the [append-only record model](../decisions/0002-append-only-record-model.md) encodes.
- Agent-produced docs set `generated`; the operator sets `verified` on review.

## Evidence to attach when closing

- The list of docs updated, and for each, what changed.
- If no domain doc needed an update: one line saying why.
- Confirmation that every new or moved doc is reachable from its index.
- Any contract or scope change flagged for the operator gates in [agent policy](../ai/agent-policy.md#human-gates).

Parent index: [docs/playbooks/README.md](./README.md)
