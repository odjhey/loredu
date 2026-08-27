import { afterAll, expect, test } from "bun:test";
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodePersistedRecord, type PersistedRecord, type PositionedRecord } from "@loredu/kernel";
import {
  defaultLoreduHome,
  initializePlainFileStore,
  PlainFileStore,
  resolveStoreRoot,
  storeRootForName,
} from "@loredu/store-plainfile";

const sandboxes = new Set<string>();

async function sandbox(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "loredu-m1d-root-"));
  sandboxes.add(path);
  return path;
}

async function dispose(path: string): Promise<void> {
  sandboxes.delete(path);
  await rm(path, { recursive: true, force: true });
}

afterAll(async () => {
  await Promise.all([...sandboxes].map(dispose));
});

function entry(id: string, body = id): PersistedRecord {
  return decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "entry",
    id,
    recorded_at: "2026-08-26T04:00:17.000Z",
    actor: { type: "agent", id: "loredu.m1d-test" },
    body,
    scope: {},
    metadata: {},
    sources: [],
  });
}

async function collect(iterable: AsyncIterable<PositionedRecord>): Promise<readonly PositionedRecord[]> {
  const records: PositionedRecord[] = [];
  for await (const record of iterable) records.push(record);
  return records;
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as { code?: unknown }).code === "ENOENT") return false;
    throw error;
  }
}

async function waitFor(path: string, timeoutMilliseconds = 10_000): Promise<void> {
  const deadline = performance.now() + timeoutMilliseconds;
  while (performance.now() < deadline) {
    if (await exists(path)) return;
    await Bun.sleep(1);
  }
  throw new Error(`timed out waiting for ${path}`);
}

// @covers T17
test("root resolution, explicit initialization, relocation, and cross-root isolation are strict", async () => {
  const base = await sandbox();
  try {
    const home = join(base, "home");
    const osHome = join(base, "os-home");
    const cwd = join(base, "work");
    await mkdir(cwd, { recursive: true });

    expect(defaultLoreduHome({ LOREDU_HOME: home }, osHome)).toBe(home);
    expect(defaultLoreduHome({ LOREDU_HOME: "" }, osHome)).toBe(join(osHome, ".loredu"));
    expect(resolveStoreRoot({ kind: "name", name: "alpha" }, { loreduHome: home, osHome, cwd })).toBe(
      join(home, "stores", "alpha"),
    );
    expect(resolveStoreRoot({ kind: "default" }, { loreduHome: home, osHome, cwd })).toBe(
      join(home, "stores", "default"),
    );
    expect(resolveStoreRoot({ kind: "path", path: "../explicit" }, { loreduHome: home, osHome, cwd })).toBe(
      join(base, "explicit"),
    );

    for (const name of ["", ".", "..", "UPPER", "a/b", "-leading", "trailing-"]) {
      expect(() => storeRootForName(name, home)).toThrow(TypeError);
    }
    expect(() => storeRootForName(`a${"b".repeat(128)}`, home)).toThrow(TypeError);

    const missing = storeRootForName("missing", home);
    await expect(new PlainFileStore(missing).head()).rejects.toMatchObject({ code: "STORE_NOT_FOUND" });
    expect(await exists(missing)).toBe(false);

    const alpha = storeRootForName("alpha", home);
    const beta = storeRootForName("beta", home);
    await initializePlainFileStore(alpha);
    await initializePlainFileStore(beta);
    expect(await readFile(join(alpha, ".loredu", "format.json"), "utf8")).toBe(
      '{"format":"loredu.plainfile/v1"}\n',
    );
    await expect(initializePlainFileStore(alpha)).rejects.toMatchObject({ code: "STORE_ALREADY_EXISTS" });

    const alphaStore = new PlainFileStore(alpha);
    const betaStore = new PlainFileStore(beta);
    const alphaRecord = entry("ent_0000000000000017", "alpha");
    const betaRecord = entry("ent_0000000000000018", "beta");
    expect(Number(await alphaStore.append(alphaRecord))).toBe(1);
    expect(Number(await betaStore.append(betaRecord))).toBe(1);
    expect(await alphaStore.get(betaRecord.id)).toBeUndefined();
    expect(await betaStore.get(alphaRecord.id)).toBeUndefined();

    await mkdir(join(alpha, ".loredu", "write.lock"));
    await writeFile(join(alpha, ".loredu", "write.lock", "owner.json"), "not owner metadata\n");
    expect(Number(await betaStore.append(entry("ent_0000000000000019", "beta second")))).toBe(2);

    const moved = join(base, "relocated-store");
    await rename(beta, moved);
    const relocated = new PlainFileStore(moved);
    expect(Number(await relocated.head())).toBe(2);
    expect((await relocated.get(betaRecord.id))?.id).toBe(betaRecord.id);
    await expect(new PlainFileStore(beta).head()).rejects.toMatchObject({ code: "STORE_NOT_FOUND" });

    const outside = join(base, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "sentinel"), "unchanged");

    const linkedRoot = join(home, "stores", "linked");
    await symlink(outside, linkedRoot, "dir");
    await expect(new PlainFileStore(linkedRoot).head()).rejects.toMatchObject({ code: "STORE_CORRUPT" });
    await expect(initializePlainFileStore(linkedRoot)).rejects.toMatchObject({
      code: "STORE_ALREADY_EXISTS",
    });

    const escaped = join(base, "escaped-descendant");
    await initializePlainFileStore(escaped);
    await rm(join(escaped, "records"), { recursive: true });
    await symlink(outside, join(escaped, "records"), "dir");
    await expect(new PlainFileStore(escaped).scan()).rejects.toMatchObject({ code: "STORE_CORRUPT" });
    expect(await readFile(join(outside, "sentinel"), "utf8")).toBe("unchanged");
  } finally {
    await dispose(base);
  }
});

