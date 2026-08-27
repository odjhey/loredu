import { RECORD_SCHEMA_ID } from "@loredu/kernel";

export {
  initializePlainFileStore,
  PLAIN_FILE_FORMAT,
  PlainFileStore,
  recordFileName,
  type StoreRootInput,
} from "./plain-file-store";
export { decodePlainFileRecord, encodePlainFileRecord } from "./record-codec";
export {
  DEFAULT_STORE_NAME,
  defaultLoreduHome,
  type ResolvedStoreRoot,
  resolveStoreRoot,
  STORES_DIRNAME,
  type StoreRootContext,
  type StoreRootSelection,
  storeRootForName,
} from "./store-root";

/**
 * Record schema this adapter reads and writes. Taken from the kernel rather than
 * re-declared, so an adapter can never drift from the published envelope.
 */
export const SUPPORTED_RECORD_SCHEMA = RECORD_SCHEMA_ID;

/** Name this adapter reports in conformance output and diagnostics. */
export const STORE_ADAPTER_NAME = "plainfile";
