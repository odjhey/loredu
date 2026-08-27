import { RECORD_SCHEMA_ID } from "@loredu/kernel";

export { PLAIN_FILE_FORMAT, PlainFileStore, recordFileName } from "./plain-file-store";
export { decodePlainFileRecord, encodePlainFileRecord } from "./record-codec";
export {
  DEFAULT_STORE_NAME,
  defaultLoreduHome,
  STORES_DIRNAME,
  storeRootForName,
} from "./store-root";

/**
 * Record schema this adapter reads and writes. Taken from the kernel rather than
 * re-declared, so an adapter can never drift from the published envelope.
 */
export const SUPPORTED_RECORD_SCHEMA = RECORD_SCHEMA_ID;

/** Name this adapter reports in conformance output and diagnostics. */
export const STORE_ADAPTER_NAME = "plainfile";
