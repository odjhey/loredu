/** Test support published only as `@loredu/kernel/testing`. */

import type { PersistedRecord } from "../src/domain/records";
import type { Clock, RandomSource } from "../src/ports/capabilities";
import type { PositionedRecord, RecordStore, StreamPosition } from "../src/ports/record-store";

export class FixedClock implements Clock {
  readonly #instant: string;
  constructor(instant: string) {
    this.#instant = instant;
  }
  now(): string {
    return this.#instant;
  }
}

/** Small deterministic test generator; not a production entropy source. */
export class SeededRandomSource implements RandomSource {
  #state: number;
  constructor(seed: number) {
    if (!Number.isInteger(seed)) throw new TypeError("seed must be an integer");
    this.#state = seed >>> 0 || 0x6d2b79f5;
  }
  nextBytes(count: number): Uint8Array {
    if (!Number.isSafeInteger(count) || count < 0)
      throw new RangeError("count must be a non-negative safe integer");
    const bytes = new Uint8Array(count);
    for (let index = 0; index < count; index += 1) {
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

/** Logical, semantic-agnostic reference store. It makes no durability claim. */
export class InMemoryStore implements RecordStore {
  readonly #items: PositionedRecord[] = [];
  readonly #byId = new Map<string, PersistedRecord>();

  async append(record: PersistedRecord): Promise<StreamPosition> {
    if (this.#byId.has(record.id)) throw new Error(`duplicate record id ${JSON.stringify(record.id)}`);
    const position = this.#items.length + 1;
    const item = Object.freeze({ position, record });
    this.#items.push(item);
    this.#byId.set(record.id, record);
    return position;
  }

  async get(id: string): Promise<PersistedRecord | undefined> {
    return this.#byId.get(id);
  }

  async *stream(afterPosition: StreamPosition = 0): AsyncIterable<PositionedRecord> {
    if (!Number.isSafeInteger(afterPosition) || afterPosition < 0)
      throw new RangeError("afterPosition must be a non-negative safe integer");
    for (const item of this.#items) if (item.position > afterPosition) yield item;
  }

  async head(): Promise<StreamPosition> {
    return this.#items.length;
  }
}

export interface StoreUnderTest {
  readonly name: string;
  create(): Promise<RecordStore>;
}
