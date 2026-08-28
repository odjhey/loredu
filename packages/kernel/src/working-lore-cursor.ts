import type { WorkingLoreSectionName } from "./application-types";
import { type CursorTransportPayload, encodeCursorTransport } from "./cursor-transport";
import { CORE_RULESET_ID, type WorkingLoreBasis, type WorkingLoreRulesetIdentity } from "./domain/basis";
import type { JsonObject } from "./domain/entry";
import { copyJsonObject, isScalarText, jsonValuesEqual, scalarLength } from "./domain/portable-json";
import { normalizeTimestamp } from "./domain/records";
import { LoreduError, type LoreduIssue } from "./errors";
import type { StreamPosition } from "./ports/capabilities";

const RECORD_ID = /^(ent|clm|rel|res|ver)_[0-9abcdefghjkmnpqrstvwxyz]{16}$/;
const DIGEST = /^[A-Za-z0-9_-]{43}$/;
const TOKEN = /^[a-z0-9](?:[a-z0-9._:/-]*[a-z0-9])?$/;
const SECTION_NAMES: readonly WorkingLoreSectionName[] = Object.freeze([
  "current",
  "patterns",
  "candidates",
  "conflicts",
  "needs_revalidation",
]);

export type WorkingLoreResume =
  | { readonly kind: "before-first" }
  | { readonly kind: "after"; readonly section_ordinal: number; readonly occurrence_index: number };
export type WorkingLoreRankBinding = {
  readonly algorithm: "sha256";
  readonly candidate_count: number;
  readonly permutation_digest: string;
  readonly section: WorkingLoreSectionName;
  readonly resume: WorkingLoreResume;
};
export type WorkingLoreCursor = {
  readonly version: 1;
  readonly operation: "lore";
  readonly query: JsonObject;
  readonly basis: WorkingLoreBasis;
  readonly anchor: string;
  readonly computed_at: string;
  readonly rank: WorkingLoreRankBinding;
};

function cursorInvalid(message = "Cursor is invalid"): never {
  throw new LoreduError("INVALID_CURSOR", message);
}

function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function rulesetToken(value: unknown): string {
  if (typeof value !== "string" || !isScalarText(value) || scalarLength(value) > 128 || !TOKEN.test(value))
    cursorInvalid();
  return value;
}

function validateSourceText(value: unknown, maximum: number): void {
  if (
    typeof value !== "string" ||
    !isScalarText(value) ||
    value !== value.trim() ||
    scalarLength(value) < 1 ||
    scalarLength(value) > maximum
  )
    cursorInvalid();
}

function validateLoreQuery(query: JsonObject): void {
  const keys = Object.keys(query).sort();
  if (
    keys.some((key) => !["activity", "corpus", "operation", "scope", "valid_at"].includes(key)) ||
    query.operation !== "lore"
  )
    cursorInvalid();
  rulesetToken(query.activity);
  const timestampIssues: LoreduIssue[] = [];
  const validAt = normalizeTimestamp(query.valid_at, "/query/valid_at", timestampIssues);
  if (!validAt || validAt !== query.valid_at || timestampIssues.length > 0) cursorInvalid();
  if (Object.hasOwn(query, "scope")) {
    const scope = query.scope;
    if (!scope || typeof scope !== "object" || Array.isArray(scope) || Object.keys(scope).length === 0)
      cursorInvalid();
    for (const [key, value] of Object.entries(scope)) {
      rulesetToken(key);
      rulesetToken(value);
    }
  }
  if (Object.hasOwn(query, "corpus")) {
    const corpus = query.corpus;
    if (!corpus || typeof corpus !== "object" || Array.isArray(corpus)) cursorInvalid();
    const corpusObject = corpus as JsonObject;
    const corpusKeys = Object.keys(corpusObject).sort();
    if (
      !Object.hasOwn(corpusObject, "ref") ||
      corpusKeys.some((key) => !["locator", "ref", "snapshot"].includes(key))
    )
      cursorInvalid();
    validateSourceText(corpusObject.ref, 1024);
    if (Object.hasOwn(corpusObject, "locator")) validateSourceText(corpusObject.locator, 1024);
    if (Object.hasOwn(corpusObject, "snapshot")) validateSourceText(corpusObject.snapshot, 256);
  }
}

function parseRuleset(value: unknown): WorkingLoreRulesetIdentity {
  const object = value as Record<string, unknown>;
  if (
    !object ||
    typeof object !== "object" ||
    Array.isArray(object) ||
    Object.keys(object).sort().join(",") !== "claim_policy,core,ranker"
  )
    cursorInvalid();
  const policy = object.claim_policy as Record<string, unknown>;
  const ranker = object.ranker as Record<string, unknown>;
  if (
    object.core !== CORE_RULESET_ID ||
    !policy ||
    !ranker ||
    Object.keys(policy).sort().join(",") !== "id,version" ||
    Object.keys(ranker).sort().join(",") !== "id,version"
  )
    cursorInvalid();
  const policyId = rulesetToken(policy.id);
  const policyVersion = rulesetToken(policy.version);
  const rankerId = rulesetToken(ranker.id);
  const rankerVersion = rulesetToken(ranker.version);
  return Object.freeze({
    core: CORE_RULESET_ID,
    claim_policy: Object.freeze({ id: policyId, version: policyVersion }),
    ranker: Object.freeze({ id: rankerId, version: rankerVersion }),
  });
}

