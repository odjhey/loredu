import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createStreamPosition,
  decodePersistedRecord,
  encodePersistedRecord,
  LoreduError,
  type PersistedRecord,
  type PositionedRecord,
} from "@loredu/kernel";
import {
  type RecordStoreConformanceCase,
  type RecordStoreFixture,
  recordStoreConformance,
  type StoreUnderTest,
} from "@loredu/kernel/testing";
import {
  decodePlainFileRecord,
  encodePlainFileRecord,
  PLAIN_FILE_FORMAT,
  PlainFileStore,
  recordFileName,
} from "@loredu/store-plainfile";

const roots = new Set<string>();
const textDecoder = new TextDecoder();

async function freshRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "loredu-m1f-"));
  roots.add(root);
  await mkdir(join(root, ".loredu", "tmp"), { recursive: true });
  await mkdir(join(root, "records"));
  await writeFile(join(root, ".loredu", "format.json"), `${JSON.stringify({ format: PLAIN_FILE_FORMAT })}\n`);
  return root;
}

async function disposeRoot(root: string): Promise<void> {
  roots.delete(root);
  await rm(root, { recursive: true, force: true });
}

afterAll(async () => {
  await Promise.all([...roots].map(disposeRoot));
});

const actor = { type: "agent" as const, id: "loredu.plainfile-test" };

const records = [
  decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "entry",
    id: "ent_0000000000000001",
    recorded_at: "2026-08-26T04:00:00.000Z",
    actor,
    body: "Exact free text.\r\nSecond line.",
    title: "Codec fixture",
    entry_type: "test.note",
    scope: { zeta: "last", alpha: "first" },
    metadata: { "test.nested": { zeta: 2, alpha: [true, null] } },
    sources: [{ ref: "https://example.test/source", locator: "line 1", snapshot: "v1" }],
  }),
  decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "claim",
    id: "clm_0000000000000001",
    recorded_at: "2026-08-26T04:00:01.000Z",
    actor,
    subject: { type: "fixture", id: "plain-file" },
    predicate: "is.canonical",
    value: { zeta: 2, alpha: 1 },
    confidence: "observed",
    claim_class: "test.assertion",
    perspective: "implementation",
    valid_from: "2026-08-26T00:00:00.000Z",
    valid_until: "2026-08-27T00:00:00.000Z",
    derived_from: ["ent_0000000000000001"],
    scope: {},
    metadata: {},
    sources: [],
  }),
  decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "relation",
    id: "rel_0000000000000001",
    recorded_at: "2026-08-26T04:00:02.000Z",
    actor,
    relation_type: "supports",
    from: "ent_0000000000000001",
    to: "clm_0000000000000001",
    scope: {},
    metadata: {},
    sources: [],
  }),
  decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "resolution",
    id: "res_0000000000000001",
    recorded_at: "2026-08-26T04:00:03.000Z",
    actor,
    targets: ["clm_0000000000000001", "rel_0000000000000001"],
    decision: "prefer",
    replacement: "clm_0000000000000001",
    reason: "The canonical fixture wins.",
    effective_at: "2026-08-26T04:00:03.000Z",
    scope: {},
    metadata: {},
    sources: [],
  }),
  decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "verification",
    id: "ver_0000000000000001",
    recorded_at: "2026-08-26T04:00:04.000Z",
    actor,
    targets: ["clm_0000000000000001"],
    verified_against: [{ ref: "https://example.test/check", snapshot: "v1" }],
    result: "confirmed",
    scope: {},
    metadata: {},
    sources: [],
  }),
] as const satisfies readonly PersistedRecord[];

async function collect(iterable: AsyncIterable<PositionedRecord>): Promise<readonly PositionedRecord[]> {
  const result: PositionedRecord[] = [];
  for await (const item of iterable) result.push(item);
  return result;
}

function portablePositioned(items: readonly PositionedRecord[]): unknown {
  return items.map(({ position, record }) => ({
    position: Number(position),
    record: encodePersistedRecord(record),
  }));
}

const plainFileSubject: StoreUnderTest = {
  name: "PlainFileStore",
  async create(): Promise<RecordStoreFixture> {
    const root = await freshRoot();
    return {
      store: new PlainFileStore(root),
      async dispose() {
        await disposeRoot(root);
      },
    };
  },
};

