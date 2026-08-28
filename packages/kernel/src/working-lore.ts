import {
  affordance,
  decodeCursor,
  deduplicateAdvice,
  page,
  readSnapshot,
  type Snapshot,
} from "./application-read";
import type {
  Affordance,
  RecordHandle,
  WorkingLoreApplicationResponse,
  WorkingLoreFilterDescriptor,
  WorkingLoreItem,
  WorkingLoreKeyDescriptor,
  WorkingLoreKnowledgeSummary,
  WorkingLorePacket,
  WorkingLoreQuery,
  WorkingLoreRankCandidate,
  WorkingLoreRankContext,
  WorkingLoreScopePreview,
  WorkingLoreSection,
  WorkingLoreSectionName,
} from "./application-types";
import { computeLoreKnowledge, type LoreKnowledgeProjection } from "./current-projection";
import type { RulesetIdentity, WorkingLoreBasis, WorkingLoreRulesetIdentity } from "./domain/basis";
import type { ClaimId, JsonObject, JsonValue, Scope, SourceRef } from "./domain/entry";
import {
  compareUnicodeScalars,
  copyJsonObject,
  copyPortableJson,
  dataValue,
  escapePointer,
  hasOwnDescriptor,
  inspectObject,
  isScalarText,
  jsonValuesEqual,
  makeIssue,
  scalarLength,
} from "./domain/portable-json";
import { normalizeTimestamp } from "./domain/records";
import { LoreduError, type LoreduIssue } from "./errors";
import type { Clock, RecordStore, StreamPosition } from "./ports/capabilities";
import { createInstant } from "./ports/capabilities";
import type { ValidatedClaimPolicy } from "./ports/claim-policy";
import { invokeRanker, type ValidatedRanker } from "./ranker";
import { permutationDigest } from "./sha256";
import {
  encodeWorkingLoreCursor,
  type WorkingLoreCursor,
  type WorkingLoreResume,
} from "./working-lore-cursor";

const DEFAULT_MAX_ITEMS = 40;
const DEFAULT_MAX_CHARS = 12_000;
const TOKEN = /^[a-z0-9](?:[a-z0-9._:/-]*[a-z0-9])?$/;
const DISPLAY_ORDER: readonly WorkingLoreSectionName[] = Object.freeze([
  "current",
  "patterns",
  "candidates",
  "conflicts",
  "needs_revalidation",
]);
const CORE_ORDER: readonly WorkingLoreSectionName[] = Object.freeze([
  "conflicts",
  "needs_revalidation",
  "candidates",
  "current",
  "patterns",
]);

type ParsedLore = {
  readonly maxItems: number;
  readonly maxChars: number;
  readonly activity: string;
  readonly scope?: Scope;
  readonly corpus?: SourceRef;
  readonly validAt?: string;
  readonly cursor?: WorkingLoreCursor;
};
type Occurrence = {
  readonly index: number;
  readonly section: WorkingLoreSectionName;
  readonly primary: number;
  readonly keyIdentity: string;
  readonly item: WorkingLoreItem;
  readonly candidate: WorkingLoreRankCandidate;
};

