import type { PersistedRecord, RecordId, RecordKind } from "../src/domain/entry";
import { jsonValuesEqual } from "../src/domain/portable-json";
import { decodePersistedRecord, encodePersistedRecord } from "../src/domain/records";
import { LoreduError } from "../src/errors";
import type { PositionedRecord, RecordScan, RecordStore, StreamPosition } from "../src/ports/capabilities";

export interface RecordStoreFixture {
  readonly store: RecordStore;
  dispose(): Promise<void>;
}

export interface StoreUnderTest {
  readonly name: string;
  create(): Promise<RecordStoreFixture>;
}

export interface RecordStoreConformanceCase {
  readonly name: string;
  run(): Promise<void>;
}

const ids = {
  entry0: "ent_0000000000000000",
  entry1: "ent_0000000000000001",
  claim0: "clm_0000000000000000",
  relation0: "rel_0000000000000000",
} as const;

const actor = Object.freeze({ type: "agent" as const, id: "loredu.conformance" });

function entry(id: string, body: string): PersistedRecord {
  return decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "entry",
    id,
    recorded_at: "1970-01-01T00:00:00.000Z",
    actor,
    body,
    scope: {},
    metadata: {},
    sources: [],
  });
}

function claim(): PersistedRecord {
  return decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "claim",
    id: ids.claim0,
    recorded_at: "1970-01-01T00:00:00.001Z",
    actor,
    subject: { type: "fixture", id: "record-store" },
    predicate: "conforms",
    value: true,
    confidence: "observed",
    derived_from: [ids.entry0],
    scope: {},
    metadata: {},
    sources: [],
  });
}

function relation(): PersistedRecord {
  return decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "relation",
    id: ids.relation0,
    recorded_at: "1970-01-01T00:00:00.002Z",
    actor,
    relation_type: "supports",
    from: ids.entry0,
    to: ids.claim0,
    scope: {},
    metadata: {},
    sources: [],
  });
}

const fixtures = Object.freeze([
  entry(ids.entry0, "first fixture"),
  claim(),
  relation(),
  entry(ids.entry1, "later fixture"),
]);

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function assertPosition(actual: StreamPosition, expected: number, context: string): void {
  assert(Number(actual) === expected, `${context}: expected position ${expected}, got ${actual}`);
}

function assertRecord(actual: PersistedRecord | undefined, expected: PersistedRecord, context: string): void {
  assert(actual !== undefined, `${context}: record was absent`);
  assert(
    jsonValuesEqual(encodePersistedRecord(actual), encodePersistedRecord(expected)),
    `${context}: record differed from fixture`,
  );
}

function assertDeepFrozen(value: unknown, context: string): void {
  if (typeof value !== "object" || value === null) return;
  assert(Object.isFrozen(value), `${context}: returned value was not frozen`);
  for (const nested of Object.values(value)) assertDeepFrozen(nested, context);
}

function assertPositioned(
  actual: readonly PositionedRecord[],
  expected: readonly PersistedRecord[],
  context: string,
): void {
  assert(
    actual.length === expected.length,
    `${context}: expected ${expected.length} records, got ${actual.length}`,
  );
  for (let index = 0; index < expected.length; index++) {
    const positioned = actual[index];
    const record = expected[index];
    assert(positioned !== undefined && record !== undefined, `${context}: missing record at index ${index}`);
    const expectedPosition = fixtures.findIndex(({ id }) => id === record.id) + 1;
    assert(expectedPosition > 0, `${context}: expected record was not a known fixture`);
    assertPosition(positioned.position, expectedPosition, context);
    assertRecord(positioned.record, record, context);
  }
}

async function collect(iterable: AsyncIterable<PositionedRecord>): Promise<readonly PositionedRecord[]> {
  const records: PositionedRecord[] = [];
  for await (const record of iterable) records.push(record);
  return records;
}

function idsOf(scan: RecordScan): readonly RecordId[] {
  return scan.records.map(({ record }) => record.id);
}

function expectedForKinds(kinds: readonly RecordKind[]): readonly PersistedRecord[] {
  return fixtures.slice(0, 3).filter((record) => kinds.includes(record.kind));
}

function conformanceCase(
  subject: StoreUnderTest,
  name: string,
  check: (store: RecordStore) => Promise<void>,
): RecordStoreConformanceCase {
  return Object.freeze({
    name: `${subject.name}: ${name}`,
    async run() {
      const fixture = await subject.create();
      try {
        await check(fixture.store);
      } finally {
        await fixture.dispose();
      }
    },
  });
}

