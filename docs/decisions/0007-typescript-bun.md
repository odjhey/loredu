---
name: decision_typescript_bun
description: "Implement the core and CLI in TypeScript on the Bun toolchain, shipping the CLI as a compiled single-file executable."
type: decision
tags: [decisions, language, toolchain, cli]
generated: "Claude Fable 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T00:00:00+08:00
---

# 0007: TypeScript on Bun

## Context

[0001](./0001-application-core-first.md) deliberately deferred the implementation language. With the contracts merged and M0 next, the decision is due. The kernel needs strong typing for the record/port contracts, a fast test loop for the behavioral suites, and a CLI that agents and humans can run without installing a runtime.

## Options considered

- Python — matches the existing single-file agent skills, zero build step, but weak typing for contract-heavy code and no simple single-binary story;
- Go — excellent single-binary CLI and testing, but high ceremony for the flexible record/metadata shapes;
- TypeScript on Node — strong typing, familiar, but slower toolchain and no built-in compile-to-binary;
- TypeScript on Bun — strong typing, built-in test runner, and `bun build --compile` produces a single-file executable.

## Choice

TypeScript (strict) on the Bun toolchain.

- `bun:test` runs the unit and behavioral suites;
- the CLI ships as a compiled single-file executable via `bun build --compile` (per-platform targets as needed);
- the application core stays dependency-light; schema validation may use zod (already the idiom in the xatu candidate consumer's codebase) but provider/framework dependencies remain banned from the core per [0001](./0001-application-core-first.md);
- consumers embed either the TypeScript application API or the CLI; Node-compatible package publishing is a later, separate decision.

## Consequences

- typed contracts (records, ports, basis, claim keys) are enforced at compile time as well as at validation time;
- agents interact through the compiled CLI with `--json` output, so no consumer needs Bun installed;
- compiled binaries are large (tens of MB) — acceptable for an internal tool;
- Bun-specific APIs stay in adapters (store, CLI); the domain/application layer uses portable TypeScript so a runtime change later stays an adapter concern.

## Rule or follow-up

The domain and application layers import no Bun-specific or provider-specific modules. CI runs the behavioral suite against both the application API and the compiled CLI binary.
