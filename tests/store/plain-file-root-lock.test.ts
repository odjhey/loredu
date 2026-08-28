import { afterAll, expect, test } from "bun:test";
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
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

async function waitForLockOwner(path: string, pid: number, timeoutMilliseconds = 10_000): Promise<void> {
  const deadline = performance.now() + timeoutMilliseconds;
  while (performance.now() < deadline) {
    try {
      const value: unknown = JSON.parse(await readFile(path, "utf8"));
      if (
        typeof value === "object" &&
        value !== null &&
        (value as { format?: unknown }).format === "loredu.write-lock/v2" &&
        (value as { pid?: unknown }).pid === pid &&
        typeof (value as { bootId?: unknown }).bootId === "string" &&
        typeof (value as { pidNamespace?: unknown }).pidNamespace === "string" &&
        typeof (value as { processIncarnation?: unknown }).processIncarnation === "string"
      ) {
        return;
      }
    } catch (error) {
      if (!(error instanceof SyntaxError) && (error as { code?: unknown }).code !== "ENOENT") throw error;
    }
    await Bun.sleep(1);
  }
  throw new Error(`timed out waiting for complete lock owner metadata at ${path}`);
}

// @covers T17
test("string root APIs, physical explicit paths, relocation, and cross-root isolation are strict", async () => {
  const base = await sandbox();
  try {
    const home = join(base, "home");
    const osHome = join(base, "os-home");
    const cwd = join(base, "work");
    await mkdir(cwd, { recursive: true });

    expect(defaultLoreduHome({ LOREDU_HOME: home }, osHome)).toBe(home);
    expect(defaultLoreduHome({ LOREDU_HOME: "" }, osHome)).toBe(join(osHome, ".loredu"));
    const named = resolveStoreRoot({ kind: "name", name: "alpha" }, { loreduHome: home, osHome, cwd });
    const defaultRoot = resolveStoreRoot({ kind: "default" }, { loreduHome: home, osHome, cwd });
    const explicitMissing = resolveStoreRoot(
      { kind: "path", path: "../explicit/missing" },
      { loreduHome: home, osHome, cwd },
    );
    expect(typeof named).toBe("string");
    expect(typeof defaultRoot).toBe("string");
    expect(typeof explicitMissing).toBe("string");
    expect(named).toBe(join(home, "stores", "alpha"));
    expect(defaultRoot).toBe(join(home, "stores", "default"));
    expect(explicitMissing).toBe(join(await realpath(base), "explicit", "missing"));
    expect(join(storeRootForName("composable", home), "records")).toBe(
      join(home, "stores", "composable", "records"),
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
    await mkdir(join(home, "stores"), { recursive: true });

    const linkedNamedRoot = join(home, "stores", "linked");
    await symlink(outside, linkedNamedRoot, "dir");
    expect(() => storeRootForName("linked", home)).toThrow(TypeError);
    expect(() =>
      resolveStoreRoot({ kind: "name", name: "linked" }, { loreduHome: home, osHome, cwd }),
    ).toThrow(TypeError);

    const unsafeHome = join(base, "unsafe-home");
    await mkdir(unsafeHome);
    await symlink(outside, join(unsafeHome, "stores"), "dir");
    expect(() => storeRootForName("escaped", unsafeHome)).toThrow(TypeError);
    expect(() => resolveStoreRoot({ kind: "default" }, { loreduHome: unsafeHome, osHome, cwd })).toThrow(
      TypeError,
    );
    expect(await exists(join(outside, "escaped"))).toBe(false);
    expect(await readFile(join(outside, "sentinel"), "utf8")).toBe("unchanged");

    const physical = join(base, "physical-explicit-store");
    await initializePlainFileStore(physical);
    const explicitRecord = entry("ent_0000000000000022", "through explicit symlink");
    await new PlainFileStore(physical).append(explicitRecord);
    const explicitLink = join(base, "explicit-link");
    await symlink(physical, explicitLink, "dir");
    const selectedExplicit = resolveStoreRoot(
      { kind: "path", path: explicitLink },
      { loreduHome: home, osHome, cwd },
    );
    expect(selectedExplicit).toBe(await realpath(physical));
    expect(Number(await new PlainFileStore(explicitLink).head())).toBe(1);
    expect((await new PlainFileStore(selectedExplicit).get(explicitRecord.id))?.id).toBe(explicitRecord.id);

    await rm(join(physical, "records"), { recursive: true });
    await symlink(outside, join(physical, "records"), "dir");
    await expect(new PlainFileStore(explicitLink).scan()).rejects.toMatchObject({ code: "STORE_CORRUPT" });
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
    await waitForLockOwner(owner, holder.pid);
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
    const temporaryEntries = await readdir(join(root, ".loredu", "tmp"));
    const deadLock = temporaryEntries.find((name) => name.startsWith("dead-write-lock--"));
    expect(deadLock).toBeDefined();
    expect(await exists(lock)).toBe(false);

    if (deadLock === undefined) throw new Error("dead owner lock was not quarantined");
    const recoveredOwner = JSON.parse(
      await readFile(join(root, ".loredu", "tmp", deadLock, "owner.json"), "utf8"),
    ) as Record<string, unknown>;
    await mkdir(lock);
    await writeFile(
      owner,
      `${JSON.stringify({ ...recoveredOwner, hostname: `other-${hostname()}`, pid: 2_147_483_647 })}\n`,
    );
    await expect(contender.append(entry("ent_0000000000000021", "different host"))).rejects.toMatchObject({
      code: "STORE_LOCKED",
    });
    expect(await exists(owner)).toBe(true);
  } finally {
    if (holder !== undefined) {
      holder.kill("SIGCONT");
      holder.kill("SIGKILL");
      await holder.exited;
    }
    await dispose(base);
  }
});