export function recordStoreConformance(subject: StoreUnderTest): readonly RecordStoreConformanceCase[] {
  return Object.freeze([
    conformanceCase(subject, "empty head, scan, and stream", async (store) => {
      assertPosition(await store.head(), 0, "empty head");
      const scan = await store.scan();
      assertPosition(scan.head, 0, "empty scan head");
      assert(scan.records.length === 0, "empty scan returned records");
      assert((await collect(store.stream())).length === 0, "empty stream returned records");
      assertDeepFrozen(scan, "empty scan");
    }),

    conformanceCase(subject, "append, get, positions, head, scan, and stream", async (store) => {
      for (let index = 0; index < 3; index++) {
        const record = fixtures[index];
        assert(record !== undefined, `missing conformance fixture ${index}`);
        assertPosition(await store.append(record), index + 1, "append");
        assertPosition(await store.head(), index + 1, "head after append");
        assertRecord(await store.get(record.id), record, "read your writes");
      }
      const scan = await store.scan();
      assertPosition(scan.head, 3, "scan head");
      assertPositioned(scan.records, fixtures.slice(0, 3), "full scan");
      assertPositioned(await collect(store.stream()), fixtures.slice(0, 3), "full stream");
    }),

    conformanceCase(subject, "scan is an atomic snapshot with exact kind filtering", async (store) => {
      for (const record of fixtures.slice(0, 2)) await store.append(record);

      const pendingScan = store.scan();
      const pendingAppend = store.append(fixtures[2] as PersistedRecord);
      const [concurrent, appendedAt] = await Promise.all([pendingScan, pendingAppend]);
      const captured = Number(concurrent.head);
      assert(captured === 2 || captured === 3, `concurrent scan captured impossible head ${captured}`);
      assertPosition(appendedAt, 3, "concurrent append");
      assertPositioned(concurrent.records, fixtures.slice(0, captured), "atomic concurrent scan");

      const all = await store.scan();
      assertPosition(all.head, 3, "unfiltered scan head");
      assertPositioned(all.records, fixtures.slice(0, 3), "unfiltered scan");
      const absentKinds = await store.scan({});
      assertPosition(absentKinds.head, 3, "absent-kinds scan head");
      assertPositioned(absentKinds.records, fixtures.slice(0, 3), "absent-kinds scan");

      const none = await store.scan({ kinds: [] });
      assertPosition(none.head, 3, "empty-filter scan head");
      assert(none.records.length === 0, "empty kind list matched records");

      for (const kinds of [
        ["claim", "entry", "claim"],
        ["entry", "claim"],
      ] as const) {
        const filtered = await store.scan({ kinds });
        assertPosition(filtered.head, 3, "filtered scan head");
        assertPositioned(filtered.records, expectedForKinds(kinds), "kind-filtered scan");
      }
      const relationOnly = await store.scan({ kinds: ["relation"] });
      assertPositioned(relationOnly.records, expectedForKinds(["relation"]), "relation-filtered scan");
    }),

    conformanceCase(subject, "stream uses exclusive after and a first-iteration snapshot", async (store) => {
      await store.append(fixtures[0] as PersistedRecord);
      const createdBeforeAppend = store.stream();
      await store.append(fixtures[1] as PersistedRecord);
      assertPositioned(
        await collect(createdBeforeAppend),
        fixtures.slice(0, 2),
        "stream starts on iteration",
      );

      const iterator = store.stream()[Symbol.asyncIterator]();
      const first = await iterator.next();
      assert(!first.done, "snapshot stream ended before its first record");
      assertPosition(first.value.position, 1, "snapshot stream first record");
      await store.append(fixtures[2] as PersistedRecord);
      const bounded = [first.value];
      for (;;) {
        const next = await iterator.next();
        if (next.done) break;
        bounded.push(next.value);
      }
      assertPositioned(bounded, fixtures.slice(0, 2), "snapshot-bounded stream");

      assertPositioned(
        await collect(store.stream({ after: first.value.position })),
        fixtures.slice(1, 3),
        "exclusive after",
      );
      const atHead = await store.head();
      assert((await collect(store.stream({ after: atHead }))).length === 0, "after=head was not empty");

      let outOfRange: unknown;
      try {
        await collect(store.stream({ after: (Number(atHead) + 1) as StreamPosition }));
      } catch (error) {
        outOfRange = error;
      }
      assert(
        outOfRange instanceof LoreduError && outOfRange.code === "STREAM_POSITION_OUT_OF_RANGE",
        "after>head did not fail with STREAM_POSITION_OUT_OF_RANGE",
      );
    }),

    conformanceCase(
      subject,
      "duplicate ids preserve the original, positions, scan, and head",
      async (store) => {
        const original = fixtures[0] as PersistedRecord;
        await store.append(original);
        const before = await store.scan();
        let duplicate: unknown;
        try {
          await store.append(original);
        } catch (error) {
          duplicate = error;
        }
        assert(
          duplicate instanceof LoreduError && duplicate.code === "DUPLICATE_RECORD_ID",
          "duplicate append did not fail with DUPLICATE_RECORD_ID",
        );
        const after = await store.scan();
        assertPosition(await store.head(), 1, "head after duplicate");
        assertPosition(after.head, Number(before.head), "scan head after duplicate");
        assert(idsOf(after).length === idsOf(before).length, "duplicate changed scan length");
        assert(
          idsOf(after).every((id, index) => id === idsOf(before)[index]),
          "duplicate changed scan records",
        );
        assertRecord(await store.get(original.id), original, "original after duplicate");
        assertPosition(await store.append(fixtures[1] as PersistedRecord), 2, "append after duplicate");
      },
    ),

    conformanceCase(subject, "all reads are detached and recursively frozen", async (store) => {
      const mutable = JSON.parse(
        JSON.stringify(encodePersistedRecord(fixtures[0] as PersistedRecord)),
      ) as PersistedRecord;
      await store.append(mutable);
      (mutable as unknown as { body: string }).body = "mutated after append";

      const firstGet = await store.get(fixtures[0]?.id as RecordId);
      const firstScan = await store.scan();
      const streamed = await collect(store.stream());
      assertRecord(firstGet, fixtures[0] as PersistedRecord, "detached append snapshot");
      assert(firstGet !== mutable, "get returned the caller's append object");
      assert(firstScan.records[0]?.record !== mutable, "scan returned the caller's append object");
      assert(streamed[0]?.record !== mutable, "stream returned the caller's append object");
      assertDeepFrozen(firstGet, "get record");
      assertDeepFrozen(firstScan, "scan snapshot");
      assertDeepFrozen(streamed[0], "stream item");
    }),
  ]);
}
