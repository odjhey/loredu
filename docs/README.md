---
name: docs_guide
description: "How to explore and maintain the Loredu design corpus."
type: index
tags: [docs, meta]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T15:45:00+08:00
---

# Loredu documentation guide

The docs are organized for progressive disclosure. Start with an index, follow only the path needed for the current question, and use frontmatter to understand a document before reading it in full.

## Reading paths

- **What is Loredu?** → [product architecture](./architecture/product-architecture.md)
- **What exactly is v0.x proving?** → [v0.x goal and scope](./v0.x/scope/goal-and-scope.md)
- **What do the core words mean?** → [ubiquitous language](./architecture/ubiquitous-language.md)
- **What are the durable contracts?** → [contracts](./architecture/contracts/README.md)
- **Why these design choices?** → [decisions](./decisions/README.md)
- **Which real activities keep the design honest?** → [representative activities](./v0.x/use-cases.md)
- **How should an agent work in this repo?** → [agent policy](./ai/agent-policy.md) (root entry point: [`AGENTS.md`](../AGENTS.md))
- **Find anything** → [INDEX.md](./INDEX.md), or `bun docs/scripts/find-docs.mjs`

## Frontmatter

Every substantive document uses:

```yaml
name: stable_snake_case_name
description: "One sentence describing the document."
type: index | architecture | contract | glossary | plan | report | decision
tags: [topic]
status: draft | current | archived | superseded
```

Optional fields include `generated`, `verified`, `sources`, `stale_after`, `created_at`, and `updated_at`.

## Layout

```text
docs/
├── README.md      ← you are here: how to explore
├── INDEX.md       ← flat table of contents (every doc, one line each)
├── architecture/  target-state architecture, with contracts/ as the published core
├── decisions/     ADR-lite decision records (see decisions/README.md for format)
├── v0.x/          the initial delivery: scope/ and execution/
├── ai/            agent behavior policy (human- and machine-readable)
├── playbooks/     repeatable procedures for agents and operators
├── reports/       assessments and findings (generated, operator-verified)
└── scripts/       docs tooling (find-docs.mjs)
```

## Finding docs by query

`bun docs/scripts/find-docs.mjs` queries the frontmatter above: `--type`, `--tag`, `--name`, `--status`, `--stale`, `--all`, `--json`, or free-text terms. Stale and archived docs are hidden by default. It is zero-dependency, so `node` works too. The `find-docs` skill documents it and lives at `.agents/skills/find-docs/SKILL.md`, exposed to harnesses through the `.claude/skills` symlink.

## Maintenance rules

1. Prefer updating the existing source of truth over creating a near-duplicate.
2. Link every document from its nearest index and from [INDEX.md](./INDEX.md).
3. Supersede durable decisions and design documents rather than deleting useful history.
4. Treat generated, unverified analysis as a proposal until reviewed.
5. Keep implementation-provider details out of domain contracts unless the contract itself is intentionally provider-specific.
6. Bump `updated_at` when you materially edit a document; agent-produced docs set `generated`, and the operator sets `verified` on review.
