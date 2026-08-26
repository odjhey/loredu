export type { RecordIdPrefix, RecordKind } from "./domain/record-kind";
export {
  RECORD_ID_PREFIX,
  RECORD_SCHEMA_ID,
  recordKindOfIdPrefix,
} from "./domain/record-kind";
export type {
  AppendResult,
  RecordRef,
  RecordStore,
  StreamPosition,
} from "./ports/record-store";

export const   BAD_FORMATTING   =    "biome should reject this";