function validationFailed(
  issues: readonly LoreduIssue[],
  message = "Working Lore query validation failed",
): never {
  throw new LoreduError("VALIDATION_FAILED", message, Object.freeze([...issues]));
}
function cursorMismatch(message = "Cursor does not match this operation or snapshot"): never {
  throw new LoreduError("CURSOR_MISMATCH", message);
}
function own(data: Readonly<Record<string, PropertyDescriptor>>, key: string): unknown {
  return hasOwnDescriptor(data, key) ? dataValue(data, key) : undefined;
}
function rejectUnknown(
  data: Readonly<Record<string, PropertyDescriptor>>,
  allowed: ReadonlySet<string>,
  issues: LoreduIssue[],
  path = "",
): void {
  for (const key of Object.keys(data))
    if (!allowed.has(key))
      issues.push(makeIssue("UNKNOWN_FIELD", `${path}/${escapePointer(key)}`, "is not part of this object"));
}
function frozenJsonObject(value: unknown): JsonObject {
  const issues: LoreduIssue[] = [];
  const copied = copyJsonObject(value, "", issues);
  if (!copied || issues.length > 0) throw new TypeError("internal value is not portable JSON");
  return copied;
}
function parseToken(value: unknown, path: string, issues: LoreduIssue[]): string | undefined {
  if (typeof value !== "string") {
    issues.push(makeIssue("TYPE", path, "must be a string"));
    return undefined;
  }
  if (!isScalarText(value) || scalarLength(value) > 128 || !TOKEN.test(value)) {
    issues.push(makeIssue("FORMAT", path, "must be an identifier-safe token"));
    return undefined;
  }
  return value;
}
function parseBudget(
  value: unknown,
  present: boolean,
  path: string,
  minimum: number,
  maximum: number,
  fallback: number,
  issues: LoreduIssue[],
): number {
  if (!present) return fallback;
  if (typeof value !== "number") {
    issues.push(makeIssue("TYPE", path, "must be a number"));
    return fallback;
  }
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    issues.push(makeIssue("RANGE", path, `must be a safe integer from ${minimum} through ${maximum}`));
    return fallback;
  }
  return value;
}
function parseScope(value: unknown, path: string, issues: LoreduIssue[]): Scope | undefined {
  const data = inspectObject(value, path, issues);
  if (!data) return undefined;
  const output = Object.create(null) as Record<string, string>;
  for (const key of Object.keys(data).sort(compareUnicodeScalars)) {
    const parsedKey = parseToken(key, `${path}/${escapePointer(key)}`, issues);
    const parsedValue = parseToken(own(data, key), `${path}/${escapePointer(key)}`, issues);
    if (parsedKey && parsedValue)
      Object.defineProperty(output, parsedKey, {
        value: parsedValue,
        enumerable: true,
        configurable: false,
        writable: false,
      });
  }
  return Object.freeze(output);
}
function scalarString(
  value: unknown,
  path: string,
  maximum: number,
  issues: LoreduIssue[],
): string | undefined {
  if (typeof value !== "string") {
    issues.push(makeIssue("TYPE", path, "must be a string"));
    return undefined;
  }
  if (!isScalarText(value)) {
    issues.push(makeIssue("FORMAT", path, "must contain only Unicode scalar values"));
    return undefined;
  }
  if (value !== value.trim()) {
    issues.push(makeIssue("FORMAT", path, "must not contain leading or trailing whitespace"));
    return undefined;
  }
  if (scalarLength(value) < 1 || scalarLength(value) > maximum) {
    issues.push(makeIssue("RANGE", path, `must contain 1 through ${maximum} scalars`));
    return undefined;
  }
  return value;
}
function parseSourceRef(value: unknown, path: string, issues: LoreduIssue[]): SourceRef | undefined {
  const data = inspectObject(value, path, issues);
  if (!data) return undefined;
  rejectUnknown(data, new Set(["ref", "locator", "snapshot"]), issues, path);
  if (!hasOwnDescriptor(data, "ref")) issues.push(makeIssue("REQUIRED", `${path}/ref`, "is required"));
  const ref = scalarString(own(data, "ref"), `${path}/ref`, 1024, issues);
  const locator = hasOwnDescriptor(data, "locator")
    ? scalarString(own(data, "locator"), `${path}/locator`, 1024, issues)
    : undefined;
  const snapshot = hasOwnDescriptor(data, "snapshot")
    ? scalarString(own(data, "snapshot"), `${path}/snapshot`, 256, issues)
    : undefined;
  if (!ref) return undefined;
  return Object.freeze({
    ref,
    ...(hasOwnDescriptor(data, "locator") && locator ? { locator } : {}),
    ...(hasOwnDescriptor(data, "snapshot") && snapshot ? { snapshot } : {}),
  });
}

