---
name: m15_application_cli_contract
description: "Closes the M1.5 application/CLI protocol, mechanical feedback, filters, pinned cursors, disclosure, host capabilities, skill behavior, and M2/M3 sequencing boundary."
type: decision
tags: [decisions, m1.5, application, cli, pagination, agents]
generated: "OpenAI coding agent, 2026-08-28"
created_at: 2026-08-28T06:00:00+08:00
---

# 0026: Close the M1.5 application and CLI contract before command fan-out

## Context

M1.5 was intended to fan out into application read mechanics and CLI composition, but its published material fixed only examples and broad principles. It did not fix TypeScript operations, command grammar, success/failure shapes, error-to-exit mapping, exact filter matching, cursor provenance, conflict-group closure, generic divergence suppression, record-handle placement, or embedded-skill bytes. Separate crews could satisfy T50–T75 with incompatible APIs.

The journey also required an M1.5 agent to complete journeys containing `lor lore` and `lor current`, although ADR 0008 and the implementation plan assign Current Knowledge to M2 and Working Lore to M3. M1.5 cannot truthfully exit on commands whose projection engines do not exist.

## Options considered

- Leave argv and response details provisional until CLI implementation. Rejected: parallel application and adapter work would encode different protocols, and behavioral tests would choose the contract accidentally.
- Pull `current` and `lore` plus partial projections into M1.5. Rejected: that collapses the explicit M2 reconciliation/projection and M3 ranking/budget milestones into command work and would make their Basis semantics false or incomplete.
- Remove every future-facing T-number from M1.5 documentation. Rejected: T54/T55/T73/T75 still need stable upgrade points, but their implementation owners can remain M2/M3.
- Close one additive application/CLI contract now, make the early orientation `status` plus filtered `claims`, and stage `current`/`lore` without changing the envelope later. Chosen.

## Choice

The exact [M1.5 application and CLI contract](../architecture/contracts/application-cli.md) governs command implementation.

### Surface-neutral application, thin CLI

M0 `append` remains exact. M1.5 additively exposes `add`, `show`, `history`, `claims`, `status`, and `readHead` on the assembled application. Successful operations return a frozen uniform response with `ok`, `result`, `reconciliation`, `advice`, and `basis`; list responses additionally carry exact page counts and an optional cursor. Application advice is a typed affordance. Only the CLI renders a shell-ready `lor ...` string.

The CLI owns argv, store selection/init, text/JSON rendering, failure envelopes, exit categories, version/help, and embedded skill output. The existing direct `--version` metadata line and its `-v` alias remain non-store commands; direct help accepts no global options, so `--help --json` is a usage failure rather than an ambiguous output mode. Stable exit classes distinguish validation/reference/cursor, not-found, provider/store, failed health check, and capability/internal failures. `status --check` reuses the successful status payload and changes only the process exit.

### Mechanical M1.5 semantics

Claim feedback compares only the exact declared key and portable-JSON value. Same key/same value corroborates. Same key/different value is a conflict candidate only under `exclusive`; `coexisting` remains non-conflicting. No derived Relation is appended and no claim is preferred. Corrective affordances may run show/history, but mechanics never fabricate a runnable Resolution by preselecting judgment, actor, replacement, or reason; the embedded skill teaches the follow-on grammar.

Health is exactly unresolved exclusive groups plus dangling record references. A Resolution closes a group only when its targets cover every Claim currently in the group; a later Claim reopens it. A reference is dangling when no target exists at a lower position, so a forward hand-authored reference remains unhealthy even if the target appears later. Relations do not substitute for judgment. Malformed canonical files remain provider corruption and make status fail rather than returning a knowingly partial health report. Status computes full counts/health but paginates one combined attention/advisory stream; group and divergence items carry bounded representatives plus filtered Claim-list affordances rather than unbounded nested arrays.

Generic same-scope/same-value/different-key divergence is core mechanics, never reconciliation and never ClaimPolicy advice. Explicit duplicate Relations connect key components and can suppress the advisory. M1.5 executes no policy advice callback because the M0 ClaimPolicy surface has none; a later additive callback must remain versioned and distinguish its output from core mechanics.

