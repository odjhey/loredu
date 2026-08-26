---
name: decision_branch_protection_posture
description: "Branch protection on master: ci-required as the only required status, zero reviews, squash-only, no bypass actors, and up-to-date-before-merge enabled."
type: decision
tags: [decisions, ci, process, agents]
generated: "Claude Opus 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T20:00:00+08:00
---

# 0017: Branch protection posture

## Context

[ADR 0012](./0012-dx-and-ci-gating.md) settled that CI, not human review, is the supervisor, and [ADR 0013](./0013-agent-decision-authority.md) that agents decide and land without sign-off before production. Both assume a gate that actually blocks. Until `ci-required` was enforced, it did not: a red pull request could merge, and one did.

Enforcement is configured in GitHub, not in this repository, so nothing in the tree explains why the settings look as they do. That is the gap this record closes — the settings are unusually permissive in one direction (no reviews at all) and unusually strict in another (nobody can bypass, not even the operator), and either half looks like an oversight without the other.

## Options considered

The live question was **up-to-date-before-merge** (`strict_required_status_checks_policy`):

- **off** — merges never wait on a rebase; semantic conflicts between concurrently-merged pull requests land on `master` and go red after the fact;
- **on** — every pull request rebases onto the current `master` and re-runs CI before merging; merges serialize.

The rest followed from ADR 0012 and 0013 without contest.

## Choice

**`ci-required` is the only required status.** One aggregate that fails closed. Requiring the component jobs directly would deadlock pull requests whose paths do not select them ([ADR 0012](./0012-dx-and-ci-gating.md)).

**Zero required reviews.** No approvals, no code-owner review, no last-push approval. A single operator and agents sharing that identity have no review queue to route through; requiring one would mean blocking on a human who is not waiting ([ADR 0013](./0013-agent-decision-authority.md)).

**Squash-merge only.** Branch history is working state; `master` keeps one commit per landed change. Note the binding constraint is the **repository** merge-method setting, not the ruleset's `allowed_merge_methods` — the ruleset list can be broader without effect, so check the repository setting when auditing this.

**Force-push and branch deletion on `master` are blocked.** Both are irreversible operations, which ADR 0013 reserves for the operator; here they are simply refused.

**No bypass actors — including the operator.** A gate whose owner can wave it through is a suggestion. The consequence is deliberate: a wrong gate is fixed forward, never overridden.

**Up-to-date-before-merge: on.** This is the one that trades speed for safety, and the trade was made knowingly. The failure it prevents is real and already observed: a spelling-config change and a formatter landed in separate pull requests, each green alone, and the combination broke `bun run lint` only once both were on `master`. With the policy off, that class of break is discovered after landing, which makes a red `master` a routine event. A rebase before merging is cheaper than a broken trunk that every other agent then pulls.

## Consequences

- With several pull requests open at once, the later ones rebase and re-run CI before merging. Merges serialize, and that cost grows with the number of agents landing work in parallel.
- `master` stays green as a rule rather than as a hope, so an agent branching from it can trust it.
- Nobody can merge red. When the gate itself is wrong, the fix is a pull request against the gate — the escape hatch, if one is ever truly needed, is adding a temporary bypass actor rather than disabling the ruleset, because a disabled ruleset silently protects nothing.
- A ruleset whose enforcement is `disabled`, or whose relative paths point at nothing, gives the *appearance* of protection. Audit with `gh api repos/<owner>/<repo>/rulesets/<id>` and confirm `enforcement: active` plus `gh api repos/<owner>/<repo>/branches/master --jq .protected`.

## Rule / follow-up

- Revisit **up-to-date-before-merge** when parallel merges become common enough that the rebase cost is felt — that is the trigger, not a date. Turning it off again means a record superseding this one.
- Repository settings are operator actions ([ADR 0013](./0013-agent-decision-authority.md)); agents propose the commands and do not run them.