function parseInitial(input: unknown): ParsedLore {
  const issues: LoreduIssue[] = [];
  const data = inspectObject(input, "", issues);
  if (!data) validationFailed(issues);
  rejectUnknown(data, new Set(["activity", "scope", "corpus", "max_items", "max_chars", "cursor"]), issues);
  if (hasOwnDescriptor(data, "cursor")) {
    for (const key of Object.keys(data))
      if (key !== "cursor" && key !== "max_items" && key !== "max_chars")
        issues.push(makeIssue("UNKNOWN_FIELD", `/${escapePointer(key)}`, "cannot accompany cursor"));
    const raw = own(data, "cursor");
    if (typeof raw !== "string") issues.push(makeIssue("TYPE", "/cursor", "must be a string"));
    if (issues.length > 0) validationFailed(issues);
    const cursor = decodeCursor(raw as string);
    if (cursor.operation !== "lore") cursorMismatch("Cursor belongs to another operation");
    const parsed = filtersFromNormalizedQuery(cursor.query);
    const maxItems = parseBudget(
      own(data, "max_items"),
      hasOwnDescriptor(data, "max_items"),
      "/max_items",
      1,
      200,
      DEFAULT_MAX_ITEMS,
      issues,
    );
    const maxChars = parseBudget(
      own(data, "max_chars"),
      hasOwnDescriptor(data, "max_chars"),
      "/max_chars",
      512,
      1_000_000,
      DEFAULT_MAX_CHARS,
      issues,
    );
    if (issues.length > 0) validationFailed(issues);
    return Object.freeze({ maxItems, maxChars, ...parsed, cursor });
  }
  const maxItems = parseBudget(
    own(data, "max_items"),
    hasOwnDescriptor(data, "max_items"),
    "/max_items",
    1,
    200,
    DEFAULT_MAX_ITEMS,
    issues,
  );
  const maxChars = parseBudget(
    own(data, "max_chars"),
    hasOwnDescriptor(data, "max_chars"),
    "/max_chars",
    512,
    1_000_000,
    DEFAULT_MAX_CHARS,
    issues,
  );
  if (!hasOwnDescriptor(data, "activity")) issues.push(makeIssue("REQUIRED", "/activity", "is required"));
  const activity = parseToken(own(data, "activity"), "/activity", issues);
  const scope = hasOwnDescriptor(data, "scope")
    ? parseScope(own(data, "scope"), "/scope", issues)
    : undefined;
  const corpus = hasOwnDescriptor(data, "corpus")
    ? parseSourceRef(own(data, "corpus"), "/corpus", issues)
    : undefined;
  if (issues.length > 0 || !activity) validationFailed(issues);
  return Object.freeze({
    maxItems,
    maxChars,
    activity,
    ...(scope === undefined || Object.keys(scope).length === 0 ? {} : { scope }),
    ...(corpus === undefined ? {} : { corpus }),
  });
}

