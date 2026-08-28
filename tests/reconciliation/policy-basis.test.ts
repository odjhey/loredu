import { describe, expect, test } from "bun:test";
import * as kernel from "@loredu/kernel";
import {
  type Basis,
  basisEquals,
  type ClaimDraft,
  type ClaimKey,
  type ClaimPolicy,
  type ClaimPolicyAdviceContext,
  claimKeyOf,
  createBasis,
  createInstant,
  createLoreduApplication,
  createRulesetIdentity,
  createStreamPosition,
  DEFAULT_CLAIM_POLICY,
  DEFAULT_RULESET_IDENTITY,
  LoreduError,
  type LoreduIssue,
} from "@loredu/kernel";
import * as testing from "@loredu/kernel/testing";
import { FixedClock, InMemoryStore, SeededRandomSource } from "@loredu/kernel/testing";
import { validateClaimPolicy } from "../../packages/kernel/src/ports/claim-policy";
import { evaluateClaimPolicyAdvice } from "../../packages/kernel/src/reconciliation";

const actor = { type: "agent" as const, id: "test.agent" };
const claim: ClaimDraft = {
  kind: "claim",
  actor,
  scope: { repo: "loredu", area: "kernel" },
  subject: { type: "code-area", id: "claim-policy" },
  predicate: "implementation-status",
  perspective: "declared",
  value: "implemented",
  confidence: "observed",
};

function defaultBasis(query: Record<string, unknown> = {}): Basis {
  return createBasis({
    stream_position: createStreamPosition(7),
    ruleset: DEFAULT_RULESET_IDENTITY,
    query: query as Basis["query"],
  });
}

function expectDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}

describe("M0 structural Basis identity", () => {
  test("canonical structural identity excludes separately held computed time — @covers T81", () => {
    const mutableQuery = {
      scope: { z: "last", a: "first" },
      filters: ["claim", { b: 2, a: 1 }],
    };
    const mutableRuleset = {
      core: "loredu.reconciliation/v1" as const,
      claim_policy: { id: "loredu.default", version: "1" },
    };
    const first = createBasis({
      stream_position: createStreamPosition(7),
      ruleset: mutableRuleset,
      query: mutableQuery,
    });
    const second = defaultBasis({
      filters: ["claim", { a: 1, b: 2 }],
      scope: { a: "first", z: "last" },
    });
    const firstProjectionMetadata = { basis: first, computed_at: "2024-01-01T00:00:00.000Z" };
    const secondProjectionMetadata = { basis: second, computed_at: "2030-01-01T00:00:00.000Z" };

    expect(firstProjectionMetadata.computed_at).not.toBe(secondProjectionMetadata.computed_at);
    expect(basisEquals(firstProjectionMetadata.basis, secondProjectionMetadata.basis)).toBe(true);
    expect(Object.keys(first)).toEqual(["stream_position", "ruleset", "query"]);
    expect(Object.keys(first.ruleset)).toEqual(["core", "claim_policy"]);
    expect(Object.keys(first.query)).toEqual(["filters", "scope"]);
    expect(Object.keys(first.query.scope as object)).toEqual(["a", "z"]);
    expectDeepFrozen(first);

    mutableQuery.scope.a = "mutated";
    mutableRuleset.claim_policy.version = "mutated";
    expect(first.query.scope).toEqual({ a: "first", z: "last" });
    expect(first.ruleset.claim_policy.version).toBe("1");

    const changedPosition = createBasis({
      ...second,
      stream_position: createStreamPosition(8),
    });
    const changedPolicyId = createBasis({
      ...second,
      ruleset: {
        core: "loredu.reconciliation/v1",
        claim_policy: { id: "consumer.policy", version: "1" },
      },
    });
    const changedPolicyVersion = createBasis({
      ...second,
      ruleset: {
        core: "loredu.reconciliation/v1",
        claim_policy: { id: "loredu.default", version: "2" },
      },
    });
    const changedQueryValue = defaultBasis({
      filters: ["claim", { a: 1, b: 3 }],
      scope: { a: "first", z: "last" },
    });
    const changedQueryOrder = defaultBasis({
      filters: [{ a: 1, b: 2 }, "claim"],
      scope: { a: "first", z: "last" },
    });
    const changedCore = {
      ...second,
      ruleset: { ...second.ruleset, core: "loredu.reconciliation/v2" },
    } as unknown as Basis;
    for (const different of [
      changedPosition,
      changedPolicyId,
      changedPolicyVersion,
      changedQueryValue,
      changedQueryOrder,
      changedCore,
    ])
      expect(basisEquals(second, different)).toBe(false);
  });

  test("Basis construction is exact, descriptor-safe, and rejects computed_at", () => {
    const valid = defaultBasis({ scope: { repo: "loredu" } });
    const invalid: unknown[] = [
      { ruleset: valid.ruleset, query: valid.query },
      { stream_position: valid.stream_position, query: valid.query },
      { stream_position: valid.stream_position, ruleset: valid.ruleset },
      { ...valid, computed_at: "2024-01-01T00:00:00.000Z" },
      { ...valid, extra: true },
      { ...valid, stream_position: -1 },
      { ...valid, stream_position: 1.5 },
      { ...valid, ruleset: { ...valid.ruleset, extra: true } },
      { ...valid, ruleset: { ...valid.ruleset, core: "loredu.reconciliation/v2" } },
      { ...valid, ruleset: { ...valid.ruleset, claim_policy: { id: "Bad Policy", version: "1" } } },
      { ...valid, ruleset: { ...valid.ruleset, claim_policy: { id: "loredu.default" } } },
      { ...valid, query: [] },
      { ...valid, query: { invalid: new Date(0) } },
    ];
    for (const input of invalid)
      expect(() => createBasis(input as Basis)).toThrow(
        expect.objectContaining({ code: "VALIDATION_FAILED" }),
      );

    expect(() =>
      createBasis({ ...valid, computed_at: "2024-01-01T00:00:00.000Z" } as unknown as Basis),
    ).toThrow(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "UNKNOWN_FIELD", path: "/computed_at" }),
        ]),
      }),
    );

    let getterCalls = 0;
    const accessor = { ...valid };
    Object.defineProperty(accessor, "query", {
      enumerable: true,
      get() {
        getterCalls++;
        return {};
      },
    });
    expect(() => createBasis(accessor as Basis)).toThrow(
      expect.objectContaining({
        issues: expect.arrayContaining([expect.objectContaining({ code: "TYPE", path: "/query" })]),
      }),
    );
    expect(getterCalls).toBe(0);
  });
});

