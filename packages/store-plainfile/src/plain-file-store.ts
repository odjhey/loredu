import type { Dirent, Stats } from "node:fs";
import { lstat, open, readdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  createStreamPosition,
  LoreduError,
  type PersistedRecord,
  type PositionedRecord,
  type RecordFilter,
  type RecordId,
  type RecordScan,
  type RecordStore,
  type RecordStreamOptions,
  type StreamPosition,
} from "@loredu/kernel";
import { decodePlainFileRecord, encodePlainFileRecord } from "./record-codec";

export const PLAIN_FILE_FORMAT = "loredu.plainfile/v1";
const FORMAT_BYTES = `{"format":"${PLAIN_FILE_FORMAT}"}\n`;
const FILE_NAME = /^(\d{16})--((?:ent|clm|rel|res|ver)_[0-9abcdefghjkmnpqrstvwxyz]{16})\.md$/;

interface ReplayedRecord extends PositionedRecord {
  readonly fileName: string;
}

function storeError(
  code: "STORE_CORRUPT" | "STORE_IO_FAILED" | "STORE_NOT_FOUND",
  message: string,
): LoreduError {
  return new LoreduError(code, message);
}

function isHostError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

function positioned(position: StreamPosition, record: PersistedRecord): PositionedRecord {
  return Object.freeze({ position, record });
}

/** The canonical filename whose decimal prefix owns a record's stream position. */
export function recordFileName(position: StreamPosition, id: RecordId): string {
  const numeric = Number(position);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new RangeError("plain-file record position must be a positive safe integer");
  }
  const name = `${String(numeric).padStart(16, "0")}--${id}.md`;
  if (!FILE_NAME.test(name)) throw new RangeError("record id is not valid for a canonical filename");
  return name;
}

/**
 * M1-F plain-file adapter. It owns canonical replay and record operations; the
 * M1-D slice adds initialization/root resolution and the durable locked commit.
 */
export class PlainFileStore implements RecordStore {
  readonly #root: string;
  readonly #recordsDirectory: string;
  readonly #controlDirectory: string;
  readonly #temporaryDirectory: string;

  constructor(root: string) {
    if (typeof root !== "string" || root.length === 0) throw new TypeError("store root must be nonempty");
    this.#root = root;
    this.#recordsDirectory = join(root, "records");
    this.#controlDirectory = join(root, ".loredu");
    this.#temporaryDirectory = join(this.#controlDirectory, "tmp");
  }

