import { describe, expect, test } from "bun:test";
import {
  type ClaimDraft,
  type ClaimPolicy,
  createInstant,
  createLoreduApplication,
  decodePersistedRecord,
  LoreduError,
  type PersistedRecord,
  type RecordStore,
} from "@loredu/kernel";
import { FixedClock, InMemoryStore, SeededRandomSource } from "@loredu/kernel/testing";

const actor = { type: "agent" as const, id: "test.agent" };
const ids = {
  entry1: "ent_0000000000000001",
  entry2: "ent_0000000000000002",
  entry3: "ent_0000000000000003",
  claim1: "clm_0000000000000001",
  claim2: "clm_0000000000000002",
  claim3: "clm_0000000000000003",
  claim4: "clm_0000000000000004",
  claim5: "clm_0000000000000005",
  claim6: "clm_0000000000000006",
  claim7: "clm_0000000000000007",
  relation1: "rel_0000000000000001",
  resolution1: "res_0000000000000001",
} as const;

function application(store: RecordStore = new InMemoryStore(), claimPolicy?: ClaimPolicy) {
  return createLoreduApplication({
    store,
    clock: new FixedClock(createInstant(1_700_000_000_000)),
    randomSource: new SeededRandomSource(41),
    ...(claimPolicy === undefined ? {} : { claimPolicy }),
  });
}

function claimDraft(value: unknown, predicate = "location"): ClaimDraft {
  return {
    kind: "claim",
    actor,
    scope: { repo: "loredu" },
    subject: { type: "code-area", id: "commands" },
    predicate,
    value: value as never,
    confidence: "observed",
  };
}

function frozenDeep(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(frozenDeep);
}

function entry(id: string, recordedAt = "2026-01-01T00:00:00.000Z") {
  return decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "entry",
    id,
    recorded_at: recordedAt,
    actor,
    body: `entry ${id}`,
    scope: {},
    metadata: {},
    sources: [],
  });
}

function claim(
  id: string,
  options: {
    recordedAt?: string;
    scope?: Record<string, string>;
    subjectType?: string;
    subject?: string;
    predicate?: string;
    perspective?: string;
    value?: unknown;
    actor?: typeof actor;
    derivedFrom?: readonly string[];
  } = {},
) {
  return decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "claim",
    id,
    recorded_at: options.recordedAt ?? "2026-01-01T00:00:00.000Z",
    actor: options.actor ?? actor,
    subject: { type: options.subjectType ?? "code-area", id: options.subject ?? "commands" },
    predicate: options.predicate ?? "location",
    ...(options.perspective === undefined ? {} : { perspective: options.perspective }),
    value: options.value ?? "src/commands",
    confidence: "observed",
    derived_from: options.derivedFrom ?? [],
    scope: options.scope ?? { repo: "loredu" },
    metadata: {},
    sources: [],
  });
}

async function appendDirect(store: InMemoryStore, records: readonly PersistedRecord[]) {
  for (const record of records) await store.append(record);
}

async function followClaims(
  app: ReturnType<typeof application>,
  first: Awaited<ReturnType<ReturnType<typeof application>["claims"]>>,
) {
  const ids = first.result.map((item) => String(item.id));
  let cursor = first.page.cursor;
  while (cursor !== undefined) {
    const response = await app.claims({ cursor });
    ids.push(...response.result.map((item) => String(item.id)));
    cursor = response.page.cursor;
  }
  return ids;
}

function cursorWithDeepQuery(cursor: string, depth: number): string {
  const prefix = "loredu.cursor.v1.";
  const payload = JSON.parse(
    Buffer.from(cursor.slice(prefix.length), "base64url").toString("utf8"),
  ) as Record<string, unknown>;
  const shallow = JSON.stringify({ ...payload, query: null });
  const marker = '"query":null';
  if (shallow === undefined || !shallow.includes(marker)) throw new TypeError("cursor query is absent");
  const nested = `${'{"next":'.repeat(depth)}null${"}".repeat(depth)}`;
  const malformed = shallow.replace(marker, `"query":${nested}`);
  return `${prefix}${Buffer.from(malformed).toString("base64url")}`;
}

