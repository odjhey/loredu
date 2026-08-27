import { describe, expect, test } from "bun:test";
import * as kernel from "@loredu/kernel";
import {
  type Claim,
  type ClaimDraft,
  claimKeyOf,
  claimKeysEqual,
  createInstant,
  createLoreduApplication,
  createStreamPosition,
  decodePersistedRecord,
  decodeRecordDraft,
  type Entry,
  type EntryDraft,
  encodePersistedRecord,
  type JsonValue,
  jsonValuesEqual,
  LoreduError,
  RECORD_ID_PREFIX,
  RECORD_SCHEMA_ID,
  type RecordDraft,
  type RecordId,
  type Relation,
  type RelationDraft,
  type Resolution,
  type ResolutionDraft,
  recordKindOfIdPrefix,
  type Verification,
  type VerificationDraft,
} from "@loredu/kernel";
import { FixedClock, InMemoryStore, SeededRandomSource } from "@loredu/kernel/testing";

const actor = { type: "agent" as const, id: "test.agent" };
const ids = {
  entry: "ent_0123456789abcdef",
  claim: "clm_0123456789abcdef",
  claim2: "clm_fedcba9876543210",
  relation: "rel_0123456789abcdef",
  resolution: "res_0123456789abcdef",
  verification: "ver_0123456789abcdef",
} as const;
const drafts: readonly [EntryDraft, ClaimDraft, RelationDraft, ResolutionDraft, VerificationDraft] = [
  { kind: "entry", actor, body: "Exact body", entry_type: "investigation.note" },
  {
    kind: "claim",
    actor,
    subject: { type: "code-area", id: "command-registration" },
    predicate: "location",
    value: { nested: ["same", "same"] },
    confidence: "observed",
    perspective: "documented",
    valid_from: "2024-02-29T01:02:03.4+01:00",
    valid_until: "2024-02-29T00:02:03.400Z",
    derived_from: [ids.entry as never],
  },
  {
    kind: "relation",
    actor,
    relation_type: "supports",
    from: ids.entry as never,
    to: ids.claim as never,
  },
  {
    kind: "resolution",
    actor,
    targets: [ids.claim as never, ids.relation as never],
    decision: "prefer",
    replacement: ids.claim2 as never,
    reason: "Cited evidence is newer.",
    effective_at: "2024-01-01T00:00:00Z",
  },
  {
    kind: "verification",
    actor,
    targets: [ids.claim as never],
    verified_against: [{ ref: "https://example.test/source", snapshot: "revision-7" }],
    result: "confirmed",
  },
];

function appWith(bytes?: Uint8Array) {
  const store = new InMemoryStore();
  return {
    store,
    app: createLoreduApplication({
      store,
      clock: new FixedClock(createInstant(0)),
      randomSource: bytes ? { nextBytes: () => bytes } : new SeededRandomSource(123),
    }),
  };
}
function persisted(draft: RecordDraft, id: string): unknown {
  return {
    ...draft,
    schema: RECORD_SCHEMA_ID,
    id,
    recorded_at: "1970-01-01T00:00:00Z",
  };
}
function expectFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectFrozen(child);
}

