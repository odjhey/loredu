import { expect, test } from "bun:test";
import {
  decodePersistedRecord,
  type PositionedRecord,
  type RecordFilter,
  type RecordScan,
  type RecordStore,
  type RecordStreamOptions,
} from "@loredu/kernel";
import {
  InMemoryStore,
  type RecordStoreConformanceCase,
  type RecordStoreFixture,
  recordStoreConformance,
  type StoreUnderTest,
} from "@loredu/kernel/testing";

// @covers T10, T13, T15
const inMemory: StoreUnderTest = {
  name: "InMemoryStore",
  async create(): Promise<RecordStoreFixture> {
    return {
      store: new InMemoryStore(),
      async dispose() {},
    };
  },
};

const cases: readonly RecordStoreConformanceCase[] = recordStoreConformance(inMemory);
for (const conformance of cases) test(conformance.name, conformance.run);

test("the public conformance kit is reusable, bound, and runner-neutral", async () => {
  expect(cases.length).toBeGreaterThan(0);
  expect(Object.isFrozen(cases)).toBe(true);
  expect(new Set(cases.map(({ name }) => name)).size).toBe(cases.length);
  expect(
    cases.every(({ name, run }) => name.startsWith("InMemoryStore: ") && typeof run === "function"),
  ).toBe(true);

  let creates = 0;
  let disposes = 0;
  const subject: StoreUnderTest = {
    name: "disposal probe",
    async create() {
      creates++;
      return {
        store: new InMemoryStore(),
        async dispose() {
          disposes++;
        },
      };
    },
  };
  const [one] = recordStoreConformance(subject);
  if (!one) throw new Error("conformance kit returned no cases");
  await one.run();
  await one.run();
  expect({ creates, disposes }).toEqual({ creates: 2, disposes: 2 });

  const fullPort: RecordStore = new InMemoryStore();
  const filter: RecordFilter = { kinds: ["entry"] };
  const scan: RecordScan = await fullPort.scan(filter);
  const positioned: readonly PositionedRecord[] = scan.records;
  const options: RecordStreamOptions = { after: await fullPort.head() };
  expect(positioned).toEqual([]);
  expect(typeof fullPort.stream(options)[Symbol.asyncIterator]).toBe("function");
});

test("InMemoryStore stays semantics-ignorant and does not validate record references", async () => {
  const store = new InMemoryStore();
  const danglingClaim = decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "claim",
    id: "clm_0000000000000009",
    recorded_at: "1970-01-01T00:00:00.000Z",
    actor: { type: "agent", id: "loredu.conformance" },
    subject: { type: "fixture", id: "dangling-reference" },
    predicate: "exists",
    value: true,
    confidence: "observed",
    derived_from: ["ent_0000000000000009"],
    scope: {},
    metadata: {},
    sources: [],
  });

  expect(Number(await store.append(danglingClaim))).toBe(1);
  expect(await store.get(danglingClaim.id)).toEqual(danglingClaim);
});
