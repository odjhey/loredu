import { describe, expect, test } from "bun:test";
import {
  ACTOR_TYPES,
  CLAIM_CONFIDENCES,
  canonicalizeJsonValue,
  canonicalizeScope,
  claimKeyOf,
  claimKeysEqual,
  createClaimKey,
  type EntryDraft,
  encodeRecordIdSuffix,
  isRecordIdForKind,
  type JsonObject,
  jsonValuesEqual,
  parsePersistedRecord,
  parseRecordDraft,
  RECORD_ID_PREFIX,
  RECORD_ID_SUFFIX_ALPHABET,
  RELATION_TYPES,
  RESOLUTION_DECISIONS,
  type RecordDraft,
  RecordValidationError,
  recordIdFromBytes,
  recordKindOfId,
  scopesEqual,
  VERIFICATION_RESULTS,
} from "../../packages/kernel/src/index";

const ZERO_SUFFIX = "0000000000000000";
const IDS = {
  entry: `ent_${ZERO_SUFFIX}`,
  claim: `clm_${ZERO_SUFFIX}`,
  relation: `rel_${ZERO_SUFFIX}`,
  resolution: `res_${ZERO_SUFFIX}`,
  verification: `ver_${ZERO_SUFFIX}`,
} as const;
const RECORD_KINDS = ["entry", "claim", "relation", "resolution", "verification"] as const;
const RECORDED_AT = "2026-08-27T01:02:03+08:00";
const ACTOR = { type: "agent", id: "agent:review-1" } as const;

