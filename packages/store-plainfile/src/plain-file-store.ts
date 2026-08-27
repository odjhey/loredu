import { randomUUID } from "node:crypto";
import { constants, type Dirent, type Stats } from "node:fs";
import { lstat, mkdir, open, readdir, rename, rm, unlink } from "node:fs/promises";
import { hostname } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
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
const FORMAT_BYTES = new TextEncoder().encode(`{"format":"${PLAIN_FILE_FORMAT}"}\n`);
const FILE_NAME = /^(\d{16})--((?:ent|clm|rel|res|ver)_[0-9abcdefghjkmnpqrstvwxyz]{16})\.md$/;
const LOCK_FORMAT = "loredu.write-lock/v1";
const LOCK_OWNER_FILE = "owner.json";

interface ReplayedRecord extends PositionedRecord {
  readonly fileName: string;
}

interface LockOwner {
  readonly format: typeof LOCK_FORMAT;
  readonly hostname: string;
  readonly pid: number;
}

type StoreErrorCode =
  | "STORE_ALREADY_EXISTS"
  | "STORE_CORRUPT"
  | "STORE_IO_FAILED"
  | "STORE_LOCKED"
  | "STORE_NOT_FOUND";

function storeError(code: StoreErrorCode, message: string): LoreduError {
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

async function readRegularFileNoFollow(path: string): Promise<Uint8Array> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw storeError("STORE_CORRUPT", `expected a regular file: ${path}`);
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function fsyncDirectory(path: string): Promise<void> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
  try {
    const stat = await handle.stat();
    if (!stat.isDirectory()) throw new Error(`not a directory: ${path}`);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function inspect(path: string): Promise<Stats | undefined> {
  try {
    return await lstat(path);
  } catch (error) {
    if (isHostError(error, "ENOENT")) return undefined;
    throw error;
  }
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
 * Establish a fresh plain-file store and durably publish its format/layout.
 * Opening a store never calls this function implicitly.
 */
export async function initializePlainFileStore(rootInput: string): Promise<void> {
  if (typeof rootInput !== "string" || rootInput.length === 0) {
    throw new TypeError("store root must be nonempty");
  }
  const root = resolve(rootInput);
  const control = join(root, ".loredu");
  const temporary = join(control, "tmp");
  const records = join(root, "records");
  const marker = join(control, "format.json");
  const syncPaths = new Set<string>();

  try {
    const existing = await inspect(root);
    if (existing !== undefined) {
      if (!existing.isDirectory() || existing.isSymbolicLink() || (await readdir(root)).length !== 0) {
        throw storeError(
          "STORE_ALREADY_EXISTS",
          `cannot initialize over an existing nonempty or non-directory path: ${root}`,
        );
      }
    } else {
      const firstCreated = await mkdir(root, { recursive: true });
      if ((await readdir(root)).length !== 0) {
        throw storeError("STORE_ALREADY_EXISTS", `store root became nonempty during initialization: ${root}`);
      }
      if (firstCreated !== undefined) {
        let path = resolve(firstCreated);
        const first = path;
        while (true) {
          syncPaths.add(path);
          if (path === root) break;
          const remainder = relative(path, root);
          const nextSegment = remainder.split(sep)[0];
          if (nextSegment === undefined || nextSegment.length === 0) throw new Error("invalid created path");
          path = join(path, nextSegment);
        }
        syncPaths.add(dirname(first));
      }
    }

    await mkdir(control);
    await mkdir(temporary);
    await mkdir(records);

    const markerHandle = await open(marker, "wx");
    try {
      await markerHandle.writeFile(FORMAT_BYTES);
      await markerHandle.sync();
    } finally {
      await markerHandle.close();
    }

    for (const path of [temporary, records, control, root]) syncPaths.add(path);
    for (const path of syncPaths) await fsyncDirectory(path);
  } catch (error) {
    if (error instanceof LoreduError) throw error;
    if (isHostError(error, "EEXIST")) {
      throw storeError("STORE_ALREADY_EXISTS", `plain-file store already exists at ${root}`);
    }
    throw storeError("STORE_IO_FAILED", `could not initialize plain-file store at ${root}`);
  }
}

/** Durable, append-serialized Markdown/frontmatter RecordStore adapter. */
export class PlainFileStore implements RecordStore {
  readonly #root: string;
  readonly #recordsDirectory: string;
  readonly #controlDirectory: string;
  readonly #temporaryDirectory: string;
  readonly #lockDirectory: string;
  readonly #lockOwnerPath: string;

  constructor(root: string) {
    if (typeof root !== "string" || root.length === 0) throw new TypeError("store root must be nonempty");
    this.#root = resolve(root);
    this.#recordsDirectory = join(this.#root, "records");
    this.#controlDirectory = join(this.#root, ".loredu");
    this.#temporaryDirectory = join(this.#controlDirectory, "tmp");
    this.#lockDirectory = join(this.#controlDirectory, "write.lock");
    this.#lockOwnerPath = join(this.#lockDirectory, LOCK_OWNER_FILE);
  }

  async append(record: PersistedRecord): Promise<StreamPosition> {
    await this.#validateLayout();
    await this.#acquireLock();

    let failure: unknown;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    let temporaryPath: string | undefined;
    let position: StreamPosition | undefined;
    let published = false;

    try {
      const replay = await this.#replay();
      const bytes = encodePlainFileRecord(record);
      const canonical = decodePlainFileRecord(bytes);
      if (replay.some(({ record: existing }) => existing.id === canonical.id)) {
        throw new LoreduError("DUPLICATE_RECORD_ID", `record id already exists: ${canonical.id}`);
      }

      position = createStreamPosition(replay.length + 1);
      const finalPath = join(this.#recordsDirectory, recordFileName(position, canonical.id));
      temporaryPath = join(
        this.#temporaryDirectory,
        `${String(Number(position)).padStart(16, "0")}--${canonical.id}--${process.pid}--${randomUUID()}.tmp`,
      );

      handle = await open(temporaryPath, "wx");
      await handle.writeFile(bytes);
      await handle.sync();
      await handle.close();
      handle = undefined;

      await rename(temporaryPath, finalPath);
      published = true;
      temporaryPath = undefined;
      await fsyncDirectory(this.#recordsDirectory);
      await fsyncDirectory(this.#temporaryDirectory);
    } catch (error) {
      failure =
        error instanceof LoreduError
          ? error
          : storeError("STORE_IO_FAILED", `plain-file append failed under ${this.#root}`);
    }

    if (handle !== undefined) await handle.close().catch(() => undefined);
    if (!published && temporaryPath !== undefined) await unlink(temporaryPath).catch(() => undefined);

    try {
      await this.#releaseLock();
    } catch {
      if (failure === undefined) {
        failure = storeError("STORE_IO_FAILED", `could not release plain-file writer lock at ${this.#root}`);
      }
    }

    if (failure !== undefined) throw failure;
    if (position === undefined) {
      throw storeError(
        "STORE_IO_FAILED",
        `plain-file append did not allocate a position under ${this.#root}`,
      );
    }
    return position;
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
    for (const { position: itemPosition, record } of replay) {
      if (itemPosition > after) yield positioned(itemPosition, record);
    }
  }

  async head(): Promise<StreamPosition> {
    return createStreamPosition((await this.#replay()).length);
  }

  async #acquireLock(): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await mkdir(this.#lockDirectory);
      } catch (error) {
        if (!isHostError(error, "EEXIST")) {
          throw storeError("STORE_IO_FAILED", `could not acquire writer lock at ${this.#root}`);
        }
        if (attempt === 1) break;
        await this.#reclaimDeadOwnerLock();
        continue;
      }

      const owner: LockOwner = { format: LOCK_FORMAT, hostname: hostname(), pid: process.pid };
      try {
        const handle = await open(this.#lockOwnerPath, "wx");
        try {
          await handle.writeFile(`${JSON.stringify(owner)}\n`, "utf8");
          await handle.sync();
        } finally {
          await handle.close();
        }
        return;
      } catch {
        await rm(this.#lockDirectory, { recursive: true, force: true }).catch(() => undefined);
        throw storeError("STORE_IO_FAILED", `could not establish writer lock metadata at ${this.#root}`);
      }
    }
    throw storeError("STORE_LOCKED", `plain-file store is locked by another writer: ${this.#root}`);
  }

  async #reclaimDeadOwnerLock(): Promise<void> {
    let owner: LockOwner;
    try {
      const lock = await lstat(this.#lockDirectory);
      if (!lock.isDirectory() || lock.isSymbolicLink()) throw new Error("invalid lock kind");
      const bytes = await readRegularFileNoFollow(this.#lockOwnerPath);
      const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      if (
        typeof value !== "object" ||
        value === null ||
        Object.keys(value).sort().join(",") !== "format,hostname,pid" ||
        (value as { format?: unknown }).format !== LOCK_FORMAT ||
        typeof (value as { hostname?: unknown }).hostname !== "string" ||
        !Number.isSafeInteger((value as { pid?: unknown }).pid) ||
        ((value as { pid: number }).pid as number) <= 0
      ) {
        throw new Error("invalid lock owner metadata");
      }
      owner = value as LockOwner;
    } catch {
      throw storeError("STORE_LOCKED", `plain-file store has an unverifiable writer lock: ${this.#root}`);
    }

    if (owner.hostname !== hostname() || !this.#isProcessProvenDead(owner.pid)) {
      throw storeError(
        "STORE_LOCKED",
        `plain-file store is locked by an active or unverifiable writer: ${this.#root}`,
      );
    }

    const quarantine = join(this.#temporaryDirectory, `dead-write-lock--${owner.pid}--${randomUUID()}`);
    try {
      await rename(this.#lockDirectory, quarantine);
    } catch {
      throw storeError("STORE_LOCKED", `plain-file writer lock could not be quarantined: ${this.#root}`);
    }
  }

  #isProcessProvenDead(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      return isHostError(error, "ESRCH");
    }
  }

  async #releaseLock(): Promise<void> {
    const released = join(this.#temporaryDirectory, `released-write-lock--${process.pid}--${randomUUID()}`);
    await rename(this.#lockDirectory, released);
    await rm(released, { recursive: true, force: true }).catch(() => undefined);
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
    if (!root.isDirectory() || root.isSymbolicLink()) {
      throw storeError("STORE_CORRUPT", `store root is not a physical directory: ${this.#root}`);
    }

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
      const markerBytes = await readRegularFileNoFollow(join(this.#controlDirectory, "format.json"));
      if (!Buffer.from(markerBytes).equals(Buffer.from(FORMAT_BYTES))) {
        throw storeError("STORE_CORRUPT", `plain-file format marker is invalid at ${this.#root}`);
      }
    } catch (error) {
      if (error instanceof LoreduError) throw error;
      if (isHostError(error, "ENOENT")) {
        throw storeError("STORE_CORRUPT", `plain-file store layout is incomplete at ${this.#root}`);
      }
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
        throw storeError("STORE_CORRUPT", "record positions are not the contiguous prefix 1..head");
      }
      if (ids.has(item.id)) {
        throw storeError("STORE_CORRUPT", `duplicate record id in canonical files: ${item.id}`);
      }
      let bytes: Uint8Array;
      try {
        bytes = await readRegularFileNoFollow(join(this.#recordsDirectory, item.fileName));
      } catch (error) {
        if (error instanceof LoreduError) throw error;
        throw storeError("STORE_IO_FAILED", `could not read canonical record ${item.fileName}`);
      }
      let replayedRecord: PersistedRecord;
      try {
        replayedRecord = decodePlainFileRecord(bytes);
      } catch (error) {
        if (error instanceof LoreduError && error.code === "STORE_CORRUPT") {
          throw storeError("STORE_CORRUPT", `canonical record is malformed: ${item.fileName}`);
        }
        throw error;
      }
      if (replayedRecord.id !== item.id) {
        throw storeError("STORE_CORRUPT", `record filename id does not match its content: ${item.fileName}`);
      }
      ids.add(replayedRecord.id);
      replayed.push(
        Object.freeze({
          fileName: item.fileName,
          position: createStreamPosition(expected),
          record: replayedRecord,
        }),
      );
    }
    return Object.freeze(replayed);
  }
}
