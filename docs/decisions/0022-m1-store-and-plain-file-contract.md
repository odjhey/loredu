---
name: m1_store_and_plain_file_contract
description: "Closes the M1 RecordStore query/conformance surface and the plain-file codec, layout, replay, locking, durability, and root-resolution rules."
type: decision
tags: [decisions, m1, storage, contracts, plain-file]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-28"
created_at: 2026-08-28T02:25:00+08:00
---

# 0022: Close the M1 store and plain-file contract before implementation

## Context

M1 promises replayable plain-file persistence, but the earlier documents deliberately left its implementation contract open. They named `scan`, `stream`, `head`, reusable conformance, Markdown/YAML, stable positions, lock-file plus atomic rename, fsync, and named stores without fixing signatures, snapshot boundaries, file bytes, position ownership, lock lifetime, commit order, or path classification. T10–T18 could therefore be implemented by mutually incompatible adapters that all appeared to satisfy the prose.

[ADR 0020](./0020-m0-public-contract-closure.md) closed only the M0 `append`/`get` slice and reserved M1 for this decision. [ADR 0003](./0003-plain-files-first.md), [ADR 0006](./0006-explicit-version-basis.md), and [ADR 0011](./0011-repo-package-architecture.md) remain governing choices.

## Options considered

- Derive positions by sorting record ids or file modification times. Rejected: ids are random, modification times are not canonical, and inserting or copying a file can renumber history.
- Keep a separate canonical manifest or database for order. Rejected: the record files would no longer reconstruct the complete stream by themselves.
- Put an immutable decimal position in each record filename and require a contiguous prefix. Chosen: order is inspectable, replay-stable, and reconstructable without derived state.
- Accept arbitrary YAML. Rejected for v1: implicit typing, tags, anchors, duplicate keys, and emitter differences make portable canonical bytes difficult and add behavior unrelated to the record model.
- Use JSON-valued, one-line YAML frontmatter and an exact Entry Markdown-body rule. Chosen: it is valid YAML, hand-inspectable, deterministic, and implementable without a second schema or YAML semantics.
- Hold a writer lock for a store object's lifetime. Rejected: CLI commands are short-lived, leaked instances become operational locks, and reads need no lease.
- Acquire one exclusive lock per append, replay under it, and allocate the next position only there. Chosen: every commit is serialized even across independently created store instances; lock contention fails rather than waits.
- Return only record arrays from every read. Rejected: a filtered empty scan would lose the atomic snapshot head needed for a Basis.
- Put M1.5 claim/query semantics into storage filters. Rejected: stores remain record-mechanical; application query semantics belong above the port.

## Choice

### Provider-neutral M1 port

M1 adds `RecordFilter`, `PositionedRecord`, `RecordScan`, and `RecordStreamOptions` and extends `RecordStore` exactly as specified by the [store contract](../architecture/contracts/store.md). `scan` returns an atomic snapshot containing both its captured head and ascending positioned records. The only M1 filter is `kinds`; absent means every kind, an empty list matches nothing, duplicates have no effect, and kind-list order has no effect. Claim keys, values, actors, scopes, and time predicates remain application filters.

`stream` is an unfiltered, snapshot-bounded `AsyncIterable`: `after` is exclusive, omitted means position `0`, and the upper bound is the head captured when iteration starts. Appends after that capture never appear in the same iteration. `head` is `0` for an empty store and otherwise the latest successful position. Successful positions are a contiguous positive sequence in M1 adapters; duplicate rejection and failures before atomic provider publication do not allocate a position. A host failure after durable-provider publication is the explicitly documented uncertain whole-record case below. Reads return detached, deeply frozen canonical records.

A requested `after` greater than the captured head fails iteration with `STREAM_POSITION_OUT_OF_RANGE`; silently treating the wrong store or lost history as an empty delta is forbidden. `get`, `scan`, `stream`, and `head` are read-your-writes after append returns. Stores do not validate domain references.

### Reusable conformance

`@loredu/kernel/testing` adds one runner-neutral `recordStoreConformance(subject)` value plus the type-only `StoreUnderTest`, `RecordStoreFixture`, and `RecordStoreConformanceCase` exports fixed in the [kernel API contract](../architecture/contracts/kernel-api.md). A subject creates a fresh empty fixture per case and disposes it in `finally`. Cases are returned as `{name, run}` so Bun, Node, or another host test runner can register them without making the kernel import a runner or host API.

The kit owns portable valid-record fixtures and verifies empty head/snapshots, append/get, positive contiguous positions, matching head, ordered scan and stream, exclusive `after`, snapshot isolation, kind filtering, duplicate-id non-advancement, read-your-writes, and detached frozen reads. It does not claim filesystem durability, root resolution, lock contention, host crash injection, or reference validation. M1 runs it unchanged against `InMemoryStore` and `PlainFileStore`; provider-specific T11/T12/T14/T16–T18 tests sit beside it.