function expectFieldError(run: () => unknown, field: string, message?: string): void {
  try {
    run();
    throw new Error("expected validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(RecordValidationError);
    expect((error as RecordValidationError).field).toBe(field);
    expect((error as RecordValidationError).message).toContain(field);
    if (message !== undefined) expect((error as RecordValidationError).message).toContain(message);
  }
}

function persistedEnvelope<K extends keyof typeof IDS>(kind: K) {
  return {
    schema: "loredu.record/v1",
    kind,
    id: IDS[kind],
    recorded_at: RECORDED_AT,
    actor: ACTOR,
    scope: {},
    metadata: {},
    sources: [],
  } as const;
}

function validEntryDraft(): Record<string, unknown> {
  return { kind: "entry", actor: ACTOR, body: "Kept exactly.\n" };
}

function validClaimDraft(): Record<string, unknown> {
  return {
    kind: "claim",
    actor: ACTOR,
    subject: { type: "code-area", id: "command-registration" },
    predicate: "location",
    value: { path: "src/commands", nested: [1, true, null] },
    confidence: "observed",
  };
}

function validRelationDraft(): Record<string, unknown> {
  return {
    kind: "relation",
    actor: ACTOR,
    relation_type: "supports",
    from: { id: IDS.claim, kind: "claim" },
    to: { id: IDS.entry, kind: "entry" },
  };
}

function validResolutionDraft(): Record<string, unknown> {
  return {
    kind: "resolution",
    actor: ACTOR,
    targets: [IDS.claim, IDS.relation],
    decision: "prefer",
    replacement: IDS.claim,
    effective_at: "2024-02-29T12:30:00Z",
    reason: "  retained exactly  ",
  };
}

function validVerificationDraft(): Record<string, unknown> {
  return {
    kind: "verification",
    actor: ACTOR,
    targets: [IDS.claim],
    verified_against: [{ source: " HTTPS://example.test/A ", snapshot: " REV-A " }],
    result: "confirmed",
  };
}

function typeBoundaryAssertions(draft: EntryDraft, union: RecordDraft): void {
  // @ts-expect-error drafts never expose application-owned ids
  draft.id;
  // @ts-expect-error drafts never expose application-owned schema
  draft.schema;
  // @ts-expect-error drafts never expose application-owned recorded_at
  draft.recorded_at;
  // @ts-expect-error readonly public fields cannot be reassigned
  draft.body = "changed";
  // @ts-expect-error nested public fields are readonly
  draft.actor.id = "changed";
  if (union.kind === "claim") {
    union.predicate satisfies string;
    // @ts-expect-error discriminated narrowing excludes entry payload
    union.body;
  }
}
void typeBoundaryAssertions;

const compileTimeDraft = {
  kind: "entry",
  actor: { type: "human", id: "operator" },
  body: "finding",
} satisfies EntryDraft;
void compileTimeDraft;

describe("five-family draft and persisted unions", () => {
  test("accepts and freezes each exact draft family", () => {
    const drafts = [
      parseRecordDraft(validEntryDraft()),
      parseRecordDraft(validClaimDraft()),
      parseRecordDraft(validRelationDraft()),
      parseRecordDraft(validResolutionDraft()),
      parseRecordDraft(validVerificationDraft()),
    ];
    expect(drafts.map((draft) => draft.kind)).toEqual([
      "entry",
      "claim",
      "relation",
      "resolution",
      "verification",
    ]);
    for (const draft of drafts) {
      expect(Object.isFrozen(draft)).toBe(true);
      expect(Object.isFrozen(draft.actor)).toBe(true);
      expect("schema" in draft).toBe(false);
      expect("id" in draft).toBe(false);
      expect("recorded_at" in draft).toBe(false);
    }
  });

  test("rejects all erased caller stamp fields instead of overwriting them", () => {
    for (const field of ["schema", "id", "recorded_at"] as const) {
      expectFieldError(
        () => parseRecordDraft({ ...validEntryDraft(), [field]: "caller" }),
        field,
        "application-owned",
      );
    }
  });

  test("requires explicit canonical common fields on persisted records", () => {
    const complete = { ...persistedEnvelope("entry"), body: "body" };
    expect(parsePersistedRecord(complete)).toEqual(complete);
    for (const field of ["schema", "id", "recorded_at", "scope", "metadata", "sources"] as const) {
      const missing = { ...complete } as Record<string, unknown>;
      delete missing[field];
      expectFieldError(() => parsePersistedRecord(missing), field);
    }
  });

  test("accepts complete persisted forms for all families", () => {
    const records = [
      { ...persistedEnvelope("entry"), body: "entry" },
      { ...persistedEnvelope("claim"), ...validClaimDraft(), kind: "claim", derived_from: [] },
      { ...persistedEnvelope("relation"), ...validRelationDraft(), kind: "relation" },
      { ...persistedEnvelope("resolution"), ...validResolutionDraft(), kind: "resolution" },
      { ...persistedEnvelope("verification"), ...validVerificationDraft(), kind: "verification" },
    ];
    expect(records.map((record) => parsePersistedRecord(record).kind)).toEqual([
      "entry",
      "claim",
      "relation",
      "resolution",
      "verification",
    ]);
  });

  test("rejects explicitly undefined optional values rather than treating them as absent", () => {
    expectFieldError(() => parseRecordDraft({ ...validClaimDraft(), perspective: undefined }), "perspective");
    expectFieldError(
      () => parseRecordDraft({ ...validResolutionDraft(), replacement: undefined }),
      "replacement",
    );
  });

  test("fails loudly on unknown schema, kind, and enumerable extra fields", () => {
    expectFieldError(
      () => parsePersistedRecord({ ...persistedEnvelope("entry"), schema: "loredu.record/v2", body: "x" }),
      "schema",
      "unknown schema",
    );
    expectFieldError(() => parseRecordDraft({ ...validEntryDraft(), kind: "note" }), "kind");
    expectFieldError(
      () => parseRecordDraft({ ...validEntryDraft(), extra: true }),
      "extra",
      "not a recognized field",
    );
  });

  test("rejects hidden, symbol, and accessor envelope fields without invoking getters", () => {
    const hidden = validEntryDraft();
    Object.defineProperty(hidden, "hidden", { value: true, enumerable: false });
    expectFieldError(() => parseRecordDraft(hidden), "hidden", "not a recognized field");

    const symbolic = validEntryDraft();
    Object.defineProperty(symbolic, Symbol("hidden"), { value: true, enumerable: false });
    expectFieldError(() => parseRecordDraft(symbolic), "record", "symbol-keyed");

    let getterReads = 0;
    const accessor: Record<string, unknown> = { kind: "entry", actor: ACTOR };
    Object.defineProperty(accessor, "body", {
      enumerable: true,
      get() {
        getterReads += 1;
        return "must not execute";
      },
    });
    expectFieldError(() => parseRecordDraft(accessor), "body", "not an accessor");
    expect(getterReads).toBe(0);
  });
});

describe("identifier-safe fields and semantic-specific strings", () => {
  test("accepts every internal separator but never normalizes", () => {
    const draft = parseRecordDraft({
      ...validClaimDraft(),
      actor: { type: "program", id: "agent.v1:team/review-job" },
      subject: { type: "code-area", id: "command_registration:v1/path" },
      predicate: "policy.retention-v1",
      perspective: "observed/process",
      scope: { "repo.name": "rozoro/loredu" },
    });
    expect(draft.actor.id).toBe("agent.v1:team/review-job");
  });

  test("rejects token empty, uppercase, whitespace, edge separators, and overlength cases at their fields", () => {
    for (const id of ["", "Agent", "two words", "-leading", "trailing_", "a".repeat(129)]) {
      expectFieldError(
        () => parseRecordDraft({ ...validEntryDraft(), actor: { type: "agent", id } }),
        "actor.id",
      );
    }
    expectFieldError(
      () => parseRecordDraft({ ...validClaimDraft(), subject: { type: "code-area", id: "free prose" } }),
      "subject.id",
    );
    expectFieldError(
      () => parseRecordDraft({ ...validClaimDraft(), scope: { Repo: "loredu" } }),
      'scope key "Repo"',
    );
    expectFieldError(
      () => parseRecordDraft({ ...validClaimDraft(), scope: { repo: { nested: true } } }),
      "scope.repo",
    );
  });

  test("preserves URL/path/vendor source strings and open vocabularies verbatim", () => {
    const source = " HTTPS://Vendor.test/A Path?q=X ";
    const entry = parseRecordDraft({
      ...validEntryDraft(),
      entry_type: " Arbitrary Finding Type ",
      sources: [{ ref: source, locator: " Line 10 ", snapshot: " Rev-A " }],
    });
    const claim = parseRecordDraft({ ...validClaimDraft(), claim_class: "Consumer Defined CLASS" });
    expect(entry.kind === "entry" && entry.entry_type).toBe(" Arbitrary Finding Type ");
    expect(entry.sources?.[0]?.ref).toBe(source);
    expect(claim.kind === "claim" && claim.claim_class).toBe("Consumer Defined CLASS");
    expect(parseRecordDraft({ ...validClaimDraft(), claim_class: "" })).toMatchObject({ claim_class: "" });
  });

  test("validates source fields independently from identifier tokens and enforces exact shape", () => {
    expectFieldError(
      () => parseRecordDraft({ ...validEntryDraft(), sources: [{ ref: "   " }] }),
      "sources[0].ref",
    );
    expectFieldError(
      () => parseRecordDraft({ ...validEntryDraft(), sources: [{ ref: "x".repeat(1025) }] }),
      "sources[0].ref",
    );
    expectFieldError(
      () => parseRecordDraft({ ...validEntryDraft(), sources: [{ ref: "x", url: "hidden" }] }),
      "sources[0].url",
    );
    const accepted = parseRecordDraft({ ...validEntryDraft(), sources: [{ ref: "X".repeat(1024) }] });
    expect(accepted.sources?.[0]?.ref.length).toBe(1024);
    expect(
      parseRecordDraft({ ...validEntryDraft(), sources: [{ ref: "😀".repeat(1024) }] }).sources?.[0]?.ref,
    ).toBe("😀".repeat(1024));

    const hiddenSource: Record<string, unknown> = { ref: "source" };
    Object.defineProperty(hiddenSource, "hidden", { value: true, enumerable: false });
    expectFieldError(
      () => parseRecordDraft({ ...validEntryDraft(), sources: [hiddenSource] }),
      "sources[0].hidden",
      "not a recognized field",
    );
  });

  test("rejects unsupported own properties and sparsity on contract collection arrays", () => {
    const sources = [{ ref: "source" }] as Array<{ ref: string }> & { hidden?: boolean };
    Object.defineProperty(sources, "hidden", { value: true, enumerable: false });
    expectFieldError(
      () => parseRecordDraft({ ...validEntryDraft(), sources }),
      "sources.hidden",
      "unsupported array property",
    );

    const targets = [IDS.claim] as string[] & { annotation?: string };
    targets.annotation = "extra";
    expectFieldError(
      () => parseRecordDraft({ ...validVerificationDraft(), targets }),
      "targets.annotation",
      "unsupported array property",
    );
    expectFieldError(
      () => parseRecordDraft({ ...validEntryDraft(), sources: new Array(1) }),
      "sources[0]",
      "sparse",
    );
    expect(parseRecordDraft({ ...validEntryDraft(), sources: [{ ref: "normal" }] }).sources).toEqual([
      { ref: "normal" },
    ]);
  });
});

describe("actors, metadata, and structural JSON", () => {
  test("accepts every closed vocabulary member and rejects values outside each set", () => {
    for (const type of ACTOR_TYPES) {
      expect(parseRecordDraft({ ...validEntryDraft(), actor: { type, id: "actor" } }).actor.type).toBe(type);
    }
    for (const confidence of CLAIM_CONFIDENCES) {
      expect(parseRecordDraft({ ...validClaimDraft(), confidence })).toMatchObject({ confidence });
    }
    for (const relationType of RELATION_TYPES) {
      expect(parseRecordDraft({ ...validRelationDraft(), relation_type: relationType })).toMatchObject({
        relation_type: relationType,
      });
    }
    for (const decision of RESOLUTION_DECISIONS) {
      expect(parseRecordDraft({ ...validResolutionDraft(), decision })).toMatchObject({ decision });
    }
    for (const result of VERIFICATION_RESULTS) {
      expect(parseRecordDraft({ ...validVerificationDraft(), result })).toMatchObject({ result });
    }
  });

  test("actor type is closed and nested failures name the field", () => {
    expectFieldError(
      () => parseRecordDraft({ ...validEntryDraft(), actor: { type: "robot", id: "r1" } }),
      "actor.type",
    );
    expectFieldError(() => parseRecordDraft({ ...validEntryDraft(), actor: { type: "agent" } }), "actor.id");
  });

  test("rejects hidden dynamic scope and metadata entries rather than dropping them", () => {
    const scope: Record<string, unknown> = { repo: "loredu" };
    Object.defineProperty(scope, "hidden", { value: "value", enumerable: false });
    expectFieldError(() => parseRecordDraft({ ...validClaimDraft(), scope }), "scope.hidden", "enumerable");

    const metadata: Record<string, unknown> = { "vendor.visible": true };
    Object.defineProperty(metadata, "vendor.hidden", { value: true, enumerable: false });
    expectFieldError(
      () => parseRecordDraft({ ...validEntryDraft(), metadata }),
      "metadata.vendor.hidden",
      "enumerable",
    );
  });

  test("preserves unknown namespaced metadata and deeply freezes JSON values", () => {
    const draft = parseRecordDraft({
      ...validEntryDraft(),
      metadata: { "vendor.audit.v1": { z: 1, a: [true, null, " Exact "] } },
    });
    const metadata = draft.metadata as JsonObject;
    expect(metadata["vendor.audit.v1"]).toEqual({ a: [true, null, " Exact "], z: 1 });
    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(metadata["vendor.audit.v1"] as object)).toBe(true);
  });

  test("rejects unnamespaced, malformed, reserved, and non-JSON metadata", () => {
    expectFieldError(
      () => parseRecordDraft({ ...validEntryDraft(), metadata: { plain: true } }),
      'metadata key "plain"',
    );
    expectFieldError(
      () => parseRecordDraft({ ...validEntryDraft(), metadata: { "Bad.name": true } }),
      'metadata key "Bad.name" namespace',
    );
    expectFieldError(
      () => parseRecordDraft({ ...validEntryDraft(), metadata: { "loredu.internal": true } }),
      "metadata.loredu.internal",
      "reserved",
    );
    expectFieldError(
      () =>
        parsePersistedRecord({
          ...persistedEnvelope("entry"),
          body: "x",
          metadata: { "loredu.internal": true },
        }),
      "metadata.loredu.internal",
      "reserved",
    );
    expectFieldError(
      () => parseRecordDraft({ ...validEntryDraft(), metadata: { "vendor.bad": undefined } }),
      "metadata.vendor.bad",
    );
  });

  test("canonicalizes object keys once and compares values structurally without coercion", () => {
    const canonical = canonicalizeJsonValue({ z: 1, a: { y: 2, x: 3 }, list: [2, 1] }) as JsonObject;
    expect(Object.keys(canonical)).toEqual(["a", "list", "z"]);
    expect(Object.keys(canonical.a as JsonObject)).toEqual(["x", "y"]);
    expect(jsonValuesEqual({ a: 1, b: [null, "X"] }, { b: [null, "X"], a: 1 })).toBe(true);
    expect(jsonValuesEqual(1, "1")).toBe(false);
    expect(jsonValuesEqual(" X ", "X")).toBe(false);
    expect(jsonValuesEqual([1, 2], [2, 1])).toBe(false);
    expect(jsonValuesEqual({ value: null }, {})).toBe(false);
  });

  test("rejects non-finite, undefined, exotic, and circular values with exact paths", () => {
    expectFieldError(() => canonicalizeJsonValue(Number.NaN), "value");
    expectFieldError(() => canonicalizeJsonValue([undefined]), "value[0]");
    expectFieldError(() => canonicalizeJsonValue(new Array(1)), "value[0]", "sparse");
    expectFieldError(() => canonicalizeJsonValue(new Date(0)), "value");
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expectFieldError(() => canonicalizeJsonValue(circular), "value.self", "circular");
  });

  test("rejects hidden, symbol, accessor, and array-extra JSON without reading hostile getters", () => {
    const hidden = { visible: true };
    Object.defineProperty(hidden, "hidden", { value: true, enumerable: false });
    expectFieldError(() => canonicalizeJsonValue(hidden), "value.hidden", "enumerable");

    const symbolic = { visible: true };
    Object.defineProperty(symbolic, Symbol("hidden"), { value: true });
    expectFieldError(() => canonicalizeJsonValue(symbolic), "value", "symbol-keyed");

    let objectGetterReads = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, "secret", {
      enumerable: true,
      get() {
        objectGetterReads += 1;
        return "must not execute";
      },
    });
    expectFieldError(() => canonicalizeJsonValue(accessor), "value.secret", "not an accessor");
    expect(objectGetterReads).toBe(0);

    const array = [1] as number[] & { extra?: boolean };
    array.extra = true;
    expectFieldError(() => canonicalizeJsonValue(array), "value.extra", "unsupported array property");

    let arrayGetterReads = 0;
    const accessorArray = [1];
    Object.defineProperty(accessorArray, "0", {
      enumerable: true,
      configurable: true,
      get() {
        arrayGetterReads += 1;
        return 1;
      },
    });
    expectFieldError(() => canonicalizeJsonValue(accessorArray), "value[0]", "not an accessor");
    expect(arrayGetterReads).toBe(0);
    expect(canonicalizeJsonValue({ normal: [1, 2] })).toEqual({ normal: [1, 2] });
  });
});