describe("M0 record/draft family foundation", () => {
  test("all five exact family shapes decode, default, normalize, and reject family excess", () => {
    const publicRecords: readonly [Entry, Claim, Relation, Resolution, Verification] = [
      decodePersistedRecord(persisted(drafts[0], ids.entry)) as Entry,
      decodePersistedRecord(persisted(drafts[1], ids.claim)) as Claim,
      decodePersistedRecord(persisted(drafts[2], ids.relation)) as Relation,
      decodePersistedRecord(persisted(drafts[3], ids.resolution)) as Resolution,
      decodePersistedRecord(persisted(drafts[4], ids.verification)) as Verification,
    ];
    expect(publicRecords.map((record) => record.kind)).toEqual([
      "entry",
      "claim",
      "relation",
      "resolution",
      "verification",
    ]);
    for (const draft of drafts) {
      const decoded = decodeRecordDraft(draft);
      expect(decoded.kind).toBe(draft.kind);
      expect(decoded.scope).toEqual({});
      expect(decoded.metadata).toEqual({});
      expect(decoded.sources).toEqual([]);
      expectFrozen(decoded);
      expect(() => decodeRecordDraft({ ...draft, extra: true })).toThrow(
        expect.objectContaining({
          code: "VALIDATION_FAILED",
          issues: expect.arrayContaining([
            { code: "UNKNOWN_FIELD", path: "/extra", message: expect.any(String) },
          ]),
        }),
      );
    }
    const claim = decodeRecordDraft(drafts[1]) as ClaimDraft;
    expect(claim.valid_from).toBe("2024-02-29T00:02:03.400Z");
    expect(claim.valid_until).toBe("2024-02-29T00:02:03.400Z");
    expect(claim.derived_from).toEqual([ids.entry as never]);
    expect(() =>
      decodeRecordDraft({
        kind: "verification",
        actor,
        targets: [],
        verified_against: [{ ref: "source" }],
        result: "unknown",
      }),
    ).toThrow(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "RANGE", path: "/targets" }),
          expect.objectContaining({ code: "REQUIRED", path: "/verified_against/0/snapshot" }),
          expect.objectContaining({ code: "FORMAT", path: "/result" }),
        ]),
      }),
    );
  });

  test("malformed Claim/plain-data issues aggregate in pointer order without invoking accessors — @covers T03", () => {
    let getterCalls = 0;
    const subject = { type: "Code Area" } as Record<string, unknown>;
    Object.defineProperty(subject, "id", {
      enumerable: true,
      get() {
        getterCalls++;
        return "do-not-read";
      },
    });
    const malformed = {
      kind: "claim",
      actor: { type: "robot", id: " Bad ", extra: true },
      subject,
      predicate: "Not prose allowed",
      value: { nested: Number.NaN },
      derived_from: ["ent_bad", "clm_0123456789abcdef"],
      scope: { Repo: "loredu", okay: "Not Okay" },
      metadata: { unnamespaced: true, "loredu.private": true },
      unexpected: true,
    };
    let thrown: LoreduError | undefined;
    try {
      decodeRecordDraft(malformed);
    } catch (error) {
      thrown = error as LoreduError;
    }
    expect(thrown).toBeInstanceOf(LoreduError);
    expect(thrown?.code).toBe("VALIDATION_FAILED");
    expect(getterCalls).toBe(0);
    const paths = thrown?.issues.map((item) => item.path) ?? [];
    expect(paths).toEqual([...paths].sort());
    expect(thrown?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNKNOWN_FIELD", path: "/actor/extra" }),
        expect.objectContaining({ code: "FORMAT", path: "/actor/id" }),
        expect.objectContaining({ code: "FORMAT", path: "/actor/type" }),
        expect.objectContaining({ code: "REQUIRED", path: "/confidence" }),
        expect.objectContaining({ code: "FORMAT", path: "/derived_from/0" }),
        expect.objectContaining({ code: "FORMAT", path: "/derived_from/1" }),
        expect.objectContaining({ code: "FORMAT", path: "/metadata/loredu.private" }),
        expect.objectContaining({ code: "FORMAT", path: "/metadata/unnamespaced" }),
        expect.objectContaining({ code: "FORMAT", path: "/predicate" }),
        expect.objectContaining({ code: "TYPE", path: "/subject/id" }),
        expect.objectContaining({ code: "UNKNOWN_FIELD", path: "/unexpected" }),
        expect.objectContaining({ code: "FORMAT", path: "/value/nested" }),
      ]),
    );
  });

  test("declared ClaimKey fields are required identifier-safe data and never normalized — @covers T04", () => {
    const base = drafts[1] as ClaimDraft;
    for (const bad of [
      { ...base, subject: { type: "code-area" } },
      { ...base, subject: { type: "code-area", id: "free prose subject" } },
      { ...base, subject: { type: "Code-Area", id: "command-registration" } },
      { ...base, predicate: " Location " },
      { ...base, perspective: "Observed Process" },
    ]) {
      expect(() => decodeRecordDraft(bad)).toThrow(expect.objectContaining({ code: "VALIDATION_FAILED" }));
    }
    const exact = decodeRecordDraft({ ...base, predicate: "location", perspective: "observed-process" });
    expect((exact as ClaimDraft).predicate).toBe("location");
    expect((exact as ClaimDraft).perspective).toBe("observed-process");
  });

  test("canonical drafts, append results, codec results, and store reads detach and deep-freeze — @covers T05", async () => {
    const shared = { repeated: ["a", "a"] };
    const input = {
      ...(drafts[1] as ClaimDraft),
      actor: { ...actor },
      subject: { type: "code-area", id: "command-registration" },
      scope: { repo: "loredu" },
      metadata: { "test.deep": [shared, shared] },
      sources: [{ ref: "source", locator: "part", snapshot: "v1" }],
      derived_from: [ids.entry as never],
    };
    const decoded = decodeRecordDraft(input) as ClaimDraft;
    input.actor.id = "mutated";
    input.subject.id = "mutated";
    input.scope.repo = "mutated";
    shared.repeated[0] = "mutated";
    const firstSource = input.sources[0];
    if (!firstSource) throw new Error("fixture source is missing");
    firstSource.ref = "mutated";
    input.derived_from[0] = "ent_0000000000000000" as never;
    expect(decoded).toMatchObject({
      actor: { id: "test.agent" },
      subject: { id: "command-registration" },
      scope: { repo: "loredu" },
      metadata: { "test.deep": [{ repeated: ["a", "a"] }, { repeated: ["a", "a"] }] },
      sources: [{ ref: "source", locator: "part", snapshot: "v1" }],
      derived_from: [ids.entry],
    });
    expectFrozen(decoded);

    const { app, store } = appWith();
    const appended = await app.append({
      ...drafts[0],
      metadata: { "test.deep": [{ repeated: ["a", "a"] }] },
      sources: [{ ref: "source", snapshot: "v1" }],
    });
    const read = await store.get(appended.record.id);
    expect(read).toEqual(appended.record);
    expectFrozen(appended);
    expectFrozen(read);
    const encoded = encodePersistedRecord(appended.record);
    expectFrozen(encoded);
    expect(encoded).not.toBe(appended.record);
  });

  test("portable JSON codec round-trips semantics and rejects malformed persisted data — @covers T06", () => {
    const dangerous = JSON.parse(
      '{"__proto__":{"safe":true},"constructor":"data","nested":["same","same",{"z":1,"a":2}]}',
    );
    const entryDraft = drafts[0];
    if (!entryDraft) throw new Error("entry fixture is missing");
    const record = decodePersistedRecord({
      ...(persisted(entryDraft, ids.entry) as object),
      metadata: { "other.payload": dangerous },
    });
    const encoded = encodePersistedRecord(record);
    const transported = JSON.parse(JSON.stringify(encoded));
    const decoded = decodePersistedRecord(transported);
    expect(decoded).toEqual(record);
    expect((decoded.metadata["other.payload"] as Record<string, JsonValue>).nested).toEqual([
      "same",
      "same",
      { a: 2, z: 1 },
    ]);
    const payload = decoded.metadata["other.payload"] as Record<string, JsonValue>;
    expect(Object.hasOwn(payload, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(payload)).toBeNull();

    expect(() => decodePersistedRecord({ ...(record as object), excess: true })).toThrow(
      expect.objectContaining({ code: "VALIDATION_FAILED" }),
    );
    expect(() => decodePersistedRecord({ ...(record as object), schema: "loredu.record/v999" })).toThrow(
      expect.objectContaining({
        issues: [expect.objectContaining({ code: "UNKNOWN_SCHEMA", path: "/schema" })],
      }),
    );
    expect(() => decodePersistedRecord({ ...(record as object), id: ids.claim })).toThrow(
      expect.objectContaining({ issues: expect.arrayContaining([expect.objectContaining({ path: "/id" })]) }),
    );
  });

  test("append and decode agree on the metadata key length bound", async () => {
    const { app } = appWith();
    const entryDraft = drafts[0] as EntryDraft;
    const oversizedNamespace = `${"n".repeat(129)}.x`;
    await expect(
      app.append({ ...entryDraft, metadata: { [oversizedNamespace]: true } }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "FORMAT", path: `/metadata/${oversizedNamespace}` }),
      ]),
    });
    const oversizedName = `x.${"n".repeat(129)}`;
    await expect(app.append({ ...entryDraft, metadata: { [oversizedName]: true } })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });

    const boundaryKey = `${"n".repeat(128)}.${"m".repeat(128)}`;
    const accepted = await app.append({ ...entryDraft, metadata: { [boundaryKey]: true } });
    const decoded = decodePersistedRecord(encodePersistedRecord(accepted.record));
    expect(decoded).toEqual(accepted.record);
  });

  test("repeated appends preserve history with distinct ids — @covers T07", async () => {
    const { app, store } = appWith();
    const one = await app.append(drafts[0] as EntryDraft);
    const two = await app.append(drafts[0] as EntryDraft);
    expect(one.record.id).not.toBe(two.record.id);
    expect(await store.get(one.record.id)).toEqual(one.record);
    expect(await store.get(two.record.id)).toEqual(two.record);
    expect(Number(one.position)).toBe(1);
    expect(Number(two.position)).toBe(2);
  });

  test("family prefixes, MSB-first fixtures, prefix checks, and collision behavior are exact — @covers T08", async () => {
    expect(RECORD_ID_PREFIX).toEqual({
      entry: "ent",
      claim: "clm",
      relation: "rel",
      resolution: "res",
      verification: "ver",
    });
    expect(["ent", "clm", "rel", "res", "ver"].map(recordKindOfIdPrefix)).toEqual([
      "entry",
      "claim",
      "relation",
      "resolution",
      "verification",
    ]);
    expect(recordKindOfIdPrefix("ent_")).toBeUndefined();

    const known = new Uint8Array([0x00, 0x44, 0x32, 0x14, 0xc7, 0x42, 0x54, 0xb6, 0x35, 0xcf]);
    for (const draft of drafts) {
      const expected = `${RECORD_ID_PREFIX[draft.kind]}_0123456789abcdef`;
      expect(String(decodePersistedRecord(persisted(draft, expected)).id)).toBe(expected);
    }
    expect(String((await appWith(known).app.append(drafts[0])).record.id)).toBe("ent_0123456789abcdef");
    expect(String((await appWith(new Uint8Array(10)).app.append(drafts[0])).record.id)).toBe(
      "ent_0000000000000000",
    );
    expect(String((await appWith(new Uint8Array(10).fill(0xff)).app.append(drafts[0])).record.id)).toBe(
      "ent_zzzzzzzzzzzzzzzz",
    );

    for (let index = 0; index < drafts.length; index++) {
      const familyDraft = drafts[index];
      const wrongId = familyDraft?.kind === "entry" ? ids.claim : ids.entry;
      if (!familyDraft) throw new Error("family fixture is missing");
      expect(() => decodePersistedRecord(persisted(familyDraft, wrongId))).toThrow(
        expect.objectContaining({ code: "VALIDATION_FAILED" }),
      );
    }
    const collision = appWith(new Uint8Array(10));
    await collision.app.append(drafts[0]);
    await expect(collision.app.append(drafts[0])).rejects.toMatchObject({
      code: "DUPLICATE_RECORD_ID",
    });
  });

  test("scope canonicalization and ClaimKey equality are pair-order insensitive — @covers T85", () => {
    const base = drafts[1] as ClaimDraft;
    const left = claimKeyOf({ ...base, scope: { repo: "loredu", area: "kernel" } });
    const reordered = claimKeyOf({ ...base, scope: { area: "kernel", repo: "loredu" } });
    const added = claimKeyOf({ ...base, scope: { area: "kernel", repo: "loredu", phase: "m0" } });
    const absent = claimKeyOf(base);
    const empty = claimKeyOf({ ...base, scope: {} });
    expect(claimKeysEqual(left, reordered)).toBe(true);
    expect(claimKeysEqual(left, added)).toBe(false);
    expect(claimKeysEqual(absent, empty)).toBe(true);
    expect(Object.keys(left.scope)).toEqual(["area", "repo"]);
    expectFrozen(left);
  });
});

