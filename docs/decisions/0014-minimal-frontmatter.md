---
name: decision_minimal_frontmatter
description: "Frontmatter stays minimal: git owns last-changed time, created_at is the only timestamp, and status carries real signal. Docs are not created as draft."
type: decision
tags: [decisions, docs, meta]
generated: "Claude Opus 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T16:30:00+08:00
---

# 0014: Minimal frontmatter — git owns time, status carries signal

## Context

This corpus is agent-maintained and edited in parallel across branches and worktrees ([ADR 0013](./0013-agent-decision-authority.md)). Frontmatter is what an agent reads to decide whether to open a file at all, so each field has to earn its place: a field that agents must hand-maintain is a field that will be forgotten, will conflict on merge, and will eventually lie.

Two questions needed answering. Where does last-changed time live? And what should `status` actually tell a reader?

## Options considered

- Frontmatter carries its own last-changed timestamp alongside `created_at`, maintained by whoever edits;
- **git owns last-changed time; frontmatter carries only what git cannot answer**;
- no metadata at all — rely on git and prose alone.

## Choice

**Git owns last-changed time.** The answer is one command:

```sh
git log -1 --format=%cI -- <path>
```

It cannot go stale, cannot conflict between branches, and cannot be forgotten. A hand-maintained copy of it would be a line every parallel branch touches and nobody can merge cleanly — noise where the repo needs signal.

**`created_at` is the only timestamp in frontmatter.** A birth date is written once and never rewritten, so it neither conflicts nor rots, and it orders the corpus without a git walk.

**`status` vocabulary** — set it only when it says something:

| Value | Meaning |
|---|---|
| *(absent)* | Agreed and in force: an accepted decision, a settled contract, an active convention. The default — do not add a status to say "normal". |
| `draft` | Deliberately unsettled: in flight, may change under you. Set it on purpose, never by default. |
| `current` | Implemented in code, and this doc matches what ships. Says nothing before the code exists, so it appears as milestones land. |
| `superseded` | Replaced. Must link its replacement. |
| `archived` | Historical, no replacement. |

**Docs are not created as `draft`.** A new doc stating the agreed design carries no status. A corpus where every doc is a draft cannot warn anyone about a particular doc, which is the only reason to have the word. This also keeps `current` meaningful: it marks the point where design and code have met — the distinction that matters most in a design-first repo.

**Trust fields, in an agent-first corpus.** `generated` marks authorship, not doubt: nearly every doc here was written by a model, so its presence is the norm. `verified` is the operator's stamp and means something precisely because it is rare.

## Consequences

- Freshness signal rests on `status` and `stale_after`. `docs/scripts/find-docs.mjs` filters on exactly those.
- "When did this doc last change?" is a git question. Anyone who wants it in a listing can join against git; nobody maintains it by hand.
- `status: draft` becomes rare enough to be worth reading. `docs/v0.x/execution/agent-skill.md` is the current example — it declares itself unsettled and is revised as M2/M3 land.
- Nothing enforces the vocabulary mechanically yet. A future check could assert that `current` docs name an implementing test; not built.
- Skill files under `.agents/skills/` are not docs and carry only what the harness consumes (`name`, `description`) — outside this schema.

## Rule / follow-up

- Schema of record: [`docs/README.md`](../README.md).