export function decodeWorkingLoreCursorPayload(parsed: CursorTransportPayload): WorkingLoreCursor {
  try {
    if (parsed.operation !== "lore") cursorInvalid();
    if (Object.keys(parsed).sort().join(",") !== "anchor,basis,computed_at,operation,query,rank,version")
      cursorInvalid();
    if (typeof parsed.anchor !== "string" || (!RECORD_ID.test(parsed.anchor) && parsed.anchor !== "empty"))
      cursorInvalid();
    const issues: LoreduIssue[] = [];
    const query = copyJsonObject(parsed.query, "/query", issues);
    if (!query || issues.length > 0) cursorInvalid();
    const basisObject = parsed.basis as Record<string, unknown>;
    if (
      !basisObject ||
      typeof basisObject !== "object" ||
      Array.isArray(basisObject) ||
      Object.keys(basisObject).sort().join(",") !== "query,ruleset,stream_position" ||
      !integer(basisObject.stream_position)
    )
      cursorInvalid();
    const basisQueryIssues: LoreduIssue[] = [];
    const basisQuery = copyJsonObject(basisObject.query, "/basis/query", basisQueryIssues);
    if (!basisQuery || basisQueryIssues.length > 0) cursorInvalid();
    validateLoreQuery(query);
    validateLoreQuery(basisQuery);
    if (!jsonValuesEqual(query, basisQuery)) cursorInvalid("Cursor Basis query does not match cursor query");
    const basis: WorkingLoreBasis = Object.freeze({
      stream_position: basisObject.stream_position as StreamPosition,
      ruleset: parseRuleset(basisObject.ruleset),
      query: basisQuery,
    });
    const timestampIssues: LoreduIssue[] = [];
    const computedAt = normalizeTimestamp(parsed.computed_at, "/computed_at", timestampIssues);
    if (
      !computedAt ||
      computedAt !== parsed.computed_at ||
      timestampIssues.length > 0 ||
      query.valid_at !== computedAt
    )
      cursorInvalid();
    const rank = parsed.rank as Record<string, unknown>;
    if (
      !rank ||
      typeof rank !== "object" ||
      Array.isArray(rank) ||
      Object.keys(rank).sort().join(",") !== "algorithm,candidate_count,permutation_digest,resume,section"
    )
      cursorInvalid();
    if (
      rank.algorithm !== "sha256" ||
      !integer(rank.candidate_count) ||
      typeof rank.permutation_digest !== "string" ||
      !DIGEST.test(rank.permutation_digest) ||
      !SECTION_NAMES.includes(rank.section as WorkingLoreSectionName)
    )
      cursorInvalid();
    const resumeObject = rank.resume as Record<string, unknown>;
    let resume: WorkingLoreResume;
    if (!resumeObject || typeof resumeObject !== "object" || Array.isArray(resumeObject)) cursorInvalid();
    if (resumeObject.kind === "before-first" && Object.keys(resumeObject).join(",") === "kind")
      resume = Object.freeze({ kind: "before-first" });
    else if (
      resumeObject.kind === "after" &&
      Object.keys(resumeObject).sort().join(",") === "kind,occurrence_index,section_ordinal" &&
      integer(resumeObject.section_ordinal) &&
      integer(resumeObject.occurrence_index) &&
      resumeObject.occurrence_index < rank.candidate_count
    )
      resume = Object.freeze({
        kind: "after",
        section_ordinal: resumeObject.section_ordinal,
        occurrence_index: resumeObject.occurrence_index,
      });
    else cursorInvalid();
    if (
      (basis.stream_position === 0 && parsed.anchor !== "empty") ||
      (basis.stream_position > 0 && !RECORD_ID.test(parsed.anchor))
    )
      cursorInvalid();
    return Object.freeze({
      version: 1,
      operation: "lore",
      query,
      basis,
      anchor: parsed.anchor,
      computed_at: computedAt,
      rank: Object.freeze({
        algorithm: "sha256",
        candidate_count: rank.candidate_count,
        permutation_digest: rank.permutation_digest,
        section: rank.section as WorkingLoreSectionName,
        resume,
      }),
    });
  } catch (error) {
    if (error instanceof LoreduError && (error.code === "INVALID_CURSOR" || error.code === "CURSOR_MISMATCH"))
      throw error;
    cursorInvalid();
  }
}

export function encodeWorkingLoreCursor(cursor: WorkingLoreCursor): string {
  return encodeCursorTransport(cursor);
}
