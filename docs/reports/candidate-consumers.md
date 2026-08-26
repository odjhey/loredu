---
name: candidate_consumers
description: "Four real internal tools that are candidates to embed Loredu, mapped to its concepts, what each one stresses, and which should be embedded first."
type: report
tags: [reports, consumers, v0.x]
status: draft
generated: "Claude Fable 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T00:00:00+08:00
updated_at: 2026-08-26T00:00:00+08:00
---

# Candidate consumers

Loredu is an embedded kernel ([decision 0005](../decisions/0005-embedded-kernel-compatibility.md)); its contracts stabilize against real consumers, not fixtures. Four existing internal tools are the candidates. Each already reinvents a slice of Loredu locally — that overlap is the evidence the kernel is needed, and the local inventions are design input, not competition.

## 1. no-mistakes extraction runbook (`no-mistakes-lessons`)

A version-pinned procedure that traces every agent invocation, prompt component, and schema in the no-mistakes pipeline from source, producing immutable per-version output directories, a self-updating Pattern Catalog, and provenance rules ("every claim links to source file, line, and symbol").

| Loredu concept | Runbook equivalent |
|---|---|
| Corpus / Snapshot | pinned source checkout at exact commit |
| Entry | extraction findings, discovery notes |
| Claim | "pattern P17 exists", prompt-component provenance rows |
| Claim key | `(pattern id)`, `(step, variant, component)` |
| valid_from / valid_until | "first confirmed v1.57.0", "deprecated", "removed" |
| Verification | "last confirmed" against a version |
| Supersession | `changes-from-previous.md` between version dirs |
| Slow learning | the self-updating runbook protocol itself |

**Stresses:** snapshot/version provenance, temporal validity of claims across corpus versions, verification freshness, pattern-class claims. Today version comparison is manual diffing of prose directories; with Loredu, "what changed since v1.56" becomes an `as_of`/supersession query.

## 2. ai-docs-assistant (`slowpoke-streams-mdt`)

A CRUD CLI over Markdown + frontmatter docs (`name`, `description`), with list/search/show, archive directories, and progressive disclosure (metadata first, `--full` for bodies).

**Maps to:** the disclosure layer only. It is exactly the "editable Markdown pages as canonical state" alternative that [decision 0002](../decisions/0002-append-only-record-model.md) rejected — updates overwrite, deletes destroy, there is no provenance or history. As a consumer it would keep its interface (list/search/show/archive) but read from Loredu projections instead of mutable files.

**Stresses:** embedding ergonomics and disclosure handles. If the Loredu-backed version is more work than `file.write_text`, criterion 12 of the [v0.x scope](../v0.x/scope/goal-and-scope.md) fails.

## 3. watchtower attention ledger (`rozoro`)

A driver-private notebook of attention items: strict frontmatter schema (`rozoro.watchtower-attention-ledger/v1`), one file per item, status transitions with an appended handling log, supersession keyed on `(task, reason)`, and `prime` — a bounded re-orientation digest with counts, urgent/normal splits, budgets, and cursors.

| Loredu concept | Ledger equivalent |
|---|---|
| Claim key | `(task, reason)` supersession match |
| Supersession | `superseded_by`, never deleting the old item |
| Resolution | status transitions with mandatory notes |
| Working Lore | `prime` digest (bounded, ranked, cursor for more) |
| Schema versioning | explicit `schema:` string, strict validation, `doctor` |
| Perspective discipline | "driver decisions, never system truth" disclaimer |

**Stresses:** claim keying ([decision 0004](../decisions/0004-claim-identity-key.md)), bounded re-orientation, strict validation, concurrent-writer safety. It is the closest existing thing to Loredu — but it mutates item files in place, so its handling history is only as durable as the last rewrite; Loredu gives it true append-only history and `as_of` reconstruction of what the driver believed mid-incident.

## 4. xatu-delivery-companion artifact intelligence

`ProjectFact` records (`statement`, `status: confirmed | assumption | unknown`, `source: EvidenceRef`, `recordedAt`) are assembled into an `EvidenceBundle`; planning validation enforces that confirmed facts survive into generated specs and every spec source traces to an authorized `EvidenceRef`. Provenance is strong and enforced at the gate.

**Gap Loredu fills:** facts are upserted JSONB — last-write-wins, no history, no supersession, no staleness detection; two facts with the same statement never merge; nothing notices a bundle is stale relative to updated facts. That is Loredu's exact ownership: `confirmed/assumption/unknown` maps to `confidence`, `EvidenceRef` maps to `SourceRef`, `fact_c_scope`-style IDs map to claim keys, and a bundle is a Working Lore snapshot with an identity Loredu could invalidate when underlying claims change.

**Stresses:** programmatic (non-agent) writers, projection identity/invalidation, authority ("current-project facts beat precedent" as Resolution policy), and the compatibility policy — a production Postgres consumer cannot tolerate breaking record changes.

## Recommended first consumer

**The watchtower attention ledger.** It already has the closest semantics (keys, supersession, strict schema, bounded prime), a single well-understood writer, low blast radius (driver-private, explicitly not system truth), and it immediately exercises claims, resolutions, supersession, and Working Lore — the four contracts that most need real-world pressure. The no-mistakes runbook is the strongest second: it adds the snapshot/valid-time dimension the ledger doesn't stress.

xatu is the most valuable long-term consumer but the worst first one: production stakes, Postgres adapter needs, and a compatibility bar that should be met with contracts already exercised elsewhere. ai-docs-assistant is a cheap ergonomics probe that can ride along at any point.
