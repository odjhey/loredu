# Workflows

`ci-required.yml` is the whole gate: a path selector, two suites, and a
fail-closed aggregate job named `ci-required` — the only status branch
protection should require (ADR 0012).

- **selector** — classifies the changed paths. Anything it cannot classify with
  confidence selects the full suite; a wrong "docs-only" answer would skip real
  checks, while a wrong "full" answer only costs time.
- **docs suite** — changes confined to `docs/**`: spelling, docs structure,
  catalog integrity, and the self-test that proves those gates still fire.
- **workspace suite** — every other change: the same corpus checks, plus the
  workspace checks. Until the scaffold lands it fails on purpose if a root
  `package.json` appears without its suite wired here.
- **aggregate** — runs with `if: always()` and asserts that the suite the
  selector chose actually succeeded, and that the other one was skipped rather
  than failed.

Run the same checks locally:

```sh
bun docs/scripts/check-docs.mjs        # frontmatter, links, anchors, reachability
bun docs/scripts/check-catalog.mjs     # every T-number implemented xor deferred
bun docs/scripts/check-selftest.mjs    # proves both gates fire on violations
bunx cspell --no-progress "docs/**/*.md" "*.md" ".agents/**/*.md"
```
