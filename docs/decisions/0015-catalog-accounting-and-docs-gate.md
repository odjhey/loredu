---
name: decision_catalog_accounting_and_docs_gate
description: "Machine-checked accounting for the behavioral catalog: every T-number is claimed by a real test via @covers or deferred in catalog-status.json. Plus the structural gate over the docs corpus and the self-test that proves both gates fire."
type: decision
tags: [decisions, ci, docs, tests, agents]
generated: "Claude Opus 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T18:00:00+08:00
---

# 0015: Catalog accounting, the docs gate, and proving both fire

## Context

[ADR 0012](./0012-dx-and-ci-gating.md) made the behavioral catalog authoritative and ruled out percentage coverage tooling: the catalog plus explicit deferred-state accounting is the coverage model. It did not say how that accounting is represented or checked, so nothing enforced it.

The docs corpus had the same gap from the other direction. It is the only content this repo has, [ADR 0014](./0014-minimal-frontmatter.md) defines a schema for it, and nothing verified that a doc satisfies that schema, that its links resolve, or that anything links to it at all.

Both gaps share a failure mode: a rule that lives only in prose is a rule agents will drift from, and nobody will notice until the corpus is already wrong.

## Options considered

- Percentage coverage tooling — ruled out by ADR 0012;
- trust the catalog table and review by hand;
- **machine-checked exact accounting, with deferral stated explicitly and both gates self-tested.**

## Choice

**`docs/v0.x/execution/catalog-status.json` records deferred work.** Each entry is a catalog T-number mapped to the `milestone` that will implement it and a `reason`. It sits beside the catalog so a docs-only change carries both, and it is JSON so every runtime here parses it without a dependency. The file starts with all 63 catalog entries deferred and zero implemented, because that is the truth today.

**A test claims a catalog entry with `@covers`.** In a `*.test.ts` file under `tests/`, the annotation `@covers T01` (comma-separated for several) in the test title or a comment above it is what marks a T-number implemented. A grep-able convention, not a framework.

**Exact accounting, enforced by `docs/scripts/check-catalog.mjs`.** Every catalog T-number is either claimed by a test or listed as deferred — never both, never neither — and nothing may claim a T-number the catalog does not define. Drift in either direction fails the build.

**A claim must be backed by a running assertion.** A file that claims coverage but contains no assertion, or that claims it from a `.skip`/`.todo` test, fails as a placeholder. This is the specific dishonesty ADR 0012 warned about: a green suite must never mean "a file exists".

**`docs/scripts/check-docs.mjs` is the structural gate over the corpus.** Required frontmatter fields present, `name` values unique, `status` inside the ADR 0014 vocabulary, no reintroduced `updated_at`, relative links resolving, `#anchors` matching a real heading, and every doc reachable from some other doc. The last rule makes "a doc nothing links to is a bug" mechanical rather than aspirational.

**Both gates are self-tested by `docs/scripts/check-selftest.mjs`, in CI.** It copies the corpus to a temp directory, injects one synthetic violation at a time, and asserts the checker fails for the expected reason — then asserts the unmutated copy is clean. A guardrail that has never fired is not a guardrail, and this keeps the red proofs repeatable instead of spending a throwaway PR per rule and never running them again.

## Consequences

- Deferred debt is visible and counted: 63 entries today, each naming the milestone that clears it. Moving a T-number to implemented means deleting its entry and claiming it from a real test — the accounting check enforces that both happen together.
- `catalog-status.json` is verbose by design. Its size is the honest measure of remaining work.
- The gates run on every change, not only docs-only ones, so the corpus cannot be broken by a code PR.
- If a checker's parser breaks such that it stops finding violations, the self-test fails. That is the intended tripwire.
- The annotation convention is enforced only where a test claims a T-number; a test with no claim is free-form.

## Rule / follow-up

- The `ci-required` workflow is described in [`.github/workflows/README.md`](../../.github/workflows/README.md). Its workspace suite deliberately fails once a root `package.json` exists until the full suite (Biome, typecheck, `bun test`, kernel boundary check, `lor` compile smoke) is wired there — issue #9 Phase A/B.
- Branch protection requiring `ci-required` as the only status, and squash-merge-only, are operator actions ([ADR 0013](./0013-agent-decision-authority.md)).
