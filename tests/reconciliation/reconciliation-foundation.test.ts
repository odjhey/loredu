import { describe, expect, test } from "bun:test";
import {
  type Claim,
  type ClaimDraft,
  type ClaimId,
  type ClaimPolicy,
  createInstant,
  createLoreduApplication,
  createStreamPosition,
  decodePersistedRecord,
  type Relation,
  type Resolution,
} from "@loredu/kernel";
import { FixedClock, InMemoryStore, SeededRandomSource } from "@loredu/kernel/testing";
import { validateClaimPolicy } from "../../packages/kernel/src/ports/claim-policy";
import {
  classifyClaimPair,
  createClaimPolicyAdviceContext,
  evaluateClaimPolicyAdvice,
  type PositionedClaim,
  type PositionedRelation,
  type PositionedResolution,
  reconcileApplicableClaimGroup,
} from "../../packages/kernel/src/reconciliation";

const agent = { type: "agent" as const, id: "test.agent" };
const human = { type: "human" as const, id: "test.human" };
const ids = {
  c1: "clm_0000000000000001",
  c2: "clm_0000000000000002",
  c3: "clm_0000000000000003",
  c4: "clm_0000000000000004",
  r1: "rel_0000000000000001",
  r2: "rel_0000000000000002",
  r3: "rel_0000000000000003",
  s1: "res_0000000000000001",
  s2: "res_0000000000000002",
} as const;

function persistedClaim(
  id: string,
  options: {
    actor?: typeof agent | typeof human;
    value?: unknown;
    predicate?: string;
    perspective?: string;
    confidence?: Claim["confidence"];
    validFrom?: string;
    validUntil?: string;
    sources?: readonly { ref: string; locator?: string; snapshot?: string }[];
  } = {},
): Claim {
  return decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "claim",
    id,
    recorded_at: "2026-03-01T00:00:00.000Z",
    actor: options.actor ?? agent,
    scope: { repo: "loredu" },
    subject: { type: "code-area", id: "commands" },
    predicate: options.predicate ?? "location",
    ...(options.perspective === undefined ? {} : { perspective: options.perspective }),
    value: options.value ?? { stable: true, path: "src/commands" },
    confidence: options.confidence ?? "observed",
    ...(options.validFrom === undefined ? {} : { valid_from: options.validFrom }),
    ...(options.validUntil === undefined ? {} : { valid_until: options.validUntil }),
    derived_from: [],
    metadata: {},
    sources: options.sources ?? [],
  }) as Claim;
}

function relation(
  id: string,
  from: string,
  to: string,
  relationType: Relation["relation_type"] = "supersedes",
): Relation {
  return decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "relation",
    id,
    recorded_at: "2026-03-01T00:00:00.000Z",
    actor: agent,
    scope: {},
    relation_type: relationType,
    from,
    to,
    metadata: {},
    sources: [],
  }) as Relation;
}

function resolution(
  id: string,
  targets: readonly string[],
  options: {
    decision?: Resolution["decision"];
    replacement?: string;
    effectiveAt?: string;
  } = {},
): Resolution {
  return decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "resolution",
    id,
    recorded_at: "2026-03-01T00:00:00.000Z",
    actor: agent,
    scope: {},
    targets,
    decision: options.decision ?? "prefer",
    ...(options.replacement === undefined ? {} : { replacement: options.replacement }),
    ...(options.effectiveAt === undefined ? {} : { effective_at: options.effectiveAt }),
    reason: "deterministic fixture judgment",
    metadata: {},
    sources: [],
  }) as Resolution;
}

function positionedClaim(position: number, record: Claim): PositionedClaim {
  return Object.freeze({ position: createStreamPosition(position), record });
}
function positionedRelation(position: number, record: Relation): PositionedRelation {
  return Object.freeze({ position: createStreamPosition(position), record });
}
function positionedResolution(position: number, record: Resolution): PositionedResolution {
  return Object.freeze({ position: createStreamPosition(position), record });
}
function claimDraft(actor: typeof agent | typeof human, value: unknown): ClaimDraft {
  return {
    kind: "claim",
    actor,
    scope: { repo: "loredu" },
    subject: { type: "code-area", id: "commands" },
    predicate: "location",
    value: value as never,
    confidence: "observed",
  };
}
function deeplyFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(deeplyFrozen);
}

