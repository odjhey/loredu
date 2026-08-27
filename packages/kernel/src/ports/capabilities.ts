import type { PersistedRecord, RecordId, RecordKind } from "../domain/entry";

export type Instant = number & { readonly __brand: "Instant" };
export type StreamPosition = number & { readonly __brand: "StreamPosition" };

export function createInstant(epochMilliseconds: number): Instant {
  if (
    !Number.isSafeInteger(epochMilliseconds) ||
    epochMilliseconds < -62_167_219_200_000 ||
    epochMilliseconds > 253_402_300_799_999
  ) {
    throw new RangeError("instant must be an integer in the strict RFC3339-renderable range");
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
export interface RecordFilter {
  readonly kinds?: readonly RecordKind[];
}
export interface PositionedRecord {
  readonly position: StreamPosition;
  readonly record: PersistedRecord;
}
export interface RecordScan {
  readonly head: StreamPosition;
  readonly records: readonly PositionedRecord[];
}
export interface RecordStreamOptions {
  readonly after?: StreamPosition;
}
export interface RecordStore {
  append(record: PersistedRecord): Promise<StreamPosition>;
  get(id: RecordId): Promise<PersistedRecord | undefined>;
  scan(filter?: RecordFilter): Promise<RecordScan>;
  stream(options?: RecordStreamOptions): AsyncIterable<PositionedRecord>;
  head(): Promise<StreamPosition>;
}
