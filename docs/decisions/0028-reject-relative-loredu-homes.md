---
name: reject_relative_loredu_homes
description: "Requires absolute Loredu and OS home paths so named and default store identity never changes with cwd."
type: decision
tags: [decisions, m1, store, paths]
generated: "OpenAI coding agent gpt-5.6-sol, 2026-08-28"
created_at: 2026-08-28T11:58:04+08:00
---

# 0028: Reject relative Loredu homes

## Context

ADR 0022 made an explicit relative store path the only intentionally cwd-relative store selection and stated that named/default roots never use cwd. It also accepted any nonempty `LOREDU_HOME`. Those rules conflict when the configured home is relative: separate invocations from different working directories resolve the same named/default selection to different stores, and initialization can report a relative root.

## Options considered

- Keep relative homes as supplied. Rejected: named/default store identity would continue to drift with cwd.
- Resolve a relative `LOREDU_HOME` against cwd. Rejected: this only makes one invocation's root absolute and does not preserve identity across working directories.
- Resolve it against the OS home. Rejected: silently assigning a nonstandard base gives an apparently valid configuration a meaning the operator did not express.
- Require absolute configured and OS home paths, while retaining cwd-relative behavior only for an explicit path selection. Chosen.

## Choice

`defaultLoreduHome` rejects a nonempty relative `LOREDU_HOME` and a relative `osHome`. Named-root helpers likewise reject a relative home supplied directly. Empty `LOREDU_HOME` remains absent and resolves to `<osHome>/.loredu`. Explicit path resolution bypasses `LOREDU_HOME` entirely, so it remains usable when the configured home is relative.

`lor --version` and `lor -v` are store-free metadata operations, not default-store selections. They ignore `LOREDU_HOME` and render the absolute OS-default `<osHome>/.loredu` home.

This narrowly supersedes ADR 0022's statement that any nonempty `LOREDU_HOME` is accepted. Its explicit relative store-path behavior is unchanged.

## Consequences

- Named and default roots are absolute and cannot change identity merely because a later invocation uses another cwd.
- A relative home configuration fails before named/default initialization or store access instead of creating state in an accidental directory.
- Callers and tests selecting a named/default store through an overridden home must provide an absolute path.

## Rule / follow-up

Keep the absolute-home invariant for named/default selection at the shared plain-file root boundary. Do not canonicalize relative home configuration at a CLI-only call site.