describe("portable value, timestamp, id, and exact family boundaries", () => {
  test("JSON equality ignores object order but preserves types, strings, arrays, and repeats", () => {
    expect(jsonValuesEqual({ a: [1, " x ", "x"] }, { a: [1, " x ", "x"] })).toBe(true);
    expect(jsonValuesEqual({ z: 1, a: 2 }, { a: 2, z: 1 })).toBe(true);
    expect(jsonValuesEqual(1, "1")).toBe(false);
    expect(jsonValuesEqual(["a", "a"], ["a"])).toBe(false);
    expect(jsonValuesEqual(["a", "b"], ["b", "a"])).toBe(false);
    expect(jsonValuesEqual(" x ", "x")).toBe(false);
  });

  test("portable JSON rejects every JS-only value, cycles, sparse arrays, and nested active containers", () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const sparse = new Array(2);
    sparse[1] = true;
    class Custom {
      value = true;
    }
    const bad: unknown[] = [
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -0,
      1n,
      Symbol("x"),
      () => true,
      new Date(0),
      new Map(),
      new Set(),
      new Uint8Array(1),
      new Custom(),
      cycle,
      sparse,
      "bad\ud800",
    ];
    for (const value of bad)
      expect(() => decodeRecordDraft({ ...(drafts[1] as ClaimDraft), value })).toThrow(
        expect.objectContaining({ code: "VALIDATION_FAILED" }),
      );

    let getterCalls = 0;
    const active: Record<string, unknown> = {};
    Object.defineProperty(active, "secret", {
      enumerable: true,
      get() {
        getterCalls++;
        return true;
      },
    });
    expect(() => decodeRecordDraft({ ...(drafts[1] as ClaimDraft), value: { nested: active } })).toThrow();
    expect(getterCalls).toBe(0);
    expect(() =>
      decodeRecordDraft({ ...(drafts[1] as ClaimDraft), value: { [Symbol("hidden")]: true } }),
    ).toThrow();
  });

  test("strict RFC3339 normalization covers extrema, calendar, offset, fraction, and validity order", () => {
    const base = drafts[1] as ClaimDraft;
    const { valid_from: _validFrom, valid_until: _validUntil, ...timestampBase } = base;
    for (const [input, canonical] of [
      ["0000-01-01T00:00:00Z", "0000-01-01T00:00:00.000Z"],
      ["0000-01-01T01:00:00+01:00", "0000-01-01T00:00:00.000Z"],
      ["9999-12-31T23:59:59.999Z", "9999-12-31T23:59:59.999Z"],
      ["9999-12-31T22:59:59.999-01:00", "9999-12-31T23:59:59.999Z"],
      ["2024-02-29T12:30:40.1+08:00", "2024-02-29T04:30:40.100Z"],
      ["2024-01-01T00:00:00.01-14:00", "2024-01-01T14:00:00.010Z"],
    ] as const) {
      expect((decodeRecordDraft({ ...timestampBase, valid_from: input }) as ClaimDraft).valid_from).toBe(
        canonical,
      );
    }
    for (const input of [
      "0000-01-01T00:00:00+00:01",
      "9999-12-31T23:59:59.999-00:01",
      "2023-02-29T00:00:00Z",
      "2024-02-30T00:00:00Z",
      "2024-01-01T24:00:00Z",
      "2024-01-01T00:00:60Z",
      "2024-01-01T00:00:00.0000Z",
      "2024-01-01T00:00:00-00:00",
      "2024-01-01T00:00:00+14:01",
      "2024-01-01T00:00:00+15:00",
      "2024-01-01T00:00:00",
      "+002024-01-01T00:00:00Z",
      "2024-01-01 00:00:00Z",
    ])
      expect(() => decodeRecordDraft({ ...base, valid_from: input })).toThrow(
        expect.objectContaining({ code: "VALIDATION_FAILED" }),
      );
    expect(() =>
      decodeRecordDraft({
        ...base,
        valid_from: "2024-01-02T00:00:00Z",
        valid_until: "2024-01-01T00:00:00Z",
      }),
    ).toThrow(
      expect.objectContaining({
        issues: expect.arrayContaining([expect.objectContaining({ path: "/valid_until" })]),
      }),
    );
  });

  test("ids and set-like duplicates obey exact field-specific shapes", () => {
    const base = drafts[1] as ClaimDraft;
    for (const id of [
      "ent_0123456789abcde",
      "ent_0123456789abcdef0",
      "ent_0123456789abcdei",
      "ent_0123456789ABCDEf",
      "ent-0123456789abcdef",
    ])
      expect(() => decodeRecordDraft({ ...base, derived_from: [id] })).toThrow();
    expect(() => decodeRecordDraft({ ...base, derived_from: [ids.entry, ids.entry] })).toThrow(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "DUPLICATE", path: "/derived_from/1" }),
        ]),
      }),
    );
    expect(() => decodeRecordDraft({ ...(drafts[3] as object), targets: [ids.claim, ids.claim] })).toThrow();
    expect(() =>
      decodeRecordDraft({
        ...(drafts[4] as object),
        verified_against: [
          { ref: "source", snapshot: "v1" },
          { ref: "source", snapshot: "v1" },
        ],
      }),
    ).toThrow();
    const repeatedJson = decodeRecordDraft({ ...base, value: ["same", "same"] }) as ClaimDraft;
    expect(repeatedJson.value).toEqual(["same", "same"]);
  });

  test("public brands, structured errors, and this slice's runtime exports remain exact", () => {
    expect(Object.keys(kernel).sort()).toEqual(
      [
        "LoreduError",
        "RECORD_ID_PREFIX",
        "RECORD_SCHEMA_ID",
        "claimKeyOf",
        "claimKeysEqual",
        "createInstant",
        "createLoreduApplication",
        "createStreamPosition",
        "decodePersistedRecord",
        "decodeRecordDraft",
        "encodePersistedRecord",
        "jsonValuesEqual",
        "recordKindOfIdPrefix",
      ].sort(),
    );
    expect(Number(createStreamPosition(0))).toBe(0);
    expect(() => createStreamPosition(-1)).toThrow(RangeError);
    expect(() => createInstant(253_402_300_800_000)).toThrow(RangeError);
    const error = new LoreduError("VALIDATION_FAILED", "failed", [
      { code: "TYPE", path: "/field", message: "bad" },
    ]);
    expect(error).toMatchObject({ code: "VALIDATION_FAILED", message: "failed" });
    const id: RecordId = ids.entry as never;
    expect(String(id)).toBe(ids.entry);
  });
});