### Query snapshots, filters, and disclosure

Claim filters are exact AND-composed application predicates; scope defaults to subset matching and supports an explicit exact mode for mechanical drill-down, perspective can match present or absent, value is structural JSON equality, and `since` is inclusive after timestamp normalization. Store filters remain kind-only. List ordering is stream position, default/max limits are fixed, and every bounded collection carries returned/total counts.

Cursors are opaque `loredu.cursor.v1.` base64url tokens whose semantic payload binds operation, normalized query, complete Basis, pinned-head record-id anchor, and exclusive last position. Continuation validates that anchor against current immutable history and rereads only the pinned prefix. Invalid or foreign tokens fail loudly; no continuation silently restarts. The anchor provides store-snapshot mismatch detection without introducing canonical store identity, secrets, or ambient cursor randomness.

Every id presented as an existing Loredu record is paired with show/history affordances. An absent or forward-pointing id preserved in a hand-authored record reference or reported by dangling-reference health is an explicit terminal invalid-reference diagnostic: the referring record remains inspectable, but the invalid target receives no misleading affordance. SourceRefs likewise terminate Loredu disclosure. Working Lore section continuation obeys the same rule when M3 exists; it is not an M1.5 command.

### Composition and embedded guide

The CLI composition root supplies host wall time through `createInstant` and cryptographic bytes through a fresh `Uint8Array`. It has no weak fallback, exports neither adapter, and introduces no package. Kernel/application code remains host-pure.

The build embeds the one source `agent-skill.md`. Text `lor skill` strips only docs frontmatter and prints the remaining bytes exactly without opening a store; JSON returns the same guide string. The M1.5 guide uses only status, claims, record mutation/read, pagination, and health commands. It names `current` and `lore` only as later revision triggers.

### Milestone correction

M1.5 has no `lore`, `current`, `--as-of`, or `--valid-at`. Its empty-store/orientation path is bare `lor`/`lor status` plus `lor claims`. M2 adds `current` and temporal projection journeys; M3 adds `lore`, bounded packet sections, and their continuation. T50–T75 are contract-ready now, but each catalog row retains its implementation milestone and deferred status until real executable coverage exists.

This decision narrows ADR 0009's statement that the M1.5 exit starts from Working Lore: M1.5 link-following starts from its own status/query/add responses, while the packet-starting form arrives at M3. It also narrows ADR 0009's “every id” rule to present Loredu record ids; explicit absent-reference diagnostics and external SourceRefs are terminal. It clarifies, rather than changes, ADR 0008's explicit statement that `current` and Working Lore remain later. It supersedes ADR 0008's broad health wording: only unresolved exclusive groups and dangling valid record references are health, while malformed canonical files are provider corruption. It also fixes ADR 0008's broad “every command” envelope wording: store-backed semantic commands and JSON mode use the envelope; version metadata, text help, and text `skill` are intentionally direct output.

## Consequences

- M15-K and M15-B can work from one application/result/filter/cursor contract without importing CLI strings into the kernel.
- The early binary is useful without pretending that a record listing is Current Knowledge or Working Lore.
- `status` can be exact and bounded through the provider-neutral port: corruption remains a provider error, while absent/forward references remain health data and full counts survive pagination.
- Cursor chains survive independent CLI processes and concurrent appends without a new secret/store-id subsystem; rendered continuations and nested handles preserve explicit store selection.
- Command examples become more explicit: mutation actors and JSON-valued options cannot be guessed from environment or ambiguous scalar parsing.
- M2/M3 add commands and derived content without changing envelope, error, exit, affordance, pagination, or capability ownership.

## Rule / follow-up

M15-K owns application read/filter/feedback/health/cursor behavior. M15-B owns composition, init and record command parsing/rendering plus the embedded guide. M15-Q owns remaining query/chain integration. M2 owns `current` and temporal scenarios; M3 owns `lore`, packet-started disclosure, and budget continuations.

No T50–T75 row is implemented, removed from `catalog-status.json`, or claimed by this decision. A change to operation signatures, command spelling, matching, status closure, cursor payload semantics, envelope/error/exit fields, host-capability ownership, or skill-byte behavior requires a superseding decision.
