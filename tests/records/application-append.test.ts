import { describe, expect, test } from "bun:test";
import {
  type Claim,
  type ClaimDraft,
  type ClaimPolicy,
  createInstant,
  createLoreduApplication,
  createStreamPosition,
  decodePersistedRecord,
  type Entry,
  type EntryDraft,
  LoreduError,
  type LoreduIssueCode,
  type PersistedRecord,
  type RecordDraft,
  type RecordStore,
  type Relation,
  type Resolution,
  type Verification,
} from "@loredu/kernel";
import { FixedClock, InMemoryStore, SeededRandomSource } from "@loredu/kernel/testing";

const actor = { type: "agent" as const, id: "test.agent" };
const id = {
  entry0: "ent_0000000000000000",
  entry1: "ent_0000000000000001",
  claim0: "clm_0000000000000000",
  claim1: "clm_0000000000000001",
  relation0: "rel_0000000000000000",
} as const;

function frozenDeep(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(frozenDeep);
}

function persisted(kind: "entry" | "claim" | "relation"): PersistedRecord {
  if (kind === "entry")
    return decodePersistedRecord({
      schema: "loredu.record/v1",
      kind,
      id: id.entry0,
      recorded_at: "1970-01-01T00:00:00.000Z",
      actor,
      body: "reference fixture",
      scope: {},
      metadata: {},
      sources: [],
    });
  if (kind === "claim")
    return decodePersistedRecord({
      schema: "loredu.record/v1",
      kind,
      id: id.claim0,
      recorded_at: "1970-01-01T00:00:00.000Z",
      actor,
      subject: { type: "fixture", id: "claim" },
      predicate: "exists",
      value: true,
      confidence: "observed",
      derived_from: [],
      scope: {},
      metadata: {},
      sources: [],
    });
  return decodePersistedRecord({
    schema: "loredu.record/v1",
    kind,
    id: id.relation0,
    recorded_at: "1970-01-01T00:00:00.000Z",
    actor,
    relation_type: "supports",
    from: id.entry0,
    to: id.claim0,
    scope: {},
    metadata: {},
    sources: [],
  });
}

function inertCapabilities(store: RecordStore, calls: string[]) {
  return createLoreduApplication({
    store,
    randomSource: {
      nextBytes() {
        calls.push("random");
        return new Uint8Array(10);
      },
    },
    clock: {
      now() {
        calls.push("clock");
        return createInstant(0);
      },
    },
  });
}

const claimDraft = (entryId?: string): ClaimDraft => ({
  kind: "claim",
  actor,
  subject: { type: "code-area", id: "application" },
  predicate: "implementation-status",
  value: "complete",
  confidence: "observed",
  ...(entryId === undefined ? {} : { derived_from: [entryId as never] }),
});

