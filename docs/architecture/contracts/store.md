---
name: record_store_contract
description: "Provider-neutral persistence port for append-only Loredu records."
type: contract
tags: [contracts, storage, ports]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T12:10:00+08:00
---

# Record store port

The application core depends on record semantics, not a persistence technology.

A minimal store provides equivalent capabilities to:

```text
append(record) -> record id
get(id) -> record | not-found
scan(filter) -> ordered records
stream(after-cursor?) -> ordered records
```

Exact method names are language-specific and are not part of this contract.

## Required behavior

- `append` never silently replaces a record with the same identity.
- reads return the original canonical record, not a projected/mutated representation;
- ordering/cursors are deterministic enough to replay projections;
- store adapters preserve record data required by the published record schema;
- application logic must not depend on provider-specific paths, tables, SDK objects, or query languages.

## Alpha adapter

The first adapter is planned as plain Markdown files with YAML frontmatter. That representation is an adapter detail, not the domain model.

An optional SQLite index/cache may later accelerate filtering, full-text search, joins, and projections. A derived index must be disposable and rebuildable from canonical records.

A future SQLite/Postgres/other canonical `RecordStore` may be added behind the same port if scale or concurrency justifies it.
