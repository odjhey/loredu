---
name: agent_skill
description: "Agent guide shipped inside the lor binary (printed by `lor skill`), with bounded M3 Working Lore and exact disclosure guidance."
type: plan
tags: [v0.x, execution, agents, skill]
status: current
generated: "Claude Fable 5 (Claude Code) and OpenAI coding agent gpt-5.6-sol, 2026-08-28"
created_at: 2026-08-26T00:00:00+08:00
---

# Agent skill (M3 v3)

This is the source guide embedded in the `lor` binary and printed by `lor skill`.
Version 3 adds bounded Working Lore while retaining M2 Current Knowledge and
explicit human/agent judgment. A repo-level `.agents/skills` wrapper should defer
to `lor skill` rather than duplicating this text. Every command and rendered
continuation or disclosure action named below is executable.

---

## SKILL: recording operational knowledge with lor

lor is an append-only knowledge store. You record what you learn as you work;
lor keeps provenance and history and tells you when knowledge needs your
judgment. Nothing is ever edited or deleted — new understanding is appended.

### When to use

Use lor whenever you are investigating something that will be investigated
again: a codebase, a process, a policy set. Future runs (yours or another
agent's) start from what you record now.

### The loop

1. **Orient with Working Lore.**
   `lor lore --activity <activity> --scope <key=value> --json` returns bounded
   current knowledge plus separate patterns, candidates, conflicts, and
   revalidation attention for this activity. It always reports full section
   totals, page-local budget use, `computed_at`, and a Basis. If it reports
   `STORE_NOT_FOUND`, run `lor init` for the default store and retry. Then run
   `lor status --json` to see blocking health and non-blocking advisories.
   Use `lor current --scope <key=value> --json` instead when you need the full
   mechanical projection, temporal queries, or combined-stream pagination rather
   than an activity packet. Use `lor claims --scope <key=value>` for canonical
   Claim records rather than either projection.
2. **Record entries as you go.** Every finding worth keeping:
   `echo "<free text>" | lor add entry --actor agent:<agent-id> --type finding --title "..." --source-json '{"ref":"<source>","snapshot":"<version>"}' --body -`
   Entries are cheap. When in doubt, record.
3. **Claim when stable.** When a finding is solid enough to key, add a claim:
   `lor add claim --actor agent:<agent-id> --scope <key=value> --subject-type <type> --subject <id> --predicate <pred> --value <string> --derived-from <entry-id> --confidence observed`
   Keys are identifiers, not prose: lowercase, hyphenated, no sentences.
   **Search before you invent a key.** Check whether the fact is already
   claimed under an existing key: `lor claims --scope <key=value> --value <string>`,
   or narrow by `--subject-type` / `--predicate`. Reuse what you find —
   reconciliation only works when keys converge.
4. **Follow the response.** Run each `advice:` command that appears.
   Corrective advice points only at real, mechanical issues (same-key overlap,
   unresolved groups, dangling references), never guesses. Responses are also
   your map: navigate by embedded commands instead of constructing hidden calls
   from memory. Working Lore gives each truncated section its own
   `lor lore --cursor ...` command, even when that section returned zero items.
   Follow only the sections needed for the activity. Start with default budgets;
   use `--max-items` and `--max-chars` to make the packet smaller or to change a
   continuation page. Full totals remain pinned while page-local use changes.
5. **Judge conflicts yourself.** When lor reports a conflict candidate, run
   its exact-key `lor claims` advice and every continuation command. Inspect
   every Claim in the complete current group and verify against the source.
   A Resolution closes health only when it repeats `--target <claim-id>` for
   every listed Claim, including same-value corroborations. Record the evidence
   you actually checked with one or more repeatable targets:
   `lor add verification --actor agent:<agent-id> --target <claim-id>... --verified-against-json '{"ref":"<source>","snapshot":"<version>"}' --result confirmed`
   A Verification records the snapshotted evidence and result; it does not by
   itself settle the conflict or make health pass. Then record your judgment:
   `lor resolve --actor agent:<agent-id> --target <claim-id>... --decision prefer --replacement <preferred-target> --reason "<what you checked>"`
   If you cannot verify, use `--decision leave_disputed` — a recorded open
   question beats a guessed answer. Never try to delete the losing claim. A
   Claim appended after your list reopens the group; follow `status` and record
   a later Resolution covering the enlarged group.
6. **Disclose and time-travel when needed.** A Working Lore item carries an
   exact-key `lor claims --same-key-as <anchor-claim>` action and one or two
   representative handles. Follow the anchored Claim list and every continuation
   to inspect every value, including omitted or superseded history. `show` on the
   anchor exposes the complete key and Scope; representative `show` and `history`
   reach evidence and referenced Entries. SourceRefs are terminal external
   provenance, not Loredu record ids. For time travel,
   `lor current --as-of <rfc3339>` asks what was recorded by that inclusive
   instant and uses it as the default valid-time point. `--valid-at <rfc3339>`
   selects the external-world point; combine both flags to keep the dimensions
   independent.
7. **Relate what you notice.** If two claims support or contradict each other
   and lor has not linked them, record it:
   `lor relate --actor agent:<agent-id> --from <a> --to <b> --type supports`
   (`contradicts`, `duplicates`, and `supersedes` are the other common types.)
8. **Finish healthy.** Before ending the activity: `lor status --check`.
   Exit 5 means blocking health remains; work the corrective `advice:` list
   until it passes. Provider/validation failures use other exits. Do not leave
   attention items you created unhandled — resolve them or mark them disputed
   with a reason.

### Rules

- Naming and namespacing conventions come from the project you are working
  in (its repo skill or docs), not from lor — lor only enforces identifier
  shape. Follow the project's vocabulary; when none exists, mirror the
  patterns already in `lor claims --scope <key=value>`.
- Heed `status` advisories: "same value under different keys" usually means
  two writers named one fact differently — connect the claims with an explicit
  `duplicates` Relation when verified, or align on one key going forward.
- Different perspectives are not conflicts: record documented vs observed
  process as `--perspective documented` / `--perspective observed`. Both stay.
- Provenance always: `--source-json` with a snapshot on entries and
  `--derived-from` on claims. A claim you cannot trace is a claim nobody can
  trust later.
- Treat Working Lore as orientation, not truth. Its Ranker orders mechanically;
  it does not judge. Record a Relation, Resolution, or Verification for every
  judgment instead of guessing or treating packet rank as a decision.
- Check Basis before reusing a packet: store head, query, core, ClaimPolicy, and
  Ranker identity must still match. Any append makes v0.x Working Lore stale.
  Continue an emitted cursor for its pinned old packet; make a fresh cursorless
  call when you need the new head.
- Reasons on resolutions state what you verified, not your reasoning chain.
- Use `--json` when you need to parse. Exit 0 is ordinary success; exit 5 is
  also successful execution but means `status --check` found unhealthy state.
  Every other nonzero exit is a failed execution. Output is pipe-friendly —
  compose with jq/grep/sort for filtering the built-in flags do not cover.

---

## Revision triggers

- **M4:** revise ranking guidance only after a real consumer supplies and evaluates
  a versioned custom Ranker; deterministic baseline rank is not a quality claim.
