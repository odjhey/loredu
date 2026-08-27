import { describe, expect, test } from "bun:test";
import * as kernel from "@loredu/kernel";
import {
  createInstant,
  createLoreduApplication,
  createStreamPosition,
  type EntryDraft,
  RECORD_SCHEMA_ID,
  type StreamPosition,
} from "@loredu/kernel";
import { FixedClock, InMemoryStore, SeededRandomSource } from "@loredu/kernel/testing";

const draft: EntryDraft = {
  kind: "entry",
  actor: { type: "agent", id: "test.agent" },
  body: "  exact body\n",
  metadata: { "test.trace": ["same", "same"] },
};
const assembly = () => {
  const store = new InMemoryStore();
  return {
    store,
    app: createLoreduApplication({
      store,
      clock: new FixedClock(createInstant(1_725_000_000_123)),
      randomSource: new SeededRandomSource(42),
    }),
  };
};

describe("public Entry assembly", () => {
  test("exact Entry, envelope defaults, deterministic identity, and positions — @covers T01, T02, T84", async () => {
    const first = assembly();
    const other = assembly();
    const one = await first.app.append(draft);
    const reproduced = await other.app.append(draft);
    const two = await first.app.append(draft);
    expect(one.record).toEqual(reproduced.record);
    expect(two.record.id).not.toBe(one.record.id);
    expect(Number(one.position)).toBe(1);
    expect(Number(two.position)).toBe(2);
    expect(one.record).toEqual({
      kind: "entry",
      actor: draft.actor,
      body: draft.body,
      metadata: { "test.trace": ["same", "same"] },
      schema: RECORD_SCHEMA_ID,
      id: one.record.id,
      recorded_at: "2024-08-30T06:40:00.123Z",
      scope: {},
      sources: [],
    });
    expect(one.record.body).toBe("  exact body\n");
    expect(await first.store.get(one.record.id)).toEqual(one.record);
    expect(Object.isFrozen(one.record)).toBe(true);
  });

  test("assembly rejects caller-owned schema/id/time and failed append does not advance — @covers T87", async () => {
    const { app } = assembly();
    for (const field of ["schema", "id", "recorded_at"] as const) {
      await expect(app.append({ ...draft, [field]: undefined } as EntryDraft)).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        issues: [{ code: "RESERVED_FIELD", path: `/${field}` }],
      });
    }
    const one = await app.append(draft);
    expect(Number(one.position)).toBe(1);
    expect(Number(createStreamPosition(0))).toBe(0);
    const branded: StreamPosition = one.position;
    expect(Number(branded)).toBe(1);
    // @ts-expect-error StreamPosition is opaque; adapters use createStreamPosition.
    const invalid: StreamPosition = 1;
    expect(Number(invalid)).toBe(1);
    expect("InMemoryStore" in kernel).toBe(false);
    expect("FixedClock" in kernel).toBe(false);
    expect("SeededRandomSource" in kernel).toBe(false);
  });

  test("descriptor and portable-data boundaries reject inertly while valid provenance and aliases survive", async () => {
    const { app } = assembly();
    const malformed: unknown[] = [];
    const hiddenStamp = { ...draft };
    Object.defineProperty(hiddenStamp, "id", { value: "ent_hidden", enumerable: false });
    malformed.push(hiddenStamp);
    malformed.push(Object.assign({ ...draft }, { [Symbol("extra")]: true }));
    malformed.push(Object.assign(Object.create({ inherited: true }), draft));
    const extraSources: unknown[] = [];
    Object.defineProperty(extraSources, "extra", { value: true, enumerable: true });
    malformed.push({ ...draft, sources: extraSources });
    const sparse = new Array(1);
    malformed.push({ ...draft, metadata: { "test.value": sparse } });
    malformed.push({ ...draft, body: "bad\ud800" });
    malformed.push({ ...draft, metadata: { "test.value": "bad\udfff" } });
    let getterCalls = 0;
    const accessor = { ...draft };
    Object.defineProperty(accessor, "body", {
      enumerable: true,
      get() {
        getterCalls++;
        return "do not invoke";
      },
    });
    malformed.push(accessor);
    for (const value of malformed)
      await expect(app.append(value as EntryDraft)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(getterCalls).toBe(0);

    const shared = { nested: ["x", "x"] };
    const title = "😀".repeat(256);
    const accepted = await app.append({
      ...draft,
      title,
      sources: [{ ref: "https://example.test/source", locator: "page-1", snapshot: "sha256:abc" }],
      metadata: { "test.aliases": [shared, shared] },
    });
    expect(accepted.record.title).toBe(title);
    expect(accepted.record.sources).toEqual([
      { ref: "https://example.test/source", locator: "page-1", snapshot: "sha256:abc" },
    ]);
    expect(accepted.record.metadata["test.aliases"]).toEqual([shared, shared]);
    shared.nested[0] = "mutated";
    expect(accepted.record.metadata["test.aliases"]).toEqual([
      { nested: ["x", "x"] },
      { nested: ["x", "x"] },
    ]);
  });

  test("invalid adapter positions become controlled failures", async () => {
    for (const position of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      const store = {
        async append() {
          return position as StreamPosition;
        },
        async get() {
          return undefined;
        },
      };
      const app = createLoreduApplication({
        store,
        clock: new FixedClock(createInstant(0)),
        randomSource: new SeededRandomSource(1),
      });
      await expect(app.append(draft)).rejects.toMatchObject({ code: "STORE_APPEND_FAILED" });
    }
  });

  test("capabilities are called once in entropy-clock-store order and collisions do not retry", async () => {
    const calls: string[] = [];
    let randomCalls = 0;
    let clockCalls = 0;
    const randomSource = {
      nextBytes(count: number) {
        calls.push(`random:${count}`);
        randomCalls++;
        return new Uint8Array(count);
      },
    };
    const clock = {
      now() {
        calls.push("clock");
        clockCalls++;
        return createInstant(1_725_000_000_123);
      },
    };
    const backing = new InMemoryStore();
    const store = {
      get: backing.get.bind(backing),
      async append(record: Parameters<typeof backing.append>[0]) {
        calls.push("store");
        return backing.append(record);
      },
    };
    const app = createLoreduApplication({ store, clock, randomSource });
    await app.append(draft);
    expect(calls).toEqual(["random:10", "clock", "store"]);
    calls.length = 0;
    await expect(app.append(draft)).rejects.toMatchObject({ code: "DUPLICATE_RECORD_ID" });
    expect(calls).toEqual(["random:10", "clock", "store"]);
    expect(randomCalls).toBe(2);
    expect(clockCalls).toBe(2);
    const fresh = createLoreduApplication({
      store: backing,
      clock: new FixedClock(createInstant(1_725_000_000_123)),
      randomSource: new SeededRandomSource(7),
    });
    const next = await fresh.append(draft);
    expect(Number(next.position)).toBe(2);
  });
});
