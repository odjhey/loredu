import type { RecordId } from "../domain/record-id";
import type { PersistedRecord } from "../domain/records";

/** A monotonic, replay-stable position in a store's append stream. */
export type StreamPosition = number;

/** One canonical record together with its store-assigned ordering fact. */
export interface PositionedRecord {
  readonly position: StreamPosition;
  readonly record: PersistedRecord;
}

/** Provider-neutral persistence boundary. The store assigns only position. */
export interface RecordStore {
  append(record: PersistedRecord): Promise<StreamPosition>;
  get(id: RecordId | string): Promise<PersistedRecord | undefined>;
  stream(afterPosition?: StreamPosition): AsyncIterable<PositionedRecord>;
  head(): Promise<StreamPosition>;
}
