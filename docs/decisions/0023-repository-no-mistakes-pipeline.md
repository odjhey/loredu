---
name: repository_no_mistakes_pipeline
description: "Repository-local no-mistakes policy: deterministic static gates, targeted Test evidence, trusted review/document guidance, and CI as the broad regression authority."
type: decision
tags: [decisions, agents, ci, dx, validation]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-28"
created_at: 2026-08-28T03:15:00+08:00
---

# 0023: Configure a repository-local no-mistakes pipeline

## Context

Loredu already uses no-mistakes to review and deliver feature branches, but the repository had no `.no-mistakes.yaml`. Pipeline behavior therefore depended on each operator's global defaults and agent discovery. The repository contracts already define the toolchain, static checks, documentation maintenance rules, package boundary, default branch, protected `ci-required` status, and squash-only landing process; the local validation gate should apply those facts rather than rediscovering them on every run.

The installed no-mistakes v1.57.0 schema distinguishes targeted local Test validation from broad remote regression. It also reads shell commands, documentation guidance, review path guidance, CI rerun policy, and PR routing only from a fetched default-branch copy where appropriate. A feature branch cannot make its own executable command trusted. The first pull request adding this policy can prove that the file parses, but its trusted command and prompt settings take effect only after it lands on `master`.

[ADR 0012](./0012-dx-and-ci-gating.md) keeps the broad suite in CI and rejects pre-commit hooks. [ADR 0017](./0017-branch-protection-posture.md) makes `ci-required` the merge authority that no actor can bypass. A no-mistakes configuration supplements those decisions when the gate is explicitly invoked; it does not replace CI or install repository-wide local hooks.

## Options considered

- Keep global defaults. Rejected: lint detection, repair limits, documentation placement, and scoped review policy would vary by machine.
- Put the full test/build suite in `commands.test`. Rejected: no-mistakes defines Test as targeted evidence, while Loredu's protected remote CI already owns broad regression and compile smoke.
- Leave all deterministic checks to an agent. Rejected: Loredu has exact scripts for formatting, static analysis, spelling, docs structure, catalog integrity, gate self-tests, workspace boundaries, and type checking.
- Allow feature branches to supply executable commands. Rejected: `allow_repo_commands` would weaken the default-branch trust boundary without a repository need.
- Publish local test evidence to a repository branch. Rejected for now: the current kernel and documentation work has no visual artifact need, and local command/test summaries plus GitHub CI are proportionate evidence.

## Choice

Add `.no-mistakes.yaml` at the repository root using only fields supported by the installed schema.

- `commands.lint` installs the frozen Bun lockfile and runs lint, spelling, docs structure, catalog integrity, gate self-tests, workspace-boundary analysis, and type checking. These are deterministic static/corpus gates rather than broad behavioral regression.
- `commands.format` uses the frozen install and Loredu's existing Biome write script. Markdown remains hand-shaped because Biome's repository configuration excludes it.
- `commands.test` stays unset. The Test agent must select the smallest relevant executable validation and record its evidence. The full `bun test` and build/CLI smoke remain mandatory in `ci-required` before landing.
- Review auto-fix is pinned to zero so intent-sensitive findings remain explicit decisions. Rebase, Test, Document, Lint, and CI retain bounded three-attempt repair budgets.
- Cancelled CI checks are not rerun automatically. This repository deliberately uses `cancel-in-progress`; a cancellation is ambiguous and another provider run spends CI resources.
- Trusted documentation guidance maps facts to their existing owners: domain material under `docs/architecture/`, decisions under `docs/decisions/`, current delivery under `docs/v0.x/`, and CI behavior in `.github/workflows/README.md`.
- Trusted path-specific review guidance reinforces kernel host isolation, the fail-closed workflow aggregate, and documentation corpus maintenance only where those paths change.
- The configuration does not select an agent, override the forge default branch, declare no CI, ignore changed paths, enable pushed-branch commands, or publish evidence. Those machine, routing, readiness, review-coverage, trust, and publication defaults already have the correct behavior.

## Consequences

- After this record and configuration land on `master`, initialized no-mistakes gates fetch and trust the same repository command and prompt policy.
- A gate run still performs targeted local evidence rather than duplicating the complete remote suite. A change is not ready to land until GitHub reports the protected `ci-required` aggregate green.
- Deterministic static and corpus failures surface through exact repository commands, while no-mistakes agents remain responsible for review, focused tests, documentation repair, PR drafting, and bounded fixes.
- The frozen install makes configured commands self-contained in disposable no-mistakes worktrees instead of assuming a checkout already has `node_modules`.
- This is process/tooling policy only. It changes no Loredu domain behavior, terminology, contract, or package boundary, so the domain-doc update playbook requires no architecture or contract edit.

## Rule / follow-up

Keep `.no-mistakes.yaml` on the default branch and use only fields verified against the installed no-mistakes schema. Script-name or check-list maintenance may update the configuration with the repository scripts it follows. Changing the trust posture, moving broad regression into local Test, weakening CI readiness, ignoring review paths, or publishing evidence requires a superseding decision.
