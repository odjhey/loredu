# Workflows

`ci-required.yml` is the whole gate: a path selector, two suites, and a
fail-closed aggregate job named `ci-required` — the only status branch
protection should require (ADR 0012).

- **selector** — classifies the changed paths. Anything it cannot classify with
  confidence selects the full suite; a wrong "docs-only" answer would skip real
  checks, while a wrong "full" answer only costs time. `docs/scripts/**` counts
  as code, so a change there selects the full suite despite living under `docs/`.
- **docs suite** — changes confined to `docs/**`: spelling, docs structure,
  catalog integrity, and the self-test that proves those gates still fire.
- **workspace suite** — every other change: `bun install --frozen-lockfile`,
  then lint and spelling (cheapest signal first), the same corpus checks, then
  typecheck, `bun test`, and a compile smoke that runs the built `lor` binary
  rather than just trusting the bundler.
- **aggregate** — runs with `if: always()` and asserts that the suite the
  selector chose actually succeeded, and that the other one was skipped rather
  than failed.

Run the same checks locally:

```sh
bun run lint          # biome check .
bun run spell         # cspell over the prose
bun run check:docs    # frontmatter, links, anchors, reachability
bun run check:catalog # every T-number implemented xor deferred
bun run check:gates   # proves both gates fire on violations
bun run typecheck     # tsc -p per project
bun test
bun run build && ./packages/cli/dist/lor --version
```

The corpus checks are zero-dependency so the docs suite needs no `bun install`;
that is the reason a separate docs path is worth having at all.