describe("family payload boundaries", () => {
  test("Entry enforces preserved non-whitespace text and exact limits", () => {
    expectFieldError(() => parseRecordDraft({ ...validEntryDraft(), body: " \n\t " }), "body");
    expectFieldError(() => parseRecordDraft({ ...validEntryDraft(), title: "  " }), "title");
    expectFieldError(() => parseRecordDraft({ ...validEntryDraft(), title: "x".repeat(1025) }), "title");
    expect(
      (parseRecordDraft({ ...validEntryDraft(), body: "x".repeat(1024 * 1024) }) as EntryDraft).body.length,
    ).toBe(1024 * 1024);
    expectFieldError(
      () => parseRecordDraft({ ...validEntryDraft(), body: "😀".repeat(262_145) }),
      "body",
      "1 MiB",
    );
  });

  test("Claim requires every declared-key/value field and permits empty direct provenance", () => {
    for (const field of ["subject", "predicate", "value", "confidence"] as const) {
      const draft = validClaimDraft();
      delete draft[field];
      expectFieldError(() => parseRecordDraft(draft), field);
    }
    const direct = parseRecordDraft({ ...validClaimDraft(), derived_from: [] });
    expect(direct.kind === "claim" && direct.derived_from).toEqual([]);
    expectFieldError(
      () => parsePersistedRecord({ ...persistedEnvelope("claim"), ...validClaimDraft(), kind: "claim" }),
      "derived_from",
      "persisted claim",
    );
    expectFieldError(
      () => parseRecordDraft({ ...validClaimDraft(), derived_from: [IDS.claim] }),
      "derived_from[0]",
      "entry",
    );
  });

  test("closed Claim confidence rejects unknown values while open class does not", () => {
    expectFieldError(() => parseRecordDraft({ ...validClaimDraft(), confidence: "likely" }), "confidence");
    expect(parseRecordDraft({ ...validClaimDraft(), claim_class: "likely" })).toMatchObject({
      claim_class: "likely",
    });
  });

  test("Relation keeps ordered singular endpoints, permits all kinds, and checks prefix agreement", () => {
    for (const kind of RECORD_KINDS) {
      const id = IDS[kind];
      const relation = parseRecordDraft({
        ...validRelationDraft(),
        from: { kind, id },
      });
      if (relation.kind !== "relation") throw new Error("expected relation");
      expect(relation.from.kind).toBe(kind);
      expect(relation.from.id).toBe(id);
    }
    expectFieldError(
      () => parseRecordDraft({ ...validRelationDraft(), from: { kind: "entry", id: IDS.claim } }),
      "from.id",
    );
    expectFieldError(
      () => parseRecordDraft({ ...validRelationDraft(), relation_type: "causes" }),
      "relation_type",
    );
    expectFieldError(() => parseRecordDraft({ ...validRelationDraft(), from: [IDS.claim] }), "from");
  });

  test("Resolution target/replacement/text cardinalities are mechanical only", () => {
    expectFieldError(
      () => parseRecordDraft({ ...validResolutionDraft(), targets: [] }),
      "targets",
      "non-empty",
    );
    expectFieldError(
      () => parseRecordDraft({ ...validResolutionDraft(), targets: [IDS.entry] }),
      "targets[0]",
      "claim or relation",
    );
    expectFieldError(
      () => parseRecordDraft({ ...validResolutionDraft(), replacement: [IDS.claim] }),
      "replacement",
    );
    expectFieldError(() => parseRecordDraft({ ...validResolutionDraft(), decision: "accept" }), "decision");
    expectFieldError(
      () => parseRecordDraft({ ...validResolutionDraft(), reason: "x".repeat(2049) }),
      "reason",
    );
    const noReplacement = validResolutionDraft();
    delete noReplacement.replacement;
    expect(parseRecordDraft(noReplacement)).not.toHaveProperty("replacement");
  });

  test("Verification requires Claim targets and a distinct non-empty basis shape", () => {
    expectFieldError(() => parseRecordDraft({ ...validVerificationDraft(), targets: [] }), "targets");
    expectFieldError(
      () => parseRecordDraft({ ...validVerificationDraft(), targets: [IDS.relation] }),
      "targets[0]",
      "claim",
    );
    expectFieldError(
      () => parseRecordDraft({ ...validVerificationDraft(), verified_against: [] }),
      "verified_against",
    );
    expectFieldError(
      () =>
        parseRecordDraft({
          ...validVerificationDraft(),
          verified_against: [{ source: { ref: "nested-is-wrong" } }],
        }),
      "verified_against[0].source",
    );
    expectFieldError(() => parseRecordDraft({ ...validVerificationDraft(), result: "likely" }), "result");
    const preserved = parseRecordDraft(validVerificationDraft());
    expect(preserved.kind === "verification" && preserved.verified_against[0]?.source).toBe(
      " HTTPS://example.test/A ",
    );
  });
});

