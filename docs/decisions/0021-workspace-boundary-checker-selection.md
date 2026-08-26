---
name: decision_workspace_boundary_checker_selection
description: "Select the tested purpose-built workspace boundary checker for the current package graph, while retaining compiler type isolation as a complementary guard."
type: decision
tags: [decisions, repo, testing, toolchain, boundaries]
generated: "OpenAI Codex, 2026-08-26"
created_at: 2026-08-26T00:00:00+08:00
---

# 0021: Workspace boundary checker selection

## Context

[ADR 0011](./0011-repo-package-architecture.md) fixed the package dependency law and required both an architecture/import check and kernel type isolation, but left checker selection to a dependency-cruiser-first spike with a purpose-built scanner as a possible fallback. [ADR 0016](./0016-workspace-scaffold-and-kernel-type-isolation.md) described its original structural scanning as interim and deferred the Phase C selection.

M0 W0 requires each finite manifest, import, testing-subpath, and ambient-capability rule to have synthetic RED-then-GREEN evidence. Import graph tools do not detect no-import ambient calls such as `Date.now()` or `Math.random()`, so dependency-cruiser would still need a separate capability guard. W0 now has one tested checker entry point in `tests/workspace-boundary.ts`; `tests/workspace-structure.test.ts` drives it against synthetic workspaces and the actual production paths.

This record supersedes only ADR 0011's dependency-cruiser-first checker-selection sequence and resolves ADR 0016's deferred Phase C checker-selection follow-up. All other choices in ADRs 0011 and 0016 remain in force.

## Options considered

- dependency-cruiser for imports and package direction plus a separate ambient-capability guard;
- the tested purpose-built checker for the current finite three-package workspace rules;
- retain the interim structural checks and leave checker selection open.

## Choice

Select `tests/workspace-boundary.ts` as the configured checker for the current three-package workspace. Do not add dependency-cruiser now.

The checker exposes the complete current rule categories through one `boundaryViolations` fixture-test interface, handles the non-import ambient capability rules, and adds no checker dependency beyond the TypeScript compiler already present in repository development tooling. Every declared rule category has committed synthetic RED-then-GREEN proof, with focused regression cases for the governed syntax forms that W0 relies on. This is a direct W0 selection; it does not claim that dependency-cruiser was tried and failed, nor that the committed cases exhaust all future TypeScript syntax.

## Consequences

- the repository owns a small TypeScript-syntax-aware boundary checker and its maintenance risk;
- dependency-cruiser is deferred, not rejected forever;
- architecture checks and the kernel's default-deny compiler type environment remain complementary;
- source-layout, package-graph, module-syntax, or toolchain changes invalidate the present evidence and may trigger a checker revisit;
- this changes repository governance only: no domain term, record contract, public kernel API, capability ownership boundary, adapter behavior, or CLI behavior changes, so no domain-document update is required.

## Rule or follow-up

Every boundary rule category must retain a synthetic RED-then-GREEN proof through `boundaryViolations`. Add permanent regression cases for newly governed syntax; do not claim exhaustive lexical or import-syntax coverage beyond committed evidence. Revisit the checker when package-graph complexity or governed import syntax exceeds its justified scope, or when another tool can replace it without weakening ambient-capability enforcement and deliberate-violation proofs.