describe("generic M0 application append", () => {
  test("all five draft families append through the family-narrowed public API", async () => {
    const store = new InMemoryStore();
    const app = createLoreduApplication({
      store,
      clock: new FixedClock(createInstant(1_725_000_000_123)),
      randomSource: new SeededRandomSource(19),
    });

    const entry = await app.append({ kind: "entry", actor, body: "Evidence" });
    const narrowedEntry: Entry = entry.record;
    const claim = await app.append(claimDraft(entry.record.id));
    const narrowedClaim: Claim = claim.record;
    const replacement = await app.append({ ...claimDraft(), value: "replacement" });
    const relation = await app.append({
      kind: "relation",
      actor,
      relation_type: "supports",
      from: entry.record.id,
      to: claim.record.id,
    });
    const narrowedRelation: Relation = relation.record;
    const resolution = await app.append({
      kind: "resolution",
      actor,
      targets: [claim.record.id, relation.record.id],
      decision: "prefer",
      replacement: replacement.record.id,
      reason: "The replacement has newer evidence.",
    });
    const narrowedResolution: Resolution = resolution.record;
    const verification = await app.append({
      kind: "verification",
      actor,
      targets: [claim.record.id],
      verified_against: [{ ref: "https://example.test/source", snapshot: "revision-7" }],
      result: "confirmed",
    });
    const narrowedVerification: Verification = verification.record;

    expect([
      narrowedEntry.kind,
      narrowedClaim.kind,
      narrowedRelation.kind,
      narrowedResolution.kind,
      narrowedVerification.kind,
    ]).toEqual(["entry", "claim", "relation", "resolution", "verification"]);
    expect([
      entry.record.id,
      claim.record.id,
      relation.record.id,
      resolution.record.id,
      verification.record.id,
    ]).toEqual([
      expect.stringMatching(/^ent_/),
      expect.stringMatching(/^clm_/),
      expect.stringMatching(/^rel_/),
      expect.stringMatching(/^res_/),
      expect.stringMatching(/^ver_/),
    ]);
    expect(
      [entry, claim, replacement, relation, resolution, verification].map((result) =>
        Number(result.position),
      ),
    ).toEqual([1, 2, 3, 4, 5, 6]);
    for (const result of [entry, claim, replacement, relation, resolution, verification]) {
      expect(frozenDeep(result)).toBe(true);
      const read = await store.get(result.record.id);
      expect(read).toEqual(result.record);
      expect(read).not.toBe(result.record);
      expect(frozenDeep(read)).toBe(true);
    }
  });

  test("every reference path aggregates in field/index order before stamping — @covers T19", async () => {
    const cases: readonly {
      readonly draft: RecordDraft;
      readonly returned: readonly (PersistedRecord | undefined)[];
      readonly expectedGets: readonly string[];
      readonly expectedIssues: readonly { code: LoreduIssueCode; path: string }[];
    }[] = [
      {
        draft: claimDraft(id.entry0),
        returned: [undefined],
        expectedGets: [id.entry0],
        expectedIssues: [{ code: "REFERENCE_NOT_FOUND", path: "/derived_from/0" }],
      },
      {
        draft: { ...claimDraft(), derived_from: [id.entry0 as never, id.entry1 as never] },
        returned: [undefined, persisted("claim")],
        expectedGets: [id.entry0, id.entry1],
        expectedIssues: [
          { code: "REFERENCE_NOT_FOUND", path: "/derived_from/0" },
          { code: "REFERENCE_KIND_MISMATCH", path: "/derived_from/1" },
        ],
      },
      {
        draft: {
          kind: "relation",
          actor,
          relation_type: "supports",
          from: id.entry0 as never,
          to: id.claim0 as never,
        },
        returned: [undefined, persisted("entry")],
        expectedGets: [id.entry0, id.claim0],
        expectedIssues: [
          { code: "REFERENCE_NOT_FOUND", path: "/from" },
          { code: "REFERENCE_KIND_MISMATCH", path: "/to" },
        ],
      },
      {
        draft: {
          kind: "resolution",
          actor,
          targets: [id.claim0 as never, id.relation0 as never],
          replacement: id.claim1 as never,
          decision: "prefer",
          reason: "fixture",
        },
        returned: [undefined, persisted("entry"), persisted("relation")],
        expectedGets: [id.claim0, id.relation0, id.claim1],
        expectedIssues: [
          { code: "REFERENCE_NOT_FOUND", path: "/targets/0" },
          { code: "REFERENCE_KIND_MISMATCH", path: "/targets/1" },
          { code: "REFERENCE_KIND_MISMATCH", path: "/replacement" },
        ],
      },
      {
        draft: {
          kind: "verification",
          actor,
          targets: [id.claim0 as never, id.claim1 as never],
          verified_against: [{ ref: "source", snapshot: "v1" }],
          result: "confirmed",
        },
        returned: [undefined, persisted("entry")],
        expectedGets: [id.claim0, id.claim1],
        expectedIssues: [
          { code: "REFERENCE_NOT_FOUND", path: "/targets/0" },
          { code: "REFERENCE_KIND_MISMATCH", path: "/targets/1" },
        ],
      },
    ];

    for (const item of cases) {
      const calls: string[] = [];
      let read = 0;
      const store: RecordStore = {
        async get(reference) {
          calls.push(`get:${reference}`);
          return item.returned[read++];
        },
        async append() {
          calls.push("append");
          return createStreamPosition(1);
        },
      };
      const app = inertCapabilities(store, calls);
      let failure: LoreduError | undefined;
      try {
        await app.append(item.draft);
      } catch (error) {
        failure = error as LoreduError;
      }
      expect(failure).toMatchObject({ code: "REFERENCE_CHECK_FAILED" });
      expect(failure?.issues.map(({ code, path }) => ({ code, path }))).toEqual([...item.expectedIssues]);
      expect(calls).toEqual(item.expectedGets.map((reference) => `get:${reference}`));
    }

    const mismatchedIdCalls: string[] = [];
    const mismatchedId = inertCapabilities(
      {
        async get(reference) {
          mismatchedIdCalls.push(`get:${reference}`);
          return persisted("claim");
        },
        async append() {
          mismatchedIdCalls.push("append");
          return createStreamPosition(1);
        },
      },
      mismatchedIdCalls,
    );
    await expect(mismatchedId.append(claimDraft(id.entry1))).rejects.toMatchObject({
      code: "REFERENCE_CHECK_FAILED",
      issues: [],
    });
    expect(mismatchedIdCalls).toEqual([`get:${id.entry1}`]);

    const calls: string[] = [];
    const sourceOnly = inertCapabilities(
      {
        async get(reference) {
          calls.push(`get:${reference}`);
          return undefined;
        },
        async append() {
          calls.push("append");
          return createStreamPosition(1);
        },
      },
      calls,
    );
    await sourceOnly.append({
      kind: "entry",
      actor,
      body: "External evidence",
      sources: [{ ref: "https://example.test", snapshot: "v1" }],
    });
    expect(calls).toEqual(["random", "clock", "append"]);
  });

  test("validation, policy, references, capabilities, freeze, and append have exact phase ownership — @covers T80", async () => {
    const events: string[] = [];
    const reference = persisted("entry");
    const policy: ClaimPolicy = {
      id: "consumer.policy",
      version: "1",
      validateClaimKey(key) {
        events.push("policy.validate");
        expect(key).toEqual({
          scope: {},
          subject: { type: "code-area", id: "application" },
          predicate: "implementation-status",
        });
        expect(frozenDeep(key)).toBe(true);
        return Object.freeze([]);
      },
      semantics() {
        events.push("policy.semantics");
        return "coexisting";
      },
    };
    const store: RecordStore = {
      async get(referenceId) {
        events.push(`get:${referenceId}`);
        return reference;
      },
      async append(record) {
        events.push("append");
        expect(record).toMatchObject({ schema: "loredu.record/v1", kind: "claim" });
        expect(frozenDeep(record)).toBe(true);
        return createStreamPosition(1);
      },
    };
    const app = createLoreduApplication({
      store,
      claimPolicy: policy,
      randomSource: {
        nextBytes(count) {
          events.push(`random:${count}`);
          return new Uint8Array(count);
        },
      },
      clock: {
        now() {
          events.push("clock");
          return createInstant(0);
        },
      },
    });
    await app.append(claimDraft(id.entry0));
    expect(events).toEqual([
      "policy.validate",
      "policy.semantics",
      `get:${id.entry0}`,
      "random:10",
      "clock",
      "append",
    ]);

    events.length = 0;
    await expect(
      app.append({ ...claimDraft(), predicate: "Bad predicate", confidence: "invalid" } as never),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      issues: expect.arrayContaining([
        expect.objectContaining({ path: "/confidence" }),
        expect.objectContaining({ path: "/predicate" }),
      ]),
    });
    expect(events).toEqual([]);

    const policyIssue = { code: "FORMAT" as const, path: "/predicate", message: "rejected" };
    let semanticsCalls = 0;
    const rejecting = createLoreduApplication({
      store,
      clock: new FixedClock(createInstant(0)),
      randomSource: new SeededRandomSource(1),
      claimPolicy: {
        ...policy,
        validateClaimKey: () => [policyIssue],
        semantics: () => {
          semanticsCalls++;
          return "exclusive";
        },
      },
    });
    await expect(rejecting.append(claimDraft())).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      issues: [{ code: "FORMAT", path: "/predicate" }],
    });
    expect(semanticsCalls).toBe(0);

    for (const invalidPolicy of [
      { validateClaimKey: () => ({}) as never, semantics: () => "exclusive" as const },
      { validateClaimKey: () => [], semantics: () => "invalid" as never },
      {
        validateClaimKey: () => {
          throw new LoreduError("CLOCK_FAILED", "foreign");
        },
        semantics: () => "exclusive" as const,
      },
    ]) {
      const malformed = createLoreduApplication({
        store,
        clock: new FixedClock(createInstant(0)),
        randomSource: new SeededRandomSource(1),
        claimPolicy: { id: "consumer.policy", version: "1", ...invalidPolicy },
      });
      await expect(malformed.append(claimDraft())).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
      });
    }

    const referenceFailure = createLoreduApplication({
      store: {
        get: async () => {
          throw new LoreduError("STORE_APPEND_FAILED", "foreign", [
            { code: "TYPE", path: "/foreign", message: "foreign" },
          ]);
        },
        append: async () => createStreamPosition(1),
      },
      clock: new FixedClock(createInstant(0)),
      randomSource: new SeededRandomSource(1),
    });
    await expect(referenceFailure.append(claimDraft(id.entry0))).rejects.toMatchObject({
      code: "REFERENCE_CHECK_FAILED",
      issues: [],
    });

    const backing = new InMemoryStore();
    let attempted: PersistedRecord | undefined;
    let fail = true;
    const failureStore: RecordStore = {
      get: backing.get.bind(backing),
      async append(record) {
        attempted = record;
        if (fail) throw new LoreduError("CLOCK_FAILED", "foreign");
        return backing.append(record);
      },
    };
    const failureApp = createLoreduApplication({
      store: failureStore,
      clock: new FixedClock(createInstant(0)),
      randomSource: new SeededRandomSource(3),
    });
    await expect(failureApp.append({ kind: "entry", actor, body: "first" })).rejects.toMatchObject({
      code: "STORE_APPEND_FAILED",
      issues: [],
      message: expect.stringContaining("ent_"),
    });
    expect(attempted).toBeDefined();
    if (!attempted) throw new Error("store did not receive the attempted record");
    expect(await backing.get(attempted.id)).toBeUndefined();
    fail = false;
    expect(Number((await failureApp.append({ kind: "entry", actor, body: "second" })).position)).toBe(1);
  });

  test("reserved/excess/active draft attacks never reach the store, which receives only complete frozen records — @covers T83", async () => {
    const drafts: readonly RecordDraft[] = [
      { kind: "entry", actor, body: "entry" },
      claimDraft(),
      {
        kind: "relation",
        actor,
        relation_type: "supports",
        from: id.entry0 as never,
        to: id.claim0 as never,
      },
      {
        kind: "resolution",
        actor,
        targets: [id.claim0 as never],
        decision: "prefer",
        reason: "reason",
      },
      {
        kind: "verification",
        actor,
        targets: [id.claim0 as never],
        verified_against: [{ ref: "source", snapshot: "v1" }],
        result: "confirmed",
      },
    ];
    let gets = 0;
    let appends = 0;
    const app = createLoreduApplication({
      store: {
        get: async () => {
          gets++;
          return undefined;
        },
        append: async () => {
          appends++;
          return createStreamPosition(1);
        },
      },
      clock: new FixedClock(createInstant(0)),
      randomSource: new SeededRandomSource(1),
    });

    for (const draft of drafts) {
      for (const stamp of ["schema", "id", "recorded_at"] as const)
        await expect(app.append({ ...draft, [stamp]: undefined } as never)).rejects.toMatchObject({
          code: "VALIDATION_FAILED",
          issues: expect.arrayContaining([
            expect.objectContaining({ code: "RESERVED_FIELD", path: `/${stamp}` }),
          ]),
        });
      await expect(app.append({ ...draft, excess: true } as never)).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        issues: expect.arrayContaining([expect.objectContaining({ path: "/excess" })]),
      });
      await expect(
        app.append(Object.assign(Object.create({ inherited: true }), draft) as never),
      ).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
      });
    }

    let getterCalls = 0;
    const active = { kind: "entry", actor } as Record<string, unknown>;
    Object.defineProperty(active, "body", {
      enumerable: true,
      get() {
        getterCalls++;
        return "must not run";
      },
    });
    await expect(app.append(active as unknown as EntryDraft)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(getterCalls).toBe(0);
    expect(gets).toBe(0);
    expect(appends).toBe(0);
  });

  test("policy callbacks are captured at assembly and active issue output is rejected inertly", async () => {
    let originalValidationCalls = 0;
    let originalSemanticsCalls = 0;
    let replacementCalls = 0;
    const mutablePolicy = {
      id: "consumer.policy",
      version: "1",
      validateClaimKey() {
        originalValidationCalls++;
        return Object.freeze([]);
      },
      semantics() {
        originalSemanticsCalls++;
        return "exclusive" as const;
      },
    };
    const assembled = createLoreduApplication({
      store: new InMemoryStore(),
      clock: new FixedClock(createInstant(0)),
      randomSource: new SeededRandomSource(1),
      claimPolicy: mutablePolicy,
    });
    mutablePolicy.validateClaimKey = () => {
      replacementCalls++;
      throw new Error("replacement validator must not run");
    };
    mutablePolicy.semantics = () => {
      replacementCalls++;
      throw new Error("replacement semantics must not run");
    };
    await expect(assembled.append(claimDraft())).resolves.toMatchObject({
      record: { kind: "claim" },
      position: 1,
    });
    expect({ originalValidationCalls, originalSemanticsCalls, replacementCalls }).toEqual({
      originalValidationCalls: 1,
      originalSemanticsCalls: 1,
      replacementCalls: 0,
    });

    let getterCalls = 0;
    let semanticsCalls = 0;
    const activeIssue = { path: "/predicate", message: "must not execute" } as Record<string, unknown>;
    Object.defineProperty(activeIssue, "code", {
      enumerable: true,
      get() {
        getterCalls++;
        return "FORMAT";
      },
    });
    const events: string[] = [];
    const activeOutput = createLoreduApplication({
      store: {
        get: async () => {
          events.push("get");
          return undefined;
        },
        append: async () => {
          events.push("append");
          return createStreamPosition(1);
        },
      },
      clock: {
        now() {
          events.push("clock");
          return createInstant(0);
        },
      },
      randomSource: {
        nextBytes(count) {
          events.push("random");
          return new Uint8Array(count);
        },
      },
      claimPolicy: {
        id: "consumer.policy",
        version: "1",
        validateClaimKey: () => [activeIssue] as never,
        semantics: () => {
          semanticsCalls++;
          return "exclusive";
        },
      },
    });
    await expect(activeOutput.append(claimDraft())).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      issues: [{ code: "TYPE", path: "" }],
    });
    expect(getterCalls).toBe(0);
    expect(semanticsCalls).toBe(0);
    expect(events).toEqual([]);
  });

  test("InMemoryStore snapshots direct inputs and never advances on duplicate or malformed append", async () => {
    const store = new InMemoryStore();
    const mutable = JSON.parse(JSON.stringify(persisted("entry"))) as PersistedRecord;
    expect(Number(await store.append(mutable))).toBe(1);
    (mutable as unknown as { body: string }).body = "mutated";
    expect(await store.get(mutable.id)).toMatchObject({ body: "reference fixture" });
    await expect(store.append(persisted("entry"))).rejects.toMatchObject({ code: "DUPLICATE_RECORD_ID" });
    await expect(store.append({ ...persisted("entry"), id: "bad" } as never)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    const next = decodePersistedRecord({ ...persisted("entry"), id: id.entry1 });
    expect(Number(await store.append(next))).toBe(2);
  });
});
