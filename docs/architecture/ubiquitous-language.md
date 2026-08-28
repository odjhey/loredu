---
name: ubiquitous_language
description: "Canonical Loredu terms for records, activities, temporal queries, reconciliation, resolution, projections, and Working Lore."
type: glossary
tags: [architecture, language]
generated: "ChatGPT GPT-5.6 Sol and OpenAI coding agent, 2026-08-28"
created_at: 2026-08-26T12:10:00+08:00
---

# Ubiquitous language

| Term | Meaning |
|---|---|
| **Record** | Immutable persisted Loredu object. |
| **Draft** | Closed caller-owned precursor requiring kind and actor. `schema`, `id`, and `recorded_at` do not exist on it; the application assigns them at append. |
| **Entry** | Canonical free-form record of something observed, learned, decided, questioned, or worth retaining. |
| **Claim** | Structured proposition supported by one or more entries or explicit evidence. A claim is not assumed to be absolute truth. |
| **Relation** | Binary directed statement with one ordered `from` and one `to` existing-record endpoint; `derived_from` is Claim→Claim. |
| **Resolution** | Explicit judgment that determines how competing or changing claims should be interpreted by a projection. |
| **Verification** | Record that one or more Claims were checked against a nonempty SourceRef basis in which every source has a snapshot. Sources/projections are not v1 persisted targets. |
| **Actor** | Human, agent, program, or system that created a record or resolution. |
| **SourceRef** | Stable reference to external evidence, optionally with a locator and snapshot/version identity. |
| **Corpus** | Body of material an activity investigates. A corpus may be a repository, document set, website, process evidence set, or another source collection. |
| **Snapshot** | Identifiable state of a corpus or source used as a verification basis. |
| **Activity** | External investigation/review/run that consumes and may produce Loredu knowledge. Loredu does not execute the activity. |
| **Extract** | Produce structured claim proposals from entries/evidence. May be human, deterministic, or agent-driven. |
| **Reconcile** | Deterministic same-key comparison and bookkeeping across Claims. Pair relations are exactly duplicate, corroboration, support, conflict, coexistence, or temporal succession. Reconciliation neither crosses a ClaimKey nor makes open-ended judgments. |
| **Resolve** | Make an explicit recorded judgment where deterministic reconciliation cannot determine the interpretation. A complete applicable Resolution outranks explicit `supersedes`, which outranks temporal mechanics. |
| **Derived relation** | Disposable pair classification produced by core, never a persisted Relation: `duplicate`, `corroboration`, `support`, `conflict`, `coexistence`, or `temporal-succession`. |
| **Projection** | Detached, recursively frozen derived view computed from records. A projection is disposable and rebuildable, never canonical storage. |
| **Current Knowledge** | Bitemporal projection at one resolved valid-time point. Each exact key is `preferred`, `coexisting`, `disputed`, or `retracted`; “preferred” means mechanics left one value, not that Loredu judged truth. |
| **Working Lore** | Bounded, ranked projection prepared for one activity. Its compact sections carry full counts, fixed-cardinality Scope/key previews, Basis-pinned continuations, and anchor/record handles for complete disclosure. Included items copy M2's first one or two exposed value representatives in exact M2 order; M3 does not reselect them, and the disclosure anchor may differ. |
| **Working Lore section** | One of the closed packet collections `current`, `patterns`, `candidates`, `conflicts`, or `needs_revalidation`; a knowledge group may intentionally occur in more than one section. |
| **Pattern** | Reusable operational knowledge that helps a future activity investigate more effectively. The deterministic baseline recognizes contributing Claims whose exact open `claim_class` is `pattern`; it is not a separate storage engine. |
| **Ranker** | Versioned Working Lore ordering port. Core owns section membership, counts, budgets, bounded candidate construction, and permutation integrity; a Ranker returns only a validated complete permutation of candidate occurrences. Continuation binds its SHA-256 digest and exact occurrence resume identity. |
| **Instant** | Opaque safe-integer epoch milliseconds in inclusive `-62_167_219_200_000..253_402_300_799_999`; supplied by Clock and always rendered by the kernel as strict four-digit-year RFC3339. |
| **Canonical timestamp** | UTC RFC3339 text with exactly four year digits and millisecond precision: `YYYY-MM-DDTHH:mm:ss.sssZ`; normalized caller timestamps remain inside the Instant range. |
| **recorded_at** | Canonical timestamp sampled after entropy and immediately before store append, never caller-authoritative. It becomes acknowledged history when append returns; after an M1 uncertain durable-provider failure, replay by attempted id determines whether whole-record publication committed it. Stream position is the commit fact. |
| **valid_from / valid_until** | When the claim is believed to apply in the external world. Either may be unknown. |
| **as_of** | Inclusive recorded-time query boundary: only records with `recorded_at <= as_of` are visible. Alone, it also supplies the Current Knowledge valid-time point. |
| **valid_at** | Inclusive external-world point: a Claim applies when it lies inside `[valid_from, valid_until]`, treating absent bounds as unbounded. Combined with `as_of`, it remains independent of the recorded-time cutoff. |
| **Capability port** | Collaborator the kernel needs but cannot reach for itself, injected when the application is assembled: `Clock` and `RandomSource`. Distinct from `RecordStore`, which is a persistence boundary rather than an environment capability. |
| **Clock** | Injected source of the instant stamped as `recorded_at`. A fixed clock in tests makes `as_of` behavior reproducible. |
| **RandomSource** | Injected source of entropy for record ids. Supplies bytes only — the kernel owns id format, so no adapter can substitute an id scheme. |
| **Stream position** | Opaque nonnegative safe integer at the public TS boundary. Successful M1 appends form the contiguous positive commit sequence `1..head`; `0` is the empty-head value. |
| **Head** | Latest committed stream position captured by a store read; `0` for an empty store. A scan returns its captured head even when its filter matches nothing. |
| **Positioned record** | Detached immutable pair of one committed stream position and its canonical record. Scan and stream order these by ascending position. |
| **Record filter** | Provider-neutral M1 scan selector, closed to exact record-kind membership. Claim/query semantics remain application-owned. |
| **Store root** | One explicitly selected physical directory containing an isolated canonical record stream plus provider control state; never discovered by walking cwd parents. |
| **Basis** | Exactly stream position, structural ruleset identity, and canonical JSON query. Current Knowledge always records its resolved canonical `valid_at`; Working Lore additionally identifies its Ranker. Shared equality treats ordinary versus Working Lore identity as unequal and compares Ranker id/version when both are Working Lore. `computed_at` is outside Basis and equality. |
| **computed_at** | Informational canonical timestamp sampled once for a projection. It is a sibling of Basis, is preserved across a cursor chain, and never participates in identity, staleness, or rebuild equality. |
| **Handle** | Existing Loredu record id paired with surface-neutral show/history affordances. Invalid-reference diagnostics and SourceRefs are terminal values, not record handles. |
| **Cursor** | Opaque `loredu.cursor.v1.` continuation token binding operation, normalized query, complete Basis, pinned-head record-id anchor, and an operation-specific exclusive resume key. Claims/history use position; status/current add item class/position/ordinal; Working Lore adds section, the validated global permutation's SHA-256 digest/count, and exact pre-rank occurrence identity plus section ordinal or `before-first`. It preserves one immutable prefix while records append and rejects foreign snapshots. |
| **Envelope** | Uniform semantic response shape: success has `ok`, `result`, `reconciliation`, `advice`, and `basis`; ordinary list success adds top-level `page`, while Working Lore carries per-section pages; CLI failure adds `error`. Direct version metadata, help, and text `skill` are non-envelope outputs; `skill --json` is the documented successful null-Basis exception. |
| **ok** | Envelope field stating whether execution produced a semantic result. Ordinary unhealthy status remains `ok: true`; `--check` changes only the process exit. |
| **Advice** | Deterministic follow-up affordance with `rel`, stable application `action`, typed `params`, and `why`; a surface may add a runnable rendering. Never speculative. |
| **Page** | Bounded collection or Working Lore section slice with this page's returned count, the pinned snapshot's total matching count, and a cursor exactly when more exists. |
| **Health** | Blocking condition: an unresolved exclusive conflict set (the union of endpoints of overlapping-validity, different-value pairs) or a reference with no matching lower-position record. Pure temporal succession is non-blocking; provider corruption prevents a health result rather than becoming partial health data. |
| **Advisory** | Non-blocking mechanical hint. Core key-divergence remains separate from a bounded policy advisory produced by M2 `ClaimPolicy.advise`; neither kind reconciles across keys, chooses a value, or closes health. |
| **Scope** | Caller-declared namespace a claim key belongs to (e.g. `repo=rozoro`); the consumer owns its vocabulary. Canonical history permits any finite pair count. Working Lore uses the complete Scope for semantics/Basis but discloses only full pair count plus the first at most two canonical pairs in repeated packet/ranking structures. |
| **Perspective** | Optional claim-key component distinguishing coexisting views of the same subject/predicate, e.g. `documented_process` vs `observed_process`. |
| **Confidence** | Claim field grading evidential strength: `candidate`, `observed`, `corroborated`, `confirmed`, `authoritative`. |
| **RulesetIdentity** | M0–M2 structural identity `{core, claim_policy: {id, version}}`; default is core `loredu.reconciliation/v1` plus policy `loredu.default` version `1`. Working Lore extends it only in `WorkingLoreBasis` with `ranker:{id,version}`. |
| **ClaimPolicy** | Versioned seam that validates (never transforms) the exact declared ClaimKey and selects `exclusive|coexisting`. M2 permits one deterministic `advise` callback, invoked once per admitted current page/continuation over exact applicable context with at most 200 outputs; advisories cannot alter identity, relations, state, preference, or health. |
| **LoreduError** | Structured public failure with stable top-level code, human message, and ordered ValidationIssues. |
| **ValidationIssue** | Stable issue code, RFC6901 JSON Pointer path, and human message identifying one validation/reference problem. |
| **Affordance** | Surface-neutral follow-up emitted by the application layer (`rel`, `action`, `params`, `why`); the CLI adds shell-ready `run`, while another adapter may render a link or call. Advice is an ordered list of affordances. |

## Naming rule

Interface field names — envelope fields, record fields, CLI output labels — use these terms verbatim. A surface that needs a name not in this table means the language gains the term first; fields never invent vocabulary of their own.

## Important distinctions

- An Entry preserves the free text; a Claim is a normalized interpretation of some evidence.
- Reconcile is mechanical; Resolve is judgment.
- A Projection is not canonical storage.
- Old knowledge may remain historically useful even when it is no longer current.
- Multiple perspectives may coexist without being a contradiction, for example documented process versus observed process.
- Duplicate, corroboration, and support are distinct: an equal semantic fingerprint with equal actor or nonempty equal evidence is duplicate; independent actor/evidence is corroboration; remaining same-actor reinforcement is support.
- `computed_at` says when projection work ran; resolved `valid_at` says which external-world point its content represents.
