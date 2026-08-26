---
name: find-docs
description: Find and filter Loredu design docs by querying their YAML frontmatter (name, type, tags, status) or the docs index. Use when looking for a contract, decision record, plan, or report in docs/, or when asked "where is the doc about X".
type: guide
tags: [docs, meta, skill]
status: current
created_at: 2026-08-26T15:40:00+08:00
updated_at: 2026-08-26T15:40:00+08:00
---

> Canonical home of the `find-docs` skill (`.agents/skills/find-docs/SKILL.md`, exposed to harnesses via the `.claude/skills` symlink). To activate in another repo that carries these docs, copy this file to `.claude/skills/find-docs/SKILL.md` there.

# Finding Loredu docs

Every doc under `docs/` carries YAML frontmatter with at least `name` (snake_case id), `description`, and `type`. Optional: `tags`, `status`, `generated`, `verified`, `sources`, `stale_after`, `created_at`, `updated_at`. Schema details: `docs/README.md`.

## Without scripts (progressive disclosure)

1. `docs/INDEX.md` — every doc, one line each. Scan descriptions.
2. Each directory's `README.md` is an index of its children.
3. Follow the links at the bottom of a doc to its parent index and related docs.

## With the query script (preferred)

`docs/scripts/find-docs.mjs` — zero-dependency script over the frontmatter. Runs under Bun (the repo runtime, see [ADR 0007](../../../docs/decisions/0007-typescript-bun.md)) or Node 18+:

```sh
bun docs/scripts/find-docs.mjs                          # list current docs (stale/archived hidden by default)
bun docs/scripts/find-docs.mjs --type contract          # by type
bun docs/scripts/find-docs.mjs --tag v0.x --tag agents  # AND-filter by tags
bun docs/scripts/find-docs.mjs working lore             # free-text terms
bun docs/scripts/find-docs.mjs --name records_contract  # exact name lookup
bun docs/scripts/find-docs.mjs --all                    # include stale/archived docs
bun docs/scripts/find-docs.mjs --stale                  # ONLY archived/superseded or past stale_after
bun docs/scripts/find-docs.mjs --json                   # machine-readable output
```

Stale docs are excluded by default so routine queries only surface trustworthy content; reach for `--all`/`--stale` (or an explicit `--status`) when history matters. Exit code 1 when nothing matches, so it composes in shell conditionals.

## With grep (fallback when no runtime is available)

List every doc with its type and description:

```sh
grep -r --include='*.md' -A3 '^name:' docs/ | grep -E 'name:|description:|type:'
```

Find docs by type (e.g. all contracts):

```sh
grep -rl --include='*.md' '^type: contract' docs/
```

Find docs by tag (tags are a bracketed list, so match inside it):

```sh
grep -rl --include='*.md' '^tags: .*\bv0.x\b' docs/
```

Find a doc by its snake_case name:

```sh
grep -rl --include='*.md' '^name: goal_and_scope' docs/
```

Full-text search, but show which doc it is:

```sh
grep -r --include='*.md' -l 'Working Lore' docs/ | xargs grep -H '^name:'
```

## Trust and freshness checks

Before relying on a doc:

- `status: archived` or `superseded` → historical only; find the replacement.
- `stale_after` in the past → verify content before using.
- `generated` present but no `verified` → agent or model recommendation, not operator-confirmed. Much of this corpus is currently `status: draft` and generated — treat it as a proposal unless `verified` says otherwise.

```sh
grep -rl --include='*.md' '^status: \(archived\|superseded\)' docs/   # what NOT to trust
```

## Type taxonomy

`index` | `architecture` | `contract` | `glossary` | `plan` | `spec` | `guide` | `checklist` | `reference` | `report` | `decision` | `diagram`
