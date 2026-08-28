import { mock } from "bun:test";
import { constants } from "node:fs";
import * as filesystem from "node:fs/promises";
import { join } from "node:path";
import { decodePersistedRecord } from "@loredu/kernel";

const mode = process.argv[2];
const root = process.argv[3];
if (root === undefined) throw new Error("crash probe root argument is required");

if (mode === "observe") {
  const { PlainFileStore } = await import("@loredu/store-plainfile");
  const scan = await new PlainFileStore(root).scan();
  process.stdout.write(
    JSON.stringify({
      head: Number(scan.head),
      ids: scan.records.map(({ record }) => record.id),
    }),
  );
  process.exit(0);
}

const fault = process.argv[4];
const faults = new Set([
  "after-temp-write",
  "after-temp-file-sync",
  "after-rename",
  "after-records-dir-sync",
  "after-tmp-dir-sync",
]);
if (mode !== "write" || fault === undefined || !faults.has(fault)) {
  throw new Error("crash probe mode or fault is invalid");
}

const realOpen = filesystem.open.bind(filesystem);
const realRename = filesystem.rename.bind(filesystem);

function isTemporary(path: string): boolean {
  return path.includes(`${join(".loredu", "tmp")}/`) && path.endsWith(".tmp");
}

function directoryKind(path: string): "records" | "tmp" | undefined {
  if (path.endsWith("/records")) return "records";
  if (path.endsWith(join(".loredu", "tmp"))) return "tmp";
  return undefined;
}

async function crashAt(point: string): Promise<never> {
  if (fault !== point) return new Promise<never>(() => undefined);
  process.kill(process.pid, "SIGKILL");
  return new Promise<never>(() => undefined);
}

mock.module("node:fs/promises", () => ({
  ...filesystem,
  async open(pathValue: string | URL, flags: string | number, modeValue?: number) {
    const path = String(pathValue);
    const handle = await realOpen(pathValue, flags, modeValue);
    const temporary = isTemporary(path);
    const directory =
      typeof flags === "number" && (flags & constants.O_DIRECTORY) !== 0 ? directoryKind(path) : undefined;
    return {
      async writeFile(data: string | Uint8Array, options?: unknown) {
        const result = await handle.writeFile(data, options as never);
        if (temporary && fault === "after-temp-write") await crashAt("after-temp-write");
        return result;
      },
      async sync() {
        await handle.sync();
        if (temporary && fault === "after-temp-file-sync") await crashAt("after-temp-file-sync");
        if (directory === "records" && fault === "after-records-dir-sync") {
          await crashAt("after-records-dir-sync");
        }
        if (directory === "tmp" && fault === "after-tmp-dir-sync") {
          await crashAt("after-tmp-dir-sync");
        }
      },
      close: handle.close.bind(handle),
      stat: handle.stat.bind(handle),
      readFile: handle.readFile.bind(handle),
    };
  },
  async rename(oldPath: string | URL, newPath: string | URL) {
    const result = await realRename(oldPath, newPath);
    if (isTemporary(String(oldPath)) && String(newPath).includes("/records/") && fault === "after-rename") {
      await crashAt("after-rename");
    }
    return result;
  },
}));

const { PlainFileStore } = await import("@loredu/store-plainfile");
const record = decodePersistedRecord({
  schema: "loredu.record/v1",
  kind: "entry",
  id: "ent_0000000000000018",
  recorded_at: "2026-08-26T04:00:18.000Z",
  actor: { type: "agent", id: "loredu.crash-probe" },
  body: "whole record across a process crash",
  scope: {},
  metadata: {},
  sources: [],
});
await new PlainFileStore(root).append(record);
throw new Error(`writer unexpectedly survived ${fault}`);
