---
name: decision_agent_decision_authority
description: "Agents decide and land changes without operator sign-off until production release; the obligation is the record, not the gate. Names the few actions that still require the operator."
type: decision
tags: [decisions, agents, process]
generated: "Claude Opus 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T16:30:00+08:00
---

# 0013: Agent decision authority and the record obligation

## Context

This is an agent-first codebase: one operator, agents sharing that identity, and design moving faster than any human review queue could clear. [ADR 0012](./0012-dx-and-ci-gating.md) already encodes the posture — *CI, not human review, is the supervisor* — but only for code gates. Nothing stated who may decide.

The first draft of [`docs/ai/agent-policy.md`](../ai/agent-policy.md) filled that gap by asserting operator sign-off on decision records, contract changes, scope changes, and merges. That was ported reflexively from a repo with different constraints and describes a review queue this project does not run. Left in place, it would make every agent either block on a human who is not waiting, or ignore the stated policy — both worse than saying plainly who decides.

## Options considered

- **Human gates** on design, contracts, scope, and merges;
- **agent authority with a mandatory record** — decide freely, but the reasoning is written down;
- **no stated rule**, leaving each agent to guess.

## Choice

**Agents decide and land, pre-production. The obligation is the record, not the sign-off.** An agent may settle a design question, change a contract, or adjust scope without waiting for the operator, on one condition: the durable part of the decision is written as a decision record before or with the change that depends on it. A choice that would need explaining to the next agent needs an ADR.

**Supersede, never rewrite.** Changing an earlier decision means a new record naming what changed and why the old reasoning no longer holds. The old record stays. This is the same instinct as [ADR 0002](./0002-append-only-record-model.md), and the same one Loredu sells: every judgment is itself a record.

**Contract changes are ADR-worthy by definition.** Published contracts are what consumers build against ([ADR 0005](./0005-embedded-kernel-compatibility.md)); a change with no record is indistinguishable from drift.

**What still requires the operator**, agent authority notwithstanding:

- **Production release** — and the compatibility promises that come with it;
- **anything reaching outside the repo** — publishing packages, external services, credentials, spend;
- **irreversible operations** — history rewrites, force-push to `master`, bulk deletion.

**The real failure mode to police is the unrecorded decision**, not the unreviewed one. An agent that decides and writes it down is working correctly. An agent that quietly encodes a choice in a diff, with no record, has cost the next agent the reasoning — that is the thing to catch in review.

## Consequences

- Decisions land at agent speed; the corpus, not a human queue, is the memory.
- A wrong decision can merge. Accepted: supersession is cheap, CI is the supervisor for anything code-shaped, and the record makes the reasoning auditable after the fact — a wrong decision with a record is recoverable, a right decision without one is not repeatable.
- `docs/decisions/` grows faster than a human-gated repo's would. That is the intended cost.
- The ADR count becomes the honest measure of how much of this design is actually explained.

## Rule / follow-up

- [`docs/ai/agent-policy.md`](../ai/agent-policy.md) is the operational statement of this decision; keep the two in sync.
- Revisit at production release — the gates that make sense with real consumers are a different question, and answering it means a new record superseding this one.
