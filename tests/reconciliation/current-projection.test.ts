import { describe, expect, test } from "bun:test";
import {
  basisEquals,
  type ClaimId,
  type ClaimPolicy,
  createInstant,
  createLoreduApplication,
  decodePersistedRecord,
  type Instant,
  type JsonObject,
  type PersistedRecord,
  type RecordId,
} from "@loredu/kernel";
import { FixedClock, InMemoryStore, SeededRandomSource } from "@loredu/kernel/testing";

const actor = { type: "agent" as const, id: "projection.test" };
const scope = { repo: "loredu" };
const ids = {
  entry: "ent_0000000000000001" as RecordId,
  old: "clm_0000000000000001" as ClaimId,
  amendment: "clm_0000000000000002" as ClaimId,
  later: "clm_0000000000000003" as ClaimId,
  relation: "rel_0000000000000001" as RecordId,
  resolution: "res_0000000000000001" as RecordId,
  verification: "ver_0000000000000001" as RecordId,
} as const;

class CountingClock {
  calls = 0;
  instant: Instant;

  constructor(epochMilliseconds: number) {
    this.instant = createInstant(epochMilliseconds);
  }

  now(): Instant {
    this.calls++;
    return this.instant;
  }
}

function base(kind: PersistedRecord["kind"], id: RecordId, recordedAt: string) {
  return {
    schema: "loredu.record/v1",
    kind,
    id,
    recorded_at: recordedAt,
    actor,
    scope,
    metadata: {},
    sources: [],
  };
}

function claim(
  id: ClaimId,
  value: string,
  recordedAt: string,
  options: {
    readonly validFrom?: string;
    readonly validUntil?: string;
    readonly derivedFrom?: readonly string[];
    readonly sources?: readonly JsonObject[];
    readonly perspective?: string;
  } = {},
): PersistedRecord {
  return decodePersistedRecord({
    ...base("claim", id, recordedAt),
    subject: { type: "agreement", id: "notice" },
    predicate: "notice-period",
    ...(options.perspective === undefined ? {} : { perspective: options.perspective }),
    value,
    confidence: "confirmed",
    ...(options.validFrom === undefined ? {} : { valid_from: options.validFrom }),
    ...(options.validUntil === undefined ? {} : { valid_until: options.validUntil }),
    derived_from: options.derivedFrom ?? [],
    sources: options.sources ?? [],
  });
}

function relation(from: ClaimId, to: ClaimId): PersistedRecord {
  return decodePersistedRecord({
    ...base("relation", ids.relation, "2026-03-05T00:00:00.000Z"),
    relation_type: "supersedes",
    from,
    to,
  });
}

function resolution(
  targets: readonly ClaimId[],
  replacement: ClaimId,
  recordedAt = "2026-03-06T00:00:00.000Z",
): PersistedRecord {
  return decodePersistedRecord({
    ...base("resolution", ids.resolution, recordedAt),
    targets,
    decision: "prefer",
    replacement,
    effective_at: "2026-02-01T00:00:00.000Z",
    reason: "the signed amendment controls from February",
  });
}

async function append(store: InMemoryStore, ...records: readonly PersistedRecord[]): Promise<void> {
  for (const record of records) await store.append(record);
}

function application(
  store: InMemoryStore,
  clock: { now(): Instant } = new FixedClock(createInstant(Date.UTC(2026, 3, 1))),
  claimPolicy?: ClaimPolicy,
) {
  return createLoreduApplication({
    store,
    clock,
    randomSource: new SeededRandomSource(11),
    ...(claimPolicy === undefined ? {} : { claimPolicy }),
  });
}

function knowledge(response: Awaited<ReturnType<ReturnType<typeof application>["current"]>>) {
  return response.result.items.filter((item) => item.kind === "knowledge");
}

function semantic(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(semantic);
  if (typeof value !== "object" || value === null) return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "computed_at" || key === "why" || key === "cursor" || key === "run") continue;
    output[key] = semantic(child);
  }
  return output;
}

function expectDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}

