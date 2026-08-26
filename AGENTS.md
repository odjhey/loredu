This repository uses `AGENTS.md` as the cross-harness entry point for agent behavior. `CLAUDE.md`, `CONTEXT.md`, and `GEMINI.md` are symlinks to this file — edit here only.

## What this repo is

Loredu is an embedded operational knowledge kernel — a utility our own products build on, not a standalone product. Activities append what they learn as immutable, provenance-carrying records; claims declare identity keys so knowledge about the same fact meets instead of piling up. The kernel is strictly mechanical: it detects duplicates, conflicts, divergence, and staleness deterministically and never judges. Humans and agents make the judgments, and every judgment is itself a record.

The repo is agent-first and design-first, and currently holds **no source tree**: contracts, decision records, and the v0.x plan are the artifact until the application contracts settle. Treat docs as the thing being built, and the maintenance rules in `docs/README.md` as its build system.

## Source of truth

- Human-readable agent policy: `docs/ai/agent-policy.md`
- Machine-readable agent policy: `docs/ai/agent-policy.yaml` (harnesses that cannot consume YAML use the markdown policy)
- How to explore the docs, frontmatter schema, maintenance rules: `docs/README.md`
- Flat table of contents for every doc: `docs/INDEX.md`
- Terminology: `docs/architecture/ubiquitous-language.md`
- Domain contracts: `docs/architecture/contracts/README.md`
- Durable decisions (supersede, never rewrite): `docs/decisions/README.md`
- Current scope and plan: `docs/v0.x/scope/goal-and-scope.md`, `docs/v0.x/execution/implementation-plan.md`
- Who decides, and the record you owe when you do: `docs/ai/agent-policy.md#who-decides` (`docs/decisions/0013-agent-decision-authority.md`)
- Frontmatter schema and `status` vocabulary: `docs/decisions/0014-minimal-frontmatter.md`
- Repo and package architecture (dependency law, test catalog shape): `docs/decisions/0011-repo-package-architecture.md`
- Toolchain, lint, and CI gating: `docs/decisions/0012-dx-and-ci-gating.md`
- Behavioral test catalog (T-numbers) and expected CLI journeys: `docs/v0.x/execution/first-user-journey.md`

## Commands

There is no workspace scaffold yet — `package.json`, the `packages/` tree, `tests/`, and the root `test`/`typecheck`/`lint`/`build` scripts land with Phase A of the repo-setup tracker (issue #9), and this section gains the paste-able verify sequence then. Until then the only repo tooling is the docs query:

```sh
bun docs/scripts/find-docs.mjs --type contract   # query docs by frontmatter (node also works)
```

Boundaries that will be enforced once code exists (see ADRs 0011 and 0012): the kernel takes zero runtime dependencies and no `node:*`/`bun:*` imports or ambient Bun/Node globals; the package DAG is one-way (kernel ← store-plainfile ← cli); a T-number is either covered by an executable test or explicitly deferred, never both, and never faked with a placeholder test.

## Default discovery sequence

1. Read this file and any harness-specific instructions.
2. Inspect the issue, PR, plan, and relevant git history before inventing new work.
3. When researching repository knowledge, start from the nearest relevant index (`docs/INDEX.md` or a directory `README.md`), or use the `find-docs` skill (`bun docs/scripts/find-docs.mjs`).
4. Follow links progressively to more specific knowledge; broken links in knowledge docs may be intentional (not-yet-written knowledge).
5. When working inside a package/service/script directory, check its `README.md` for local context.
6. Load skills when their trigger conditions apply.
7. Prefer repository scripts and deterministic CLI tooling over manually recreating documented procedures.
8. Decide rather than block — and write the decision record you owe (`docs/decisions/`).
9. Use an isolated worktree when concurrent work exists.
10. Verify the result and produce the expected evidence before considering work complete.

## You decide; the record is the obligation

Agents settle design questions, change contracts, and adjust scope here without operator sign-off, until production release. The condition is that anything durable you settle becomes a decision record under `docs/decisions/` — written before or with the change that depends on it. Supersede earlier records, never rewrite them. The failure mode this repo polices is the *unrecorded* decision, not the unreviewed one.

Still the operator's call: production release, anything reaching outside the repo (publishing, external services, credentials, spend), and irreversible operations (history rewrites, force-push to `master`, bulk deletion).

## Trust the frontmatter

- No `status` → agreed and in force; that is the normal state, not a gap.
- `draft` → deliberately unsettled. `current` → implemented in code and matching what ships.
- `archived`/`superseded`, or a past `stale_after` → historical only; find the replacement.
- `generated` marks model authorship — the norm here, not a caveat; `verified` is the operator's stamp.
- Last-changed time comes from git, not frontmatter: `git log -1 --format=%cI -- <path>`.

## Harness adapters

- Harness-specific instruction files stay thin and defer to this file and the policy docs above.
- Shared agent and skill definitions live in `.agents/` (`.agents/agents`, `.agents/skills`); `.claude/agents` and `.claude/skills` are symlinks into it. Add new skills under `.agents/skills/<name>/SKILL.md` so every harness picks them up.
- The `find-docs` skill lives at `.agents/skills/find-docs/SKILL.md`.
- Once the `lor` binary exists, a repo-level skill wrapper should defer to `lor skill` rather than duplicating the guide drafted in `docs/v0.x/execution/agent-skill.md`.

## Worktree path convention

- Create git worktrees ONLY in `.worktrees/<name>` (inside the repo, git-ignored).
- Do not invent other worktree paths unless the user explicitly asks for a specific location.

## Plan closure requirements

- Use `docs/playbooks/domain-doc-update.md` when domain documentation may be impacted.
- If domain behavior, terminology, or boundaries changed, update the relevant docs under `docs/architecture/` (start with the ubiquitous language and contracts); otherwise record why no domain-doc update was needed.
- Link every new doc from its directory index and `docs/INDEX.md`; record any durable choice you made along the way.

## Documentation conventions

- Described in `docs/README.md`: frontmatter schema, link rules, index upkeep, trust/provenance fields.
