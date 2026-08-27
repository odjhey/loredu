import { mock } from "bun:test";
import { constants } from "node:fs";
import * as filesystem from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodePersistedRecord } from "@loredu/kernel";

const real = {
  lstat: filesystem.lstat.bind(filesystem),
  mkdir: filesystem.mkdir.bind(filesystem),
  mkdtemp: filesystem.mkdtemp.bind(filesystem),
  open: filesystem.open.bind(filesystem),
  readdir: filesystem.readdir.bind(filesystem),
  rename: filesystem.rename.bind(filesystem),
  rm: filesystem.rm.bind(filesystem),
  unlink: filesystem.unlink.bind(filesystem),
  writeFile: filesystem.writeFile.bind(filesystem),
};

const faultPoints = [
  "none",
  "temp-open",
  "temp-write",
  "temp-file-sync",
  "temp-close",
  "rename",
  "records-dir-sync",
  "tmp-dir-sync",
  "lock-release",
] as const;
type FaultPoint = (typeof faultPoints)[number];

let activeFault: FaultPoint = "none";
let events: string[] = [];

function injectedFailure(point: FaultPoint): Error {
  return Object.assign(new Error(`injected ${point} failure`), { code: "EIO" });
}

function isTemporary(path: string): boolean {
  return path.includes(`${join(".loredu", "tmp")}/`) && path.endsWith(".tmp");
}

function directoryKind(path: string): "records-dir" | "tmp-dir" | undefined {
  if (path.endsWith("/records")) return "records-dir";
  if (path.endsWith(join(".loredu", "tmp"))) return "tmp-dir";
  return undefined;
}

function wrapHandle(handle: Awaited<ReturnType<typeof real.open>>, path: string): unknown {
  const temporary = isTemporary(path);
  const directory = directoryKind(path);
  return {
    async writeFile(data: string | Uint8Array, options?: unknown) {
      if (temporary) {
        events.push("temp-write");
        if (activeFault === "temp-write") {
          const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
          await handle.writeFile(bytes.subarray(0, Math.max(1, Math.floor(bytes.length / 2))));
          throw injectedFailure("temp-write");
        }
      }
      return handle.writeFile(data, options as never);
    },
    async sync() {
      if (temporary) {
        events.push("temp-file-sync");
        if (activeFault === "temp-file-sync") throw injectedFailure("temp-file-sync");
      }
      if (directory !== undefined) {
        events.push(`${directory}-sync`);
        if (activeFault === `${directory}-sync`) throw injectedFailure(activeFault);
      }
      return handle.sync();
    },
    async close() {
      if (temporary) {
        events.push("temp-close");
        if (activeFault === "temp-close") {
          await handle.close();
          throw injectedFailure("temp-close");
        }
      }
      return handle.close();
    },
    stat: handle.stat.bind(handle),
    readFile: handle.readFile.bind(handle),
  };
}

mock.module("node:fs/promises", () => ({
  ...filesystem,
  async open(pathValue: string | URL, flags: string | number, mode?: number) {
    const path = String(pathValue);
    if (flags === "wx" && isTemporary(path)) {
      events.push("temp-open");
      if (activeFault === "temp-open") throw injectedFailure("temp-open");
    }
    const directory = typeof flags === "number" ? directoryKind(path) : undefined;
    if (directory !== undefined && typeof flags === "number" && (flags & constants.O_DIRECTORY) !== 0) {
      events.push(`${directory}-open`);
    }
    return wrapHandle(await real.open(pathValue, flags, mode), path);
  },
  async rename(oldPath: string | URL, newPath: string | URL) {
    if (isTemporary(String(oldPath)) && String(newPath).includes("/records/")) {
      events.push("rename");
      if (activeFault === "rename") throw injectedFailure("rename");
    }
    if (String(oldPath).endsWith(join(".loredu", "write.lock"))) {
      events.push("lock-release");
      if (activeFault === "lock-release") throw injectedFailure("lock-release");
    }
    return real.rename(oldPath, newPath);
  },
}));

const { PlainFileStore } = await import("@loredu/store-plainfile");
const parent = await real.mkdtemp(join(tmpdir(), "loredu-m1d-fault-"));
const outcomes: unknown[] = [];

try {
  for (const [index, fault] of faultPoints.entries()) {
    const root = join(parent, `case-${index}`);
    await real.mkdir(join(root, ".loredu", "tmp"), { recursive: true });
    await real.mkdir(join(root, "records"));
    await real.writeFile(join(root, ".loredu", "format.json"), '{"format":"loredu.plainfile/v1"}\n');

    const id = `ent_00000000000000${String(index + 1).padStart(2, "0")}`;
    const record = decodePersistedRecord({
      schema: "loredu.record/v1",
      kind: "entry",
      id,
      recorded_at: "2026-08-26T04:00:18.000Z",
      actor: { type: "agent", id: "loredu.fault-probe" },
      body: "whole durable record",
      scope: {},
      metadata: {},
      sources: [],
    });
    const store = new PlainFileStore(root);
    activeFault = fault;
    events = [];
    let appendCode: string | undefined;
    let returnedPosition: number | undefined;
    try {
      returnedPosition = Number(await store.append(record));
    } catch (error) {
      appendCode = (error as { code?: string }).code;
    }
    activeFault = "none";
    const commitEvents = [...events];
    const observed = await new PlainFileStore(root).scan();
    const attemptedVisible = (await new PlainFileStore(root).get(record.id))?.id === record.id;
    let retryCode: string | undefined;
    if (attemptedVisible) {
      try {
        await store.append(record);
      } catch (error) {
        retryCode = (error as { code?: string }).code;
      }
    }
    outcomes.push({
      fault,
      events: commitEvents,
      appendCode,
      returnedPosition,
      head: Number(observed.head),
      ids: observed.records.map(({ record: item }) => item.id),
      attemptedVisible,
      retryCode,
    });
  }
  process.stdout.write(JSON.stringify(outcomes));
} finally {
  mock.restore();
  await real.rm(parent, { recursive: true, force: true });
}
