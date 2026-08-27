---
name: agent_skill_draft
description: "Draft of the agent guide shipped inside the lor binary (printed by `lor skill`), v1 for the manual-reconciliation era."
type: plan
tags: [v0.x, execution, agents, skill]
status: draft
generated: "Claude Fable 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T00:00:00+08:00
---

# Agent skill (draft v1)

This is the source draft of the guide embedded in the `lor` binary and printed by `lor skill`. Version 1 targets the M1.5 manual-reconciliation era; it is revised when M2 (computed reconciliation) and M3 (`lor lore`) land. A repo-level `.agents/skills` wrapper should defer to `lor skill` rather than duplicating this text.

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

1. **Orient.** `lor status --json` — see health and advisories before starting.
   If it reports `STORE_NOT_FOUND`, run `lor init` for the default store and
   retry. List what is already known in your scope:
   `lor claims --scope <key=value>`.
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
   unresolved groups, dangling references), never guesses.
   Responses are also your map: navigate by the embedded commands and ids
   instead of constructing calls from memory. When a list says more exists,
   the continuation command (with its `--cursor`) is in the response — use
   it only if the bounded view was not enough.
5. **Judge conflicts yourself.** When lor reports a conflict candidate, run
   its exact-key `lor claims` advice and every continuation command. Inspect
   every Claim in the complete current group and verify against the source.
   A Resolution closes health only when it repeats `--target <claim-id>` for
   every listed Claim, including same-value corroborations. Then record your
   judgment:
   `lor resolve --actor agent:<agent-id> --target <claim-id>... --decision prefer --replacement <preferred-target> --reason "<what you checked>"`
   If you cannot verify, use `--decision leave_disputed` — a recorded open
   question beats a guessed answer. Never try to delete the losing claim. A
   Claim appended after your list reopens the group; follow `status` and record
   a later Resolution covering the enlarged group.
6. **Relate what you notice.** If two claims support or contradict each other
   and lor has not linked them, record it:
   `lor relate --actor agent:<agent-id> --from <a> --to <b> --type supports`
   (`contradicts`, `duplicates`, and `supersedes` are the other common types.)
7. **Finish healthy.** Before ending the activity: `lor status --check`.
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
- Reasons on resolutions state what you verified, not your reasoning chain.
- Use `--json` when you need to parse. Exit 0 is ordinary success; exit 5 is
  also successful execution but means `status --check` found unhealthy state.
  Every other nonzero exit is a failed execution. Output is pipe-friendly —
  compose with jq/grep/sort for filtering the built-in flags do not cover.

---

## Revision triggers

- **M2:** feedback lines change from candidates to computed relations; add
  `lor current` / `--as-of` to the orientation step.
- **M3:** orientation step becomes `lor lore --activity <kind> --scope <scope>`;
  drill-down guidance for handles.