// This bounded M2-R suite executes the internal deterministic engine foundation.
// Public `current`/temporal query wiring and full projection shapes remain M2-P/E scope.
describe("ADR 0027 deterministic reconciliation foundation", () => {
  test("different actors corroborate into one preferred value without appending a Relation — @covers T20", async () => {
    const first = positionedClaim(1, persistedClaim(ids.c1, { actor: agent }));
    const second = positionedClaim(
      2,
      persistedClaim(ids.c2, { actor: human, value: { path: "src/commands", stable: true } }),
    );
    const reconciled = reconcileApplicableClaimGroup({
      claims: [first, second],
      visibleClaims: [first, second],
      semantics: "exclusive",
    });
    expect(reconciled).toMatchObject({
      state: "preferred",
      cycle: false,
      relations: [{ relation: "corroboration", from: second, to: first }],
    });
    expect(reconciled.values).toHaveLength(1);
    expect(reconciled.values[0]?.claims.map(({ record }) => String(record.id))).toEqual([ids.c1, ids.c2]);

    const store = new InMemoryStore();
    const app = createLoreduApplication({
      store,
      clock: new FixedClock(createInstant(1_700_000_000_000)),
      randomSource: new SeededRandomSource(7),
    });
    await app.add(claimDraft(agent, { stable: true, path: "src/commands" }));
    const added = await app.add(claimDraft(human, { path: "src/commands", stable: true }));
    expect(added.reconciliation.state).toBe("corroboration");
    expect((await store.scan()).records.map(({ record }) => record.kind)).toEqual(["claim", "claim"]);
  });

  test("exclusive different values dispute and an active one-value supersedes cycle removes nobody — @covers T21", () => {
    const old = positionedClaim(1, persistedClaim(ids.c1, { value: "old" }));
    const newer = positionedClaim(2, persistedClaim(ids.c2, { value: "new" }));
    const disputed = reconcileApplicableClaimGroup({
      claims: [old, newer],
      visibleClaims: [old, newer],
      semantics: "exclusive",
    });
    expect(disputed.state).toBe("disputed");
    expect(disputed.relations.map(({ relation }) => relation)).toEqual(["conflict"]);
    expect(disputed.claims.map(({ record }) => String(record.id))).toEqual([ids.c1, ids.c2]);

    const equalOld = positionedClaim(1, persistedClaim(ids.c1, { value: { a: 1 } }));
    const equalNew = positionedClaim(2, persistedClaim(ids.c2, { value: { a: 1 } }));
    const forward = positionedRelation(3, relation(ids.r1, ids.c2, ids.c1));
    const backward = positionedRelation(4, relation(ids.r2, ids.c1, ids.c2));
    const cycle = reconcileApplicableClaimGroup({
      claims: [equalOld, equalNew],
      visibleClaims: [equalOld, equalNew],
      relations: [forward, backward],
      semantics: "exclusive",
    });
    expect(cycle).toMatchObject({ state: "disputed", cycle: true });
    expect(cycle.values).toHaveLength(1);
    expect(cycle.claims.map(({ record }) => String(record.id))).toEqual([ids.c1, ids.c2]);
    expect(
      reconcileApplicableClaimGroup({
        claims: [equalOld, equalNew],
        visibleClaims: [equalOld, equalNew],
        relations: [forward, backward],
        semantics: "coexisting",
      }).state,
    ).toBe("disputed");

    const deactivation = positionedResolution(5, resolution(ids.s1, [ids.r2], { decision: "retract" }));
    const noCycle = reconcileApplicableClaimGroup({
      claims: [equalOld, equalNew],
      visibleClaims: [equalOld, equalNew],
      relations: [forward, backward],
      resolutions: [deactivation],
      semantics: "exclusive",
    });
    expect(noCycle).toMatchObject({ state: "preferred", cycle: false });
    expect(noCycle.claims.map(({ record }) => String(record.id))).toEqual([ids.c2]);
  });

  test("complete latest Resolution outranks Relations while incomplete judgment has no partial effect", () => {
    const irrelevant = positionedClaim(1, persistedClaim(ids.c3, { predicate: "owner", value: "elsewhere" }));
    const first = positionedClaim(2, persistedClaim(ids.c1, { value: "old" }));
    const second = positionedClaim(3, persistedClaim(ids.c2, { value: "new" }));
    const complete = positionedResolution(
      4,
      resolution(ids.s1, [ids.c1, ids.c2, ids.c3], { decision: "prefer", replacement: ids.c2 }),
    );
    const incompleteLater = positionedResolution(
      5,
      resolution(ids.s2, [ids.c1], { decision: "prefer", replacement: ids.c1 }),
    );
    const explicitOpposite = positionedRelation(6, relation(ids.r1, ids.c1, ids.c2));
    const resolved = reconcileApplicableClaimGroup({
      claims: [first, second],
      visibleClaims: [irrelevant, first, second],
      relations: [explicitOpposite],
      resolutions: [complete, incompleteLater],
      semantics: "exclusive",
    });
    expect(resolved).toMatchObject({ state: "preferred", resolution: complete, cycle: false });
    expect(resolved.claims.map(({ record }) => String(record.id))).toEqual([ids.c2]);

    const equalFirst = positionedClaim(1, persistedClaim(ids.c1, { value: "same" }));
    const equalSecond = positionedClaim(2, persistedClaim(ids.c2, { value: "same" }));
    const edge = positionedRelation(3, relation(ids.r1, ids.c2, ids.c1));
    const relationSelected = reconcileApplicableClaimGroup({
      claims: [equalFirst, equalSecond],
      visibleClaims: [equalFirst, equalSecond],
      relations: [edge],
      semantics: "exclusive",
    });
    expect(relationSelected).toMatchObject({ state: "preferred", cycle: false });
    expect(relationSelected.claims.map(({ record }) => String(record.id))).toEqual([ids.c2]);
  });

  test("advice receives only admitted applicable context, orders dense cross-key output, accepts 200, and bounds before elements — @covers T22", () => {
    const documented = positionedClaim(1, persistedClaim(ids.c1, { perspective: "documented" }));
    const observed = positionedClaim(2, persistedClaim(ids.c2, { perspective: "observed" }));
    const future = positionedClaim(
      3,
      persistedClaim(ids.c3, {
        perspective: "future",
        validFrom: "2026-04-01T00:00:00.000Z",
      }),
    );
    const admittedRelation = positionedRelation(4, relation(ids.r1, ids.c1, ids.c2, "related_to"));
    const excludedRelation = positionedRelation(5, relation(ids.r2, ids.c2, ids.c3, "related_to"));
    const admittedResolution = positionedResolution(
      6,
      resolution(ids.s1, [ids.c1, ids.r1], { replacement: ids.c2 }),
    );
    const excludedResolution = positionedResolution(
      7,
      resolution(ids.s2, [ids.c1, ids.r2], { replacement: ids.c2 }),
    );
    const context = createClaimPolicyAdviceContext({
      query: { operation: "current", valid_at: "2026-03-01T00:00:00.000Z" },
      claims: [future, observed, documented],
      relations: [excludedRelation, admittedRelation],
      resolutions: [excludedResolution, admittedResolution],
      validAt: "2026-03-01T00:00:00.000Z",
    });
    expect(context.claims.map(({ record }) => String(record.id))).toEqual([ids.c1, ids.c2]);
    expect(context.relations.map(({ record }) => String(record.id))).toEqual([ids.r1]);
    expect(context.resolutions.map(({ record }) => String(record.id))).toEqual([ids.s1]);
    expect(deeplyFrozen(context)).toBe(true);

    let calls = 0;
    const drafts = Array.from({ length: 200 }, (_, index) => ({
      code: `gap.${String(199 - index).padStart(3, "0")}`,
      claims: index % 2 === 0 ? [ids.c2, ids.c1] : [ids.c1],
      details: { index },
    })) as never;
    const policy: ClaimPolicy = {
      id: "test.advice",
      version: "1",
      validateClaimKey: () => [],
      semantics: () => "exclusive",
      advise(received) {
        calls++;
        expect(received).toBe(context);
        return drafts;
      },
    };
    const accepted = evaluateClaimPolicyAdvice(validateClaimPolicy(policy), context);
    expect(calls).toBe(1);
    expect(accepted).toHaveLength(200);
    expect(accepted[0]).toMatchObject({ code: "gap.000", claims: [ids.c1] });
    expect(accepted[199]).toMatchObject({ code: "gap.199", claims: [ids.c1, ids.c2] });
    expect(deeplyFrozen(accepted)).toBe(true);

    let indexedReads = 0;
    const oversized: unknown[] = [];
    Object.defineProperty(oversized, "0", {
      enumerable: true,
      configurable: true,
      get() {
        indexedReads++;
        throw new Error("must not inspect an over-limit element");
      },
    });
    oversized.length = 201;
    const overLimit = validateClaimPolicy({ ...policy, advise: () => oversized as never });
    expect(() => evaluateClaimPolicyAdvice(overLimit, context)).toThrow(
      expect.objectContaining({
        code: "VALIDATION_FAILED",
        issues: [expect.objectContaining({ code: "RANGE", path: "" })],
      }),
    );
    expect(indexedReads).toBe(0);
  });

  test("advice validation rejects active, sparse, foreign, malformed, and duplicate output without partial data", () => {
    const first = positionedClaim(1, persistedClaim(ids.c1));
    const second = positionedClaim(2, persistedClaim(ids.c2));
    const context = createClaimPolicyAdviceContext({
      query: { operation: "current", valid_at: "2026-03-01T00:00:00.000Z" },
      claims: [first, second],
      relations: [],
      resolutions: [],
      validAt: "2026-03-01T00:00:00.000Z",
    });
    const evaluate = (returned: unknown) =>
      evaluateClaimPolicyAdvice(
        validateClaimPolicy({
          id: "test.invalid-advice",
          version: "1",
          validateClaimKey: () => [],
          semantics: () => "exclusive",
          advise: () => returned as never,
        }),
        context,
      );
    const extra = Object.assign([], { extra: true });
    for (const malformed of [
      {},
      new Array(1),
      extra,
      [{ code: "Bad Code", claims: [ids.c1], details: {} }],
      [{ code: "gap", claims: [], details: {} }],
      [{ code: "gap", claims: [ids.c1, ids.c1], details: {} }],
      [{ code: "gap", claims: [ids.c3], details: {} }],
      [{ code: "gap", claims: [ids.c1], details: [] }],
      [
        { code: "gap", claims: [ids.c1], details: { same: true } },
        { code: "gap", claims: [ids.c1], details: { same: true } },
      ],
    ])
      expect(() => evaluate(malformed)).toThrow(expect.objectContaining({ code: "VALIDATION_FAILED" }));

    let getterCalls = 0;
    const active: unknown[] = [];
    Object.defineProperty(active, "0", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls++;
        return { code: "gap", claims: [ids.c1], details: {} };
      },
    });
    expect(() => evaluate(active)).toThrow(expect.objectContaining({ code: "VALIDATION_FAILED" }));
    expect(getterCalls).toBe(0);

    const throwing = validateClaimPolicy({
      id: "test.throwing-advice",
      version: "1",
      validateClaimKey: () => [],
      semantics: () => "exclusive",
      advise() {
        throw new Error("foreign callback details");
      },
    });
    expect(() => evaluateClaimPolicyAdvice(throwing, context)).toThrow(
      expect.objectContaining({ code: "VALIDATION_FAILED", message: "ClaimPolicy advice validation failed" }),
    );
    expect(
      evaluateClaimPolicyAdvice(
        validateClaimPolicy({
          id: "test.no-advice",
          version: "1",
          validateClaimKey: () => [],
          semantics: () => "exclusive",
        }),
        context,
      ),
    ).toEqual([]);
  });

  test("policy and explicit cross-key links stay advisory/history and cannot create pair or group reconciliation — @covers T23", () => {
    const documented = positionedClaim(1, persistedClaim(ids.c1, { perspective: "documented" }));
    const observed = positionedClaim(2, persistedClaim(ids.c2, { perspective: "observed" }));
    const crossKey = positionedRelation(3, relation(ids.r1, ids.c1, ids.c2, "duplicates"));
    expect(classifyClaimPair(documented, observed, "exclusive")).toBeUndefined();
    expect(() =>
      reconcileApplicableClaimGroup({
        claims: [documented, observed],
        visibleClaims: [documented, observed],
        relations: [crossKey],
        semantics: "exclusive",
      }),
    ).toThrow("cannot cross an exact ClaimKey");

    const context = createClaimPolicyAdviceContext({
      query: { operation: "current", valid_at: "2026-03-01T00:00:00.000Z" },
      claims: [documented, observed],
      relations: [crossKey],
      resolutions: [],
      validAt: "2026-03-01T00:00:00.000Z",
    });
    const advisory = evaluateClaimPolicyAdvice(
      validateClaimPolicy({
        id: "test.cross-key",
        version: "1",
        validateClaimKey: () => [],
        semantics: () => "exclusive",
        advise: () => [{ code: "process.gap", claims: [ids.c1, ids.c2] as [ClaimId, ClaimId], details: {} }],
      }),
      context,
    );
    expect(context.relations.map(({ record }) => String(record.id))).toEqual([ids.r1]);
    expect(advisory.map((item) => ({ ...item, claims: item.claims.map(String) }))).toEqual([
      { code: "process.gap", claims: [ids.c1, ids.c2], details: {} },
    ]);
    expect(classifyClaimPair(documented, observed, "exclusive")).toBeUndefined();
  });

  test("canonical equality closes duplicate, corroboration, support, temporal, and scalar conflict boundaries — @covers T86", () => {
    const base = positionedClaim(1, persistedClaim(ids.c1, { value: { b: [1, true], a: "x" } }));
    const reordered = positionedClaim(2, persistedClaim(ids.c2, { value: { a: "x", b: [1, true] } }));
    expect(classifyClaimPair(base, reordered, "exclusive")?.relation).toBe("duplicate");

    const independent = positionedClaim(
      2,
      persistedClaim(ids.c2, { actor: human, value: { a: "x", b: [1, true] } }),
    );
    expect(classifyClaimPair(base, independent, "exclusive")?.relation).toBe("corroboration");

    const sharedEvidenceBase = positionedClaim(
      1,
      persistedClaim(ids.c1, { actor: agent, sources: [{ ref: "doc", snapshot: "v1" }] }),
    );
    const sharedEvidenceOtherActor = positionedClaim(
      2,
      persistedClaim(ids.c2, { actor: human, sources: [{ snapshot: "v1", ref: "doc" }] }),
    );
    expect(classifyClaimPair(sharedEvidenceBase, sharedEvidenceOtherActor, "exclusive")?.relation).toBe(
      "duplicate",
    );

    const refined = positionedClaim(2, persistedClaim(ids.c2, { confidence: "confirmed" }));
    expect(
      classifyClaimPair(positionedClaim(1, persistedClaim(ids.c1)), refined, "exclusive")?.relation,
    ).toBe("support");

    const number = positionedClaim(1, persistedClaim(ids.c1, { value: 1 }));
    const text = positionedClaim(2, persistedClaim(ids.c2, { value: "1" }));
    expect(classifyClaimPair(number, text, "exclusive")?.relation).toBe("conflict");
    expect(classifyClaimPair(number, text, "coexisting")?.relation).toBe("coexistence");

    const january = positionedClaim(2, persistedClaim(ids.c2, { validUntil: "2026-02-01T00:00:00.000Z" }));
    const touching = positionedClaim(3, persistedClaim(ids.c3, { validFrom: "2026-02-01T00:00:00.000Z" }));
    const disjoint = positionedClaim(4, persistedClaim(ids.c4, { validFrom: "2026-02-01T00:00:00.001Z" }));
    expect(classifyClaimPair(january, touching, "exclusive")?.relation).toBe("support");
    expect(classifyClaimPair(january, disjoint, "exclusive")?.relation).toBe("temporal-succession");
  });
});
