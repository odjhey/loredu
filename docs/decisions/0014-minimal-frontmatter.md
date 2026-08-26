---
name: decision_minimal_frontmatter
description: "Drop updated_at from doc frontmatter — git owns last-changed time — and give status a vocabulary with real signal; docs are not created as draft."
type: decision
tags: [decisions, docs, meta]
generated: "Claude Opus 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T16:30:00+08:00
---

# 0014: Minimal frontmatter — git owns time, status carries signal

## Context

Every doc carried both `created_at` and `updated_at`, and every doc was born `status: draft`. Both conventions were inherited, and both misfire here.

`updated_at` is a hand-maintained copy of something git already knows exactly. With agents working in parallel across branches and worktrees, it is a line that every branch touches and nobody can merge cleanly: pure conflict noise, and wrong whenever an agent forgets to bump it. A field that is both noisy and untrustworthy is worse than no field.

`status: draft` on all 39 docs conveyed nothing. If every doc is a draft, the word cannot warn anyone about a particular doc, which is the only reason to have it.

## Options considered

- Keep both timestamps and the draft default;
- **drop `updated_at`, keep `created_at`, give `status` a vocabulary with real signal**;
- drop all metadata and rely on git plus prose alone.

## Choice

**Drop `updated_at`.** Last-changed time comes from git:

```sh
git log -1 --format=%cI -- <path>
```

It cannot go stale, cannot conflict, and cannot be forgotten. `created_at` stays: a birth date is written once, never rewritten, so it neither conflicts nor rots, and it orders the corpus without a git walk.

**`status` vocabulary** — set it only when it says something:

| Value | Meaning |
|---|---|
| *(absent)* | Agreed and in force: an accepted decision, a settled contract, an active convention. The default — do not add a status to say "normal". |
| `draft` | Deliberately unsettled: in flight, may change under you. Set it on purpose, never by default. |
| `current` | Implemented in code, and this doc matches what ships. Says nothing before the code exists, so it appears as milestones land. |
| `superseded` | Replaced. Must link its replacement. |
| `archived` | Historical, no replacement. |

**Docs are not created as `draft`.** A new doc that states the agreed design gets no status. This makes `draft` mean what it says, and makes `current` a real signal that design and code have met — the distinction that matters most in a design-first repo.

**Trust fields, in an agent-first corpus.** `generated` is the norm, not a caveat: nearly every doc here was written by a model, so its presence marks authorship, not doubt ([ADR 0013](./0013-agent-decision-authority.md)). `verified` remains the operator's stamp and still means something precisely because it is rare.

## Consequences

- Freshness signal rests on `status` and `stale_after`. `docs/scripts/find-docs.mjs` never read `updated_at`, so its filters are unaffected.
- "When did this doc last change?" becomes a git question. Anyone wanting it in a listing can join against git; nobody has to maintain it by hand.
- Nothing enforces the status vocabulary mechanically yet. A future check could assert that `current` docs name an implementing test; not built.
- Skill files under `.agents/skills/` are not docs and carry only what the harness consumes (`name`, `description`) — they are outside this schema.

## Rule / follow-up

- Schema of record: [`docs/README.md`](../README.md).
- Existing corpus swept with this decision: `updated_at` removed everywhere; `status: draft` removed except on [the agent skill draft](../v0.x/execution/agent-skill.md), which declares itself unsettled and is revised as M2/M3 land.