describe("M0 ClaimPolicy seam", () => {
  test("default policy preserves declared identity, is exclusive, and has no advice — @covers T82", () => {
    const key = claimKeyOf(claim);
    expect(key).toEqual({
      scope: { area: "kernel", repo: "loredu" },
      subject: { type: "code-area", id: "claim-policy" },
      predicate: "implementation-status",
      perspective: "declared",
    });
    expect(DEFAULT_CLAIM_POLICY).toMatchObject({ id: "loredu.default", version: "1" });
    expect(DEFAULT_CLAIM_POLICY.validateClaimKey(key)).toEqual([]);
    expect(Object.isFrozen(DEFAULT_CLAIM_POLICY.validateClaimKey(key))).toBe(true);
    expect(DEFAULT_CLAIM_POLICY.semantics(key)).toBe("exclusive");
    expect("identity" in DEFAULT_CLAIM_POLICY).toBe(false);
    expect("advise" in DEFAULT_CLAIM_POLICY).toBe(false);
    expect("advisories" in DEFAULT_CLAIM_POLICY).toBe(false);
    expect(createRulesetIdentity(DEFAULT_CLAIM_POLICY)).toEqual({
      core: "loredu.reconciliation/v1",
      claim_policy: { id: "loredu.default", version: "1" },
    });
    expect(DEFAULT_RULESET_IDENTITY).toEqual(createRulesetIdentity(DEFAULT_CLAIM_POLICY));
    expectDeepFrozen(DEFAULT_RULESET_IDENTITY);

    const malformed = {
      ...key,
      subject: { type: "Code Area", id: "claim-policy", extra: true },
      predicate: " implementation-status ",
      extra: true,
    } as unknown as ClaimKey;
    const first = DEFAULT_CLAIM_POLICY.validateClaimKey(malformed);
    const second = DEFAULT_CLAIM_POLICY.validateClaimKey(malformed);
    expect(first).toEqual(second);
    expect(first).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNKNOWN_FIELD", path: "/extra" }),
        expect.objectContaining({ code: "FORMAT", path: "/predicate" }),
        expect.objectContaining({ code: "UNKNOWN_FIELD", path: "/subject/extra" }),
        expect.objectContaining({ code: "FORMAT", path: "/subject/type" }),
      ]),
    );
    expect(Object.isFrozen(first)).toBe(true);
  });

  test("custom policy identity and optional advice are captured without callback execution; remapping rejects", async () => {
    const key = claimKeyOf(claim);
    const customIssue: LoreduIssue = Object.freeze({
      code: "FORMAT",
      path: "/predicate",
      message: "consumer policy refuses this predicate",
    });
    const calls = { validate: 0, semantics: 0, advise: 0 };
    const custom: ClaimPolicy = {
      id: "consumer.policy",
      version: "2024-08-28",
      validateClaimKey(candidate) {
        calls.validate++;
        return candidate.predicate === "implementation-status"
          ? Object.freeze([customIssue])
          : Object.freeze([]);
      },
      semantics() {
        calls.semantics++;
        return "coexisting";
      },
      advise() {
        calls.advise++;
        return [];
      },
    };
    expect(createRulesetIdentity(custom)).toEqual({
      core: "loredu.reconciliation/v1",
      claim_policy: { id: "consumer.policy", version: "2024-08-28" },
    });
    expect(calls).toEqual({ validate: 0, semantics: 0, advise: 0 });
    expect(custom.validateClaimKey(key)).toEqual([customIssue]);
    expect(custom.validateClaimKey(key)).toEqual([customIssue]);
    expect(custom.semantics(key)).toBe("coexisting");

    const app = createLoreduApplication({
      store: new InMemoryStore(),
      clock: new FixedClock(createInstant(0)),
      randomSource: new SeededRandomSource(1),
      claimPolicy: custom,
    });
    expect(
      (
        await app.append({
          kind: "entry",
          actor,
          body: "M0-P does not pull generic Claim append forward.",
        })
      ).record.kind,
    ).toBe("entry");
    await app.append({ ...claim, predicate: "accepted-by-consumer" });
    expect(calls.advise).toBe(0);

    let remapCalls = 0;
    const remapping = {
      ...custom,
      identity() {
        remapCalls++;
        return { ...key, predicate: "remapped" };
      },
    };
    for (const create of [
      () => createRulesetIdentity(remapping as ClaimPolicy),
      () =>
        createLoreduApplication({
          store: new InMemoryStore(),
          clock: new FixedClock(createInstant(0)),
          randomSource: new SeededRandomSource(1),
          claimPolicy: remapping as ClaimPolicy,
        }),
    ])
      expect(create).toThrow(
        expect.objectContaining({
          code: "VALIDATION_FAILED",
          issues: expect.arrayContaining([
            expect.objectContaining({ code: "UNKNOWN_FIELD", path: "/identity" }),
          ]),
        }),
      );
    expect(remapCalls).toBe(0);

    for (const malformed of [
      { ...custom, id: "Consumer Policy" },
      { ...custom, version: "" },
      { id: "consumer.policy", version: "1", semantics: custom.semantics },
      { id: "consumer.policy", version: "1", validateClaimKey: custom.validateClaimKey },
      { ...custom, advise: "not-callable" },
      { ...custom, advisories: () => [] },
    ])
      expect(() => createRulesetIdentity(malformed as ClaimPolicy)).toThrow(LoreduError);
  });

  test("optional advice tracks descriptor presence exactly without invocation or downstream mutation", () => {
    const calls = { validate: 0, semantics: 0, advise: 0, clock: 0, random: 0, store: 0 };
    const base = {
      id: "consumer.optional-advice",
      version: "1",
      validateClaimKey() {
        calls.validate++;
        return Object.freeze([]);
      },
      semantics() {
        calls.semantics++;
        return "exclusive" as const;
      },
    };
    const context = Object.freeze({
      query: Object.freeze({}),
      claims: Object.freeze([]),
      relations: Object.freeze([]),
      resolutions: Object.freeze([]),
    }) as ClaimPolicyAdviceContext;
    const absent = validateClaimPolicy(base);
    expect(Object.hasOwn(absent, "advise")).toBe(false);
    expect(createRulesetIdentity(base)).toEqual({
      core: "loredu.reconciliation/v1",
      claim_policy: { id: base.id, version: base.version },
    });
    const empty = evaluateClaimPolicyAdvice(absent, context);
    expect(empty).toEqual([]);
    expect(Object.isFrozen(empty)).toBe(true);
    expect(calls).toEqual({ validate: 0, semantics: 0, advise: 0, clock: 0, random: 0, store: 0 });

    let receiver: unknown;
    const callableTarget = {
      ...base,
      advise(this: unknown, received: ClaimPolicyAdviceContext) {
        receiver = this;
        calls.advise++;
        expect(received).toBe(context);
        return Object.freeze([]);
      },
    };
    const callable = new Proxy(callableTarget, {
      ownKeys: (target) => Reflect.ownKeys(target),
      getOwnPropertyDescriptor: (target, property) => Reflect.getOwnPropertyDescriptor(target, property),
      getPrototypeOf: (target) => Reflect.getPrototypeOf(target),
    });
    const validatedCallable = validateClaimPolicy(callable);
    expect(Object.hasOwn(validatedCallable, "advise")).toBe(true);
    expect(createRulesetIdentity(callable)).toEqual({
      core: "loredu.reconciliation/v1",
      claim_policy: { id: base.id, version: base.version },
    });
    expect(calls.advise).toBe(0);
    expect(evaluateClaimPolicyAdvice(validatedCallable, context)).toEqual([]);
    expect(calls.advise).toBe(1);
    expect(receiver).toBe(callable);

    const store = {
      async append() {
        calls.store++;
        return createStreamPosition(1);
      },
      async get() {
        calls.store++;
        return undefined;
      },
      async scan() {
        calls.store++;
        return { head: createStreamPosition(0), records: Object.freeze([]) };
      },
      stream() {
        calls.store++;
        return {
          [Symbol.asyncIterator]() {
            return this;
          },
          async next() {
            return { done: true as const, value: undefined };
          },
        };
      },
      async head() {
        calls.store++;
        return createStreamPosition(0);
      },
    };
    const dependencies = {
      store,
      clock: {
        now() {
          calls.clock++;
          return createInstant(0);
        },
      },
      randomSource: {
        nextBytes() {
          calls.random++;
          return new Uint8Array(10);
        },
      },
    };
    const exactIssue = {
      code: "TYPE",
      path: "/advise",
      message: "must be a function when present",
    };
    const presentNonFunctions: unknown[] = [
      { ...base, advise: undefined },
      { ...base, advise: null },
      { ...base, advise: false },
      { ...base, advise: 0 },
      { ...base, advise: "callback" },
      { ...base, advise: [] },
      { ...base, advise: {} },
      new Proxy(
        { ...base, advise: undefined },
        {
          ownKeys: (target) => Reflect.ownKeys(target),
          getOwnPropertyDescriptor: (target, property) => Reflect.getOwnPropertyDescriptor(target, property),
          getPrototypeOf: (target) => Reflect.getPrototypeOf(target),
        },
      ),
    ];
    for (const policy of presentNonFunctions)
      for (const assemble of [
        () => createRulesetIdentity(policy as ClaimPolicy),
        () => createLoreduApplication({ ...dependencies, claimPolicy: policy as ClaimPolicy }),
      ])
        expect(assemble).toThrow(
          expect.objectContaining({
            code: "VALIDATION_FAILED",
            message: "ClaimPolicy validation failed",
            issues: [exactIssue],
          }),
        );

    let getterCalls = 0;
    const accessor = { ...base } as Record<string, unknown>;
    Object.defineProperty(accessor, "advise", {
      enumerable: true,
      get() {
        getterCalls++;
        return () => [];
      },
    });
    expect(() => createRulesetIdentity(accessor as unknown as ClaimPolicy)).toThrow(
      expect.objectContaining({
        code: "VALIDATION_FAILED",
        message: "ClaimPolicy validation failed",
        issues: [{ code: "TYPE", path: "/advise", message: "must be a data property" }],
      }),
    );
    expect(getterCalls).toBe(0);

    const inheritedCalls = { advise: 0 };
    const inherited = Object.assign(
      Object.create({
        validateClaimKey: base.validateClaimKey,
        semantics: base.semantics,
        advise(this: unknown) {
          receiver = this;
          inheritedCalls.advise++;
          return Object.freeze([]);
        },
      }),
      { id: "consumer.inherited-advice", version: "1" },
    ) as ClaimPolicy;
    const validatedInherited = validateClaimPolicy(inherited);
    expect(Object.hasOwn(validatedInherited, "advise")).toBe(true);
    expect(evaluateClaimPolicyAdvice(validatedInherited, context)).toEqual([]);
    expect(inheritedCalls.advise).toBe(1);
    expect(receiver).toBe(inherited);
    const inheritedUndefined = Object.assign(
      Object.create({
        validateClaimKey: base.validateClaimKey,
        semantics: base.semantics,
        advise: undefined,
      }),
      { id: "consumer.inherited-invalid", version: "1" },
    ) as ClaimPolicy;
    expect(() => createRulesetIdentity(inheritedUndefined)).toThrow(
      expect.objectContaining({ issues: [exactIssue] }),
    );

    const hostile = [
      new Proxy(base, {
        ownKeys() {
          throw new Error("proxy-secret-own-keys");
        },
      }),
      new Proxy(base, {
        getOwnPropertyDescriptor(target, property) {
          if (property === "advise") throw new Error("proxy-secret-descriptor");
          return Reflect.getOwnPropertyDescriptor(target, property);
        },
      }),
      new Proxy(base, {
        getPrototypeOf() {
          throw new Error("proxy-secret-prototype");
        },
      }),
    ];
    for (const policy of hostile) {
      let caught: unknown;
      try {
        createLoreduApplication({ ...dependencies, claimPolicy: policy });
      } catch (error) {
        caught = error;
      }
      expect(caught).toMatchObject({ code: "VALIDATION_FAILED", message: "ClaimPolicy validation failed" });
      expect(JSON.stringify(caught)).not.toContain("proxy-secret");
    }

    let cyclicPrototypePolicy: ClaimPolicy;
    cyclicPrototypePolicy = new Proxy(base, {
      getPrototypeOf() {
        return cyclicPrototypePolicy;
      },
    });
    for (const assemble of [
      () => createRulesetIdentity(cyclicPrototypePolicy),
      () => createLoreduApplication({ ...dependencies, claimPolicy: cyclicPrototypePolicy }),
    ])
      expect(assemble).toThrow(
        expect.objectContaining({
          code: "VALIDATION_FAILED",
          message: "ClaimPolicy validation failed",
          issues: [
            {
              code: "TYPE",
              path: "/advise",
              message: "could not inspect ClaimPolicy field",
            },
          ],
        }),
      );
    expect(getterCalls).toBe(0);
    expect(calls).toEqual({ validate: 0, semantics: 0, advise: 1, clock: 0, random: 0, store: 0 });
  });

  test("custom policy shape validation rejects accessors without invoking them", () => {
    const custom: ClaimPolicy = {
      id: "consumer.policy",
      version: "1",
      validateClaimKey() {
        return Object.freeze([]);
      },
      semantics() {
        return "exclusive";
      },
      advise() {
        return Object.freeze([]);
      },
    };

    for (const field of ["id", "version", "validateClaimKey", "semantics", "advise"] as const) {
      let getterCalls = 0;
      const accessorPolicy = { ...custom };
      Object.defineProperty(accessorPolicy, field, {
        enumerable: true,
        get() {
          getterCalls++;
          return Reflect.get(custom, field);
        },
      });

      for (const create of [
        () => createRulesetIdentity(accessorPolicy),
        () =>
          createLoreduApplication({
            store: new InMemoryStore(),
            clock: new FixedClock(createInstant(0)),
            randomSource: new SeededRandomSource(1),
            claimPolicy: accessorPolicy,
          }),
      ]) {
        expect(create).toThrow(
          expect.objectContaining({
            code: "VALIDATION_FAILED",
            issues: expect.arrayContaining([expect.objectContaining({ code: "TYPE", path: `/${field}` })]),
          }),
        );
        expect(getterCalls).toBe(0);
      }
    }
  });

  test("normal and testing runtime export allowlists remain exact through M1-K", () => {
    expect(Object.keys(kernel).sort()).toEqual(
      [
        "DEFAULT_CLAIM_POLICY",
        "DEFAULT_RULESET_IDENTITY",
        "LoreduError",
        "RECORD_ID_PREFIX",
        "RECORD_SCHEMA_ID",
        "basisEquals",
        "claimKeyOf",
        "claimKeysEqual",
        "createBasis",
        "createInstant",
        "createLoreduApplication",
        "createRulesetIdentity",
        "createStreamPosition",
        "decodePersistedRecord",
        "decodeRecordDraft",
        "encodePersistedRecord",
        "jsonValuesEqual",
        "recordKindOfIdPrefix",
      ].sort(),
    );
    expect(Object.keys(testing).sort()).toEqual(
      ["FixedClock", "InMemoryStore", "SeededRandomSource", "recordStoreConformance"].sort(),
    );
  });
});