describe("timestamps and validity", () => {
  test("accepts valid explicit-offset instants and preserves spelling", () => {
    const draft = parseRecordDraft({
      ...validClaimDraft(),
      valid_from: "2024-02-29T10:00:00.123+02:30",
      valid_until: "2024-02-29T07:30:00.123Z",
    });
    expect(draft.kind === "claim" && draft.valid_from).toBe("2024-02-29T10:00:00.123+02:30");
  });

  test("compares arbitrary fractional precision and signed offsets exactly", () => {
    for (const [validFrom, validUntil] of [
      ["2024-01-01T00:00:00.0002Z", "2024-01-01T00:00:00.0001Z"],
      ["2024-01-01T00:00:00.12345678901234567892Z", "2024-01-01T00:00:00.12345678901234567891Z"],
      ["2024-01-01T00:00:00.0000000002+01:30", "2023-12-31T22:30:00.0000000001Z"],
    ] as const) {
      expectFieldError(
        () =>
          parseRecordDraft({
            ...validClaimDraft(),
            valid_from: validFrom,
            valid_until: validUntil,
          }),
        "valid_until",
        "must not precede",
      );
    }

    const equivalent = parseRecordDraft({
      ...validClaimDraft(),
      valid_from: "2024-01-01T00:00:00.123456789-02:30",
      valid_until: "2024-01-01T02:30:00.1234567890Z",
    });
    expect(equivalent.kind === "claim" && equivalent.valid_from).toBe("2024-01-01T00:00:00.123456789-02:30");
    expect(equivalent.kind === "claim" && equivalent.valid_until).toBe("2024-01-01T02:30:00.1234567890Z");

    expect(
      parseRecordDraft({
        ...validClaimDraft(),
        valid_from: "0000-01-01T00:00:00.1Z",
        valid_until: "9999-12-31T23:59:59.999999999999999999999999Z",
      }),
    ).toMatchObject({ valid_from: "0000-01-01T00:00:00.1Z" });
  });

  test("rejects absent offsets, invalid calendars/offsets, and inverted instants", () => {
    for (const timestamp of [
      "2024-01-01T00:00:00",
      "2023-02-29T00:00:00Z",
      "2024-13-01T00:00:00Z",
      "2024-01-01T24:00:00Z",
      "2024-01-01T00:00:00+24:00",
    ]) {
      expectFieldError(() => parseRecordDraft({ ...validClaimDraft(), valid_from: timestamp }), "valid_from");
    }
    expectFieldError(
      () =>
        parseRecordDraft({
          ...validClaimDraft(),
          valid_from: "2024-01-01T00:00:01Z",
          valid_until: "2024-01-01T00:00:00Z",
        }),
      "valid_until",
      "must not precede",
    );
  });

  test("validates effective_at and persisted recorded_at at their own paths", () => {
    expectFieldError(
      () => parseRecordDraft({ ...validResolutionDraft(), effective_at: "tomorrow" }),
      "effective_at",
    );
    expectFieldError(
      () => parsePersistedRecord({ ...persistedEnvelope("entry"), recorded_at: "now", body: "x" }),
      "recorded_at",
    );
  });
});

