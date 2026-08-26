---
name: docs_guide
description: "How to explore and maintain the Loredu design corpus."
type: index
tags: [docs, meta]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T12:10:00+08:00
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
- **Find anything** → [INDEX.md](./INDEX.md)

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

## Maintenance rules

1. Prefer updating the existing source of truth over creating a near-duplicate.
2. Link every document from its nearest index and from [INDEX.md](./INDEX.md).
3. Supersede durable decisions and design documents rather than deleting useful history.
4. Treat generated, unverified analysis as a proposal until reviewed.
5. Keep implementation-provider details out of domain contracts unless the contract itself is intentionally provider-specific.