const conformance: readonly RecordStoreConformanceCase[] = recordStoreConformance(plainFileSubject);
for (const conformanceCase of conformance) test(conformanceCase.name, conformanceCase.run);

test("reopens the same canonical files as an identical stream and scan — @covers T11", async () => {
  const root = await freshRoot();
  try {
    const writer = new PlainFileStore(root);
    for (const [index, record] of records.entries()) {
      expect(Number(await writer.append(record))).toBe(index + 1);
    }

    const reopened = new PlainFileStore(root);
    const stream = await collect(reopened.stream());
    const scan = await reopened.scan();
    expect(Number(scan.head)).toBe(records.length);
    expect(portablePositioned(scan.records)).toEqual(portablePositioned(stream));
    expect(portablePositioned(stream)).toEqual(
      records.map((record, index) => ({ position: index + 1, record: encodePersistedRecord(record) })),
    );
  } finally {
    await disposeRoot(root);
  }
});

test("filename positions remain replay authority after control leftovers are removed — @covers T12", async () => {
  const root = await freshRoot();
  try {
    const store = new PlainFileStore(root);
    await store.append(records[0]);
    await store.append(records[1]);
    await writeFile(join(root, ".loredu", "tmp", "discarded.tmp"), "not canonical");
    await writeFile(join(root, "generated-index.json"), "not canonical");
    await rm(join(root, ".loredu", "tmp", "discarded.tmp"));
    await rm(join(root, "generated-index.json"));

    const reopened = new PlainFileStore(root);
    expect(Number(await reopened.head())).toBe(2);
    expect((await collect(reopened.stream())).map(({ position }) => Number(position))).toEqual([1, 2]);
    expect(await readdirNames(join(root, "records"))).toEqual([
      recordFileName(createStreamPosition(1), records[0].id),
      recordFileName(createStreamPosition(2), records[1].id),
    ]);
  } finally {
    await disposeRoot(root);
  }
});

async function readdirNames(path: string): Promise<readonly string[]> {
  return (await readdir(path)).sort();
}

test("strict inspectable frontmatter preserves Entry text and discovers a valid hand addition — @covers T14", async () => {
  const root = await freshRoot();
  try {
    const store = new PlainFileStore(root);
    await store.append(records[0]);
    const firstPath = join(root, "records", recordFileName(createStreamPosition(1), records[0].id));
    expect(await readFile(firstPath, "utf8")).toBe(
      `---\n` +
        `schema: "loredu.record/v1"\n` +
        `kind: "entry"\n` +
        `id: "ent_0000000000000001"\n` +
        `recorded_at: "2026-08-26T04:00:00.000Z"\n` +
        `actor: {"type":"agent","id":"loredu.plainfile-test"}\n` +
        `scope: {"alpha":"first","zeta":"last"}\n` +
        `metadata: {"test.nested":{"alpha":[true,null],"zeta":2}}\n` +
        `sources: [{"ref":"https://example.test/source","locator":"line 1","snapshot":"v1"}]\n` +
        `title: "Codec fixture"\n` +
        `entry_type: "test.note"\n` +
        `---\n` +
        `Exact free text.\r\nSecond line.`,
    );

    const handId = "ent_0000000000000002";
    const handBody = "Hand-added body.\r\nPreserved exactly.";
    const handFile =
      `---\n` +
      `kind: "entry"\n` +
      `schema: "loredu.record/v1"\n` +
      `recorded_at: "2026-08-26T04:00:05.000Z"\n` +
      `id: "${handId}"\n` +
      `sources: []\n` +
      `metadata: {}\n` +
      `scope: {}\n` +
      `actor: {"type":"human","id":"fixture.author"}\n` +
      `---\n` +
      handBody;
    await writeFile(
      join(root, "records", recordFileName(createStreamPosition(2), handId as PersistedRecord["id"])),
      handFile,
    );

    const reopened = new PlainFileStore(root);
    expect(Number(await reopened.head())).toBe(2);
    const handAdded = await reopened.get(handId as PersistedRecord["id"]);
    expect(handAdded?.kind).toBe("entry");
    if (handAdded?.kind !== "entry") throw new Error("hand-added Entry was not discovered");
    expect(handAdded.body).toBe(handBody);
  } finally {
    await disposeRoot(root);
  }
});

