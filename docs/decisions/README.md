---
name: decisions_index
description: "Format and index for durable Loredu architecture and product decisions."
type: index
tags: [decisions]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-28"
created_at: 2026-08-26T12:10:00+08:00
---

# Decision records

Decision files use `NNNN-short-kebab-title.md` and contain Context, Options considered, Choice, Consequences, and Rule/follow-up. Supersede durable decisions rather than rewriting why an earlier choice was made.

Initial decisions:

- [0001: Application core first](./0001-application-core-first.md)
- [0002: Append-only record model](./0002-append-only-record-model.md)
- [0003: Plain files first](./0003-plain-files-first.md)
- [0004: Claim identity is a declared key](./0004-claim-identity-key.md)
- [0005: Embedded kernel, not a standalone product](./0005-embedded-kernel-compatibility.md)
- [0006: Versioning is explicit at every layer](./0006-explicit-version-basis.md)
- [0007: TypeScript on Bun](./0007-typescript-bun.md)
- [0008: CLI before full reconciliation; agent-reactive responses](./0008-cli-first-agent-reactive.md)
- [0009: Hypermedia responses and basis-pinned pagination](./0009-hypermedia-pagination.md)
- [0010: The ClaimPolicy extension seam](./0010-claim-policy-seam.md)
- [0011: Repository and package architecture](./0011-repo-package-architecture.md)
- [0012: Developer experience and CI gating](./0012-dx-and-ci-gating.md)
- [0013: Agent decision authority and the record obligation](./0013-agent-decision-authority.md)
- [0014: Minimal frontmatter — git owns time, status carries signal](./0014-minimal-frontmatter.md)
- [0015: Catalog accounting, the docs gate, and proving both fire](./0015-catalog-accounting-and-docs-gate.md)
- [0016: Workspace scaffold — TS sources as exports, and kernel purity as a compiler error](./0016-workspace-scaffold-and-kernel-type-isolation.md)
- [0017: Branch protection posture](./0017-branch-protection-posture.md)
- [0018: Capability ports for time and identity](./0018-capability-ports.md)
- [0019: M0 validation rules](./0019-m0-validation-rules.md)
- [0020: Close the M0 public contract before implementation](./0020-m0-public-contract-closure.md) — partially supersedes only identified ADR 0010 identity/advice wording, ADR 0016 helper timing, and ADR 0019 §3 string-whitespace wording; §5's TimeClip range is partially superseded by ADR 0021
- [0021: Keep every Instant within strict RFC3339](./0021-strict-rfc3339-instant-domain.md) — narrows Instant to the four-digit-year epoch-millisecond range and partially supersedes ADR 0020 §5
- [0022: Close the M1 store and plain-file contract](./0022-m1-store-and-plain-file-contract.md) — exact full RecordStore/conformance surface and plain-file codec, layout, replay, locking, durability, and root resolution; narrowly supersedes ADR 0020's no-publication wording for post-publication/pre-acknowledgement durable-provider failure
- [0023: Repository-local no-mistakes pipeline](./0023-repository-no-mistakes-pipeline.md) — deterministic static/corpus commands, targeted Test evidence, trusted path guidance, bounded repair, and protected CI as landing authority
- [0024: Validate M0 policy and Basis inputs at their public construction boundaries](./0024-m0-policy-and-basis-runtime-boundaries.md) — exact runtime rejection, callback-free ruleset snapshot, and canonical closed Basis behavior without pulling M0-A forward
- [0025: Keep every generic M0 append failure inside its owning phase](./0025-m0-application-append-phase-boundaries.md) — exact custom-policy callback/result handling, ordered reference-read failures, canonical all-family stamping, and detached InMemoryStore snapshots
