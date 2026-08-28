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
  type RelationId,
  type Resolution,
} from "@loredu/kernel";
import { FixedClock, InMemoryStore, SeededRandomSource } from "@loredu/kernel/testing";

const actor = { type: "agent" as const, id: "projection.test" };
const scope = { repo: "loredu" };
const ids = {
  entry: "ent_0000000000000001" as RecordId,
  old: "clm_0000000000000001" as ClaimId,
  amendment: "clm_0000000000000002" as ClaimId,
  later: "clm_0000000000000003" as ClaimId,
  outside: "clm_0000000000000004" as ClaimId,
  relation: "rel_0000000000000001" as RelationId,
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
    readonly scope?: Readonly<Record<string, string>>;
    readonly subjectId?: string;
    readonly predicate?: string;
  } = {},
): PersistedRecord {
  return decodePersistedRecord({
    ...base("claim", id, recordedAt),
    ...(options.scope === undefined ? {} : { scope: options.scope }),
    subject: { type: "agreement", id: options.subjectId ?? "notice" },
    predicate: options.predicate ?? "notice-period",
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
  targets: readonly (ClaimId | RelationId)[],
  replacement: ClaimId | undefined,
  recordedAt = "2026-03-06T00:00:00.000Z",
  options: {
    readonly decision?: Resolution["decision"];
    readonly effectiveAt?: string;
  } = {},
): PersistedRecord {
  return decodePersistedRecord({
    ...base("resolution", ids.resolution, recordedAt),
    targets,
    decision: options.decision ?? "prefer",
    ...(replacement === undefined ? {} : { replacement }),
    effective_at: options.effectiveAt ?? "2026-02-01T00:00:00.000Z",
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

  test("scoped Resolution eligibility uses full visible references while output, coverage, and advice stay local", async () => {
    const selectedScope = { repo: "selected" };
    const outsideScope = { repo: "outside" };
    const selectedOld = claim(ids.old, "30 days", "2026-01-01T00:00:00.000Z", {
      scope: selectedScope,
    });
    const selectedNew = claim(ids.amendment, "60 days", "2026-01-02T00:00:00.000Z", {
      scope: selectedScope,
    });
    const outside = claim(ids.outside, "outside", "2026-01-03T00:00:00.000Z", {
      scope: outsideScope,
      subjectId: "outside-policy",
      predicate: "state",
    });

    const completeStore = new InMemoryStore();
    await append(
      completeStore,
      selectedOld,
      selectedNew,
      outside,
      resolution([ids.old, ids.amendment, ids.outside], ids.amendment),
    );
    let adviceCalls = 0;
    let adviceClaimIds: readonly ClaimId[] = [];
    let adviceResolutionIds: readonly RecordId[] = [];
    const complete = await application(completeStore, undefined, {
      id: "test.scoped-visibility",
      version: "1",
      validateClaimKey: () => [],
      semantics: () => "exclusive",
      advise(context) {
        adviceCalls++;
        adviceClaimIds = context.claims.map(({ record }) => record.id);
        adviceResolutionIds = context.resolutions.map(({ record }) => record.id);
        return [];
      },
    }).current({ scope: selectedScope, valid_at: "2026-03-10T00:00:00Z" });
    expect(adviceCalls).toBe(1);
    expect(adviceClaimIds).toEqual([ids.old, ids.amendment]);
    expect(adviceResolutionIds).toEqual([]);
    expect(knowledge(complete)).toHaveLength(1);
    expect(knowledge(complete)[0]).toMatchObject({
      key: { scope: selectedScope },
      state: "preferred",
      values: [{ value: "60 days", representative: { id: ids.amendment } }],
      history: { claim_count: 2, resolution_count: 1, latest_resolution: { id: ids.resolution } },
    });
    expect(JSON.stringify(complete.result.items)).not.toContain(ids.outside);

    const incompleteStore = new InMemoryStore();
    await append(
      incompleteStore,
      selectedOld,
      selectedNew,
      outside,
      resolution([ids.old, ids.outside], ids.old),
    );
    const incomplete = await application(incompleteStore).current({
      scope: selectedScope,
      valid_at: "2026-03-10T00:00:00Z",
    });
    expect(knowledge(incomplete)).toHaveLength(1);
    expect(knowledge(incomplete)[0]).toMatchObject({
      state: "disputed",
      value_count: 2,
      history: { claim_count: 2, resolution_count: 1 },
    });

    const forwardStore = new InMemoryStore();
    await append(
      forwardStore,
      selectedOld,
      selectedNew,
      resolution([ids.old, ids.amendment, ids.outside], ids.amendment),
      outside,
    );
    const forward = await application(forwardStore).current({
      scope: selectedScope,
      valid_at: "2026-03-10T00:00:00Z",
    });
    expect(knowledge(forward)).toHaveLength(1);
    expect(knowledge(forward)[0]).toMatchObject({
      state: "disputed",
      value_count: 2,
      history: { claim_count: 2, resolution_count: 0 },
    });
    expect(JSON.stringify(forward.result.items)).not.toContain(ids.outside);

    const missingStore = new InMemoryStore();
    await append(
      missingStore,
      selectedOld,
      selectedNew,
      resolution([ids.old, ids.amendment, ids.outside], ids.amendment),
    );
    const missing = await application(missingStore).current({
      scope: selectedScope,
      valid_at: "2026-03-10T00:00:00Z",
    });
    expect(knowledge(missing)[0]).toMatchObject({
      state: "disputed",
      value_count: 2,
      history: { resolution_count: 0 },
    });

    const asOfStore = new InMemoryStore();
    const excludedAtAsOf = claim(ids.outside, "outside", "2026-04-01T00:00:00.000Z", {
      scope: outsideScope,
      subjectId: "outside-policy",
      predicate: "state",
    });
    await append(
      asOfStore,
      excludedAtAsOf,
      selectedOld,
      selectedNew,
      resolution([ids.old, ids.amendment, ids.outside], ids.amendment),
    );
    const excluded = await application(asOfStore).current({
      scope: selectedScope,
      as_of: "2026-03-10T00:00:00Z",
      valid_at: "2026-03-10T00:00:00Z",
    });
    expect(knowledge(excluded)[0]).toMatchObject({
      state: "disputed",
      value_count: 2,
      history: { resolution_count: 0 },
    });

    const relationStore = new InMemoryStore();
    await append(
      relationStore,
      selectedOld,
      selectedNew,
      relation(ids.amendment, ids.outside),
      resolution([ids.old, ids.amendment, ids.relation], ids.amendment),
      outside,
    );
    const relationTarget = await application(relationStore).current({
      scope: selectedScope,
      valid_at: "2026-03-10T00:00:00Z",
    });
    expect(knowledge(relationTarget)[0]).toMatchObject({
      state: "preferred",
      values: [{ value: "60 days", representative: { id: ids.amendment } }],
      history: { explicit_relation_count: 0, resolution_count: 1 },
    });
  });

  test("incomplete Resolutions and future replacements cannot select Current Knowledge", async () => {
    const incompleteStore = new InMemoryStore();
    await append(
      incompleteStore,
      claim(ids.old, "30 days", "2026-01-01T00:00:00.000Z"),
      claim(ids.amendment, "60 days", "2026-01-02T00:00:00.000Z"),
      claim(ids.later, "90 days", "2026-01-03T00:00:00.000Z"),
      resolution([ids.old, ids.amendment], ids.amendment),
    );
    const incomplete = await application(incompleteStore).current({
      valid_at: "2026-03-10T00:00:00Z",
    });
    expect(knowledge(incomplete)[0]).toMatchObject({ state: "disputed", value_count: 3 });

    const futureStore = new InMemoryStore();
    await append(
      futureStore,
      claim(ids.old, "30 days", "2026-01-01T00:00:00.000Z"),
      claim(ids.amendment, "60 days", "2026-01-02T00:00:00.000Z", {
        validFrom: "2026-02-01T00:00:00.000Z",
      }),
      resolution([ids.old, ids.amendment], ids.amendment, "2026-01-03T00:00:00.000Z", {
        effectiveAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    const beforeReplacement = await application(futureStore).current({
      valid_at: "2026-01-15T00:00:00Z",
    });
    expect(knowledge(beforeReplacement)[0]).toMatchObject({
      state: "preferred",
      values: [{ value: "30 days", representative: { id: ids.old } }],
      history: { resolution_count: 1, latest_resolution: { id: ids.resolution } },
    });
  });

  test("prefer retains equal-value contributors while supersede retains only its replacement", async () => {
    const preferredStore = new InMemoryStore();
    await append(
      preferredStore,
      claim(ids.old, "60 days", "2026-01-01T00:00:00.000Z"),
      claim(ids.amendment, "60 days", "2026-01-02T00:00:00.000Z"),
      resolution([ids.old, ids.amendment], ids.amendment),
    );
    const preferred = await application(preferredStore).current({
      valid_at: "2026-03-10T00:00:00Z",
    });
    expect(knowledge(preferred)[0]).toMatchObject({
      state: "preferred",
      values: [{ value: "60 days", representative: { id: ids.amendment }, claim_count: 2 }],
    });

    const supersededStore = new InMemoryStore();
    await append(
      supersededStore,
      claim(ids.old, "60 days", "2026-01-01T00:00:00.000Z", {
        sources: [{ ref: "agreement", snapshot: "base" }],
      }),
      claim(ids.amendment, "60 days", "2026-01-02T00:00:00.000Z", {
        sources: [{ ref: "agreement", snapshot: "amendment" }],
      }),
      resolution([ids.old, ids.amendment], ids.amendment, undefined, { decision: "supersede" }),
    );
    const superseded = await application(supersededStore).current({
      valid_at: "2026-03-10T00:00:00Z",
    });
    expect(knowledge(superseded)[0]).toMatchObject({
      state: "preferred",
      values: [{ value: "60 days", representative: { id: ids.amendment }, claim_count: 1 }],
      evidence: { source_count: 1 },
    });
  });

  test("retracted knowledge has no current evidence", async () => {
    const store = new InMemoryStore();
    const entry = decodePersistedRecord({
      ...base("entry", ids.entry, "2026-01-01T00:00:00.000Z"),
      body: "The original agreement was inspected.",
      sources: [{ ref: "agreement", snapshot: "base" }],
    });
    const old = claim(ids.old, "30 days", "2026-01-02T00:00:00.000Z", {
      derivedFrom: [ids.entry],
      sources: [{ ref: "agreement", snapshot: "claim" }],
    });
    const verification = decodePersistedRecord({
      ...base("verification", ids.verification, "2026-01-03T00:00:00.000Z"),
      targets: [ids.old],
      verified_against: [{ ref: "registry", snapshot: "signed" }],
      result: "confirmed",
    });
    await append(
      store,
      entry,
      old,
      verification,
      resolution([ids.old], undefined, "2026-03-06T00:00:00.000Z", { decision: "retract" }),
    );
    const result = await application(store).current({ valid_at: "2026-03-10T00:00:00Z" });
    expect(knowledge(result)[0]).toMatchObject({
      state: "retracted",
      value_count: 0,
      values: [],
      evidence: {
        entry_count: 0,
        source_count: 0,
        verification: { confirmed: 0, contradicted: 0, unchanged: 0, needs_revalidation: 0 },
      },
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

  test("pagination emits corrective advice only for returned disputed knowledge", async () => {
    const store = new InMemoryStore();
    const firstOld = "clm_0000000000000011" as ClaimId;
    const firstNew = "clm_0000000000000012" as ClaimId;
    const secondOld = "clm_0000000000000013" as ClaimId;
    const secondNew = "clm_0000000000000014" as ClaimId;
    await append(
      store,
      claim(firstOld, "documented-a", "2026-01-01T00:00:00.000Z", { perspective: "documented" }),
      claim(firstNew, "observed-a", "2026-01-02T00:00:00.000Z", { perspective: "documented" }),
      claim(secondOld, "documented-b", "2026-01-03T00:00:00.000Z", { perspective: "observed" }),
      claim(secondNew, "observed-b", "2026-01-04T00:00:00.000Z", { perspective: "observed" }),
    );

    const first = await application(store).current({ limit: 1 });
    expect(first.result.items).toHaveLength(1);
    expect(first.advice.map(({ action }) => action)).toEqual([
      "claims.list",
      "record.show",
      "record.show",
      "current.read",
    ]);
    expect(first.advice.slice(1, 3).map(({ params }) => params)).toEqual([
      { id: firstOld },
      { id: firstNew },
    ]);

    const second = await application(store).current({ cursor: first.page.cursor as string });
    expect(second.advice.map(({ action }) => action)).toEqual(["claims.list", "record.show", "record.show"]);
    expect(second.advice.slice(1).map(({ params }) => params)).toEqual([
      { id: secondOld },
      { id: secondNew },
    ]);
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