function normalizedQuery(parsed: ParsedLore, validAt: string): JsonObject {
  return frozenJsonObject({
    operation: "lore",
    activity: parsed.activity,
    valid_at: validAt,
    ...(parsed.scope === undefined ? {} : { scope: parsed.scope }),
    ...(parsed.corpus === undefined ? {} : { corpus: parsed.corpus }),
  });
}
function filtersFromNormalizedQuery(query: JsonObject): Omit<ParsedLore, "maxItems" | "maxChars" | "cursor"> {
  const issues: LoreduIssue[] = [];
  const data = inspectObject(query, "", issues);
  if (!data) cursorMismatch("Cursor query is not normalized");
  rejectUnknown(data, new Set(["operation", "activity", "valid_at", "scope", "corpus"]), issues);
  if (own(data, "operation") !== "lore") issues.push(makeIssue("FORMAT", "/operation", "must equal lore"));
  const activity = parseToken(own(data, "activity"), "/activity", issues);
  const timestampIssues: LoreduIssue[] = [];
  const validAt = normalizeTimestamp(own(data, "valid_at"), "/valid_at", timestampIssues);
  issues.push(...timestampIssues);
  const scope = hasOwnDescriptor(data, "scope")
    ? parseScope(own(data, "scope"), "/scope", issues)
    : undefined;
  if (scope && Object.keys(scope).length === 0)
    issues.push(makeIssue("FORMAT", "/scope", "empty scope must be omitted"));
  const corpus = hasOwnDescriptor(data, "corpus")
    ? parseSourceRef(own(data, "corpus"), "/corpus", issues)
    : undefined;
  if (issues.length > 0 || !activity || !validAt) cursorMismatch("Cursor query is not normalized");
  const parsed = Object.freeze({
    activity,
    validAt,
    ...(scope === undefined ? {} : { scope }),
    ...(corpus === undefined ? {} : { corpus }),
  });
  if (
    !jsonValuesEqual(
      normalizedQuery({ maxItems: DEFAULT_MAX_ITEMS, maxChars: DEFAULT_MAX_CHARS, ...parsed }, validAt),
      query,
    )
  )
    cursorMismatch("Cursor query is not normalized");
  return parsed;
}