describe("opaque record identity", () => {
  test("encodes exactly ten bytes into sixteen lowercase Crockford symbols", () => {
    expect(encodeRecordIdSuffix(new Uint8Array(10))).toBe("0000000000000000");
    expect(encodeRecordIdSuffix(new Uint8Array(10).fill(255))).toBe("zzzzzzzzzzzzzzzz");
    expect(recordIdFromBytes("entry", new Uint8Array(10))).toBe(IDS.entry);
    expect(RECORD_ID_SUFFIX_ALPHABET).toBe("0123456789abcdefghjkmnpqrstvwxyz");
    expectFieldError(() => encodeRecordIdSuffix(new Uint8Array(9)), "bytes", "exactly 10");
  });

  test("validates all kind prefixes and only the exact suffix alphabet/length", () => {
    for (const kind of RECORD_KINDS) {
      const id = IDS[kind];
      expect(isRecordIdForKind(id, kind)).toBe(true);
      expect(recordKindOfId(id)).toBe(kind);
    }
    for (const symbol of RECORD_ID_SUFFIX_ALPHABET) {
      expect(recordKindOfId(`ent_${symbol.repeat(16)}`)).toBe("entry");
    }
    expect(recordKindOfId("ent_iiiiiiiiiiiiiiii")).toBeUndefined();
    expect(recordKindOfId("ent_000000000000000")).toBeUndefined();
    expect(recordKindOfId("ent_00000000000000000")).toBeUndefined();
    expect(recordKindOfId("ent_000000000000000U")).toBeUndefined();
  });

  test("persisted kind and id prefix must agree", () => {
    expectFieldError(
      () => parsePersistedRecord({ ...persistedEnvelope("entry"), id: IDS.claim, body: "x" }),
      "id",
      "entry id",
    );
  });
});

