import type { RecordKind } from "../domain/record-kind";

/**
 * The persistence port, transcribed from the store contract
 * (`docs/architecture/contracts/store.md`). Declaration only: the guarantees
 * behind these signatures — append-is-commit, monotonic and replay-stable
 * positions, torn-read safety — belong to the conformance suite that ships with
 * M1 (catalog T10–T19), not to this file.
 *
 * `StoredRecord` is deliberately opaque here. The record envelope is modelled in
 * `domain/` as M0 lands; until then the port speaks about identity and ordering
 * only, which is all any adapter needs to be typed against.
 */

/** A monotonic, replay-stable position in a store's append stream. */
export type StreamPosition = number;

/** An opaque handle to a persisted record. */
export interface RecordRef {
  readonly id: string;
  readonly kind: RecordKind;
}

/** Result of a successful append: the kernel-assigned identity plus its position. */
export interface AppendResult {
  readonly ref: RecordRef;
  readonly position: StreamPosition;
}

export interface RecordStore {
  /**
   * Commit one record. Returning a position means the record is durable.
   * The store assigns neither `id` nor `recorded_at` — the kernel does.
   */
  append(record: unknown): Promise<AppendResult>;

  /** The canonical record for an id; resolves to `undefined` when absent. */
  get(id: string): Promise<unknown>;

  /** Ordered records from the append stream, optionally after a position. */
  stream(afterPosition?: StreamPosition): AsyncIterable<unknown>;

  /** The latest stream position; `0` on an empty store. */
  head(): Promise<StreamPosition>;
}