function scopePreview(scope: Scope | undefined): WorkingLoreScopePreview {
  const keys = scope === undefined ? [] : Object.keys(scope).sort(compareUnicodeScalars);
  const pairs = keys.slice(0, 2).map((key) => Object.freeze({ key, value: (scope as Scope)[key] as string }));
  return Object.freeze({ pair_count: keys.length, pairs: Object.freeze(pairs) }) as WorkingLoreScopePreview;
}
function filterDescriptor(
  scope: Scope | undefined,
  corpus: SourceRef | undefined,
): WorkingLoreFilterDescriptor {
  return Object.freeze({ scope: scopePreview(scope), ...(corpus === undefined ? {} : { corpus }) });
}
function keyDescriptor(projection: LoreKnowledgeProjection): WorkingLoreKeyDescriptor {
  const anchor = projection.contributing.reduce((earliest, claim) =>
    Number(claim.position) < Number(earliest.position) ? claim : earliest,
  );
  return Object.freeze({
    anchor_claim: anchor.record.id,
    scope: scopePreview(projection.item.key.scope),
    subject: Object.freeze({
      type: projection.item.key.subject.type,
      id: projection.item.key.subject.id,
    }),
    predicate: projection.item.key.predicate,
    ...(projection.item.key.perspective === undefined
      ? {}
      : { perspective: projection.item.key.perspective }),
  });
}
function copyHandle(handle: RecordHandle): RecordHandle {
  return Object.freeze({
    id: handle.id,
    kind: handle.kind,
    affordances: Object.freeze(
      handle.affordances.map((item) =>
        Object.freeze({
          rel: item.rel,
          action: item.action,
          params: frozenJsonObject(item.params),
          why: item.why,
        }),
      ),
    ),
  });
}
function anchoredClaims(anchor: ClaimId): Affordance {
  return affordance(
    "list",
    "claims.list",
    { query: { same_key_as: anchor } },
    "inspect the complete exact-key group",
  );
}
function compactSummary(key: WorkingLoreKeyDescriptor, state: string, values: readonly JsonValue[]): string {
  const issues: LoreduIssue[] = [];
  const canonical = copyPortableJson({ key, state, values }, "", issues);
  if (canonical === undefined || issues.length > 0)
    throw new TypeError("could not construct Working Lore summary");
  const text = JSON.stringify(canonical);
  const scalars = [...text];
  return scalars.length <= 512 ? text : `${scalars.slice(0, 511).join("")}…`;
}
function sourceMatches(source: SourceRef, corpus: SourceRef): boolean {
  return source.ref === corpus.ref && (corpus.locator === undefined || source.locator === corpus.locator);
}
function mismatchCount(sources: readonly SourceRef[], corpus: SourceRef | undefined): number {
  if (corpus?.snapshot === undefined) return 0;
  return sources.filter(
    (source) =>
      sourceMatches(source, corpus) && source.snapshot !== undefined && source.snapshot !== corpus.snapshot,
  ).length;
}
function knowledgeSummary(
  projection: LoreKnowledgeProjection,
  key: WorkingLoreKeyDescriptor,
): WorkingLoreKnowledgeSummary {
  const representatives = Object.freeze(
    projection.item.values.map((value) => copyHandle(value.representative)),
  ) as readonly [RecordHandle] | readonly [RecordHandle, RecordHandle];
  return Object.freeze({
    key,
    semantics: projection.item.semantics,
    state: projection.item.state as "preferred" | "coexisting" | "disputed",
    value_count: projection.item.value_count,
    claim_count: projection.contributing.length,
    representatives,
    history: projection.item.history,
    evidence: projection.item.evidence,
    claims: anchoredClaims(key.anchor_claim),
  });
}
function itemFor(
  section: WorkingLoreSectionName,
  summary: string,
  knowledge: WorkingLoreKnowledgeSummary,
  projection: LoreKnowledgeProjection,
  snapshotMismatches: number,
): WorkingLoreItem {
  if (section === "current") return Object.freeze({ kind: "current", summary, knowledge });
  if (section === "patterns") return Object.freeze({ kind: "pattern", summary, knowledge });
  if (section === "candidates") return Object.freeze({ kind: "candidate", summary, knowledge });
  if (section === "conflicts") return Object.freeze({ kind: "conflict", summary, knowledge });
  return Object.freeze({
    kind: "needs-revalidation",
    summary,
    knowledge,
    revalidation: Object.freeze({
      verification_count: projection.needs_revalidation_count,
      snapshot_mismatch_count: snapshotMismatches,
    }),
  });
}
function occurrenceSections(
  projection: LoreKnowledgeProjection,
  corpus: SourceRef | undefined,
): readonly WorkingLoreSectionName[] {
  if (projection.item.state === "retracted") return Object.freeze([]);
  if (corpus && !projection.sources.some((source) => sourceMatches(source, corpus))) return Object.freeze([]);
  const current = projection.item.state === "preferred" || projection.item.state === "coexisting";
  const sections: WorkingLoreSectionName[] = [];
  if (projection.item.state === "disputed") sections.push("conflicts");
  const mismatches = mismatchCount(projection.sources, corpus);
  if (
    (current || projection.item.state === "disputed") &&
    (projection.needs_revalidation_count > 0 || mismatches > 0)
  )
    sections.push("needs_revalidation");
  if (current && projection.contributing.every((claim) => claim.record.confidence === "candidate"))
    sections.push("candidates");
  if (current) sections.push("current");
  if (current && projection.contributing.some((claim) => claim.record.claim_class === "pattern"))
    sections.push("patterns");
  return Object.freeze(sections);
}
function buildOccurrences(
  projections: readonly LoreKnowledgeProjection[],
  corpus: SourceRef | undefined,
): readonly Occurrence[] {
  const builders: Omit<Occurrence, "index" | "candidate">[] = [];
  for (const projection of projections) {
    const key = keyDescriptor(projection);
    const summary = compactSummary(key, projection.item.state, projection.values);
    const mismatches = mismatchCount(projection.sources, corpus);
    for (const section of occurrenceSections(projection, corpus))
      builders.push({
        section,
        primary: projection.primary,
        keyIdentity: JSON.stringify(copyPortableJson(projection.item.key, "", [])),
        item: itemFor(section, summary, knowledgeSummary(projection, key), projection, mismatches),
      });
  }
  builders.sort(
    (left, right) =>
      CORE_ORDER.indexOf(left.section) - CORE_ORDER.indexOf(right.section) ||
      left.primary - right.primary ||
      compareUnicodeScalars(left.keyIdentity, right.keyIdentity),
  );
  return Object.freeze(
    builders.map((builder, index) => {
      const candidate: WorkingLoreRankCandidate = Object.freeze({
        index,
        section: builder.section,
        primary_position: builder.primary as StreamPosition,
        key: builder.item.knowledge.key,
        state: builder.item.knowledge.state,
        summary: builder.item.summary,
        evidence: builder.item.knowledge.evidence,
      });
      return Object.freeze({ ...builder, index, candidate });
    }),
  );
}
function rankContext(
  parsed: ParsedLore,
  validAt: string,
  filters: WorkingLoreFilterDescriptor,
  occurrences: readonly Occurrence[],
): WorkingLoreRankContext {
  return Object.freeze({
    query: Object.freeze({ operation: "lore", activity: parsed.activity, valid_at: validAt, filters }),
    candidates: Object.freeze(occurrences.map((occurrence) => occurrence.candidate)),
  });
}
function orientation(occurrences: readonly Occurrence[]) {
  const count = (section: WorkingLoreSectionName) =>
    occurrences.filter((item) => item.section === section).length;
  const current = count("current");
  const patterns = count("patterns");
  const candidates = count("candidates");
  const conflicts = count("conflicts");
  const revalidation = count("needs_revalidation");
  return Object.freeze({
    current_count: current,
    pattern_count: patterns,
    candidate_count: candidates,
    conflict_count: conflicts,
    needs_revalidation_count: revalidation,
    attention_count: candidates + conflicts + revalidation,
  });
}
function selectPrefix(
  occurrences: readonly Occurrence[],
  maxItems: number,
  maxChars: number,
): readonly Occurrence[] {
  const selected: Occurrence[] = [];
  let chars = 0;
  for (const occurrence of occurrences) {
    const length = scalarLength(occurrence.item.summary);
    if (selected.length + 1 > maxItems || chars + length > maxChars) break;
    selected.push(occurrence);
    chars += length;
  }
  return Object.freeze(selected);
}

