/**
 * Record families and their id prefixes, transcribed from the record contract
 * (`docs/architecture/contracts/records.md`).
 *
 * This module is vocabulary, not behavior: it names the record kinds and the
 * three-letter id prefix each one uses, so adapters and the CLI agree on the
 * spelling. Record validation, id generation, and the append path arrive with
 * M0 (catalog T01–T08); nothing here validates a record.
 */

/** Value of the `schema` field every persisted record carries. */
export const RECORD_SCHEMA_ID = "loredu.record/v1";

/** The three-letter id prefix of each record kind. */
export const RECORD_ID_PREFIX = {
  entry: "ent",
  claim: "clm",
  relation: "rel",
  resolution: "res",
  verification: "ver",
} as const;

export type RecordKind = keyof typeof RECORD_ID_PREFIX;
export type RecordIdPrefix = (typeof RECORD_ID_PREFIX)[RecordKind];

const KIND_BY_PREFIX = new Map<string, RecordKind>(
  Object.entries(RECORD_ID_PREFIX).map(([kind, prefix]) => [prefix, kind as RecordKind]),
);

/** The record kind a three-letter id prefix denotes, or `undefined` if unknown. */
export function recordKindOfIdPrefix(prefix: string): RecordKind | undefined {
  return KIND_BY_PREFIX.get(prefix);
}
