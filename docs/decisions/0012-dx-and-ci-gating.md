---
name: decision_dx_and_ci_gating
description: "Biome for lint+format, cspell gate, single required ci-required status with fail-safe path selection, catalog drift check, AGENTS.md single entry with harness symlinks."
type: decision
tags: [decisions, dx, ci, lint, agents]
status: draft
generated: "Claude Fable 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T00:00:00+08:00
updated_at: 2026-08-26T00:00:00+08:00
---

# 0012: Developer experience and CI gating

## Context

Bun supplies the runtime, test runner, workspaces, and compiler ([0007](./0007-typescript-bun.md)) but ships no linter or formatter, and says nothing about CI shape or agent entry points. The xatu-delivery-companion monorepo — pnpm/Node, but its patterns are toolchain-portable — was audited as prior art: its guiding posture is *CI, not human review, is the supervisor* (single operator plus agents sharing one identity, no CODEOWNERS, one required status check), which matches how this repo already operates.

## Options considered

- ESLint + Prettier + cspell (xatu's stack);
- Biome (single tool for lint + format) + cspell;
- no lint/format gates until the code demands them.

## Choice

**Biome for lint and format, code only.** xatu rejected Biome specifically because Next.js's ESLint plugin forced a second tool class; that constraint does not exist here — no web app, no plugin ecosystem needed at kernel scale. One fast tool, one config. Markdown is excluded from formatting: contract tables and prose are hand-authored and stay hand-shaped.

**cspell as a CI gate.** This is a prose-first repo; spelling drift in contracts is contract drift.

**CI: xatu's `ci-required` pattern, collapsed to kernel scale.** One required branch-protection status. A path selector decides what runs, **fail-safe**: docs-only changes select nothing (CI green with no suites); any change outside `docs/` — including root config, lockfile, CI itself — selects everything. One workspace suite runs, in order: Biome check → cspell → typecheck → the full behavioral `tests/` tree → the kernel boundary check ([0011](./0011-repo-package-architecture.md)) → catalog drift check → `lor` compile smoke. A final aggregate job **fails closed** (`if: always()`, asserts every selected suite succeeded) and is the only required status — requiring skippable suites directly would deadlock docs-only PRs.

**Catalog drift check.** A small script asserts a bijection between the [behavioral test catalog](../v0.x/execution/first-user-journey.md) and the test tree: every T-number in the catalog appears in at least one test file under `tests/`, and no test file names a T-number the catalog lacks. This mechanizes the drift mitigation [0011](./0011-repo-package-architecture.md) otherwise leaves to convention.

**Agent entry point: one file, symlinked.** Root `AGENTS.md` is the single cross-harness source; `CLAUDE.md` (and any other harness file) is a symlink to it. Shared skills live in `.agents/skills/`, with `.claude/skills` symlinked in. Adopted verbatim from xatu — edit-here-only prevents multi-harness drift.

**Pinning and hooks.** The Bun version is pinned (version file consumed by CI setup) so humans, CI, and agents agree. **No pre-commit hooks** — enforcement is CI-side only, deliberate for agent fan-out under one identity. **No coverage tooling** — the bet is determinism plus catalog conformance, not coverage percentage; a green `tests/` tree that mirrors the catalog *is* the coverage report.

## Consequences

- one lint/format tool with no plugin surface; if a future web/Next surface ever appears, its package can carry its own ESLint without changing the kernel's tooling (xatu's split proves this works);
- docs-only PRs — the majority so far — get instant green without burning CI minutes;
- the drift check turns "did we implement the catalog?" from a review question into a failing job;
- agents joining from other repos in this ecosystem find the same entry-point convention xatu uses;
- local enforcement is zero: a contributor (human or agent) learns of a violation from CI, which is acceptable because pushes are cheap and the trunk is protected by the single gate.

## Rule or follow-up

The gate composition above is authoritative; adding, removing, or reordering a gate is an update to this decision, not an ad-hoc workflow edit. The selector must stay fail-safe: when in doubt about a path, run everything.
