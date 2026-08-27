import type { PositionedRecord, RecordStore } from "@loredu/kernel";

const unused = (method: string): never => {
  throw new Error(`application test unexpectedly called RecordStore.${method}`);
};

/** M1 query methods for append/get-focused application collaborators. */
export const unusedRecordStoreQueries = {
  async scan() {
    return unused("scan");
  },
  stream(): AsyncIterable<PositionedRecord> {
    return unused("stream");
  },
  async head() {
    return unused("head");
  },
} satisfies Pick<RecordStore, "scan" | "stream" | "head">;