### Plain-file authority and positions

A plain-file store root has one format marker, one canonical records directory, and adapter control state:

```text
<root>/
  .loredu/
    format.json
    tmp/
    write.lock/                 # exists only while an append owns the lock
  records/
    0000000000000001--ent_0123456789abcdef.md
    0000000000000002--clm_0123456789abcdef.md
```

`format.json` is UTF-8 `{"format":"loredu.plainfile/v1"}\n`. Canonical knowledge is exactly the valid files under `records/`; `.loredu/tmp`, locks, and any future index are control or derived state and may not affect replay. A generated index is optional and disposable.

A record filename is exactly 16 zero-padded decimal digits, `--`, the record id, and `.md`. Sixteen digits hold every safe-integer position. The decimal prefix is the public stream position and the id segment must equal the decoded record id. Replay sorts numerically and requires exactly the contiguous sequence `1..head`, unique ids, valid family prefixes, and no symlinks or unrecognized entries in `records/`. A gap, duplicate id/position, mismatched filename, malformed file, or unknown schema is `STORE_CORRUPT`; reads and appends fail without repair or partial results. File names, not modification times, directory enumeration order, ids, or an index, own ordering.

A hand-added record is picked up only when it uses the next contiguous filename position, a matching id, and an accepted record-file representation. That explicit rule preserves both the ability to hand-edit and all previously assigned positions. Reopening or deleting all derived/control leftovers cannot renumber canonical files.

### Record-file codec

Record files are UTF-8 without BOM. Frontmatter delimiters and header lines use LF exactly:

```text
---\n
schema: "loredu.record/v1"\n
kind: "entry"\n
id: "ent_0123456789abcdef"\n
recorded_at: "2026-08-26T04:00:00.000Z"\n
actor: {"type":"agent","id":"example.agent"}\n
scope: {}\n
metadata: {}\n
sources: []\n
---\n
Exact free text.
```

Each frontmatter line is `<field>: <JSON value>` on one physical line. This is a strict YAML 1.2 subset: no implicit scalars, comments, tags, anchors, aliases, block values, duplicate keys, or multiline frontmatter. The decoder accepts schema fields in any order for hand editing, but requires each exactly once when required and applies the public persisted-record decoder after parsing. Nested objects use the portable JSON domain. Unknown fields reject.

The encoder emits common fields in `schema`, `kind`, `id`, `recorded_at`, `actor`, `scope`, `metadata`, `sources` order, then family fields in their record-contract order. Optional fields are omitted when absent. Fixed-shape object keys follow schema order; dynamic maps use the kernel's Unicode-scalar canonical key order. JSON strings and numbers use canonical `JSON.stringify` spellings from accepted kernel values. These rules define one append-produced byte representation.

For Entry only, `body` is omitted from frontmatter and every byte after the closing delimiter's LF is the exact UTF-8 encoding of the Entry body; no newline is inserted, removed, or normalized. For Claim, Relation, Resolution, and Verification, `body` is not a field and the Markdown body is exactly empty. This avoids two authorities for Entry text and rejects accidental prose on structured records.

### Locking and the append commit

PlainFileStore is single-writer, multi-reader. Every append attempts one atomic exclusive creation of `.loredu/write.lock/`; it never waits. Contention fails `STORE_LOCKED` with no position allocation or file mutation. Under the lock, append replays the canonical prefix, rejects duplicate ids, chooses `head + 1`, and commits one file. Independently created store instances therefore cannot allocate from stale cached heads.

The lock carries owner diagnostics. If acquisition finds a lock, an implementation may reclaim it only after it can prove that its local owning process is dead, by atomically moving the lock directory into `.loredu/tmp` before retrying. An alive owner, an unverifiable owner, a reused process id, malformed lock metadata, or a failed quarantine is `STORE_LOCKED`; safety wins over availability. Successful and failed operations remove their own lock in `finally`; crash leftovers are non-canonical control state.

The append commit sequence is exact:

1. acquire the append lock;
2. replay and validate the current contiguous prefix, check id uniqueness, and choose the next position;
3. encode the complete record and exclusively create a same-filesystem temp file under `.loredu/tmp`;
4. write all bytes, fsync the temp file, and close it;
5. atomically rename it to its final previously absent `records/<position>--<id>.md` path;
6. fsync `records/` and `.loredu/tmp/` directory entries;
7. release the lock, then return the position.

