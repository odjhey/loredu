---
name: ubiquitous_language
description: "Canonical Loredu terms for records, activities, temporal queries, reconciliation, resolution, projections, and Working Lore."
type: glossary
tags: [architecture, language]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T12:10:00+08:00
---

# Ubiquitous language

| Term | Meaning |
|---|---|
| **Record** | Immutable persisted Loredu object. |
| **Entry** | Canonical free-form record of something observed, learned, decided, questioned, or worth retaining. |
| **Claim** | Structured proposition supported by one or more entries or explicit evidence. A claim is not assumed to be absolute truth. |
| **Relation** | Durable or rebuildable statement connecting records, such as `supports`, `contradicts`, `duplicates`, or `supersedes`. |
| **Resolution** | Explicit judgment that determines how competing or changing claims should be interpreted by a projection. |
| **Verification** | Record that a claim, pattern, source, or projection was checked against a stated basis or snapshot. |
| **Actor** | Human, agent, program, or system that created a record or resolution. |
| **SourceRef** | Stable reference to external evidence, optionally with a locator and snapshot/version identity. |
| **Corpus** | Body of material an activity investigates. A corpus may be a repository, document set, website, process evidence set, or another source collection. |
| **Snapshot** | Identifiable state of a corpus or source used as a verification basis. |
| **Activity** | External investigation/review/run that consumes and may produce Loredu knowledge. Loredu does not execute the activity. |
| **Extract** | Produce structured claim proposals from entries/evidence. May be human, deterministic, or agent-driven. |
| **Reconcile** | Deterministic comparison and bookkeeping across claims: identity matching, duplicates, support, candidate conflict, and mechanical temporal relationships. Reconciliation does not make open-ended judgments. |
| **Resolve** | Make an explicit judgment where deterministic reconciliation cannot determine the preferred interpretation. |
| **Projection** | Derived view computed from records. A projection is disposable and rebuildable. |
| **Current Knowledge** | Projection representing the preferred interpretation using all currently available records. |
| **Working Lore** | Bounded, ranked projection prepared for one activity, with handles for deeper disclosure. |
| **Pattern** | Reusable operational knowledge that helps a future activity investigate more effectively. It is represented as a class/purpose of claim, not a separate storage engine. |
| **recorded_at** | When Loredu durably learned something — assigned by the kernel at successful append, never caller-authoritative. |
| **valid_from / valid_until** | When the claim is believed to apply in the external world. Either may be unknown. |
| **as_of** | Query boundary limiting knowledge to records available at that time. |
| **valid_at** | Query asking what a projection believes applied at that external-world time. |
| **Stream position** | Monotonic position in the canonical record stream, returned by `append` and exposed as the store head. |
| **Basis** | Stamp on a derived view recording the stream position, ruleset version, and query it was computed from; enables deterministic staleness checks. |
| **Handle** | Stable, runnable reference embedded in a response — an identifier plus the command that expands it. The unit of progressive disclosure. |
| **Cursor** | Opaque continuation token for a paginated result, pinned to the basis position so a page chain stays consistent while records append. |
| **Envelope** | The uniform response shape every surface returns: `ok`, `result`, `reconciliation`, `advice`, `basis` — plus `page` on list-returning results. |
| **ok** | Envelope field stating whether the call succeeded. Failures carry a structured, actionable error and a distinct nonzero exit code. |
| **Advice** | Deterministic, runnable follow-up entries in a response — corrective (close an attention item) or navigational (continue a list, expand a handle). Never speculative. |
| **Page** | Bounded slice of a list result: returned count, total count, and a cursor when more exists. Truncation is never silent. |
| **Health** | Mechanically checkable store condition that blocks a health check: unresolved same-key groups, malformed records, dangling references. |
| **Advisory** | Non-blocking mechanical hint, e.g. the same value under different keys in one scope suggesting key divergence. |
| **Scope** | Caller-declared namespace a claim key belongs to (e.g. `repo=rozoro`); the consumer owns its vocabulary. |
| **Perspective** | Optional claim-key component distinguishing coexisting views of the same subject/predicate, e.g. `documented_process` vs `observed_process`. |
| **Confidence** | Claim field grading evidential strength: `candidate`, `observed`, `corroborated`, `confirmed`, `authoritative`. |
| **Ruleset** | Versioned bundle of deterministic reconciliation/resolution rules, including any active claim policy version; its version is part of every basis. |
| **ClaimPolicy** | Versioned consumer-supplied extension owning deterministic claim semantics: identity construction, value coexistence (`exclusive`/`coexisting`), optional mechanical advisories. Core ships a default. |
| **Affordance** | Surface-neutral follow-up emitted by the application layer (`rel`, `action`, `params`); surface adapters render it as a CLI command, link, or call. Advice is a list of affordances. |

## Naming rule

Interface field names — envelope fields, record fields, CLI output labels — use these terms verbatim. A surface that needs a name not in this table means the language gains the term first; fields never invent vocabulary of their own.

## Important distinctions

- An Entry preserves the free text; a Claim is a normalized interpretation of some evidence.
- Reconcile is mechanical; Resolve is judgment.
- A Projection is not canonical storage.
- Old knowledge may remain historically useful even when it is no longer current.
- Multiple perspectives may coexist without being a contradiction, for example documented process versus observed process.
