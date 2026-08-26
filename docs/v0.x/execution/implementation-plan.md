---
name: v0x_implementation_plan
description: "M0–M3 implementation sequence for the Loredu domain kernel, plain-file store, projections, and Working Lore."
type: plan
tags: [v0.x, execution]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T12:10:00+08:00
---

# v0.x implementation plan

The implementation sequence starts from the application contracts and deliberately postpones product surfaces.

## M0 — Domain kernel

Implement and test:

- immutable record envelope;
- Entry, Claim, Relation, Resolution, Verification shapes;
- opaque ID generation/validation;
- `recorded_at` and optional validity fields;
- scope, actor, and provenance/reference structures;
- record validation and compatibility rules.

Exit: records can be created, validated, serialized, and compared without any storage or UI dependency.

## M1 — Plain-file persistence

Implement:

- `RecordStore` port;
- `PlainFileStore` adapter;
- Markdown/frontmatter codec for records with free-text Entry bodies;
- append/get/scan/replay semantics;
- deterministic filesystem layout that is not exposed as a domain contract.

Optional only if useful: a generated human-readable index. Do not make the index canonical.

Exit: deleting all derived state and replaying the Markdown records reconstructs the same record stream.

## M2 — Reconciliation and projection

Implement deterministic baseline rules for:

- duplicate detection where identity/value/source makes it unambiguous;
- same-value corroboration/support;
- candidate conflict detection for overlapping property-like claims;
- mechanical temporal precedence where inputs are sufficient;
- explicit Resolution application;
- current, `as_of`, `valid_at`, and combined temporal projections;
- evidence/history lookup by record identity.

Exit: projections are deterministic and rebuildable from canonical records and the same ruleset.

## M3 — Working Lore

Implement:

- Activity query/scope input;
- bounded Working Lore output;
- deterministic baseline ranking/filtering;
- separate current, patterns, candidates/conflicts, and revalidation sections;
- stable handles for drilling into claims, evidence, and entries;
- item/character budgets.

Do not require embeddings or a model reranker.

Exit: the acceptance activity receives useful context that remains bounded as historical records accumulate.

## Acceptance scenario A — repeated technical investigation

1. Run/entry 1 records: `CLI commands appear under src/commands`.
2. Run/entry 2 records: `plugins can register commands dynamically`.
3. Run/entry 3 records a later plugin-registration change with source/snapshot provenance.

Verify:

- current projection does not claim `src/commands` is exhaustive;
- earlier `as_of` projection reproduces the earlier belief;
- supporting entries/source refs are inspectable;
- Working Lore returns a compact current pattern plus any revalidation attention rather than all three raw entries.

## Acceptance scenario B — policy change

1. Base document states a 30-day notice period.
2. Later amendment states a 60-day notice period effective on a specific date.
3. The amendment is recorded after its effective date.

Verify:

- current projection prefers the amended value;
- `as_of` before discovery returns the earlier belief;
- current `valid_at` after the amendment effective date returns the amended value;
- combined `as_of` + `valid_at` distinguishes historical knowledge from later correction;
- evidence resolves to both base and amendment references.

## Guardrail scenario — business-process perspectives

Record different documented and observed process sequences. Verify that perspective prevents an automatic destructive contradiction and allows the projection to surface a process gap/attention item.

## After v0.x

Only after these contracts prove useful should the project decide which inbound surface to build first and whether SQLite indexing, source adapters, agent extraction, model-assisted resolution, or Rozoro integration are justified.
