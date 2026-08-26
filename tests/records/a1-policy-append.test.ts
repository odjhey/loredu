import { describe, expect, test } from "bun:test";
import {
  appendRecord,
  basisIdentitiesEqual,
  basisIdentityOf,
  type Clock,
  createApplication,
  DEFAULT_CLAIM_POLICY,
  type EntryDraft,
  type PersistedRecord,
  type RandomSource,
  RECORD_SCHEMA_ID,
  type RecordStore,
  RecordValidationError,
} from "../../packages/kernel/src/index";
import { FixedClock, InMemoryStore, SeededRandomSource } from "../../packages/kernel/testing/index";

const actor = { type: "agent", id: "tester" } as const;
const entry = (body = "evidence"): EntryDraft => ({ kind: "entry", actor, body });
const instant = "2026-08-27T00:00:00Z";

class SpyStore extends InMemoryStore {
  readonly events: string[];
  constructor(events: string[] = []) {
    super();
    this.events = events;
  }
  override async append(record: PersistedRecord) {
    this.events.push("append");
    return super.append(record);
  }
}

describe("A1 application kernel", () => {
  test("stamps a complete immutable record and returns identity plus position", async () => {
    const store = new InMemoryStore();
    const app = createApplication({
      store,
      clock: new FixedClock(instant),
      random: new SeededRandomSource(7),
    });
    const result = await app.append(entry());
    expect(result.position).toBe(1);
    expect(result.record.id).toMatch(/^ent_[0-9a-hjkmnp-tv-z]{16}$/);
    if (result.record.kind !== "entry") throw new Error("expected entry");
    expect(result.record).toEqual({
      schema: RECORD_SCHEMA_ID,
      kind: "entry",
      id: result.record.id,
      recorded_at: instant,
      actor,
      scope: {},
      metadata: {},
      sources: [],
      body: "evidence",
    });
    expect(Object.isFrozen(result.record)).toBe(true);
    expect(await store.get(result.record.id)).toBe(result.record);
    expect(await store.head()).toBe(1);
  });

  test("requests exactly ten bytes before sampling the clock immediately before append", async () => {
    const events: string[] = [];
    const random: RandomSource = {
      nextBytes(count) {
        events.push(`random:${count}`);
        return new Uint8Array(count);
      },
    };
    const clock: Clock = {
      now() {
        events.push("clock");
        return instant;
      },
    };
    const store = new SpyStore(events);
    await appendRecord(entry(), { store, clock, random });
    expect(events).toEqual(["random:10", "clock", "append"]);
  });

  test("rejects wrong entropy count and propagates capability/store failures without a canonical result", async () => {
    const store = new InMemoryStore();
    await expect(
      appendRecord(entry(), {
        store,
        clock: new FixedClock(instant),
        random: { nextBytes: () => new Uint8Array(9) },
      }),
    ).rejects.toMatchObject({ field: "bytes" });
    expect(await store.head()).toBe(0);
    await expect(
      appendRecord(entry(), {
        store,
        clock: {
          now() {
            throw new Error("clock failed");
          },
        },
        random: new SeededRandomSource(1),
      }),
    ).rejects.toThrow("clock failed");
    const failing: RecordStore = {
      append: async () => {
        throw new Error("store failed");
      },
      get: store.get.bind(store),
      stream: store.stream.bind(store),
      head: store.head.bind(store),
    };
    await expect(
      appendRecord(entry(), {
        store: failing,
        clock: new FixedClock(instant),
        random: new SeededRandomSource(1),
      }),
    ).rejects.toThrow("store failed");
  });

  test("rejects caller stamps and duplicate seeded ids", async () => {
    const store = new InMemoryStore();
    const capabilities = { store, clock: new FixedClock(instant), random: new SeededRandomSource(3) };
    await expect(
      appendRecord({ ...entry(), id: "ent_0000000000000000" } as unknown as EntryDraft, capabilities),
    ).rejects.toBeInstanceOf(RecordValidationError);
    await appendRecord(entry(), capabilities);
    await expect(
      appendRecord(entry(), { ...capabilities, random: new SeededRandomSource(3) }),
    ).rejects.toThrow(/duplicate/i);
  });

  test("fresh deterministic assemblies agree and repeated appends consume fresh entropy", async () => {
    const make = () =>
      createApplication({
        store: new InMemoryStore(),
        clock: new FixedClock(instant),
        random: new SeededRandomSource(99),
      });
    const a = make();
    const b = make();
    const firstA = await a.append(entry());
    const firstB = await b.append(entry());
    expect(firstA.record).toEqual(firstB.record);
    expect((await a.append(entry())).record.id).not.toBe(firstA.record.id);
  });

  test("checks every adopted reference family before appending the referrer", async () => {
    const app = createApplication({
      store: new InMemoryStore(),
      clock: new FixedClock(instant),
      random: new SeededRandomSource(5),
    });
    const missingEntry = "ent_0000000000000000" as const;
    const missingClaim = "clm_0000000000000000" as const;
    const missingRelation = "rel_0000000000000000" as const;
    const cases = [
      {
        kind: "claim",
        actor,
        subject: { type: "repo", id: "x" },
        predicate: "p",
        value: 1,
        confidence: "observed",
        derived_from: [missingEntry],
      },
      {
        kind: "relation",
        actor,
        relation_type: "supports",
        from: { kind: "entry", id: missingEntry },
        to: { kind: "claim", id: missingClaim },
      },
      {
        kind: "resolution",
        actor,
        targets: [missingRelation],
        replacement: missingClaim,
        decision: "prefer",
        reason: "because",
      },
      {
        kind: "verification",
        actor,
        targets: [missingClaim],
        verified_against: [{ source: "source" }],
        result: "confirmed",
      },
    ] as const;
    for (const draft of cases) await expect(app.append(draft)).rejects.toThrow(/does not exist/);
    expect(await app.head()).toBe(0);
  });

  test("store is semantic-agnostic and provides read/order/head behavior", async () => {
    const store = new InMemoryStore();
    const app = createApplication({
      store,
      clock: new FixedClock(instant),
      random: new SeededRandomSource(11),
    });
    const one = await app.append(entry("one"));
    const two = await app.append(entry("two"));
    const all = [];
    for await (const item of store.stream()) all.push(item);
    const after = [];
    for await (const item of store.stream(one.position)) after.push(item);
    expect(all.map((x) => x.position)).toEqual([1, 2]);
    expect(after).toEqual([{ position: 2, record: two.record }]);
    expect(await store.get(one.record.id)).toBe(one.record);
    expect(await store.head()).toBe(2);
  });

  test("default policy is deterministic declared-key/exclusive/no-advisories", () => {
    const claim = {
      kind: "claim",
      actor,
      scope: { z: "2", a: "1" },
      subject: { type: "repo", id: "x" },
      predicate: "p",
      value: 1,
      confidence: "observed",
    } as const;
    expect(DEFAULT_CLAIM_POLICY.version).toBe("loredu.claim-policy/default-v1");
    expect(DEFAULT_CLAIM_POLICY.semantics(claim)).toBe("exclusive");
    expect(DEFAULT_CLAIM_POLICY.advisories(claim)).toEqual([]);
    expect(DEFAULT_CLAIM_POLICY.identity(claim).scope).toEqual([
      ["a", "1"],
      ["z", "2"],
    ]);
  });

  test("basis identity excludes display-only computed_at", () => {
    const a = {
      basis: { stream_position: 4, ruleset: "core-v1+policy-v1", query: { scope: { b: "2", a: "1" } } },
      computed_at: "2020-01-01T00:00:00Z",
    };
    const b = {
      basis: { stream_position: 4, ruleset: "core-v1+policy-v1", query: { scope: { a: "1", b: "2" } } },
      computed_at: "2030-01-01T00:00:00Z",
    };
    expect(basisIdentitiesEqual(a, b)).toBe(true);
    expect(basisIdentityOf(a)).toEqual(basisIdentityOf(b));
  });
});
