---
name: agent_policy
description: "Agent behavior policy: who decides (agents do), the record obligation, discovery sequence, trust rules, worktrees, and closure evidence."
type: guide
tags: [ai, agents, policy]
generated: "Claude Opus 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T15:40:00+08:00
---

# Agent policy

Applies to every agent and harness working in this repository. [`AGENTS.md`](../../AGENTS.md) carries the short summary; this document is the detail. Machine-readable companion: [agent-policy.yaml](./agent-policy.yaml) — keep the two in sync.

## Repository state

This repo is agent-first and design-first: it holds contracts, decision records, and the v0.x plan, with no source tree yet ([ADR 0001](../decisions/0001-application-core-first.md) explains why the application core is defined before any surface). Until code exists, docs *are* the artifact, and the maintenance rules in [docs/README.md](../README.md) are the build system.

## Who decides

**You do.** Agents settle design questions, change contracts, and adjust scope without waiting for operator sign-off — this holds until production release ([ADR 0013](../decisions/0013-agent-decision-authority.md)). There is no review queue to block on.

**The obligation is the record, not the gate.** Whatever you settle that a future agent would otherwise have to reverse-engineer goes into a decision record under [docs/decisions/](../decisions/README.md), written before or with the change that depends on it. The bar is simple: if the reasoning matters and lives only in your context window, it is not yet a decision — it is a guess someone else will inherit.

- **Supersede, never rewrite.** Changing an earlier decision means a new record naming what changed and why the old reasoning no longer holds. Leave the old record standing.
- **Contract changes always earn a record.** Published contracts are what consumers build against; an unexplained change is indistinguishable from drift.
- **The failure mode is the unrecorded decision.** Deciding and writing it down is correct behavior. Encoding a choice silently in a diff is the thing to catch.

**What still needs the operator:** production release, anything reaching outside the repo (publishing packages, external services, credentials, spend), and irreversible operations (history rewrites, force-push to `master`, bulk deletion). Stop at those boundaries and hand over.

## Discovery sequence

1. Read `AGENTS.md` plus any harness-specific instructions.
2. Inspect the issue, PR, plan, and relevant git history before inventing new work. Design here moves by numbered ADRs and PRs; check whether a decision already exists before making a new one.
3. Start research from the nearest index — [docs/INDEX.md](../INDEX.md) or a directory `README.md` — or use the `find-docs` skill (`bun docs/scripts/find-docs.mjs`).
4. Follow links progressively toward more specific knowledge. Broken links in knowledge docs may be intentional: they mark not-yet-written knowledge, not bugs to patch over.
5. Check a directory's `README.md` for local context before working inside it.
6. Load skills when their trigger conditions apply.
7. Prefer repository scripts and deterministic CLI tooling over manually recreating a documented procedure.

## Contract-driven work protocol

For any work touching a domain contract:

1. Identify the governing contracts, ADRs, and behavioral catalog rows.
2. Enumerate every normative invariant, including MUST, ONLY, REQUIRED, REJECT, NEVER, closed vocabularies, type/family restrictions, equality, ownership, and persistence rules.
3. Record those invariants in the work item's Contract Matrix.
4. Classify each invariant as in scope, explicitly out of scope, dependent, or ambiguous.
5. Every in-scope invariant must eventually have implementation evidence and appropriate test/review evidence.
6. Accepted behavior broader than the contract is a bug.
7. Behavior narrower than the contract is a bug unless explicitly allowed.
8. Generic helpers must not erase semantic distinctions required by a contract.
9. If work requires a new public semantic/API/persisted-shape/ownership decision, report NEEDS_DECISION. Do not silently settle it in implementation.
10. If the existing task decomposition no longer matches reality, report NEEDS_REPLAN.
11. Green CI proves only what its checks assert.
12. Return findings and evidence to Watchtower; do not assume the next step.

### Watchtower

Watchtower is the external Rozoro orchestrator that dispatched the work and owns routing and next-step decisions. It is not a Loredu runtime component, domain term, or persisted concept.

## Trust rules

Read the frontmatter before relying on a doc ([ADR 0014](../decisions/0014-minimal-frontmatter.md) defines the schema):

- **No `status`** → agreed and in force. The normal state; not a gap to fill.
- **`status: draft`** → deliberately unsettled; may change under you.
- **`status: current`** → implemented in code and matching what ships.
- **`status: archived` / `superseded`**, or a past `stale_after` → historical; find the replacement first.
- **`generated`** marks model authorship, which is the norm here, not a caveat. **`verified`** is the operator's stamp.
- **Last changed** is a git question: `git log -1 --format=%cI -- <path>`.

Terminology changes start in [ubiquitous language](../architecture/ubiquitous-language.md); contract changes start in [contracts](../architecture/contracts/README.md). Never fork a definition into a second doc.

## Worktrees and branching

- Create git worktrees ONLY in `.worktrees/<name>` (inside the repo, git-ignored). Do not invent other worktree paths unless the user asks for a specific location.
- Use an isolated worktree when concurrent work exists on the repo.
- Branch rather than committing to `master`.

## Evidence expected before work is complete

- The change verified by the strictest check that applies. For docs: links resolve, frontmatter is complete, and the doc is reachable from its directory index and [INDEX.md](../INDEX.md). For code (once a source tree exists): the suites and gates named in [ADR 0012](../decisions/0012-dx-and-ci-gating.md).
- A decision record for anything durable you settled.
- Domain-doc impact addressed per the [domain doc update playbook](../playbooks/domain-doc-update.md) — either the docs are updated, or the reason no update was needed is recorded.
- Anything you could not verify stated plainly as unverified. CI is the supervisor for code ([ADR 0012](../decisions/0012-dx-and-ci-gating.md)); until it is wired, say what you actually ran.

Parent index: [docs/ai/README.md](./README.md)
