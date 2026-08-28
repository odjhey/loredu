---
name: plain_file_store_contract
description: "Exact M1 PlainFileStore record codec, filesystem layout, replay, locking, durability, initialization, and store-root resolution contract."
type: contract
tags: [contracts, storage, plain-file, m1]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-28"
created_at: 2026-08-28T02:25:00+08:00
---

# Plain-file store contract

This is the provider-specific M1 contract for `@loredu/store-plainfile`. The provider-neutral query and commit guarantees remain in the [RecordStore contract](./store.md); record semantics remain in the [record contract](./records.md). [Decision 0022](../../decisions/0022-m1-store-and-plain-file-contract.md) records why these exact choices were made.

## Public adapter surface

`@loredu/store-plainfile` exports these M1 values and no deep-import contract:

```ts
const PLAIN_FILE_FORMAT = "loredu.plainfile/v1"
const STORES_DIRNAME = "stores"
const DEFAULT_STORE_NAME = "default"

class PlainFileStore implements RecordStore {
  constructor(root: string)
  append(record: PersistedRecord): Promise<StreamPosition>
  get(id: RecordId): Promise<PersistedRecord | undefined>
  scan(filter?: RecordFilter): Promise<RecordScan>
  stream(options?: RecordStreamOptions): AsyncIterable<PositionedRecord>
  head(): Promise<StreamPosition>
}

function initializePlainFileStore(root: string): Promise<void>
function encodePlainFileRecord(record: PersistedRecord): Uint8Array
function decodePlainFileRecord(bytes: Uint8Array): PersistedRecord
function recordFileName(position: StreamPosition, id: RecordId): string

type StoreRootSelection =
  | { readonly kind: "path"; readonly path: string }
  | { readonly kind: "name"; readonly name: string }
  | { readonly kind: "default" }
interface StoreRootContext {
  readonly loreduHome?: string
  readonly osHome: string
  readonly cwd: string
}
function resolveStoreRoot(
  selection: StoreRootSelection,
  context: StoreRootContext,
): string
function defaultLoreduHome(
  env: Readonly<Record<string, string | undefined>>,
  osHome: string,
): string
function storeRootForName(name: string, home: string): string
```