describe("M1.5 application mutations and overlap", () => {
  test("add returns the exact frozen surface-neutral envelope and committed feedback fallback — @covers T60", async () => {
    const store = new InMemoryStore();
    const app = application(store);
    const added = await app.add({ kind: "entry", actor, body: "surface-neutral evidence" });

    expect(Object.keys(added)).toEqual(["ok", "result", "reconciliation", "advice", "basis"]);
    expect(added).toMatchObject({
      ok: true,
      result: { kind: "entry", position: 1 },
      reconciliation: { state: "not-applicable", related: [] },
      advice: [],
      basis: { stream_position: 1, query: { operation: "add", id: added.result.id } },
    });
    expect(Object.keys(added.result)).toEqual(["id", "kind", "position", "handle"]);
    expect(added.result).not.toHaveProperty("record");
    expect(added.result.handle.affordances.map(({ action }) => action)).toEqual([
      "record.show",
      "record.history",
    ]);
    expect(JSON.stringify(added)).not.toContain("lor ");
    expect(frozenDeep(added)).toBe(true);

    class FailingFeedbackStore extends InMemoryStore {
      override async scan(): Promise<never> {
        throw new LoreduError("STORE_IO_FAILED", "injected feedback failure");
      }
    }
    const failingStore = new FailingFeedbackStore();
    const committed = await application(failingStore).add(claimDraft("value"));
    expect(committed).toMatchObject({
      ok: true,
      result: { kind: "claim", position: 1 },
      reconciliation: { state: "unavailable", reason: "post-commit-read-failed", related: [] },
      advice: [{ rel: "status", action: "status.read", params: {} }],
      basis: { stream_position: 1 },
    });
    expect(Number(await failingStore.head())).toBe(1);
  });

  test("policy callbacks and Basis identity share one captured policy snapshot", async () => {
    const callbackCalls: string[] = [];
    const first: ClaimPolicy = {
      id: "test.first",
      version: "1",
      validateClaimKey() {
        callbackCalls.push("first.validate");
        return [];
      },
      semantics() {
        callbackCalls.push("first.semantics");
        return "exclusive";
      },
    };
    const second: ClaimPolicy = {
      id: "test.second",
      version: "2",
      validateClaimKey() {
        callbackCalls.push("second.validate");
        return [];
      },
      semantics() {
        callbackCalls.push("second.semantics");
        return "coexisting";
      },
    };
    const descriptorReads = new Map<PropertyKey, number>();
    const varyingPolicy = new Proxy(first, {
      getOwnPropertyDescriptor(_target, property) {
        const reads = (descriptorReads.get(property) ?? 0) + 1;
        descriptorReads.set(property, reads);
        const source = reads === 1 ? first : second;
        const descriptor = Reflect.getOwnPropertyDescriptor(source, property);
        return descriptor === undefined ? undefined : { ...descriptor, configurable: true };
      },
    });

    const added = await application(new InMemoryStore(), varyingPolicy).add(claimDraft("captured"));

    expect(callbackCalls).toEqual(["first.validate", "first.semantics"]);
    expect(added.basis.ruleset.claim_policy).toEqual({ id: "test.first", version: "1" });
    expect([...descriptorReads.values()]).toEqual([1, 1, 1, 1]);
  });

  test("same-key values corroborate or conflict with bounded exact-key feedback — @covers T61, T62", async () => {
    const app = application();
    const first = await app.add(claimDraft({ path: "src/commands", stable: true }));
    const corroboration = await app.add(claimDraft({ stable: true, path: "src/commands" }));
    expect(corroboration.reconciliation).toMatchObject({
      state: "corroboration",
      related_count: 1,
      related: [{ id: first.result.id }],
      claims: {
        action: "claims.list",
        params: {
          query: {
            scope: { repo: "loredu" },
            scope_match: "exact",
            subject_type: "code-area",
            subject: "commands",
            predicate: "location",
            perspective: null,
          },
        },
      },
    });
    expect(corroboration.advice).toEqual([]);

    const conflict = await app.add(claimDraft("src/cli/commands"));
    expect(conflict.reconciliation).toMatchObject({
      state: "conflict-candidate",
      related_count: 2,
      related: [{ id: first.result.id }],
    });
    expect(conflict.advice.map(({ action }) => action)).toEqual([
      "claims.list",
      "record.show",
      "record.show",
    ]);
    expect(conflict.advice[1]?.params).toEqual({ id: first.result.id });
    expect(conflict.advice[2]?.params).toEqual({ id: conflict.result.id });

    const coexisting: ClaimPolicy = {
      id: "test.coexisting",
      version: "1",
      validateClaimKey: () => [],
      semantics: () => "coexisting",
    };
    const coexistApp = application(new InMemoryStore(), coexisting);
    await coexistApp.add(claimDraft("documented"));
    const coexist = await coexistApp.add(claimDraft("observed"));
    expect(coexist.reconciliation).toMatchObject({ state: "coexisting", related_count: 1 });
    expect((await coexistApp.status()).result.healthy).toBe(true);
  });

  test("the public application chain paginates, records complete judgment, and becomes healthy — @covers T63", async () => {
    const app = application();
    const first = await app.add(claimDraft("src/commands"));
    const second = await app.add(claimDraft("src/commands"));
    const third = await app.add(claimDraft("src/cli/commands"));
    const exactQuery = (third.reconciliation as unknown as { claims: { params: { query: object } } }).claims
      .params.query;

    const firstPage = await app.claims({ ...exactQuery, limit: 2 });
    const memberIds = await followClaims(app, firstPage);
    expect(memberIds).toEqual([first.result.id, second.result.id, third.result.id]);
    for (const id of memberIds) expect(String((await app.show(id as never)).result.record.id)).toBe(id);

    await app.add({
      kind: "resolution",
      actor,
      targets: memberIds as never,
      decision: "prefer",
      replacement: third.result.id as never,
      reason: "verified moved command location",
    });
    const status = await app.status();
    expect(status.result).toMatchObject({ healthy: true, health: { unresolved_exclusive_groups: 0 } });
    expect(status.advice).toEqual([]);
  });

  test("identical pinned reads keep affordance order while healthy state has navigation but no correction — @covers T66", async () => {
    const app = application();
    const added = await app.add(claimDraft("stable"));
    const left = await app.claims();
    const right = await app.claims();
    expect(left).toEqual(right);
    expect(left.advice).toEqual([]);
    expect(left.result[0]?.handles[0]?.affordances.map(({ action }) => action)).toEqual([
      "record.show",
      "record.history",
    ]);
    const shown = await app.show(added.result.id);
    expect(shown.advice).toEqual([]);
    expect((await app.status()).advice).toEqual([]);
  });
});

