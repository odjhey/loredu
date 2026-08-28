import { describe, expect, test } from "bun:test";
import {
  basisEquals,
  type ClaimId,
  type ClaimPolicy,
  createInstant,
  createLoreduApplication,
  DEFAULT_RANKER,
  LoreduError,
  type Ranker,
  type RecordDraft,
  type Scope,
  type WorkingLoreApplicationResponse,
  type WorkingLoreItem,
  type WorkingLoreRankContext,
} from "@loredu/kernel";
import { FixedClock, InMemoryStore, SeededRandomSource } from "@loredu/kernel/testing";

const NOW = "2026-01-02T03:04:05.000Z";
const ACTOR = { type: "agent" as const, id: "working-lore-test" };

function app(options: { store?: InMemoryStore; policy?: ClaimPolicy; ranker?: Ranker } = {}) {
  const store = options.store ?? new InMemoryStore();
  return {
    store,
    application: createLoreduApplication({
      store,
      clock: new FixedClock(createInstant(Date.parse(NOW))),
      randomSource: new SeededRandomSource(41),
      ...(options.policy ? { claimPolicy: options.policy } : {}),
      ...(options.ranker ? { ranker: options.ranker } : {}),
    }),
  };
}

function claim(
  value: unknown,
  options: {
    scope?: Scope;
    subject?: string;
    predicate?: string;
    confidence?: "candidate" | "observed" | "corroborated" | "confirmed" | "authoritative";
    claimClass?: string;
    sources?: readonly { ref: string; locator?: string; snapshot?: string }[];
    derivedFrom?: readonly string[];
  } = {},
): RecordDraft {
  return {
    kind: "claim",
    actor: ACTOR,
    scope: options.scope ?? { repo: "loredu" },
    subject: { type: "component", id: options.subject ?? "kernel" },
    predicate: options.predicate ?? "supports-working-lore",
    value: value as never,
    confidence: options.confidence ?? "confirmed",
    ...(options.claimClass ? { claim_class: options.claimClass } : {}),
    ...(options.sources ? { sources: options.sources } : {}),
    ...(options.derivedFrom ? { derived_from: options.derivedFrom as readonly never[] } : {}),
  };
}

function allItems(response: WorkingLoreApplicationResponse): readonly WorkingLoreItem[] {
  return response.result.packet.sections.flatMap((section) => section.items);
}

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("expected test value to be present");
  return value;
}

function byKind<K extends WorkingLoreItem["kind"]>(
  response: WorkingLoreApplicationResponse,
  kind: K,
): readonly Extract<WorkingLoreItem, { readonly kind: K }>[] {
  return allItems(response).filter(
    (item): item is Extract<WorkingLoreItem, { readonly kind: K }> => item.kind === kind,
  );
}

interface TestCursorPayload {
  rank: {
    algorithm: string;
    candidate_count: number;
    permutation_digest: string;
    section: string;
    resume: { kind: string; section_ordinal?: number; occurrence_index?: number };
  };
  [key: string]: unknown;
}

function cursorPayload(cursor: string): TestCursorPayload {
  const encoded = cursor.slice("loredu.cursor.v1.".length);
  return JSON.parse(
    Buffer.from(encoded.replaceAll("-", "+").replaceAll("_", "/"), "base64url").toString("utf8"),
  ) as TestCursorPayload;
}