describe("claim-key and scope identity", () => {
  test("scope identity is order-insensitive, absent equals empty, and added pairs differ", () => {
    expect(canonicalizeScope({ z: "last", a: "first" })).toEqual([
      ["a", "first"],
      ["z", "last"],
    ]);
    expect(scopesEqual({ a: "1", b: "2" }, { b: "2", a: "1" })).toBe(true);
    expect(scopesEqual(undefined, {})).toBe(true);
    expect(scopesEqual({ a: "1" }, { a: "1", b: "2" })).toBe(false);
  });

  test("public structural claim keys compare scope pairs as a validated unordered set", () => {
    const common = { subject: { type: "code-area", id: "commands" }, predicate: "location" } as const;
    const left = {
      ...common,
      scope: [
        ["b", "2"],
        ["a", "1"],
      ],
    } as const;
    const right = {
      ...common,
      scope: [
        ["a", "1"],
        ["b", "2"],
      ],
    } as const;
    expect(claimKeysEqual(left, right)).toBe(true);
    expect(left.scope).toEqual([
      ["b", "2"],
      ["a", "1"],
    ]);
    expect(right.scope).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);

    expectFieldError(
      () =>
        claimKeysEqual(
          {
            ...common,
            scope: [
              ["a", "1"],
              ["a", "1"],
            ],
          },
          { ...common, scope: [["a", "1"]] },
        ),
      "left.scope[1][0]",
      "duplicates scope key",
    );

    const pair = ["a", "1"] as [string, string] & { hidden?: boolean };
    Object.defineProperty(pair, "hidden", { value: true, enumerable: false });
    expectFieldError(
      () => claimKeysEqual({ ...common, scope: [pair] }, { ...common, scope: [["a", "1"]] }),
      "left.scope[0].hidden",
      "unsupported array property",
    );
  });

  test("declared claim keys preserve consumer vocabulary and distinguish perspective", () => {
    const base = {
      scope: { repo: "loredu", team: "core" },
      subject: { type: "code-area", id: "commands" },
      predicate: "location",
    } as const;
    const same = createClaimKey({ ...base, scope: { team: "core", repo: "loredu" } });
    const absentPerspective = createClaimKey(base);
    const observed = createClaimKey({ ...base, perspective: "observed" });
    expect(claimKeysEqual(same, absentPerspective)).toBe(true);
    expect(claimKeysEqual(absentPerspective, observed)).toBe(false);
    expect(observed.perspective).toBe("observed");
  });

  test("claimKeyOf extracts the same immutable declared identity from a validated claim", () => {
    const claim = parseRecordDraft({ ...validClaimDraft(), scope: { b: "2", a: "1" } });
    if (claim.kind !== "claim") throw new Error("expected claim");
    const key = claimKeyOf(claim);
    expect(key.scope).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
    expect(Object.isFrozen(key)).toBe(true);
    expect(Object.isFrozen(key.scope)).toBe(true);
  });
});