describe("M1.5 application filters, health, and disclosure", () => {
  test("Claim filters compose with exact semantics and preserve stream order — @covers T67", async () => {
    const store = new InMemoryStore();
    await appendDirect(store, [
      claim(ids.claim1, {
        recordedAt: "2026-01-02T00:00:00.000Z",
        scope: { repo: "loredu", package: "kernel" },
        value: { b: [1, true], a: "x" },
      }),
      claim(ids.claim2, {
        recordedAt: "2026-01-03T00:00:00.000Z",
        scope: { repo: "loredu" },
        perspective: "documented",
        value: { a: "x", b: [1, true] },
      }),
      claim(ids.claim3, {
        recordedAt: "2025-12-31T00:00:00.000Z",
        scope: { repo: "other", package: "kernel" },
        value: { a: "x", b: [1, true] },
      }),
    ]);
    const app = application(store);

    const composed = await app.claims({
      scope: { repo: "loredu" },
      subject_type: "code-area",
      subject: "commands",
      predicate: "location",
      perspective: null,
      value: { a: "x", b: [1, true] },
      actor,
      since: "2026-01-02T08:00:00+08:00",
    });
    expect(composed.result.map(({ id }) => String(id))).toEqual([ids.claim1]);
    expect(composed.basis.query).toEqual({
      operation: "claims",
      filters: {
        actor,
        perspective: null,
        predicate: "location",
        scope: { repo: "loredu" },
        since: "2026-01-02T00:00:00.000Z",
        subject: "commands",
        subject_type: "code-area",
        value: { a: "x", b: [1, true] },
      },
    });
    expect(
      (await app.claims({ scope: { repo: "loredu" }, scope_match: "exact" })).result.map(({ id }) =>
        String(id),
      ),
    ).toEqual([ids.claim2]);
    expect((await app.claims({ perspective: "documented" })).result.map(({ id }) => String(id))).toEqual([
      ids.claim2,
    ]);
    expect((await app.claims()).result.map(({ id }) => String(id))).toEqual([
      ids.claim1,
      ids.claim2,
      ids.claim3,
    ]);
    await expect(app.claims({ scope_match: "exact" } as never)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(app.claims({ value: undefined } as never)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  test("health counts groups and every backward-reference failure; only complete eligible judgment closes — @covers T64", async () => {
    const app = application();
    const first = await app.add(claimDraft("old"));
    const second = await app.add(claimDraft("new"));
    expect((await app.status()).result).toMatchObject({
      healthy: false,
      health: { unresolved_exclusive_groups: 1, dangling_record_references: 0 },
    });
    await app.add({
      kind: "resolution",
      actor,
      targets: [first.result.id, second.result.id] as never,
      decision: "prefer",
      replacement: second.result.id as never,
      reason: "complete group reviewed",
    });
    expect((await app.status()).result.healthy).toBe(true);
    await app.add(claimDraft("later"));
    expect((await app.status()).result.health.unresolved_exclusive_groups).toBe(1);

    const handStore = new InMemoryStore();
    await appendDirect(handStore, [
      decodePersistedRecord({
        schema: "loredu.record/v1",
        kind: "relation",
        id: ids.relation1,
        recorded_at: "2026-01-01T00:00:00.000Z",
        actor,
        relation_type: "supports",
        from: ids.entry2,
        to: ids.entry3,
        scope: {},
        metadata: {},
        sources: [],
      }),
      entry(ids.entry2),
      entry(ids.entry3),
    ]);
    const handStatus = await application(handStore).status();
    expect(handStatus.result.health.dangling_record_references).toBe(2);
    expect(handStatus.result.attention.map((item) => item.kind)).toEqual([
      "dangling-record-reference",
      "dangling-record-reference",
    ]);

    const corruptStore = {
      async append() {
        return 1 as never;
      },
      async get() {
        return undefined;
      },
      async scan() {
        return { head: 1, records: [{ position: 1, record: { broken: true } }] } as never;
      },
      async *stream() {},
      async head() {
        return 1 as never;
      },
    } satisfies RecordStore;
    await expect(application(corruptStore).status()).rejects.toMatchObject({ code: "STORE_CORRUPT" });
  });

  test("generic equal-value key divergence is advisory-only and backward duplicate edges suppress it — @covers T68", async () => {
    const app = application();
    const first = await app.add(claimDraft({ logical: true }, "location"));
    const second = await app.add(claimDraft({ logical: true }, "location-path"));
    expect(first.reconciliation.state).toBe("new-key");
    expect(second.reconciliation.state).toBe("new-key");

    const status = await app.status();
    expect(status.result).toMatchObject({ healthy: true, advisory_count: 1 });
    expect(status.result.advisories[0]).toMatchObject({
      kind: "key-divergence",
      component_count: 2,
      representatives: [{ id: first.result.id }, { id: second.result.id }],
      claims: { action: "claims.list" },
    });
    expect(status.advice).toEqual([]);

    await app.add({
      kind: "relation",
      actor,
      relation_type: "duplicates",
      from: first.result.id,
      to: second.result.id,
    });
    const suppressed = await app.status();
    expect(suppressed.result).toMatchObject({ healthy: true, advisory_count: 0, advisories: [] });
  });

  test("status indexes preserve policy, group, component, and advice order", async () => {
    const store = new InMemoryStore();
    await appendDirect(store, [
      claim(ids.claim1, { predicate: "location", value: "old" }),
      claim(ids.claim2, { predicate: "owner", value: { shared: true } }),
      claim(ids.claim3, { predicate: "reviewer", value: { shared: true } }),
      claim(ids.claim4, { predicate: "location", value: "new" }),
      claim(ids.claim5, { predicate: "status", value: { shared: true } }),
      decodePersistedRecord({
        schema: "loredu.record/v1",
        kind: "relation",
        id: ids.relation1,
        recorded_at: "2026-01-01T00:00:00.000Z",
        actor,
        relation_type: "duplicates",
        from: ids.claim2,
        to: ids.claim5,
        scope: {},
        metadata: {},
        sources: [],
      }),
      claim(ids.claim6, { predicate: "lifecycle", value: "inactive" }),
      claim(ids.claim7, { predicate: "lifecycle", value: "active" }),
    ]);
    const policyCalls: string[] = [];
    const policy: ClaimPolicy = {
      id: "test.status-order",
      version: "1",
      validateClaimKey(key) {
        policyCalls.push(`validate:${key.predicate}`);
        return [];
      },
      semantics(key) {
        policyCalls.push(`semantics:${key.predicate}`);
        return "exclusive";
      },
    };

    const status = await application(store, policy).status();

    expect(policyCalls).toEqual([
      "validate:location",
      "semantics:location",
      "validate:owner",
      "semantics:owner",
      "validate:reviewer",
      "semantics:reviewer",
      "validate:status",
      "semantics:status",
      "validate:lifecycle",
      "semantics:lifecycle",
    ]);
    expect(
      status.result.attention.map((item) =>
        item.kind === "unresolved-exclusive-group" ? String(item.representative.id) : item.kind,
      ),
    ).toEqual([ids.claim1, ids.claim6]);
    expect(status.result.advisories).toMatchObject([
      {
        component_count: 2,
        representatives: [{ id: ids.claim2 }, { id: ids.claim3 }],
      },
    ]);
    expect(status.advice.map(({ action }) => action)).toEqual([
      "claims.list",
      "record.show",
      "claims.list",
      "record.show",
    ]);
    expect(status.page).toEqual({ returned: 3, total: 3 });
  });

  test("show discloses only valid backward record references and history stays position ordered", async () => {
    const store = new InMemoryStore();
    await appendDirect(store, [
      entry(ids.entry1),
      claim(ids.claim1, { derivedFrom: [ids.entry1] }),
      claim(ids.claim2, { derivedFrom: [ids.entry1], predicate: "owner" }),
    ]);
    const app = application(store);
    const shown = await app.show(ids.claim1 as never);
    expect(shown.result.handles.map(({ id }) => String(id))).toEqual([ids.claim1, ids.entry1]);
    expect(shown.result.handles.every((item) => item.affordances.length === 2)).toBe(true);
    const history = await app.history({ id: ids.entry1 as never });
    expect(history.result.map(({ id }) => String(id))).toEqual([ids.entry1, ids.claim1, ids.claim2]);
    expect(history.result[1]?.summary).not.toHaveProperty("derived_from");
    await expect(app.show(ids.entry3 as never)).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
  });

  test("read-only operations consume neither Clock nor RandomSource", async () => {
    const store = new InMemoryStore();
    await store.append(entry(ids.entry1));
    let clockCalls = 0;
    let randomCalls = 0;
    const app = createLoreduApplication({
      store,
      clock: {
        now: () => {
          clockCalls += 1;
          return createInstant(0);
        },
      },
      randomSource: {
        nextBytes: () => {
          randomCalls += 1;
          return new Uint8Array(10);
        },
      },
    });
    await app.readHead();
    await app.show(ids.entry1 as never);
    await app.history({ id: ids.entry1 as never });
    await app.claims();
    await app.status();
    expect([clockCalls, randomCalls]).toEqual([0, 0]);
  });
});

describe("M1.5 basis-pinned opaque pagination", () => {
  test("Claim, history, and same-position status pages preserve limits, totals, and exact continuation — @covers T70", async () => {
    const store = new InMemoryStore();
    await appendDirect(store, [
      entry(ids.entry1),
      claim(ids.claim1, { derivedFrom: [ids.entry1] }),
      claim(ids.claim2, { derivedFrom: [ids.entry1], predicate: "owner" }),
      claim(ids.claim3, { predicate: "status" }),
      decodePersistedRecord({
        schema: "loredu.record/v1",
        kind: "resolution",
        id: ids.resolution1,
        recorded_at: "2026-01-04T00:00:00.000Z",
        actor,
        targets: [ids.claim4, ids.claim5],
        decision: "leave_disputed",
        reason: "hand-authored dangling references",
        scope: {},
        metadata: {},
        sources: [],
      }),
    ]);
    const app = application(store);

    const claimsPage = await app.claims({ limit: 2 });
    expect(claimsPage.page).toMatchObject({ returned: 2, total: 3 });
    expect(claimsPage.page.cursor).toMatch(/^loredu\.cursor\.v1\.[A-Za-z0-9_-]+$/);
    expect(claimsPage.advice[0]).toMatchObject({
      action: "claims.list",
      params: { cursor: claimsPage.page.cursor, limit: 2 },
    });
    const claimsEnd = await app.claims({ cursor: claimsPage.page.cursor as string });
    expect(claimsEnd.page).toEqual({ returned: 1, total: 3 });

    const historyPage = await app.history({ id: ids.entry1 as never, limit: 1 });
    const historyIds: string[] = [];
    let current = historyPage;
    while (true) {
      historyIds.push(...current.result.map(({ id }) => id));
      if (!current.page.cursor) break;
      expect(current.advice[0]?.params).toMatchObject({ limit: 1 });
      current = await app.history({ cursor: current.page.cursor });
    }
    expect(historyIds).toEqual([ids.entry1, ids.claim1, ids.claim2]);

    const statusFirst = await app.status({ limit: 1 });
    expect(statusFirst.page).toMatchObject({ returned: 1, total: 3 });
    expect(statusFirst.result.health.dangling_record_references).toBe(2);
    const statusSecond = await app.status({ cursor: statusFirst.page.cursor as string, limit: 1 });
    expect(statusSecond.page).toMatchObject({ returned: 1, total: 3 });
    expect([
      (statusFirst.result.attention[0] as { path: string }).path,
      (statusSecond.result.attention[0] as { path: string }).path,
    ]).toEqual(["/targets/0", "/targets/1"]);
    const statusEnd = await app.status({ cursor: statusSecond.page.cursor as string, limit: 1 });
    expect(statusEnd.page).toEqual({ returned: 1, total: 3 });
    expect(statusEnd.result.advisories).toHaveLength(1);
  });

  test("a cursor chain replays only its pinned prefix while a fresh query sees concurrent append — @covers T71", async () => {
    const store = new InMemoryStore();
    await appendDirect(store, [claim(ids.claim1), claim(ids.claim2, { predicate: "owner" })]);
    const app = application(store);
    const first = await app.claims({ limit: 1 });
    expect(Number(first.basis.stream_position)).toBe(2);

    await store.append(claim(ids.claim3, { predicate: "status" }));
    const continued = await app.claims({ cursor: first.page.cursor as string, limit: 1 });
    expect([...first.result, ...continued.result].map(({ id }) => String(id))).toEqual([
      ids.claim1,
      ids.claim2,
    ]);
    expect(Number(continued.basis.stream_position)).toBe(2);
    expect(continued.page).toEqual({ returned: 1, total: 2 });

    const fresh = await app.claims();
    expect(Number(fresh.basis.stream_position)).toBe(3);
    expect(fresh.result.map(({ id }) => String(id))).toEqual([ids.claim1, ids.claim2, ids.claim3]);
  });

  test("malformed, wrong-operation, wrong-ruleset, and foreign-snapshot cursors fail loudly — @covers T72", async () => {
    const store = new InMemoryStore();
    await appendDirect(store, [claim(ids.claim1), claim(ids.claim2, { predicate: "owner" })]);
    const app = application(store);
    await expect(app.claims({ cursor: "loredu.cursor.v1.not*base64" })).rejects.toMatchObject({
      code: "INVALID_CURSOR",
    });

    const claimsCursor = (await app.claims({ limit: 1 })).page.cursor as string;
    await expect(app.claims({ cursor: cursorWithDeepQuery(claimsCursor, 20_000) })).rejects.toMatchObject({
      code: "INVALID_CURSOR",
    });
    await expect(app.history({ cursor: claimsCursor })).rejects.toMatchObject({ code: "CURSOR_MISMATCH" });

    const policy: ClaimPolicy = {
      id: "other.policy",
      version: "1",
      validateClaimKey: () => [],
      semantics: () => "exclusive",
    };
    await expect(application(store, policy).claims({ cursor: claimsCursor })).rejects.toMatchObject({
      code: "CURSOR_MISMATCH",
    });

    const foreign = new InMemoryStore();
    await appendDirect(foreign, [claim(ids.claim3), claim(ids.claim4, { predicate: "owner" })]);
    await expect(application(foreign).claims({ cursor: claimsCursor })).rejects.toMatchObject({
      code: "CURSOR_MISMATCH",
    });
  });
});
