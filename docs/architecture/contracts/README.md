---
name: contracts_index
description: "Index of Loredu's initial provider-neutral application and knowledge contracts."
type: index
tags: [architecture, contracts]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-28"
created_at: 2026-08-26T12:10:00+08:00
---

# Core contracts

The v0.x contracts are intentionally language-neutral and provider-neutral.

- [Records](./records.md) — exact closed envelopes, five families, portable JSON, time, references, codec, and errors
- [Store](./store.md) — staged M0 append/get port and exact M1 snapshot scan, stream, head, commit, and conformance extension
- [Plain-file store](./plain-file-store.md) — provider-specific M1 codec, layout, replay, locking, fsync, initialization, and root resolution
- [Clock and identity](./clock-and-identity.md) — exact Instant, id encoding, and append capability order
- [Kernel API](./kernel-api.md) — exact staged TypeScript entrypoints, exports, signatures, branded constructors, assembly, and M1.5 additions
- [Application and CLI](./application-cli.md) — exact M1.5 read/response/filter/cursor/health/affordance contract and `lor` grammar, errors, exits, composition, and skill behavior
- [Projection](./projection.md) — structural ruleset/Basis primitives and later temporal views
- [Working Lore](./working-lore.md) — bounded progressive-disclosure context

Provider SDK types, SQL schemas, model APIs, and crawler implementation details do not belong in provider-neutral contracts. A deliberately provider-specific contract such as PlainFileStore may define its public representation and host guarantees without moving them into the kernel/domain model.
