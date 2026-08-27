import type { PersistedRecord, RecordId } from "../src/domain/entry";
import { decodePersistedRecord } from "../src/domain/records";
import { LoreduError } from "../src/errors";
import {
  type Clock,
  createInstant,
  createStreamPosition,
  type Instant,
  type PositionedRecord,
  type RandomSource,
  type RecordFilter,
  type RecordScan,
  type RecordStore,
  type RecordStreamOptions,
  type StreamPosition,
} from "../src/ports/capabilities";

export type {
  RecordStoreConformanceCase,
  RecordStoreFixture,
  StoreUnderTest,
} from "./record-store-conformance";
export { recordStoreConformance } from "./record-store-conformance";

export class FixedClock implements Clock {
  readonly #instant: Instant;
  constructor(instant: Instant) {
    this.#instant = createInstant(instant);
  }
  now(): Instant {
    return this.#instant;
  }
}

export class SeededRandomSource implements RandomSource {
  #state: number;
  constructor(seed: number) {
    if (!Number.isSafeInteger(seed) || seed < 0)
      throw new RangeError("seed must be a nonnegative safe integer");
    this.#state = seed >>> 0 || 0x9e3779b9;
  }
  nextBytes(count: number): Uint8Array {
    if (!Number.isSafeInteger(count) || count < 0)
      throw new RangeError("count must be a nonnegative safe integer");
    const bytes = new Uint8Array(count);
    for (let index = 0; index < count; index++) {
      let value = this.#state;
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      this.#state = value >>> 0;
      bytes[index] = this.#state & 0xff;
    }
    return bytes;
  }
}

export class InMemoryStore implements RecordStore {
  readonly #records = new Map<string, PersistedRecord>();
  readonly #sequence: PersistedRecord[] = [];

  async append(record: PersistedRecord): Promise<StreamPosition> {
    const snapshot = decodePersistedRecord(record);
    if (this.#records.has(snapshot.id))
      throw new LoreduError("DUPLICATE_RECORD_ID", `record id already exists: ${snapshot.id}`);
    const next = createStreamPosition(this.#sequence.length + 1);
    this.#records.set(snapshot.id, snapshot);
    this.#sequence.push(snapshot);
    return next;
  }

  async get(id: RecordId): Promise<PersistedRecord | undefined> {
    const record = this.#records.get(id);
    return record === undefined ? undefined : decodePersistedRecord(record);
  }

  async scan(filter?: RecordFilter): Promise<RecordScan> {
    const snapshot = this.#sequence.slice();
    const head = createStreamPosition(snapshot.length);
    const kinds = filter?.kinds === undefined ? undefined : new Set(filter.kinds);
    const records = snapshot
      .map((record, index) => ({ record, position: createStreamPosition(index + 1) }))
      .filter(({ record }) => kinds === undefined || kinds.has(record.kind))
      .map(({ record, position }) => this.#positioned(position, record));
    return Object.freeze({ head, records: Object.freeze(records) });
  }

  async *stream(options?: RecordStreamOptions): AsyncIterable<PositionedRecord> {
    const head = createStreamPosition(this.#sequence.length);
    const after = options?.after ?? createStreamPosition(0);
    if (after > head) {
      throw new LoreduError(
        "STREAM_POSITION_OUT_OF_RANGE",
        `stream position ${after} is greater than captured head ${head}`,
      );
    }
    const snapshot = this.#sequence
      .slice(Number(after), Number(head))
      .map((record, index) => this.#positioned(createStreamPosition(Number(after) + index + 1), record));
    for (const record of snapshot) yield record;
  }

  async head(): Promise<StreamPosition> {
    return createStreamPosition(this.#sequence.length);
  }

  #positioned(position: StreamPosition, record: PersistedRecord): PositionedRecord {
    return Object.freeze({ position, record: decodePersistedRecord(record) });
  }
}