// @covers T16
test("an owned append lock fails immediately, cannot age stale, and only a proven-dead owner is recovered", async () => {
  const base = await sandbox();
  let holder: ReturnType<typeof Bun.spawn> | undefined;
  try {
    const root = join(base, "store");
    await initializePlainFileStore(root);
    const helper = join(import.meta.dir, "plain-file-lock-holder.ts");
    holder = Bun.spawn([process.execPath, helper, root], {
      cwd: join(import.meta.dir, "../.."),
      stderr: "pipe",
      stdout: "pipe",
    });

    const lock = join(root, ".loredu", "write.lock");
    const owner = join(lock, "owner.json");
    await waitFor(owner);
    holder.kill("SIGSTOP");
    await Bun.sleep(20);
    expect(await exists(owner)).toBe(true);

    const beforeRecords = await readdir(join(root, "records"));
    const beforeTemporary = await readdir(join(root, ".loredu", "tmp"));
    const contender = new PlainFileStore(root);
    const attempted = entry("ent_0000000000000020", "contender");
    const started = performance.now();
    await expect(contender.append(attempted)).rejects.toMatchObject({ code: "STORE_LOCKED" });
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(await readdir(join(root, "records"))).toEqual(beforeRecords);
    expect(await readdir(join(root, ".loredu", "tmp"))).toEqual(beforeTemporary);

    await utimes(lock, new Date(0), new Date(0));
    await expect(contender.append(attempted)).rejects.toMatchObject({ code: "STORE_LOCKED" });

    holder.kill("SIGKILL");
    await holder.exited;
    holder = undefined;

    const position = await contender.append(attempted);
    const replay = await collect(new PlainFileStore(root).stream());
    expect(replay.map(({ position: item }) => Number(item))).toEqual(
      Array.from({ length: replay.length }, (_, index) => index + 1),
    );
    expect(replay.some(({ record }) => record.id === attempted.id)).toBe(true);
    expect(Number(position)).toBe(replay.length);
    expect(
      (await readdir(join(root, ".loredu", "tmp"))).some((name) => name.startsWith("dead-write-lock--")),
    ).toBe(true);
    expect(await exists(lock)).toBe(false);
  } finally {
    if (holder !== undefined) {
      holder.kill("SIGCONT");
      holder.kill("SIGKILL");
      await holder.exited;
    }
    await dispose(base);
  }
});