function encodeCursor(payload: unknown): string {
  return `loredu.cursor.v1.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

const coexistingPolicy: ClaimPolicy = Object.freeze({
  id: "test.coexisting",
  version: "1",
  validateClaimKey: () => Object.freeze([]),
  semantics: () => "coexisting" as const,
});

describe("M3 Working Lore public application", () => {
  test("T41 @covers T41 — budgets, Unicode scalars, compact summaries, scope previews, and bounded Ranker context", async () => {
    let captured: WorkingLoreRankContext | undefined;
    const ranker: Ranker = {
      id: "test.capture",
      version: "1",
      rank(context) {
        captured = context;
        return context.candidates.map(({ index }) => index);
      },
    };
    const { application } = app({ ranker });
    const hugeScope = Object.fromEntries(
      Array.from({ length: 80 }, (_, index) => [`k${String(index).padStart(3, "0")}`, `v${index}`]),
    );
    await application.add(
      claim(`${"😀".repeat(700)} tail`, {
        scope: hugeScope,
        confidence: "candidate",
        claimClass: "pattern",
      }),
    );
    const response = await application.lore({
      activity: "inspect.kernel",
      scope: hugeScope,
      max_items: 2,
      max_chars: 700,
    });
    expect(response.result.packet.budget).toMatchObject({
      max_items: 2,
      max_chars: 700,
      used_items: 1,
    });
    const firstItem = must(allItems(response)[0]);
    expect(response.result.packet.budget.used_chars).toBe([...firstItem.summary].length);
    expect([...firstItem.summary].length).toBe(512);
    expect(firstItem.summary.endsWith("…")).toBe(true);
    expect(response.result.packet.filters.scope).toEqual({
      pair_count: 80,
      pairs: [
        { key: "k000", value: "v0" },
        { key: "k001", value: "v1" },
      ],
    });
    expect(firstItem.knowledge.key.scope.pair_count).toBe(80);
    expect(firstItem.knowledge.key.scope.pairs).toHaveLength(2);
    expect(response.result.packet.orientation).toEqual({
      current_count: 1,
      pattern_count: 1,
      candidate_count: 1,
      conflict_count: 0,
      needs_revalidation_count: 0,
      attention_count: 1,
    });
    expect(response.result.packet.sections.map((section) => section.page.total)).toEqual([1, 1, 1, 0, 0]);
    if (!captured) throw new Error("Ranker did not receive its context");
    expect(captured.candidates).toHaveLength(3);
    expect(Object.isFrozen(captured)).toBe(true);
    expect(Object.isFrozen(captured.candidates)).toBe(true);
    expect(JSON.stringify(captured)).not.toContain("tail");
    expect(JSON.stringify(captured)).not.toContain("k079");
    expect(captured.candidates.every((candidate) => [...candidate.summary].length <= 512)).toBe(true);
    expect(captured.query.filters.scope.pair_count).toBe(80);

    for (const count of [0, 1, 2, 3]) {
      const scoped = Object.fromEntries(
        Array.from({ length: count }, (_, index) => [`a${index}`, `b${index}`]),
      );
      const result = await application.lore({
        activity: `scope.${count}`,
        ...(count ? { scope: scoped } : {}),
      });
      expect(result.result.packet.filters.scope.pair_count).toBe(count);
      expect(result.result.packet.filters.scope.pairs).toHaveLength(Math.min(count, 2));
    }
  });

  test("T42 @covers T42 — M2-owned representative tuples, retraction, equal values, resolution, and exact anchors", async () => {
    const { application } = app();
    const a = await application.add(claim("A", { confidence: "candidate", claimClass: "pattern" }));
    const b = await application.add(claim("B", { confidence: "confirmed" }));
    const c = await application.add(claim("C", { confidence: "confirmed" }));
    const aId = a.result.id as ClaimId;
    const bId = b.result.id as ClaimId;
    const cId = c.result.id as ClaimId;
    const disputed = await application.lore({ activity: "representatives" });
    for (const item of allItems(disputed)) {
      expect(item.knowledge.value_count).toBe(3);
      expect(item.knowledge.representatives.map(({ id }) => id)).toEqual([aId, bId]);
      expect(item.knowledge.key.anchor_claim).toBe(aId);
    }

    const equal = await application.add(claim("A"));
    const stillTwo = await application.lore({ activity: "equal-values" });
    const stillConflict = must(byKind(stillTwo, "conflict")[0]);
    expect(stillConflict.knowledge.representatives.map(({ id }) => id)).toEqual([aId, bId]);
    expect(stillConflict.knowledge.claim_count).toBe(4);
    expect(equal.result.id).not.toBe(a.result.id);

    await application.add({
      kind: "resolution",
      actor: ACTOR,
      targets: [aId, bId, cId, equal.result.id] as never,
      decision: "prefer",
      replacement: cId as never,
      reason: "select C",
    });
    const resolved = await application.lore({ activity: "resolved" });
    const resolvedCurrent = must(byKind(resolved, "current")[0]);
    expect(resolvedCurrent.knowledge.representatives.map(({ id }) => id)).toEqual([cId]);
    expect(resolvedCurrent.knowledge.key.anchor_claim).toBe(cId);

    const retractApp = app().application;
    const doomed = await retractApp.add(claim("obsolete"));
    await retractApp.add({
      kind: "resolution",
      actor: ACTOR,
      targets: [doomed.result.id] as never,
      decision: "retract",
      reason: "withdraw",
    });
    const retracted = await retractApp.lore({ activity: "retracted" });
    expect(allItems(retracted)).toEqual([]);
    expect(retracted.result.packet.orientation).toEqual({
      current_count: 0,
      pattern_count: 0,
      candidate_count: 0,
      conflict_count: 0,
      needs_revalidation_count: 0,
      attention_count: 0,
    });

    const coexist = app({ policy: coexistingPolicy }).application;
    const ca = await coexist.add(claim("A"));
    const cb = await coexist.add(claim("B"));
    await coexist.add(claim("C"));
    const coexisting = await coexist.lore({ activity: "coexisting" });
    for (const item of allItems(coexisting)) {
      expect(item.knowledge.value_count).toBe(3);
      expect(item.knowledge.representatives.map(({ id }) => id)).toEqual([ca.result.id, cb.result.id]);
    }
    expect(coexisting.advice).toEqual([]);
  });

  test("representative edge vectors preserve M2 cycle, duplicate, and Resolution authority", async () => {
    const equalApp = app().application;
    const first = await equalApp.add(claim("same"));
    await equalApp.add(claim("same"));
    const equal = await equalApp.lore({ activity: "equal" });
    const equalCurrent = must(byKind(equal, "current")[0]);
    expect(equalCurrent.knowledge.value_count).toBe(1);
    expect(equalCurrent.knowledge.representatives.map(({ id }) => id)).toEqual([first.result.id]);

    const cycleApp = app().application;
    const cycleA = await cycleApp.add(claim("same"));
    const cycleB = await cycleApp.add(claim("same"));
    await cycleApp.add({
      kind: "relation",
      actor: ACTOR,
      relation_type: "supersedes",
      from: cycleA.result.id,
      to: cycleB.result.id,
    });
    await cycleApp.add({
      kind: "relation",
      actor: ACTOR,
      relation_type: "supersedes",
      from: cycleB.result.id,
      to: cycleA.result.id,
    });
    const cycle = await cycleApp.lore({ activity: "cycle" });
    const cycleConflict = must(byKind(cycle, "conflict")[0]);
    expect(cycleConflict.knowledge).toMatchObject({ state: "disputed", value_count: 1 });
    expect(cycleConflict.knowledge.representatives.map(({ id }) => id)).toEqual([cycleA.result.id]);

    const replacementApp = app().application;
    const old = await replacementApp.add(claim("same"));
    const replacement = await replacementApp.add(claim("same"));
    await replacementApp.add({
      kind: "resolution",
      actor: ACTOR,
      targets: [old.result.id, replacement.result.id] as never,
      decision: "prefer",
      replacement: replacement.result.id as never,
      reason: "prefer the later corroboration",
    });
    const selected = await replacementApp.lore({ activity: "replacement" });
    const knowledge = must(byKind(selected, "current")[0]).knowledge;
    expect(knowledge.key.anchor_claim).toBe(old.result.id as ClaimId);
    expect(knowledge.representatives.map(({ id }) => id)).toEqual([replacement.result.id]);
  });

  test("equal Scope previews remain distinct and history growth does not expand occurrence counts", async () => {
    const { application } = app();
    const one = await application.add(claim("one", { scope: { a: "1", b: "2", c: "3" }, subject: "one" }));
    await application.add(claim("two", { scope: { a: "1", b: "2", d: "4" }, subject: "two" }));
    const previews = await application.lore({ activity: "preview" });
    const current = byKind(previews, "current");
    expect(current).toHaveLength(2);
    expect(must(current[0]).knowledge.key.scope).toEqual(must(current[1]).knowledge.key.scope);
    expect(must(current[0]).knowledge.key.anchor_claim).not.toBe(must(current[1]).knowledge.key.anchor_claim);

    const before = await application.lore({ activity: "growth", max_items: 1, max_chars: 512 });
    for (let index = 0; index < 9; index++)
      await application.add(claim("one", { scope: { a: "1", b: "2", c: "3" }, subject: "one" }));
    const after = await application.lore({ activity: "growth", max_items: 1, max_chars: 512 });
    expect(after.result.packet.budget.used_items).toBe(1);
    expect(after.result.packet.budget.used_chars).toBeLessThanOrEqual(512);
    expect(after.result.packet.orientation).toEqual(before.result.packet.orientation);
    expect(
      must(
        byKind(await application.lore({ activity: "growth-full" }), "current").find(
          (item) => item.knowledge.key.anchor_claim === one.result.id,
        ),
      ).knowledge.claim_count,
    ).toBe(10);
  });

  test("T43 @covers T43 — conflicts and exact corpus revalidation are structural and fully counted", async () => {
    const { application } = app();
    const first = await application.add(
      claim("old", { sources: [{ ref: "doc", locator: "policy", snapshot: "v1" }] }),
    );
    await application.add(claim("new", { sources: [{ ref: "doc", locator: "policy", snapshot: "v2" }] }));
    await application.add({
      kind: "verification",
      actor: ACTOR,
      targets: [first.result.id] as never,
      verified_against: [{ ref: "doc", locator: "policy", snapshot: "v3" }],
      result: "needs_revalidation",
    });
    const response = await application.lore({
      activity: "refresh-policy",
      corpus: { ref: "doc", locator: "policy", snapshot: "v3" },
    });
    expect(response.result.packet.orientation.conflict_count).toBe(1);
    expect(response.result.packet.orientation.needs_revalidation_count).toBe(1);
    const revalidation = must(byKind(response, "needs-revalidation")[0]);
    expect(revalidation.revalidation.verification_count).toBe(1);
    expect(revalidation.revalidation.snapshot_mismatch_count).toBe(2);

    const locatorMiss = await application.lore({
      activity: "wrong-corpus",
      corpus: { ref: "doc", locator: "other", snapshot: "v3" },
    });
    expect(allItems(locatorMiss)).toEqual([]);
    const snapshotOnly = await application.lore({
      activity: "snapshot-is-not-filter",
      corpus: { ref: "doc", snapshot: "future" },
    });
    expect(snapshotOnly.result.packet.orientation.conflict_count).toBe(1);
    expect(snapshotOnly.result.packet.orientation.needs_revalidation_count).toBe(1);
  });

  test("T44 @covers T44 — every handle discloses show/history and same_key_as paginates the complete exact group", async () => {
    const { application } = app();
    const ids = [] as ClaimId[];
    for (const value of ["A", "B", "C"]) ids.push((await application.add(claim(value))).result.id as ClaimId);
    const response = await application.lore({ activity: "disclosure" });
    const conflict = must(byKind(response, "conflict")[0]);
    expect(conflict.knowledge.representatives.map(({ id }) => id)).toEqual(ids.slice(0, 2));
    expect(response.advice.slice(0, 3).map((item) => item.action)).toEqual([
      "claims.list",
      "record.show",
      "record.show",
    ]);
    expect(must(response.advice[0]).params).toEqual({ query: { same_key_as: must(ids[0]) } });
    for (const representative of conflict.knowledge.representatives) {
      expect(representative.affordances.map(({ action }) => action)).toEqual([
        "record.show",
        "record.history",
      ]);
      const shown = await application.show(representative.id);
      expect(shown.result.record.id).toBe(representative.id);
      const history = await application.history({ id: representative.id });
      expect(must(history.result[0]).id).toBe(representative.id);
    }
    const firstPage = await application.claims({ same_key_as: must(ids[0]), limit: 1 });
    expect(firstPage.result.map(({ id }) => id)).toEqual([must(ids[0])]);
    expect(firstPage.page).toMatchObject({ returned: 1, total: 3 });
    await expect(application.lore({ cursor: must(firstPage.page.cursor) })).rejects.toMatchObject({
      code: "CURSOR_MISMATCH",
    });
    const secondPage = await application.claims({ cursor: must(firstPage.page.cursor), limit: 2 });
    expect(secondPage.result.map(({ id }) => id)).toEqual(ids.slice(1));
    await expect(
      application.claims({ same_key_as: "clm_0000000000000000" as ClaimId }),
    ).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
    await expect(
      application.claims({ same_key_as: must(ids[0]), predicate: "x" } as never),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(application.claims({ same_key_as: "ent_0000000000000000" as never })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  test("T45 @covers T45 — Working Basis identity, one-append staleness, and equal-history replay", async () => {
    const store = new InMemoryStore();
    const firstApplication = app({ store }).application;
    await firstApplication.add(claim("stable"));
    const first = await firstApplication.lore({ activity: "cache" });
    const replayApplication = app({ store }).application;
    const replay = await replayApplication.lore({ activity: "cache" });
    expect(basisEquals(first.basis, replay.basis)).toBe(true);
    expect(replay.result.packet).toEqual(first.result.packet);
    expect(replay.advice.map(({ action, params }) => ({ action, params }))).toEqual(
      first.advice.map(({ action, params }) => ({ action, params })),
    );
    const ordinary = await firstApplication.readHead();
    expect(basisEquals(ordinary.basis, first.basis)).toBe(false);
    expect(basisEquals(first.basis, ordinary.basis)).toBe(false);

    await firstApplication.add(claim("new", { subject: "other" }));
    const fresh = await firstApplication.lore({ activity: "cache" });
    expect(Number(fresh.basis.stream_position)).toBeGreaterThan(Number(first.basis.stream_position));
    expect(basisEquals(first.basis, fresh.basis)).toBe(false);

    const changedRanker = app({
      store,
      ranker: { id: "loredu.baseline", version: "2", rank: DEFAULT_RANKER.rank },
    }).application;
    const changed = await changedRanker.lore({ activity: "cache" });
    expect(basisEquals(fresh.basis, changed.basis)).toBe(false);
    const changedQuery = await firstApplication.lore({ activity: "other-activity" });
    expect(basisEquals(fresh.basis, changedQuery.basis)).toBe(false);
  });

  test("T75 @covers T75 — section continuations bind permutation digest/count and exact occurrence identity", async () => {
    const store = new InMemoryStore();
    const { application } = app({
      store,
      ranker: {
        id: "test.digest-vector",
        version: "1",
        rank: () => [0, 2, 1],
      },
    });
    await application.add(claim("pattern", { confidence: "candidate", claimClass: "pattern" }));
    const first = await application.lore({ activity: "paginate", max_items: 1, max_chars: 512 });
    expect(
      first.result.packet.sections.map(({ name, page }) => [name, page.returned, page.total, !!page.cursor]),
    ).toEqual([
      ["current", 0, 1, true],
      ["patterns", 0, 1, true],
      ["candidates", 1, 1, false],
      ["conflicts", 0, 0, false],
      ["needs_revalidation", 0, 0, false],
    ]);
    const currentCursor = must(must(first.result.packet.sections[0]).page.cursor);
    const patternCursor = must(must(first.result.packet.sections[1]).page.cursor);
    const currentPayload = cursorPayload(currentCursor);
    const patternPayload = cursorPayload(patternCursor);
    expect(currentPayload.rank).toMatchObject({
      algorithm: "sha256",
      candidate_count: 3,
      permutation_digest: "F-xKZQnI4WgcP4GTnO6egQd0keFR1WmtDMbwMZYgGBg",
      section: "current",
      resume: { kind: "before-first" },
    });
    expect(patternPayload.rank.permutation_digest).toBe(currentPayload.rank.permutation_digest);
    const continued = await application.lore({ cursor: currentCursor, max_items: 200, max_chars: 1_000_000 });
    expect(continued.result.packet.sections).toHaveLength(1);
    const continuedSection = must(continued.result.packet.sections[0]);
    expect(continuedSection.name).toBe("current");
    expect(continuedSection.items).toHaveLength(1);
    expect(continued.result.packet.budget).toMatchObject({
      max_items: 200,
      max_chars: 1_000_000,
      used_items: 1,
    });
    expect(must(continuedSection.items[0]).knowledge.representatives).toEqual(
      must(must(first.result.packet.sections[2]).items[0]).knowledge.representatives,
    );

    await application.add(claim("suffix", { subject: "new-subject" }));
    const pinned = await application.lore({ cursor: patternCursor });
    expect(pinned.basis.stream_position).toBe(first.basis.stream_position);
    expect(pinned.result.packet.orientation.current_count).toBe(1);

    const tampered = cursorPayload(currentCursor);
    tampered.rank.resume = { kind: "after", section_ordinal: 0, occurrence_index: 2 };
    await expect(application.lore({ cursor: encodeCursor(tampered) })).rejects.toMatchObject({
      code: "CURSOR_MISMATCH",
    });
    const driftedTime = cursorPayload(currentCursor);
    driftedTime.computed_at = "2026-01-02T03:04:06.000Z";
    await expect(application.lore({ cursor: encodeCursor(driftedTime) })).rejects.toMatchObject({
      code: "INVALID_CURSOR",
    });

    const stable = app().application;
    await stable.add(claim("one", { subject: "one", confidence: "candidate", claimClass: "pattern" }));
    await stable.add(claim("two", { subject: "two", confidence: "candidate", claimClass: "pattern" }));
    const stableFirst = await stable.lore({ activity: "stable-digest", max_items: 1, max_chars: 512 });
    const beforeFirst = must(
      must(stableFirst.result.packet.sections.find(({ name }) => name === "current")).page.cursor,
    );
    const stableNext = await stable.lore({ cursor: beforeFirst, max_items: 1, max_chars: 1000 });
    const afterOne = must(must(stableNext.result.packet.sections[0]).page.cursor);
    expect(cursorPayload(afterOne).rank.permutation_digest).toBe(
      cursorPayload(beforeFirst).rank.permutation_digest,
    );
    expect(cursorPayload(afterOne).rank.candidate_count).toBe(
      cursorPayload(beforeFirst).rank.candidate_count,
    );
    expect(cursorPayload(afterOne).rank.resume).toMatchObject({ kind: "after", section_ordinal: 0 });
    const stableLast = await stable.lore({ cursor: afterOne, max_items: 1, max_chars: 1000 });
    expect(must(stableLast.result.packet.sections[0]).page).toEqual({ returned: 1, total: 2 });
    expect(stableLast.advice.filter(({ rel }) => rel === "continue")).toEqual([]);
  });

  test("Ranker assembly/callback validation is fail-closed and callback timing is exact", async () => {
    expect(() => app({ ranker: { id: "bad", version: "1", rank: 1 as never } })).toThrow(LoreduError);
    let assemblyCalls = 0;
    const store = new InMemoryStore();
    const stable: Ranker = {
      id: "test.stable",
      version: "1",
      rank(context) {
        assemblyCalls++;
        return context.candidates.map(({ index }) => index);
      },
    };
    const application = app({ store, ranker: stable }).application;
    expect(assemblyCalls).toBe(0);
    await application.lore({ activity: "empty" });
    expect(assemblyCalls).toBe(1);

    await application.add(claim("x", { confidence: "candidate", claimClass: "pattern" }));
    const page = await application.lore({ activity: "rank", max_items: 1 });
    expect(assemblyCalls).toBe(2);
    const cursor = must(must(page.result.packet.sections.find(({ page }) => page.cursor)).page.cursor);
    const drifted = cursorPayload(cursor);
    drifted.computed_at = "2026-01-02T03:04:06.000Z";
    await expect(application.lore({ cursor: encodeCursor(drifted) })).rejects.toMatchObject({
      code: "INVALID_CURSOR",
    });
    expect(assemblyCalls).toBe(2);

    let wrongVersionCalls = 0;
    const wrongVersion = app({
      store,
      ranker: {
        id: "test.stable",
        version: "2",
        rank(context) {
          wrongVersionCalls++;
          return context.candidates.map(({ index }) => index);
        },
      },
    }).application;
    await expect(wrongVersion.lore({ cursor })).rejects.toMatchObject({ code: "CURSOR_MISMATCH" });
    expect(wrongVersionCalls).toBe(0);

    let alternatingCalls = 0;
    const alternatingStore = new InMemoryStore();
    const alternating = app({
      store: alternatingStore,
      ranker: {
        id: "test.alternating",
        version: "1",
        rank(context) {
          alternatingCalls++;
          const indexes = context.candidates.map(({ index }) => index);
          return alternatingCalls % 2 === 1 ? indexes : indexes.reverse();
        },
      },
    }).application;
    await alternating.add(claim("x", { confidence: "candidate", claimClass: "pattern" }));
    const alternatingPage = await alternating.lore({ activity: "alternating", max_items: 1 });
    const alternatingCursor = must(
      must(alternatingPage.result.packet.sections.find(({ page }) => page.cursor)).page.cursor,
    );
    await expect(alternating.lore({ cursor: alternatingCursor })).rejects.toMatchObject({
      code: "CURSOR_MISMATCH",
    });
    expect(alternatingCalls).toBe(2);

    const malformed = app({
      store,
      ranker: { id: "test.malformed", version: "1", rank: () => [0, 0, 2] },
    }).application;
    await expect(malformed.lore({ activity: "bad-output" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(application.lore({ activity: "bad-budget", max_items: 0 })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  test("corpus SourceRef fields require canonical text", async () => {
    const { application } = app();
    for (const [field, corpus] of [
      ["ref", { ref: " doc" }],
      ["locator", { ref: "doc", locator: "policy " }],
      ["snapshot", { ref: "doc", snapshot: " v1" }],
    ] as const) {
      await expect(application.lore({ activity: "canonical-corpus", corpus })).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        issues: [{ code: "FORMAT", path: `/corpus/${field}` }],
      });
    }
  });

  test("hostile queries and every malformed Ranker container fail without accessors or partial output", async () => {
    const store = new InMemoryStore();
    const seeded = app({ store }).application;
    await seeded.add(claim("x", { confidence: "candidate", claimClass: "pattern" }));
    let queryGetterCalls = 0;
    let rankCalls = 0;
    const guarded = app({
      store,
      ranker: {
        id: "test.guarded",
        version: "1",
        rank(context) {
          rankCalls++;
          return context.candidates.map(({ index }) => index);
        },
      },
    }).application;
    const hostileQuery = Object.defineProperty({ activity: "safe" }, "scope", {
      enumerable: true,
      get() {
        queryGetterCalls++;
        return {};
      },
    });
    await expect(guarded.lore(hostileQuery as never)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(queryGetterCalls).toBe(0);
    expect(rankCalls).toBe(0);

    let outputGetterCalls = 0;
    const accessor = [0, 1, 2];
    Object.defineProperty(accessor, "0", {
      enumerable: true,
      get() {
        outputGetterCalls++;
        return 0;
      },
    });
    const excess = [0, 1, 2] as number[] & { extra?: number };
    excess.extra = 3;
    const custom = Object.setPrototypeOf([0, 1, 2], Object.create(Array.prototype));
    for (const output of [
      () => {
        throw new Error("foreign");
      },
      () => ({ 0: 0, length: 1 }),
      () => new Array(3),
      () => accessor,
      () => excess,
      () => custom,
      () => [0, 0, 2],
      () => [0, 1],
      () => [0, 1, 3],
      () => [0, 1, Number.MAX_SAFE_INTEGER + 1],
    ]) {
      const malformed = app({
        store,
        ranker: { id: "test.hostile", version: "1", rank: output as never },
      }).application;
      await expect(malformed.lore({ activity: "hostile-output" })).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
      });
    }
    expect(outputGetterCalls).toBe(0);
  });

  test("custom Ranker permutes occurrences only and duplicate section occurrences retain frozen tuples", async () => {
    const { application } = app({
      ranker: {
        id: "test.reverse",
        version: "1",
        rank(context) {
          return context.candidates.map(({ index }) => index).reverse();
        },
      },
    });
    const added = await application.add(claim("A", { confidence: "candidate", claimClass: "pattern" }));
    const response = await application.lore({ activity: "reverse" });
    expect(response.result.packet.sections.flatMap(({ items }) => items).map(({ kind }) => kind)).toEqual([
      "current",
      "pattern",
      "candidate",
    ]);
    const tuples = allItems(response).map((item) => item.knowledge.representatives);
    for (const tuple of tuples) {
      expect(tuple.map(({ id }) => id)).toEqual([added.result.id]);
      expect(Object.isFrozen(tuple)).toBe(true);
      expect(Object.isFrozen(tuple[0])).toBe(true);
    }
    expect(tuples[0]).not.toBe(tuples[1]);
  });
});
