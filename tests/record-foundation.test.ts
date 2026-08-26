import { describe, expect, test } from "bun:test";
import {
  canonicalClaimKey,
  canonicalizeJsonValue,
  claimKeysEqual,
  jsonValuesEqual,
  RECORD_SCHEMA_ID,
  validateDraft,
  validateRecord,
  validateRecordId,
} from "../packages/kernel/src/index";

const actor = { type: "agent", id: "agent:test" } as const;

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { kind: "entry", actor, body: "A finding", ...overrides };
}

function persisted(kind: string, payload: Record<string, unknown>): Record<string, unknown> {
  const prefixes: Record<string, string> = {
    entry: "ent",
    claim: "clm",
    relation: "rel",
    resolution: "res",
    verification: "ver",
  };
  return {
    schema: RECORD_SCHEMA_ID,
    kind,
    id: `${prefixes[kind]}_0123456789abcdef`,
    recorded_at: "2026-08-26T12:00:00+08:00",
    actor,
    ...payload,
  };
}

function errorPaths(result: ReturnType<typeof validateDraft> | ReturnType<typeof validateRecord>): string[] {
  return result.ok ? [] : result.errors.map((error) => error.path);
}

describe("record foundation", () => {
  test("accepts and snapshots every draft family", () => {
    const drafts = [
      entry(),
      {
        kind: "claim",
        actor,
        subject: { type: "repo", id: "loredu" },
        predicate: "build.status",
        value: null,
        confidence: "observed",
        derived_from: [],
      },
      {
        kind: "relation",
        actor,
        from: "clm_0123456789abcdef",
        to: "clm_fedcba9876543210",
        relation_type: "supports",
      },
      {
        kind: "resolution",
        actor,
        targets: ["clm_0123456789abcdef"],
        decision: "prefer",
        reason: "Verified",
      },
      {
        kind: "verification",
        actor,
        targets: ["clm_0123456789abcdef"],
        verified_against: [{ source: "https://example.test/source", snapshot: "v1" }],
        result: "confirmed",
      },
    ];

    for (const draft of drafts) {
      const result = validateDraft(draft);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Object.isFrozen(result.value)).toBe(true);
        draft.actor = { type: "human", id: "changed" };
        expect(result.value.actor).toEqual(actor);
      }
    }
  });

  test("rejects draft stamps, schema, and unknown fields", () => {
    for (const field of ["id", "recorded_at", "schema", "surprise"]) {
      const result = validateDraft(entry({ [field]: "bad" }));
      expect(errorPaths(result)).toContain(field);
    }
  });

  test("reports token, scope, metadata, source, and nested unknown paths", () => {
    const result = validateDraft(
      entry({
        actor: { type: "robot", id: "Bad ID", extra: true },
        scope: { Repo: "x", repo: { nested: true } },
        metadata: { bare: 1, "loredu.private": true, "vendor.ok": undefined },
        sources: [{ ref: " padded ", extra: true }],
      }),
    );
    expect(errorPaths(result)).toEqual(
      expect.arrayContaining([
        "actor.type",
        "actor.id",
        "actor.extra",
        "scope.Repo",
        "scope.repo",
        "metadata.bare",
        "metadata.loredu.private",
        "metadata.vendor.ok",
        "sources[0].ref",
        "sources[0].extra",
      ]),
    );
  });

  test("enforces family payload branches and vocabularies", () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [entry({ body: "" }), "body"],
      [entry({ entry_type: "consumer.extension" }), ""],
      [
        {
          kind: "claim",
          actor,
          subject: { type: "Repo", id: "free prose" },
          predicate: "x",
          confidence: "maybe",
        },
        "value",
      ],
      [{ kind: "relation", actor, from: "bad", to: "bad", relation_type: "likes" }, "relation_type"],
      [{ kind: "resolution", actor, targets: [], decision: "guess", reason: "" }, "targets"],
      [{ kind: "verification", actor, targets: [], verified_against: [], result: "maybe" }, "result"],
    ];
    for (const [draft, expected] of cases) {
      const result = validateDraft(draft);
      if (expected === "") expect(result.ok).toBe(true);
      else expect(errorPaths(result)).toContain(expected);
    }
  });

  test("validates complete records, schema replay, timestamp, and kind prefix", () => {
    expect(validateRecord(persisted("entry", { body: "ok" })).ok).toBe(true);
    expect(
      errorPaths(validateRecord(persisted("entry", { body: "ok", schema: "loredu.record/v2" }))),
    ).toContain("schema");
    expect(
      errorPaths(validateRecord(persisted("entry", { body: "ok", recorded_at: "yesterday" }))),
    ).toContain("recorded_at");
    expect(
      errorPaths(validateRecord(persisted("entry", { body: "ok", recorded_at: "2026-02-30T00:00:00Z" }))),
    ).toContain("recorded_at");
    expect(
      errorPaths(validateRecord(persisted("entry", { body: "ok", id: "clm_0123456789abcdef" }))),
    ).toContain("id");
    expect(validateRecordId("ent_0123456789abcdef", "entry").ok).toBe(true);
    expect(validateRecordId("ent_0123456789abcdei", "entry").ok).toBe(false);
  });

  test("canonicalizes JSON structurally without coercion and snapshots input", () => {
    const input = { z: [1, "1", null], a: { y: true, x: false } };
    const result = canonicalizeJsonValue(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value as object)).toEqual(["a", "z"]);
      input.z[0] = 9;
      expect(result.value).toEqual({ a: { x: false, y: true }, z: [1, "1", null] });
      expect(Object.isFrozen(result.value)).toBe(true);
    }
    expect(jsonValuesEqual({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(true);
    expect(jsonValuesEqual(1, "1")).toBe(false);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (const invalid of [
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      { x: undefined },
      [undefined],
      cyclic,
    ]) {
      expect(canonicalizeJsonValue(invalid).ok).toBe(false);
    }
  });

  test("constructs canonical claim keys with scope order and perspective", () => {
    const left = canonicalClaimKey({
      scope: { repo: "loredu", env: "test" },
      subject: { type: "repo", id: "loredu" },
      predicate: "status",
    });
    const right = canonicalClaimKey({
      scope: { env: "test", repo: "loredu" },
      subject: { type: "repo", id: "loredu" },
      predicate: "status",
    });
    expect(left.ok && right.ok && claimKeysEqual(left.value, right.value)).toBe(true);
    const scoped = canonicalClaimKey({
      scope: { repo: "other" },
      subject: { type: "repo", id: "loredu" },
      predicate: "status",
    });
    expect(left.ok && scoped.ok && claimKeysEqual(left.value, scoped.value)).toBe(false);
    const perspective = canonicalClaimKey({
      subject: { type: "repo", id: "loredu" },
      predicate: "status",
      perspective: "observed",
    });
    const unscoped = canonicalClaimKey({ subject: { type: "repo", id: "loredu" }, predicate: "status" });
    expect(perspective.ok && unscoped.ok && claimKeysEqual(perspective.value, unscoped.value)).toBe(false);
  });

  test("claim key equality is insensitive to subject property declaration order", () => {
    const typeFirst = canonicalClaimKey({
      subject: { type: "repo", id: "loredu" },
      predicate: "status",
    });
    const idFirst = canonicalClaimKey({
      subject: { id: "loredu", type: "repo" },
      predicate: "status",
    });
    expect(typeFirst.ok && idFirst.ok && claimKeysEqual(typeFirst.value, idFirst.value)).toBe(true);
  });
});