describe("public M2 Current Knowledge projection", () => {
  test("complete Resolution selects its applicable replacement and bounded summaries disclose canonical evidence — @covers T24", async () => {
    const store = new InMemoryStore();
    const entry = decodePersistedRecord({
      ...base("entry", ids.entry, "2026-01-01T00:00:00.000Z"),
      body: "The base agreement and signed amendment were inspected.",
      sources: [{ ref: "agreement", snapshot: "base" }],
    });
    const old = claim(ids.old, "30 days", "2026-01-02T00:00:00.000Z", {
      derivedFrom: [ids.entry],
      sources: [{ ref: "agreement", snapshot: "base" }],
    });
    const amendment = claim(ids.amendment, "60 days", "2026-03-01T00:00:00.000Z", {
      validFrom: "2026-02-01T00:00:00.000Z",
      derivedFrom: [ids.entry],
      sources: [{ ref: "agreement", snapshot: "amendment" }],
    });
    const explicit = relation(ids.amendment, ids.old);
    const judgment = resolution([ids.old, ids.amendment], ids.amendment);
    const verification = decodePersistedRecord({
      ...base("verification", ids.verification, "2026-03-07T00:00:00.000Z"),
      targets: [ids.amendment],
      verified_against: [{ ref: "registry", snapshot: "signed" }],
      result: "confirmed",
    });
    await append(store, entry, old, amendment, explicit, judgment, verification);
    const app = application(store);

    const projected = await app.current({ valid_at: "2026-03-10T00:00:00Z" });
    expect(knowledge(projected)).toHaveLength(1);
    expect(knowledge(projected)[0]).toMatchObject({
      state: "preferred",
      value_count: 1,
      values: [{ value: "60 days", representative: { id: ids.amendment }, claim_count: 1 }],
      history: {
        claim_count: 2,
        derived_relation_count: 1,
        explicit_relation_count: 1,
        resolution_count: 1,
        latest_resolution: { id: ids.resolution },
      },
      evidence: {
        entry_count: 1,
        source_count: 3,
        verification: { confirmed: 1, contradicted: 0, unchanged: 0, needs_revalidation: 0 },
      },
    });
    expect(projected.reconciliation).toMatchObject({
      state: "projection",
      relations: { conflict: 1 },
      knowledge: { preferred: 1, disputed: 0 },
    });
    expect(projected.basis.query).toEqual({
      operation: "current",
      valid_at: "2026-03-10T00:00:00.000Z",
    });
    expectDeepFrozen(projected);
    expect((await app.show(ids.old)).result.record).toEqual(old);
    expect((await app.show(ids.resolution)).result.record).toEqual(judgment);

    await store.append(claim(ids.later, "90 days", "2026-03-08T00:00:00.000Z"));
    const reopened = await app.current({ valid_at: "2026-03-10T00:00:00Z" });
    expect(knowledge(reopened)[0]).toMatchObject({ state: "disputed", value_count: 2 });
    expect(knowledge(reopened)[0]?.values.map((value) => value.value)).toEqual(["60 days", "90 days"]);
  });

  test("a Resolution replacement is the exposed representative while equal-value contributors stay counted", async () => {
    const store = new InMemoryStore();
    await append(
      store,
      claim(ids.old, "60 days", "2026-01-01T00:00:00.000Z"),
      claim(ids.amendment, "60 days", "2026-01-02T00:00:00.000Z"),
      resolution([ids.old, ids.amendment], ids.amendment),
    );
    const result = await application(store).current({ valid_at: "2026-03-10T00:00:00Z" });
    expect(knowledge(result)[0]).toMatchObject({
      state: "preferred",
      values: [{ value: "60 days", representative: { id: ids.amendment }, claim_count: 2 }],
    });
  });

  test("as_of includes exactly the recorded prefix and uses that instant as its implicit valid point — @covers T25", async () => {
    const store = new InMemoryStore();
    await append(
      store,
      claim(ids.old, "src/commands", "2026-01-01T00:00:00.000Z"),
      claim(ids.amendment, "src/cli/commands", "2026-02-01T00:00:00.000Z"),
    );
    const result = await application(store).current({ as_of: "2026-01-15T12:00:00+00:00" });
    expect(Number(result.basis.stream_position)).toBe(2);
    expect(result.basis.query).toEqual({
      operation: "current",
      as_of: "2026-01-15T12:00:00.000Z",
      valid_at: "2026-01-15T12:00:00.000Z",
    });
    expect(knowledge(result)[0]).toMatchObject({
      state: "preferred",
      values: [{ value: "src/commands", representative: { id: ids.old } }],
      history: { claim_count: 1 },
    });
  });

  test("valid_at uses later-recorded knowledge but future Claims and their supersedes edge cannot affect January — @covers T26", async () => {
    const store = new InMemoryStore();
    await append(
      store,
      claim(ids.old, "30 days", "2026-01-01T00:00:00.000Z", {
        validUntil: "2026-01-31T23:59:59.999Z",
      }),
      claim(ids.amendment, "60 days", "2026-03-01T00:00:00.000Z", {
        validFrom: "2026-02-01T00:00:00.000Z",
      }),
      relation(ids.amendment, ids.old),
    );
    const app = application(store);
    const january = await app.current({ valid_at: "2026-01-31T23:59:59.999Z" });
    expect(knowledge(january)[0]).toMatchObject({
      state: "preferred",
      values: [{ value: "30 days", representative: { id: ids.old } }],
      history: { claim_count: 2, explicit_relation_count: 1 },
    });
    const february = await app.current({ valid_at: "2026-02-01T00:00:00.000Z" });
    expect(knowledge(february)[0]).toMatchObject({
      state: "preferred",
      values: [{ value: "60 days", representative: { id: ids.amendment } }],
    });
  });

  test("combined recorded and valid time distinguishes historical belief from later correction — @covers T27", async () => {
    const store = new InMemoryStore();
    await append(
      store,
      claim(ids.old, "30 days", "2026-01-01T00:00:00.000Z"),
      claim(ids.amendment, "60 days", "2026-03-01T00:00:00.000Z", {
        validFrom: "2026-02-01T00:00:00.000Z",
      }),
      resolution([ids.old, ids.amendment], ids.amendment, "2026-03-02T00:00:00.000Z"),
    );
    const app = application(store);
    const historical = await app.current({
      as_of: "2026-01-15T00:00:00Z",
      valid_at: "2026-03-10T00:00:00Z",
    });
    expect(knowledge(historical)[0]?.values[0]?.value).toBe("30 days");
    const corrected = await app.current({
      as_of: "2026-03-10T00:00:00Z",
      valid_at: "2026-03-10T00:00:00Z",
    });
    expect(knowledge(corrected)[0]).toMatchObject({
      state: "preferred",
      values: [{ value: "60 days", representative: { id: ids.amendment } }],
    });
  });

  test("canonical replay reproduces semantic items, counts, ordering, and surface-neutral actions — @covers T28", async () => {
    const firstStore = new InMemoryStore();
    await append(
      firstStore,
      claim(ids.old, "30 days", "2026-01-01T00:00:00.000Z"),
      claim(ids.amendment, "60 days", "2026-03-01T00:00:00.000Z"),
      resolution([ids.old, ids.amendment], ids.amendment),
    );
    const original = await application(firstStore).current({ valid_at: "2026-03-10T00:00:00Z" });
    const replayStore = new InMemoryStore();
    for (const item of (await firstStore.scan()).records) await replayStore.append(item.record);
    const replay = await application(replayStore).current({ valid_at: "2026-03-10T00:00:00Z" });

    expect(basisEquals(original.basis, replay.basis)).toBe(true);
    expect(semantic(original.result.items)).toEqual(semantic(replay.result.items));
    expect(semantic(original.reconciliation)).toEqual(semantic(replay.reconciliation));
    expect(semantic(original.advice)).toEqual(semantic(replay.advice));
    expect((await replayStore.scan()).records.every(({ record }) => record.kind !== "relation")).toBe(true);
  });

  test("Basis, computed time, advice calls, and recomputed combined-stream continuation stay pinned — @covers T29", async () => {
    const store = new InMemoryStore();
    await append(store, claim(ids.old, "30 days", "2026-01-01T00:00:00.000Z"));
    const clock = new CountingClock(Date.UTC(2026, 2, 10));
    let calls = 0;
    let validations = 0;
    let semanticsCalls = 0;
    const policy: ClaimPolicy = {
      id: "test.current-advice",
      version: "1",
      validateClaimKey() {
        validations++;
        return [];
      },
      semantics() {
        semanticsCalls++;
        return "exclusive";
      },
      advise(context) {
        calls++;
        const id = context.claims[0]?.record.id as ClaimId;
        return [
          { code: "review.alpha", claims: [id], details: { ordinal: 1 } },
          { code: "review.beta", claims: [id], details: { ordinal: 2 } },
        ];
      },
    };
    const app = application(store, clock, policy);
    const first = await app.current({ scope, limit: 2 });
    expect(clock.calls).toBe(1);
    expect({ calls, validations, semanticsCalls }).toEqual({ calls: 1, validations: 1, semanticsCalls: 1 });
    expect(first.result.computed_at).toBe("2026-03-10T00:00:00.000Z");
    expect(first.basis.query).toEqual({
      operation: "current",
      scope,
      valid_at: "2026-03-10T00:00:00.000Z",
    });
    expect(first.page).toMatchObject({ returned: 2, total: 3 });
    expect(first.result.items.map((item) => item.kind)).toEqual(["knowledge", "policy-advisory"]);
    expect(first.advice.at(-1)).toMatchObject({ action: "current.read", params: { limit: 2 } });

    await store.append(
      decodePersistedRecord({
        ...base("entry", ids.entry, "2026-03-11T00:00:00.000Z"),
        body: "a concurrent suffix must not enter continuation",
      }),
    );
    const cursor = first.page.cursor as string;
    const second = await app.current({ cursor });
    expect(clock.calls).toBe(1);
    expect({ calls, validations, semanticsCalls }).toEqual({ calls: 2, validations: 2, semanticsCalls: 2 });
    expect(second.result.computed_at).toBe(first.result.computed_at);
    expect(second.basis).toEqual(first.basis);
    expect(second.page).toEqual({ returned: 1, total: 3 });
    expect(second.result.items).toMatchObject([{ kind: "policy-advisory", code: "review.beta" }]);

    const beforeInvalid = { calls, validations, semanticsCalls, clock: clock.calls };
    await expect(app.current({ cursor: "not-a-cursor" })).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect({ calls, validations, semanticsCalls, clock: clock.calls }).toEqual(beforeInvalid);

    let emptyCalls = 0;
    const emptyClock = new CountingClock(Date.UTC(2026, 2, 10));
    const emptyApp = application(new InMemoryStore(), emptyClock, {
      ...policy,
      id: "test.empty-advice",
      advise(context) {
        emptyCalls++;
        expect(context.claims).toEqual([]);
        return [];
      },
    });
    const empty = await emptyApp.current();
    expect(emptyCalls).toBe(1);
    expect(empty.page).toEqual({ returned: 0, total: 0 });
  });

  test("advisory continuation resumes after canonical bound identity even when primary positions descend", async () => {
    const store = new InMemoryStore();
    await append(
      store,
      claim(ids.old, "documented", "2026-01-01T00:00:00.000Z", {
        perspective: "documented",
      }),
      claim(ids.amendment, "observed", "2026-01-02T00:00:00.000Z", {
        perspective: "observed",
      }),
    );
    const policy: ClaimPolicy = {
      id: "test.advisory-order",
      version: "1",
      validateClaimKey: () => [],
      semantics: () => "exclusive",
      advise(context) {
        return [
          {
            code: "alpha",
            claims: [context.claims[1]?.record.id as ClaimId],
            details: {},
          },
          {
            code: "beta",
            claims: [context.claims[0]?.record.id as ClaimId],
            details: {},
          },
        ];
      },
    };
    const app = application(store, undefined, policy);
    const first = await app.current({ limit: 3 });
    expect(first.result.items.map((item) => (item.kind === "knowledge" ? item.kind : item.code))).toEqual([
      "knowledge",
      "knowledge",
      "alpha",
    ]);
    const second = await app.current({ cursor: first.page.cursor as string });
    expect(second.result.items).toMatchObject([{ kind: "policy-advisory", code: "beta" }]);

    let calls = 0;
    const changingApp = application(store, undefined, {
      ...policy,
      id: "test.impossible-resume",
      advise(context) {
        calls++;
        const later = context.claims[1]?.record.id as ClaimId;
        const earlier = context.claims[0]?.record.id as ClaimId;
        return calls === 1
          ? [
              { code: "alpha", claims: [later], details: {} },
              { code: "beta", claims: [earlier], details: {} },
            ]
          : [{ code: "beta", claims: [earlier], details: {} }];
      },
    });
    const changingFirst = await changingApp.current({ limit: 3 });
    await expect(changingApp.current({ cursor: changingFirst.page.cursor as string })).rejects.toMatchObject({
      code: "CURSOR_MISMATCH",
    });
    expect(calls).toBe(2);
  });

  test("store head, query, core, and policy identity govern cache validity without canonical mutation — @covers T30", async () => {
    const store = new InMemoryStore();
    await append(store, claim(ids.old, "30 days", "2026-01-01T00:00:00.000Z"));
    const first = await application(store).current({ valid_at: "2026-03-10T00:00:00Z" });
    expect(Number(first.basis.stream_position)).toBe(1);

    await store.append(
      decodePersistedRecord({
        ...base("entry", ids.entry, "2026-03-11T00:00:00.000Z"),
        body: "even an irrelevant append conservatively stales Current Knowledge",
      }),
    );
    const advanced = await application(store).current({ valid_at: "2026-03-10T00:00:00Z" });
    expect(Number(advanced.basis.stream_position)).toBe(2);
    expect(basisEquals(first.basis, advanced.basis)).toBe(false);

    const changedQuery = await application(store).current({
      scope: { repo: "other" },
      valid_at: "2026-03-10T00:00:00Z",
    });
    expect(changedQuery.basis.stream_position).toBe(advanced.basis.stream_position);
    expect(basisEquals(advanced.basis, changedQuery.basis)).toBe(false);

    const versioned = application(store, undefined, {
      id: "loredu.default",
      version: "2",
      validateClaimKey: () => [],
      semantics: () => "exclusive",
    });
    const changedRuleset = await versioned.current({ valid_at: "2026-03-10T00:00:00Z" });
    expect(changedRuleset.basis.stream_position).toBe(advanced.basis.stream_position);
    expect(basisEquals(advanced.basis, changedRuleset.basis)).toBe(false);
    expect((await store.scan()).records).toHaveLength(2);

    const changedCore = {
      ...advanced.basis,
      ruleset: { ...advanced.basis.ruleset, core: "loredu.reconciliation/v2" },
    } as unknown as typeof advanced.basis;
    expect(basisEquals(advanced.basis, changedCore)).toBe(false);
  });
});