An adapter may not report success when its filesystem cannot provide same-filesystem atomic rename and file/directory fsync. Before rename, interruption leaves only the old canonical prefix plus ignorable temp state. After rename, readers see either the whole file or no new file. A returned position is durable-before-return. If an I/O failure or process death occurs after rename but before return, the call has an uncertain outcome: replay/get by the already-known record id determines whether the whole record committed; retrying append may correctly receive `DUPLICATE_RECORD_ID`. No failure permits a torn canonical file or a non-prefix stream.

This decision **partially supersedes ADR 0020's M0-only statement that every failed append publishes no record**, and the matching unqualified wording in the record and clock/identity contracts, only for this M1 durable-provider uncertainty window. An application call still returns no `AppendRecordResult` on rejection, but a complete stamped record may be discoverable after a provider published it and then failed before acknowledgement. The id is already known to the RecordStore caller; the application still emits a fresh `STORE_APPEND_FAILED` rather than leaking provider details, but its M1 human message identifies that attempted id so an operator can replay/check it rather than generating a replacement. Ordinary validation, reference, capability, duplicate, lock, and pre-rename failures publish nothing.

### Store initialization and resolution

Initialization is the only operation that creates a store. It accepts an absent root or existing empty root, creates only the missing ancestors/root needed to establish that explicitly selected root, writes the marker/directories, and durably fsyncs their entries before success; it fails `STORE_ALREADY_EXISTS` rather than deleting or adopting a nonempty or malformed directory. Opening/resolving never initializes. A missing root is `STORE_NOT_FOUND` with an actionable `lor init` hint; a bad marker or layout is `STORE_CORRUPT`.

Resolution has three mutually exclusive selections in precedence order at the calling surface: an explicitly classified path, an explicit validated name, then default name `default`. A path is not placed under Loredu home and no parent walk or repository discovery occurs; an explicit relative path is resolved against the caller-supplied cwd in the ordinary way. A name is a lowercase 1–128 scalar token using only letters, digits, `.`, `_`, and `-`, must begin and end alphanumeric, and may not be `.` or `..`; it resolves to `<home>/stores/<name>`. Home is nonempty `LOREDU_HOME` when supplied, otherwise `<os-home>/.loredu`; an empty environment value is treated as absent.

The future CLI may classify a single `--store` argument as a path when it is absolute, starts with `.` plus a platform separator, or contains a platform separator; every other argument is a name. The provider resolution API keeps path and name discriminated so it never guesses. An explicit relative path is the sole intentional cwd-relative case; defaults and names are never cwd-discovered.

Every canonical/control path is joined beneath the selected root, descendant symlinks are rejected, and named-store resolution rejects traversal. Two named stores have disjoint roots, locks, positions, and reads. No operation follows a record/control symlink or reads/writes outside the selected physical root.

Stable M1 store/adapter top-level error codes are `STREAM_POSITION_OUT_OF_RANGE`, `STORE_NOT_FOUND`, `STORE_ALREADY_EXISTS`, `STORE_LOCKED`, `STORE_CORRUPT`, and `STORE_IO_FAILED`, in addition to M0 `DUPLICATE_RECORD_ID`. Human messages and raw host causes are diagnostic, not compatibility surfaces.

## Consequences

- T10 has one cross-adapter meaning and one reusable, runner-neutral kit; T13's duplicate behavior includes unchanged scan/head state.
- T11/T12 replay positions from canonical filenames without a hidden order database. T14 hand addition is precise rather than dependent on mtime or directory order.
- T16 uses immediate append-scoped lock failure; stale-lock recovery cannot create a second writer merely because time elapsed.
- T18's commit point is after file and relevant directory fsync. A failed call may have committed only as a whole prefix record, which callers can resolve by id.
- M1.5 application filters can consume an atomic `RecordScan.head` while keeping claim/query semantics out of adapters.
- The plain-file bytes and layout are provider-specific. The kernel remains unaware of paths, Markdown, lock ownership, and host durability APIs.
- The M1 conformance kit is test support under `@loredu/kernel/testing`; it does not enter the normal runtime export and does not make Bun/Node ambient types visible to the kernel.

## Rule / follow-up

M1-K implements the port, M1-complete InMemoryStore, exact exports, and generic conformance only. M1-F implements the codec, layout, replay, and record operations. M1-D implements lock contention, crash/fsync evidence, initialization/resolution, and cross-adapter conformance. Provider-specific tests must use public adapter behavior rather than treating source text as evidence.

No T10–T18 catalog row is implemented or removed from deferred status by this decision. Changing a signature, filter meaning, canonical byte/layout rule, position source, lock-reclamation safety rule, commit sequence, or root-resolution precedence requires a superseding decision.