`StoreRootSelection` rejects empty path/name strings; its exact discriminants prevent simultaneous selectors and provider guessing. `resolveStoreRoot`, `storeRootForName`, `initializePlainFileStore`, and the `PlainFileStore` constructor use primitive strings exactly; no resolved-root wrapper is exported. The calling surface applies path > name > default precedence and the classification rule under [Store roots](#store-roots) before calling it. The existing adapter diagnostics `STORE_ADAPTER_NAME = "plainfile"` and `SUPPORTED_RECORD_SCHEMA = RECORD_SCHEMA_ID` remain exported constants, not alternate format authorities.

Construction performs no creation. Each operation validates the existing root/format before reading or writing. Initialization is explicit.

## Layout and canonical authority

```text
<root>/
  .loredu/
    format.json
    tmp/
    write.lock/                 # ephemeral append lease
  records/
    0000000000000001--ent_0123456789abcdef.md
    0000000000000002--clm_0123456789abcdef.md
```

The format marker bytes are exactly:

```json
{"format":"loredu.plainfile/v1"}
```

followed by one LF. Canonical knowledge is only the valid files in `records/`. `.loredu/tmp`, `.loredu/write.lock`, and future generated indexes are control/derived state; removing them cannot change replayed history. Initialization accepts an absent root or an already empty root, creates missing parent/root directories needed to establish it, and fsyncs the marker plus created directory entries before returning. It never deletes or adopts an existing nonempty directory (`STORE_ALREADY_EXISTS`). Parent writes are limited to establishing the explicitly selected root; after that, canonical/control access stays beneath it. Reads and append never initialize.

A canonical filename is 16 zero-padded decimal position digits, `--`, the exact decoded record id, then `.md`. `recordFileName` accepts only positive positions; position `0` has no file. Files must form the contiguous numeric sequence `1..head`; ids and positions are unique. Replay uses the numeric prefixes—not ids, modification times, enumeration order, or an index—and validates every file before returning any result. The id in the filename must equal the body record id.

Any gap, duplicate, unknown record-directory entry, symlink, filename/content mismatch, malformed codec input, unsupported schema, or invalid record makes the store `STORE_CORRUPT`. No read returns a partial prefix and append does not repair it. Unknown files outside `records/` do not become records, but adapter-owned control paths must have the exact expected kinds.

A hand addition is valid only at the next contiguous position with a matching canonical filename and an accepted record-file body. Adding at an old position, inserting a gap, or relying on mtime is corruption. Existing positions therefore never change on replay.

## Markdown/frontmatter codec

Files are UTF-8 without a BOM. Delimiters and header line endings are exact LF. Each header line is one schema field, `: `, and one strict JSON value:

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

This is valid YAML 1.2, but v1 intentionally accepts only this JSON-valued one-line subset. Comments, implicit scalars, block values, tags, anchors/aliases, duplicate keys, BOMs, CRLF header syntax, and multiline frontmatter reject. Header field order is accepted in any order for a hand-authored file; required/optional/excess rules and all values then pass through `decodePersistedRecord` unchanged.

Append emits one canonical representation:

1. common fields: `schema`, `kind`, `id`, `recorded_at`, `actor`, `scope`, `metadata`, `sources`;
2. family fields in the order shown by the [record contract](./records.md);
3. absent optional fields omitted;
4. fixed-shape nested fields in schema order and dynamic maps in Unicode-scalar canonical key order;
5. values serialized with `JSON.stringify` spellings over the accepted portable JSON domain.

For Entry, `body` never appears in frontmatter. All bytes after the closing delimiter's LF are exactly the Entry body's UTF-8 bytes; the codec adds, removes, and normalizes no body character or line ending. For Claim, Relation, Resolution, and Verification, the bytes after that LF are exactly empty. Structured-record prose and any frontmatter `body` reject. This makes the Markdown body the sole Entry-text authority and frontmatter the sole authority for every other field.

`encodePlainFileRecord` returns detached bytes. `decodePlainFileRecord` returns the same canonical detached, deeply frozen record as the public kernel decoder. Semantic round-trip is required; the kernel's storage-neutral JSON codec and these provider bytes remain distinct contracts.

## Read and replay behavior

`head`, `scan`, and `stream` replay the canonical file sequence and expose positions from filenames. `get` returns the unique matching id. Results obey all snapshot, ordering, filtering, out-of-range, immutability, and read-your-writes rules in [RecordStore](./store.md).

Readers do not take the writer lock. They enumerate a snapshot of canonical names first; atomic final rename means each selected record is either absent or complete. A concurrent append is either outside that read snapshot or appears as the next whole contiguous file. An invalid selected snapshot fails as corruption rather than returning a torn or partial result.

## Single-writer lock

Every append acquires `.loredu/write.lock/` by one atomic exclusive directory creation and never waits. If another writer owns it, append fails `STORE_LOCKED` before replay/allocation/mutation. Under the lock, append replays the current prefix, checks duplicate id, and chooses exactly `head + 1`; no instance-cached head allocates positions.

Lock metadata is diagnostic. A lock may be reclaimed only when its boot/session identity and PID-namespace identity exactly match the current process and a local process probe proves the recorded PID absent. If either identity cannot be established, recovery is unavailable; hostname equality and elapsed time never prove staleness. The reclaimer atomically quarantines the whole lock directory under `.loredu/tmp` before retry. Alive, unverifiable, reused-pid, malformed, and quarantine-race cases remain `STORE_LOCKED`. A per-process incarnation protects owner-only release; a process crash can leave only non-canonical control state.

External hand editing is a writer operation and must not overlap adapter append. The adapter guarantees contention safety among writers honoring this protocol; it does not pretend to make arbitrary filesystem mutation safe.

## Atomic durable append

After the lock is acquired and replay/duplicate checks pass:

1. exclusively create a uniquely named temp file in `.loredu/tmp` on the root filesystem;
2. write the complete encoded bytes, fsync that file, and close it;
3. atomically rename it to the previously absent final record filename;
4. fsync both `records/` and `.loredu/tmp/` directory entries;
5. release the lock and only then return the new position.

The adapter must fail rather than weaken success on a filesystem lacking same-filesystem atomic rename or file/directory fsync. Before rename, process death leaves the old prefix and ignorable temp state. Rename publishes one whole file. A returned position is durable-before-return and immediately visible to every read method.

Failure after rename but before return is an uncertain whole-record commit, never a torn record: no append result is returned, but the caller's attempted record id can be checked with `get`, and a retry may return `DUPLICATE_RECORD_ID`. Replay after every interruption is either the old prefix or the old prefix plus the complete next file. This is the narrow M1 durable-provider exception recorded by [ADR 0022](../../decisions/0022-m1-store-and-plain-file-contract.md) to M0's no-publication-on-failure rule.

## Store roots

Resolution precedence is exact:

1. `path` when explicitly supplied;
2. otherwise `name` when supplied;
3. otherwise the name `default`.

An explicit path is not put under Loredu home and triggers no upward search. An explicit relative path resolves against the supplied `cwd`; this is the only intentional cwd-relative behavior. An explicit path selection establishes a physical root: an existing root symlink resolves to its target, and a missing root resolves its nearest existing ancestor physically before appending the missing suffix. Named/default roots never use cwd. A store name is 1–128 Unicode scalars but ASCII lowercase only, begins and ends `[a-z0-9]`, contains only `[a-z0-9._-]`, and is neither `.` nor `..`. It resolves to `<home>/stores/<name>`.

Home is a nonempty `LOREDU_HOME`, otherwise `<osHome>/.loredu`; empty `LOREDU_HOME` counts as absent. A CLI with one `--store` token classifies it as a path when absolute, when it starts with `.` plus a platform separator, or when it contains a platform separator; all other tokens are names. Invalid names reject rather than becoming accidental paths.

Missing resolved roots fail `STORE_NOT_FOUND` with an actionable `lor init` hint. A bad marker/layout is `STORE_CORRUPT`. No read or ordinary command silently creates a directory and there is no cwd-parent discovery.

All canonical/control paths are joined beneath the selected root. Descendant symlinks and name traversal reject. While the name/default discriminant still exists, `resolveStoreRoot` (and the name-aware `storeRootForName`) rejects an existing `<home>/stores` or named root symlink and requires existing named paths to remain physically beneath the physical home. The helper then returns only the primitive root string; initialization and opening resolve that string to its physical root, including through an explicit root symlink, while preserving no-follow checks for descendants. Named stores have disjoint roots, locks, position sequences, and reads. A store directory may be relocated and reopened by selecting its new explicit path; the layout stores no absolute-root identity. No operation follows a record/control symlink or accesses another named root.

## Stable adapter errors

In addition to `DUPLICATE_RECORD_ID`, stable M1 top-level codes are:

- `STREAM_POSITION_OUT_OF_RANGE` — incremental stream starts beyond captured head;
- `STORE_NOT_FOUND` — selected root does not exist;
- `STORE_ALREADY_EXISTS` — explicit initialization cannot create a fresh store;
- `STORE_LOCKED` — exclusive append safety is unavailable;
- `STORE_CORRUPT` — format/layout/codec/replay invariant failed;
- `STORE_IO_FAILED` — host I/O or required durability primitive failed.

Human messages include the root/path and corrective hint where safe. Message wording and raw host causes are diagnostic, not compatibility surfaces.
