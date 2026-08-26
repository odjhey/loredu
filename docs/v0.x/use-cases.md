---
name: representative_activities
description: "Three domain-agnostic activity scenarios used to keep Loredu useful across technical, project/process, and policy/legal knowledge work."
type: plan
tags: [v0.x, use-cases, activities]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T12:10:00+08:00
---

# Representative activities

Loredu should support activities that repeatedly inspect a changing body of information, accumulate useful findings, and benefit from carrying forward only the relevant current knowledge. These scenarios test the core design; they do not mean Loredu owns the crawler/reviewer itself.

## Technical investigation

Example activity: inspect a CLI or application to identify implementation patterns, templates, execution flows, conventions, and current behavior.

A run may learn:

- command registration is concentrated in one area;
- additional behavior is registered dynamically elsewhere;
- generated fixtures should be excluded;
- a structural/AST search catches patterns a text search misses;
- an earlier execution-flow assumption became stale after a change.

Loredu should retain current-state claims, reusable investigation patterns, exclusions, unresolved findings, and source/snapshot provenance. A later run receives bounded Working Lore rather than years of appended crawler notes.

This scenario exercises changing corpora, snapshot/version awareness, reusable patterns, repeated verification, and fast recurring investigations.

## Project and business-process investigation

Example activity: review project material or a business process to understand actors, systems, handoffs, approvals, exceptions, undocumented behavior, and differences between documented and observed operation.

A run may learn:

- the documented flow says A → B → C;
- actual operation includes an undocumented manual step;
- exception handling is described in a different source than the main procedure;
- one business unit follows a different branch;
- a previously observed workaround no longer applies.

Loredu must allow multiple perspectives to coexist where appropriate. For example:

```text
documented_process: Finance approval occurs after booking
observed_process:   Finance approval occurs before booking
```

These are evidence of a process gap, not necessarily two claims where one should be deleted.

This scenario exercises mixed-source corpora, human observations, perspective, process evolution, and operational patterns.

## Policy and legal-document investigation

Example activity: locate and summarize applicable policies, agreements, amendments, obligations, definitions, exceptions, and changes over time.

A run may learn:

- an amendment supersedes part of a base document;
- a definition lives outside the clause that uses it;
- an older policy remains relevant for an earlier effective date;
- current wording differs from what a prior review believed;
- source authority matters when documents disagree.

The core should be able to answer:

- What is the current preferred interpretation?
- What was believed on a prior date?
- What do we now believe was effective on a prior date?
- Which entries and source locations support the answer?

This scenario exercises provenance, authority, supersession, external validity time, and historical projection.

## Common shape

| Concept | Technical investigation | Project/process investigation | Policy/legal investigation |
|---|---|---|---|
| Corpus | repository/files | SOPs, project docs, interviews | policies, agreements, amendments |
| Snapshot | revision/content state | source/review versions | document/version/effective set |
| Entry | crawler finding | process observation | clause/research finding |
| Claim | current implementation or pattern | process state/perspective | obligation, definition, applicability |
| Provenance | file/line/revision | document/interview/source | document/section/version |
| Temporal change | implementation changed | process changed | amendment/policy became effective |
| Working Lore | search hints + current structure | known process + gaps | current clauses + open issues |

All three reduce to the same application loop: use lore, test lore, append new entries/claims, reconcile/resolve, and prepare a smaller improved Working Lore for the next activity.
