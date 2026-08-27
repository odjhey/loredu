import { LoreduError } from "../src/application";
import type { PersistedRecord, RecordId } from "../src/domain/entry";
import {
  type Clock,
  createInstant,
  createStreamPosition,
  type Instant,
  type RandomSource,
  type RecordStore,
  type StreamPosition,
} from "../src/ports/capabilities";

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
  #position = 0;
  async append(record: PersistedRecord): Promise<StreamPosition> {
    if (this.#records.has(record.id))
      throw new LoreduError("DUPLICATE_RECORD_ID", `record id already exists: ${record.id}`);
    const next = createStreamPosition(this.#position + 1);
    this.#records.set(record.id, record);
    this.#position = next;
    return next;
  }
  async get(id: RecordId): Promise<PersistedRecord | undefined> {
    return this.#records.get(id);
  }
}