function makeBasis(
  head: StreamPosition,
  ruleset: WorkingLoreRulesetIdentity,
  query: JsonObject,
): WorkingLoreBasis {
  return Object.freeze({ stream_position: head, ruleset, query });
}
function sameRuleset(left: WorkingLoreRulesetIdentity, right: WorkingLoreRulesetIdentity): boolean {
  return (
    left.core === right.core &&
    left.claim_policy.id === right.claim_policy.id &&
    left.claim_policy.version === right.claim_policy.version &&
    left.ranker.id === right.ranker.id &&
    left.ranker.version === right.ranker.version
  );
}
function pinSnapshot(
  current: Snapshot,
  cursor: WorkingLoreCursor,
  ruleset: WorkingLoreRulesetIdentity,
): Snapshot {
  if (!sameRuleset(cursor.basis.ruleset, ruleset)) cursorMismatch("Cursor ruleset does not match");
  if (current.head < cursor.basis.stream_position) cursorMismatch("Cursor snapshot is no longer present");
  if (cursor.basis.stream_position === 0) {
    if (cursor.anchor !== "empty") cursorMismatch();
  } else if (current.records[Number(cursor.basis.stream_position) - 1]?.record.id !== cursor.anchor)
    cursorMismatch("Cursor snapshot anchor does not match this store");
  return Object.freeze({
    head: cursor.basis.stream_position,
    records: Object.freeze(current.records.slice(0, Number(cursor.basis.stream_position))),
  });
}
function cursorFor(
  basis: WorkingLoreBasis,
  snapshot: Snapshot,
  computedAt: string,
  section: WorkingLoreSectionName,
  resume: WorkingLoreResume,
  count: number,
  digest: string,
): string {
  const anchor =
    basis.stream_position === 0 ? "empty" : snapshot.records[Number(basis.stream_position) - 1]?.record.id;
  if (!anchor) throw new TypeError("snapshot has no cursor anchor");
  return encodeWorkingLoreCursor(
    Object.freeze({
      version: 1,
      operation: "lore",
      query: basis.query,
      basis,
      anchor,
      computed_at: computedAt,
      rank: Object.freeze({
        algorithm: "sha256",
        candidate_count: count,
        permutation_digest: digest,
        section,
        resume,
      }),
    }),
  );
}
function sectionCursor(
  section: WorkingLoreSectionName,
  all: readonly Occurrence[],
  selected: readonly Occurrence[],
  previousResume: WorkingLoreResume | undefined,
  basis: WorkingLoreBasis,
  snapshot: Snapshot,
  computedAt: string,
  count: number,
  digest: string,
): string | undefined {
  const stream = all.filter((item) => item.section === section);
  const returned = selected.filter((item) => item.section === section);
  const last = returned[returned.length - 1];
  const resume: WorkingLoreResume =
    last === undefined
      ? (previousResume ?? Object.freeze({ kind: "before-first" }))
      : Object.freeze({
          kind: "after",
          section_ordinal: stream.findIndex((item) => item.index === last.index),
          occurrence_index: last.index,
        });
  const nextOrdinal = resume.kind === "before-first" ? 0 : resume.section_ordinal + 1;
  if (nextOrdinal >= stream.length) return undefined;
  return cursorFor(basis, snapshot, computedAt, section, resume, count, digest);
}
function buildSections(
  names: readonly WorkingLoreSectionName[],
  all: readonly Occurrence[],
  selected: readonly Occurrence[],
  previousResume: WorkingLoreResume | undefined,
  basis: WorkingLoreBasis,
  snapshot: Snapshot,
  computedAt: string,
  count: number,
  digest: string,
): readonly WorkingLoreSection[] {
  return Object.freeze(
    names.map((name) => {
      const items = Object.freeze(selected.filter((item) => item.section === name).map((item) => item.item));
      const total = all.filter((item) => item.section === name).length;
      const cursor = sectionCursor(
        name,
        all,
        selected,
        previousResume,
        basis,
        snapshot,
        computedAt,
        count,
        digest,
      );
      return Object.freeze({ name, items, page: page(items.length, total, cursor) });
    }),
  );
}
function continuationAffordance(cursor: string, maxItems: number, maxChars: number): Affordance {
  return affordance(
    "continue",
    "lore.read",
    {
      cursor,
      ...(maxItems === DEFAULT_MAX_ITEMS ? {} : { max_items: maxItems }),
      ...(maxChars === DEFAULT_MAX_CHARS ? {} : { max_chars: maxChars }),
    },
    "continue this pinned Working Lore section",
  );
}
function adviceFor(
  selected: readonly Occurrence[],
  sections: readonly WorkingLoreSection[],
  maxItems: number,
  maxChars: number,
): readonly Affordance[] {
  const output: Affordance[] = [];
  for (const occurrence of selected) {
    if (occurrence.section !== "conflicts") continue;
    output.push(occurrence.item.knowledge.claims);
    for (const representative of occurrence.item.knowledge.representatives)
      output.push(representative.affordances[0] as Affordance);
  }
  for (const section of sections)
    if (section.page.cursor) output.push(continuationAffordance(section.page.cursor, maxItems, maxChars));
  return deduplicateAdvice(output);
}
function clockSample(clock: Clock): string {
  try {
    return new Date(createInstant(clock.now())).toISOString();
  } catch {
    throw new LoreduError("CLOCK_FAILED", "Clock failed");
  }
}

