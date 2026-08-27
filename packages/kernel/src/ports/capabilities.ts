import type { PersistedRecord, RecordId } from "../domain/entry";

export type Instant = number & { readonly __brand: "Instant" };
export type StreamPosition = number & { readonly __brand: "StreamPosition" };

export function createInstant(epochMilliseconds: number): Instant {
  if (!Number.isSafeInteger(epochMilliseconds) || Math.abs(epochMilliseconds) > 8_640_000_000_000_000) {
    throw new RangeError("instant must be a safe integer within the ECMAScript TimeClip range");
  }
  return epochMilliseconds as Instant;
}

export function createStreamPosition(value: number): StreamPosition {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("stream position must be a nonnegative safe integer");
  }
  return value as StreamPosition;
}

export interface Clock {
  now(): Instant;
}
export interface RandomSource {
  nextBytes(count: number): Uint8Array;
}
export interface RecordStore {
  append(record: PersistedRecord): Promise<StreamPosition>;
  get(id: RecordId): Promise<PersistedRecord | undefined>;
}