  async append(record: PersistedRecord): Promise<StreamPosition> {
    const bytes = encodePlainFileRecord(record);
    const canonical = decodePlainFileRecord(bytes);
    const replay = await this.#replay();
    if (replay.some(({ record: existing }) => existing.id === canonical.id)) {
      throw new LoreduError("DUPLICATE_RECORD_ID", `record id already exists: ${canonical.id}`);
    }
    const position = createStreamPosition(replay.length + 1);
    const path = join(this.#recordsDirectory, recordFileName(position, canonical.id));
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    let created = false;
    try {
      handle = await open(path, "wx");
      created = true;
      await handle.writeFile(bytes);
      await handle.close();
      handle = undefined;
      return position;
    } catch (error) {
      if (handle !== undefined) await handle.close().catch(() => undefined);
      if (created) await unlink(path).catch(() => undefined);
      if (error instanceof LoreduError) throw error;
      throw storeError("STORE_IO_FAILED", `plain-file append failed under ${this.#root}`);
    }
  }

  async get(id: RecordId): Promise<PersistedRecord | undefined> {
    const replay = await this.#replay();
    return replay.find(({ record }) => record.id === id)?.record;
  }

  async scan(filter?: RecordFilter): Promise<RecordScan> {
    const replay = await this.#replay();
    const head = createStreamPosition(replay.length);
    const kinds = filter?.kinds === undefined ? undefined : new Set(filter.kinds);
    const records = replay
      .filter(({ record }) => kinds === undefined || kinds.has(record.kind))
      .map(({ position, record }) => positioned(position, record));
    return Object.freeze({ head, records: Object.freeze(records) });
  }

  async *stream(options?: RecordStreamOptions): AsyncIterable<PositionedRecord> {
    const replay = await this.#replay();
    const head = createStreamPosition(replay.length);
    const after = options?.after ?? createStreamPosition(0);
    if (after > head) {
      throw new LoreduError(
        "STREAM_POSITION_OUT_OF_RANGE",
        `stream position ${after} is greater than captured head ${head}`,
      );
    }
    for (const { position, record } of replay) {
      if (position > after) yield positioned(position, record);
    }
  }

  async head(): Promise<StreamPosition> {
    return createStreamPosition((await this.#replay()).length);
  }

  async #validateLayout(): Promise<void> {
    let root: Stats;
    try {
      root = await lstat(this.#root);
    } catch (error) {
      if (isHostError(error, "ENOENT")) {
        throw storeError(
          "STORE_NOT_FOUND",
          `plain-file store not found at ${this.#root}; initialize it with lor init`,
        );
      }
      throw storeError("STORE_IO_FAILED", `could not inspect plain-file store ${this.#root}`);
    }
    if (!root.isDirectory())
      throw storeError("STORE_CORRUPT", `store root is not a directory: ${this.#root}`);

    try {
      const [control, temporary, records, marker] = await Promise.all([
        lstat(this.#controlDirectory),
        lstat(this.#temporaryDirectory),
        lstat(this.#recordsDirectory),
        lstat(join(this.#controlDirectory, "format.json")),
      ]);
      if (
        !control.isDirectory() ||
        control.isSymbolicLink() ||
        !temporary.isDirectory() ||
        temporary.isSymbolicLink() ||
        !records.isDirectory() ||
        records.isSymbolicLink() ||
        !marker.isFile() ||
        marker.isSymbolicLink()
      ) {
        throw storeError("STORE_CORRUPT", `plain-file store layout is invalid at ${this.#root}`);
      }
      const markerBytes = await readFile(join(this.#controlDirectory, "format.json"), "utf8");
      if (markerBytes !== FORMAT_BYTES) {
        throw storeError("STORE_CORRUPT", `plain-file format marker is invalid at ${this.#root}`);
      }
    } catch (error) {
      if (error instanceof LoreduError) throw error;
      if (isHostError(error, "ENOENT"))
        throw storeError("STORE_CORRUPT", `plain-file store layout is incomplete at ${this.#root}`);
      throw storeError("STORE_IO_FAILED", `could not read plain-file store layout at ${this.#root}`);
    }
  }

  async #replay(): Promise<readonly ReplayedRecord[]> {
    await this.#validateLayout();
    let entries: Dirent[];
    try {
      entries = await readdir(this.#recordsDirectory, { withFileTypes: true });
    } catch {
      throw storeError("STORE_IO_FAILED", `could not enumerate records under ${this.#root}`);
    }

    const named: { readonly fileName: string; readonly position: number; readonly id: string }[] = [];
    for (const entry of entries) {
      const match = FILE_NAME.exec(entry.name);
      const numeric = match === null ? Number.NaN : Number(match[1]);
      if (
        !entry.isFile() ||
        entry.isSymbolicLink() ||
        match === null ||
        !Number.isSafeInteger(numeric) ||
        numeric <= 0
      ) {
        throw storeError("STORE_CORRUPT", `unrecognized canonical record entry: ${entry.name}`);
      }
      named.push({ fileName: entry.name, position: numeric, id: match[2] as string });
    }
    named.sort(
      (left, right) => left.position - right.position || left.fileName.localeCompare(right.fileName),
    );

    const ids = new Set<string>();
    const replayed: ReplayedRecord[] = [];
    for (let index = 0; index < named.length; index++) {
      const item = named[index] as (typeof named)[number];
      const expected = index + 1;
      if (item.position !== expected) {
        throw storeError("STORE_CORRUPT", `record positions are not the contiguous prefix 1..head`);
      }
      if (ids.has(item.id))
        throw storeError("STORE_CORRUPT", `duplicate record id in canonical files: ${item.id}`);
      let bytes: Uint8Array;
      try {
        bytes = await readFile(join(this.#recordsDirectory, item.fileName));
      } catch {
        throw storeError("STORE_IO_FAILED", `could not read canonical record ${item.fileName}`);
      }
      let record: PersistedRecord;
      try {
        record = decodePlainFileRecord(bytes);
      } catch (error) {
        if (error instanceof LoreduError && error.code === "STORE_CORRUPT") {
          throw storeError("STORE_CORRUPT", `canonical record is malformed: ${item.fileName}`);
        }
        throw error;
      }
      if (record.id !== item.id) {
        throw storeError("STORE_CORRUPT", `record filename id does not match its content: ${item.fileName}`);
      }
      ids.add(record.id);
      replayed.push(
        Object.freeze({ fileName: item.fileName, position: createStreamPosition(expected), record }),
      );
    }
    return Object.freeze(replayed);
  }
}