describe("immutable public boundaries", () => {
  test("freezes exported mechanical vocabularies", () => {
    expect(Object.isFrozen(ACTOR_TYPES)).toBe(true);
    expect(Object.isFrozen(CLAIM_CONFIDENCES)).toBe(true);
    expect(Object.isFrozen(RELATION_TYPES)).toBe(true);
    expect(Object.isFrozen(RESOLUTION_DECISIONS)).toBe(true);
    expect(Object.isFrozen(VERIFICATION_RESULTS)).toBe(true);
    expect(Object.isFrozen(RECORD_ID_PREFIX)).toBe(true);
  });

  test("deep copies inputs and freezes nested values and arrays", () => {
    const input = {
      ...validClaimDraft(),
      scope: { repo: "loredu" },
      metadata: { "vendor.data": { nested: [1, 2] } },
      sources: [{ ref: "source" }],
      derived_from: [IDS.entry],
    };
    const draft = parseRecordDraft(input);
    input.scope.repo = "changed";
    const mutableSource = input.sources[0];
    if (mutableSource === undefined) throw new Error("expected source");
    mutableSource.ref = "changed";
    expect(draft.scope?.repo).toBe("loredu");
    expect(draft.sources?.[0]?.ref).toBe("source");
    expect(Object.isFrozen(draft.scope)).toBe(true);
    expect(Object.isFrozen(draft.sources)).toBe(true);
    expect(Object.isFrozen(draft.sources?.[0])).toBe(true);
    expect(draft.kind === "claim" && Object.isFrozen(draft.value as object)).toBe(true);
    expect(draft.kind === "claim" && Object.isFrozen(draft.derived_from)).toBe(true);
  });

  test("mutation attempts throw and leave persisted values unchanged", () => {
    const record = parsePersistedRecord({
      ...persistedEnvelope("verification"),
      ...validVerificationDraft(),
      kind: "verification",
    });
    expect(() => {
      (record as { result: string }).result = "changed";
    }).toThrow();
    expect(() => {
      (record.actor as { id: string }).id = "changed";
    }).toThrow();
    if (record.kind !== "verification") throw new Error("expected verification");
    expect(() => {
      (record.targets as string[]).push(IDS.claim);
    }).toThrow();
    expect(record.result).toBe("confirmed");
    expect(record.actor.id).toBe(ACTOR.id);
  });
});