test("duplicate append preserves the original canonical bytes and next position", async () => {
  const root = await freshRoot();
  try {
    const store = new PlainFileStore(root);
    await store.append(records[0]);
    const originalPath = join(root, "records", recordFileName(createStreamPosition(1), records[0].id));
    const before = await readFile(originalPath);
    const duplicate = decodePersistedRecord({
      ...encodePersistedRecord(records[0]),
      body: "replacement body",
    });

    await expect(store.append(duplicate)).rejects.toMatchObject({ code: "DUPLICATE_RECORD_ID" });
    expect(await readFile(originalPath)).toEqual(before);
    expect(Number(await store.head())).toBe(1);
    expect(Number(await store.append(records[1]))).toBe(2);
  } finally {
    await disposeRoot(root);
  }
});

describe("public strict record codec", () => {
  test("round-trips every record family with structured Markdown bodies empty", () => {
    for (const record of records) {
      const bytes = encodePlainFileRecord(record);
      expect(encodePersistedRecord(decodePlainFileRecord(bytes))).toEqual(encodePersistedRecord(record));
      const text = textDecoder.decode(bytes);
      if (record.kind !== "entry") expect(text.endsWith("---\n")).toBe(true);
    }
  });

  test("rejects a raw UTF-8 BOM before an otherwise valid record", () => {
    const encoded = encodePlainFileRecord(records[0]);
    const withBom = new Uint8Array(encoded.length + 3);
    withBom.set([0xef, 0xbb, 0xbf]);
    withBom.set(encoded, 3);

    expect(() => decodePlainFileRecord(withBom)).toThrow(LoreduError);
    try {
      decodePlainFileRecord(withBom);
    } catch (error) {
      expect(error).toBeInstanceOf(LoreduError);
      expect((error as LoreduError).code).toBe("STORE_CORRUPT");
    }
  });

  test("orders numeric-looking keys recursively in dynamic JSON maps", () => {
    const claim = decodePersistedRecord({
      ...encodePersistedRecord(records[1]),
      value: { "2": "two", "10": "ten", nested: { "2": 2, "10": 10 } },
    });
    const bytes = encodePlainFileRecord(claim);

    expect(textDecoder.decode(bytes)).toContain(
      'value: {"10":"ten","2":"two","nested":{"10":10,"2":2}}\n',
    );
    expect(encodePersistedRecord(decodePlainFileRecord(bytes))).toEqual(encodePersistedRecord(claim));
  });

  test.each([
    ["CRLF headers", `---\r\nschema: "loredu.record/v1"\r\n---\r\n`],
    ["implicit scalar", `---\nschema: loredu.record/v1\n---\n`],
    ["comment", `---\nschema: "loredu.record/v1" # no\n---\n`],
    ["duplicate field", `---\nkind: "entry"\nkind: "entry"\n---\nbody`],
    [
      "nested duplicate JSON key",
      `---\nkind: "entry"\nmetadata: {"test.key":{"same":1,"same":2}}\n---\nbody`,
    ],
  ])("rejects %s", (_name, text) => {
    expect(() => decodePlainFileRecord(new TextEncoder().encode(text))).toThrow(LoreduError);
    try {
      decodePlainFileRecord(new TextEncoder().encode(text));
    } catch (error) {
      expect(error).toBeInstanceOf(LoreduError);
      expect((error as LoreduError).code).toBe("STORE_CORRUPT");
    }
  });

  test("rejects frontmatter body fields and structured Markdown prose", () => {
    const entry = textDecoder
      .decode(encodePlainFileRecord(records[0]))
      .replace('entry_type: "test.note"\n', 'entry_type: "test.note"\nbody: "second authority"\n');
    expect(() => decodePlainFileRecord(new TextEncoder().encode(entry))).toThrow(LoreduError);

    const claim = `${textDecoder.decode(encodePlainFileRecord(records[1]))}not empty`;
    expect(() => decodePlainFileRecord(new TextEncoder().encode(claim))).toThrow(LoreduError);
  });
});

test("canonical replay rejects gaps and never returns a partial prefix", async () => {
  const root = await freshRoot();
  try {
    await writeFile(
      join(root, "records", recordFileName(createStreamPosition(2), records[0].id)),
      encodePlainFileRecord(records[0]),
    );
    const store = new PlainFileStore(root);
    await expect(store.scan()).rejects.toMatchObject({ code: "STORE_CORRUPT" });
    await expect(store.get(records[0].id)).rejects.toMatchObject({ code: "STORE_CORRUPT" });
  } finally {
    await disposeRoot(root);
  }
});