export function createWorkingLoreService(
  store: RecordStore,
  clock: Clock,
  policy: ValidatedClaimPolicy,
  ordinaryRuleset: RulesetIdentity,
  ranker: ValidatedRanker,
): (query: WorkingLoreQuery) => Promise<WorkingLoreApplicationResponse> {
  const ruleset: WorkingLoreRulesetIdentity = Object.freeze({
    core: ordinaryRuleset.core,
    claim_policy: ordinaryRuleset.claim_policy,
    ranker: Object.freeze({ id: ranker.id, version: ranker.version }),
  });
  return async (input: WorkingLoreQuery): Promise<WorkingLoreApplicationResponse> => {
    const parsed = parseInitial(input);
    const computedAt = parsed.cursor?.computed_at ?? clockSample(clock);
    const validAt = (parsed.cursor?.basis.query.valid_at as string | undefined) ?? computedAt;
    const query = parsed.cursor?.query ?? normalizedQuery(parsed, validAt);
    const current = await readSnapshot(store);
    const snapshot = parsed.cursor ? pinSnapshot(current, parsed.cursor, ruleset) : current;
    const basis = parsed.cursor?.basis ?? makeBasis(snapshot.head, ruleset, query);
    if (!jsonValuesEqual(basis.query, query)) cursorMismatch("Cursor Basis query does not match");
    const projections = computeLoreKnowledge(snapshot, validAt, parsed.scope, policy);
    const filters = filterDescriptor(parsed.scope, parsed.corpus);
    const occurrences = buildOccurrences(projections, parsed.corpus);
    const context = rankContext(parsed, validAt, filters, occurrences);
    const permutation = invokeRanker(ranker, context);
    const digest = permutationDigest(permutation);
    if (
      parsed.cursor &&
      (parsed.cursor.rank.candidate_count !== occurrences.length ||
        parsed.cursor.rank.permutation_digest !== digest)
    )
      cursorMismatch("Cursor ranking does not match the recomputed permutation");
    const ranked = Object.freeze(permutation.map((index) => occurrences[index] as Occurrence));
    let names: readonly WorkingLoreSectionName[] = DISPLAY_ORDER;
    let available = ranked;
    if (parsed.cursor) {
      const binding = parsed.cursor.rank;
      names = Object.freeze([binding.section]);
      const sectionStream = ranked.filter((item) => item.section === binding.section);
      if (sectionStream.length === 0) cursorMismatch("Cursor section has no occurrences to resume");
      if (binding.resume.kind === "after") {
        const found = sectionStream[binding.resume.section_ordinal];
        if (!found || found.index !== binding.resume.occurrence_index)
          cursorMismatch("Cursor resume occurrence is absent or moved");
        available = Object.freeze(sectionStream.slice(binding.resume.section_ordinal + 1));
        if (available.length === 0) cursorMismatch("Cursor resume is already at the end of its section");
      } else available = Object.freeze(sectionStream);
    }
    const selected = selectPrefix(available, parsed.maxItems, parsed.maxChars);
    const sections = buildSections(
      names,
      ranked,
      selected,
      parsed.cursor?.rank.resume,
      basis,
      snapshot,
      computedAt,
      occurrences.length,
      digest,
    );
    const usedChars = selected.reduce((sum, item) => sum + scalarLength(item.item.summary), 0);
    const packet: WorkingLorePacket = Object.freeze({
      activity: parsed.activity,
      filters,
      orientation: orientation(occurrences),
      sections,
      budget: Object.freeze({
        max_items: parsed.maxItems,
        max_chars: parsed.maxChars,
        used_items: selected.length,
        used_chars: usedChars,
      }),
    });
    return Object.freeze({
      ok: true,
      result: Object.freeze({ computed_at: computedAt, packet }),
      reconciliation: Object.freeze({ state: "not-applicable", related: Object.freeze([]) as readonly [] }),
      advice: adviceFor(selected, sections, parsed.maxItems, parsed.maxChars),
      basis,
    });
  };
}
