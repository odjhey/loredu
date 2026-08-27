import { describe, expect, test } from "bun:test";
import * as vm from "node:vm";
import * as kernel from "@loredu/kernel";
import {
  createInstant,
  createLoreduApplication,
  createStreamPosition,
  type EntryDraft,
  LoreduError,
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

  test("present undefined, duplicate provenance, and safe portable object keys have exact semantics", async () => {
    const { app } = assembly();
    for (const field of ["title", "entry_type"] as const) {
      await expect(app.append({ ...draft, [field]: undefined } as EntryDraft)).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        issues: [{ code: "TYPE", path: `/${field}` }],
      });
    }
    for (const field of ["ref", "locator", "snapshot"] as const) {
      await expect(
        app.append({ ...draft, sources: [{ ref: "source", [field]: undefined }] } as EntryDraft),
      ).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        issues: [{ code: "TYPE", path: `/sources/0/${field}` }],
      });
    }
    await expect(app.append({ ...draft, sources: [{}] } as unknown as EntryDraft)).rejects.toMatchObject({
      issues: [{ code: "REQUIRED", path: "/sources/0/ref" }],
    });
    const source = { ref: "source", locator: "part", snapshot: "v1" };
    await expect(app.append({ ...draft, sources: [source, source] })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      issues: [{ code: "DUPLICATE", path: "/sources/1" }],
    });

    const dangerous = JSON.parse(
      '{"\\ud800\\udc00":"supplementary","\\ue000":"bmp","__proto__":{"polluted":true},"constructor":"data","prototype":"data"}',
    );
    const accepted = await app.append({ ...draft, metadata: { "test.safe": dangerous } });
    const copied = accepted.record.metadata["test.safe"] as Readonly<Record<string, unknown>>;
    expect(Object.keys(copied).slice(-2)).toEqual(["", "𐀀"]);
    expect(Object.hasOwn(copied, "__proto__")).toBe(true);
    expect(Object.getOwnPropertyDescriptor(copied, "__proto__")?.value).toEqual({ polluted: true });
    expect(Reflect.get(copied, "constructor")).toBe("data");
    expect(Reflect.get(copied, "prototype")).toBe("data");
    expect(Object.getPrototypeOf(copied)).toBeNull();
    expect((Object.prototype as { polluted?: boolean }).polluted).toBeUndefined();
    expect(Object.isFrozen(copied)).toBe(true);
    const reordered = JSON.parse(
      '{"prototype":"data","constructor":"data","__proto__":{"polluted":true},"\\ue000":"bmp","\\ud800\\udc00":"supplementary"}',
    );
    const reorderedRecord = await app.append({
      ...draft,
      scope: { z: "last", a: "first" },
      metadata: { "test.z": true, "test.safe": reordered, "test.a": true },
    });
    expect(reorderedRecord.record.metadata["test.safe"] as unknown).toEqual(copied);
    expect(Object.keys(reorderedRecord.record.scope)).toEqual(["a", "z"]);
    expect(Object.keys(reorderedRecord.record.metadata)).toEqual(["test.a", "test.safe", "test.z"]);
    const inputProto = Object.getOwnPropertyDescriptor(dangerous, "__proto__");
    const copiedProto = Object.getOwnPropertyDescriptor(copied, "__proto__");
    expect(inputProto).toBeDefined();
    expect(copiedProto).toBeDefined();
    if (!inputProto || !copiedProto) throw new Error("expected own __proto__ descriptors");
    (inputProto.value as { polluted: boolean }).polluted = false;
    expect((copiedProto.value as { polluted: boolean }).polluted).toBe(true);
    await expect(
      app.append({ ...draft, metadata: { "test.bad": { __proto__: { changed: true } } } }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  test("Instant bounds and untrusted Clock returns are strict and phase-owned", async () => {
    expect(Number(createInstant(-62_167_219_200_000))).toBe(-62_167_219_200_000);
    expect(Number(createInstant(253_402_300_799_999))).toBe(253_402_300_799_999);
    for (const value of [-62_167_219_200_001, 253_402_300_800_000, 1.5, "0"]) {
      expect(() => createInstant(value as number)).toThrow(RangeError);
    }
    for (const [instant, rendered] of [
      [-62_167_219_200_000, "0000-01-01T00:00:00.000Z"],
      [253_402_300_799_999, "9999-12-31T23:59:59.999Z"],
    ] as const) {
      const app = createLoreduApplication({
        store: new InMemoryStore(),
        clock: { now: () => instant as never },
        randomSource: new SeededRandomSource(2),
      });
      expect((await app.append(draft)).record.recorded_at).toBe(rendered);
    }
    for (const invalid of ["0", 1.5, 253_402_300_800_000]) {
      let randomCalls = 0;
      let storeCalls = 0;
      const app = createLoreduApplication({
        randomSource: {
          nextBytes: (count) => {
            randomCalls++;
            return new Uint8Array(count);
          },
        },
        clock: { now: () => invalid as never },
        store: {
          get: async () => undefined,
          append: async () => {
            storeCalls++;
            return createStreamPosition(1);
          },
        },
      });
      await expect(app.append(draft)).rejects.toMatchObject({ code: "CLOCK_FAILED", issues: [] });
      expect(randomCalls).toBe(1);
      expect(storeCalls).toBe(0);
    }
  });

  test("entropy uses genuine Uint8 internal slots and an owned intrinsic copy", async () => {
    const crossRealm = vm.runInNewContext("new Uint8Array(10).fill(255)") as Uint8Array;
    const ownAt = new Uint8Array(10);
    Object.defineProperties(ownAt, {
      at: { value: () => 255 },
      length: { value: 1 },
      [Symbol.iterator]: {
        value: () => {
          throw new Error("caller iterator must not run");
        },
      },
    });
    class MisleadingLength extends Uint8Array {
      override get length() {
        return 10;
      }
    }
    const detached = new Uint8Array(10);
    structuredClone(detached.buffer, { transfer: [detached.buffer] });
    const spoof = Object.create(Uint8Array.prototype) as Uint8Array;
    const proxy = new Proxy(new Uint8Array(10), {});

    const accept = async (entropy: Uint8Array, expectedId: string) => {
      const calls: string[] = [];
      const app = createLoreduApplication({
        randomSource: {
          nextBytes: () => {
            calls.push("random");
            return entropy;
          },
        },
        clock: {
          now: () => {
            calls.push("clock");
            return createInstant(0);
          },
        },
        store: {
          get: async () => undefined,
          append: async () => {
            calls.push("store");
            return createStreamPosition(1);
          },
        },
      });
      expect(String((await app.append(draft)).record.id)).toBe(expectedId);
      expect(calls).toEqual(["random", "clock", "store"]);
    };
    await accept(crossRealm, "ent_zzzzzzzzzzzzzzzz");
    await accept(ownAt, "ent_0000000000000000");
    await accept(new Uint8Array(10), "ent_0000000000000000");
    await accept(new (class extends Uint8Array {})(10), "ent_0000000000000000");
    const nonzeroView = new Uint8Array(new ArrayBuffer(14), 2, 10);
    nonzeroView.set([0x00, 0x44, 0x32, 0x14, 0xc7, 0x42, 0x54, 0xb6, 0x35, 0xcf]);
    await accept(nonzeroView, "ent_0123456789abcdef");

    for (const entropy of [new MisleadingLength(1), proxy, detached, spoof, new Uint8ClampedArray(10)]) {
      const calls: string[] = [];
      const app = createLoreduApplication({
        randomSource: {
          nextBytes: () => {
            calls.push("random");
            return entropy as Uint8Array;
          },
        },
        clock: {
          now: () => {
            calls.push("clock");
            return createInstant(0);
          },
        },
        store: {
          get: async () => undefined,
          append: async () => {
            calls.push("store");
            return createStreamPosition(1);
          },
        },
      });
      await expect(app.append(draft)).rejects.toMatchObject({ code: "RANDOM_SOURCE_FAILED", issues: [] });
      expect(calls).toEqual(["random"]);
    }
  });

  test("post-import intrinsic pollution cannot observe or alter entropy snapshots", async () => {
    const bytes = new Uint8Array([0x00, 0x44, 0x32, 0x14, 0xc7, 0x42, 0x54, 0xb6, 0x35, 0xcf]);
    const appendWith = async () => {
      const calls: string[] = [];
      const app = createLoreduApplication({
        randomSource: {
          nextBytes: () => {
            calls.push("random");
            return bytes;
          },
        },
        clock: {
          now: () => {
            calls.push("clock");
            return createInstant(0);
          },
        },
        store: {
          get: async () => undefined,
          append: async () => {
            calls.push("store");
            return createStreamPosition(1);
          },
        },
      });
      const result = await app.append(draft);
      return { id: String(result.record.id), calls };
    };
    const restore = (target: object, key: PropertyKey, descriptor: PropertyDescriptor | undefined) => {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    };

    const atDescriptor = Object.getOwnPropertyDescriptor(Uint8Array.prototype, "at");
    Object.defineProperty(Uint8Array.prototype, "at", { configurable: true, value: () => 255 });
    let result: Awaited<ReturnType<typeof appendWith>>;
    try {
      result = await appendWith();
    } finally {
      restore(Uint8Array.prototype, "at", atDescriptor);
    }
    expect(result).toEqual({ id: "ent_0123456789abcdef", calls: ["random", "clock", "store"] });

    const intrinsicConstructor = Uint8Array;
    const intrinsicPrototype = intrinsicConstructor.prototype;
    const globalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Uint8Array");
    const speciesDescriptor = Object.getOwnPropertyDescriptor(intrinsicConstructor, Symbol.species);
    const callDescriptor = Object.getOwnPropertyDescriptor(Function.prototype, "call");
    const applyDescriptor = Object.getOwnPropertyDescriptor(Function.prototype, "apply");
    const prototypeKeys = ["at", Symbol.iterator, "slice", "subarray", "set", "0"] as const;
    const prototypeDescriptors = prototypeKeys.map(
      (key) => [key, Object.getOwnPropertyDescriptor(intrinsicPrototype, key)] as const,
    );
    const typedArrayPrototype = Object.getPrototypeOf(intrinsicPrototype);
    const callTargets = new Set([
      Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)?.get,
      Object.getOwnPropertyDescriptor(typedArrayPrototype, "length")?.get,
      atDescriptor?.value,
    ]);
    try {
      Object.defineProperty(globalThis, "Uint8Array", {
        configurable: true,
        get() {
          throw new Error("global constructor lookup");
        },
      });
      Object.defineProperty(intrinsicConstructor, Symbol.species, {
        configurable: true,
        get() {
          throw new Error("species lookup");
        },
      });
      for (const key of prototypeKeys)
        Object.defineProperty(intrinsicPrototype, key, {
          configurable: true,
          get() {
            throw new Error(`prototype hook ${String(key)}`);
          },
        });
      Object.defineProperty(Function.prototype, "call", {
        configurable: true,
        value: function (this: (...args: unknown[]) => unknown, receiver: unknown, ...args: unknown[]) {
          if (callTargets.has(this)) throw new Error("call lookup");
          return Reflect.apply(this, receiver, args);
        },
      });
      Object.defineProperty(Function.prototype, "apply", {
        configurable: true,
        value: () => {
          throw new Error("apply lookup");
        },
      });
      result = await appendWith();
    } finally {
      restore(Function.prototype, "apply", applyDescriptor);
      restore(Function.prototype, "call", callDescriptor);
      for (const [key, descriptor] of prototypeDescriptors) restore(intrinsicPrototype, key, descriptor);
      restore(intrinsicConstructor, Symbol.species, speciesDescriptor);
      restore(globalThis, "Uint8Array", globalDescriptor);
    }
    expect(result).toEqual({ id: "ent_0123456789abcdef", calls: ["random", "clock", "store"] });
  });

  test("inherited descriptor-map pollution cannot fabricate absent schema fields", async () => {
    Object.defineProperty(Object.prototype, "body", {
      value: { value: "fabricated", enumerable: true },
      configurable: true,
    });
    try {
      const { body: _body, ...withoutBody } = draft;
      await expect(assembly().app.append(withoutBody as EntryDraft)).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        issues: [{ code: "REQUIRED", path: "/body" }],
      });
    } finally {
      delete (Object.prototype as { body?: unknown }).body;
    }
  });

  test("entropy brand and operational failures are normalized without retries or advancement", async () => {
    for (const entropy of [
      new Array(10).fill(0),
      new Uint8ClampedArray(10),
      new Uint16Array(10),
      new DataView(new ArrayBuffer(10)),
    ]) {
      let clockCalls = 0;
      let storeCalls = 0;
      const app = createLoreduApplication({
        randomSource: { nextBytes: () => entropy as unknown as Uint8Array },
        clock: {
          now: () => {
            clockCalls++;
            return createInstant(0);
          },
        },
        store: {
          get: async () => undefined,
          append: async () => {
            storeCalls++;
            return createStreamPosition(1);
          },
        },
      });
      await expect(app.append(draft)).rejects.toMatchObject({ code: "RANDOM_SOURCE_FAILED", issues: [] });
      expect(clockCalls).toBe(0);
      expect(storeCalls).toBe(0);
    }
    const foreign = new LoreduError("VALIDATION_FAILED", "foreign", [
      { code: "TYPE", path: "/foreign", message: "foreign" },
    ]);
    const randomFailure = createLoreduApplication({
      store: new InMemoryStore(),
      clock: new FixedClock(createInstant(0)),
      randomSource: {
        nextBytes: () => {
          throw foreign;
        },
      },
    });
    await expect(randomFailure.append(draft)).rejects.toMatchObject({
      code: "RANDOM_SOURCE_FAILED",
      issues: [],
    });

    const backing = new InMemoryStore();
    let failure: LoreduError | undefined = foreign;
    const store = {
      get: backing.get.bind(backing),
      async append(record: Parameters<typeof backing.append>[0]) {
        if (failure) throw failure;
        return backing.append(record);
      },
    };
    const app = createLoreduApplication({
      store,
      clock: new FixedClock(createInstant(0)),
      randomSource: new SeededRandomSource(9),
    });
    for (const code of [
      "VALIDATION_FAILED",
      "CLOCK_FAILED",
      "RANDOM_SOURCE_FAILED",
      "STORE_APPEND_FAILED",
    ] as const) {
      failure = new LoreduError(code, "foreign", [{ code: "TYPE", path: "/foreign", message: "foreign" }]);
      await expect(app.append(draft)).rejects.toMatchObject({ code: "STORE_APPEND_FAILED", issues: [] });
    }
    failure = new LoreduError("DUPLICATE_RECORD_ID", "duplicate");
    await expect(app.append(draft)).rejects.toMatchObject({ code: "DUPLICATE_RECORD_ID" });
    failure = undefined;
    expect(Number((await app.append(draft)).position)).toBe(1);
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
