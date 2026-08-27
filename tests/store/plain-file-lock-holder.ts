import { decodePersistedRecord } from "@loredu/kernel";
import { PlainFileStore } from "@loredu/store-plainfile";

const root = process.argv[2];
if (root === undefined) throw new Error("lock-holder root argument is required");

const record = decodePersistedRecord({
  schema: "loredu.record/v1",
  kind: "entry",
  id: "ent_0000000000000016",
  recorded_at: "2026-08-26T04:00:16.000Z",
  actor: { type: "agent", id: "loredu.lock-holder" },
  body: "x".repeat(16 * 1024 * 1024),
  scope: {},
  metadata: {},
  sources: [],
});

await new PlainFileStore(root).append(record);
