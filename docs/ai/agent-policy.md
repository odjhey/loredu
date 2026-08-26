---
name: agent_policy
description: "Human-readable agent behavior policy: discovery sequence, human gates, worktree rules, and the evidence expected before work is considered complete."
type: guide
tags: [ai, agents, policy]
status: draft
created_at: 2026-08-26T15:40:00+08:00
updated_at: 2026-08-26T15:40:00+08:00
---

# Agent policy

Applies to every agent and harness working in this repository. [`AGENTS.md`](../../AGENTS.md) carries the short summary; this document is the detail. Machine-readable companion: [agent-policy.yaml](./agent-policy.yaml) — keep the two in sync.

## Repository state

This repo is design-first: it currently holds contracts, decision records, and the v0.x plan, with no source tree yet ([ADR 0001](../decisions/0001-application-core-first.md) explains why the application core is defined before any surface). Until code exists, docs *are* the artifact, and the maintenance rules in [docs/README.md](../README.md) are the build system.

## Discovery sequence

1. Read `AGENTS.md` plus any harness-specific instructions.
2. Inspect the issue, PR, plan, and relevant git history before inventing new work. Design here moves by numbered ADRs and PRs; check whether a decision already exists.
3. Start research from the nearest index — [docs/INDEX.md](../INDEX.md) or a directory `README.md` — or use the `find-docs` skill (`bun docs/scripts/find-docs.mjs`).
4. Follow links progressively toward more specific knowledge. Broken links in knowledge docs may be intentional: they mark not-yet-written knowledge, not bugs to patch over.
5. Check a directory's `README.md` for local context before working inside it.
6. Load skills when their trigger conditions apply.
7. Prefer repository scripts and deterministic CLI tooling over manually recreating a documented procedure.

## Trust rules

- `status: draft` plus a `generated` field and no `verified` field means a model proposed it and no operator has confirmed it. Most of this corpus is in that state — treat it as a proposal, and say so when you build on it.
- `status: archived` or `superseded`, or a past `stale_after`, means historical only; find the replacement before relying on it.
- Terminology changes start in [ubiquitous language](../architecture/ubiquitous-language.md); contract changes start in [contracts](../architecture/contracts/README.md). Never fork a definition into a second doc.

## Human gates

The operator signs off — agents do not self-approve — on:

- **Design decisions.** A new or changed ADR under [docs/decisions/](../decisions/README.md) needs operator review before it is treated as settled. Superseding a decision is itself an ADR ([ADR 0005](../decisions/0005-embedded-kernel-compatibility.md) on compatibility policy).
- **Contract changes.** Anything under [docs/architecture/contracts/](../architecture/contracts/README.md), because published contracts are what consumers build against.
- **Scope.** Changes to [v0.x goal and scope](../v0.x/scope/goal-and-scope.md) or the [implementation plan](../v0.x/execution/implementation-plan.md) milestones.
- **Merges.** PR review is required; agents do not merge their own PRs.

When work needs a gate, stop at the boundary, state what you are asking for, and hand over — do not proceed under an assumption and reconcile later.

## Worktrees and branching

- Create git worktrees ONLY in `.worktrees/<name>` (inside the repo, git-ignored). Do not invent other worktree paths unless the user asks for a specific location.
- Use an isolated worktree when concurrent work exists on the repo.
- Branch rather than committing to `master`.

## Evidence expected before work is complete

- The change verified by the strictest check that applies. For docs: links resolve, frontmatter is complete, `updated_at` is bumped, and the doc is reachable from its directory index and [INDEX.md](../INDEX.md). For code (once a source tree exists): the suites and gates named in [ADR 0012](../decisions/0012-dx-and-ci-gating.md).
- Domain-doc impact addressed per the [domain doc update playbook](../playbooks/domain-doc-update.md) — either the docs are updated, or the reason no update was needed is recorded.
- Anything you could not verify stated plainly as unverified.

Parent index: [docs/ai/README.md](./README.md)
