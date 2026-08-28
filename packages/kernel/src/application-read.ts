import type {
  Affordance,
  ApplicationListResponse,
  ApplicationResponse,
  ApplicationStatusResponse,
  ClaimFilters,
  ClaimItem,
  ClaimQuery,
  DanglingRecordReference,
  HeadResult,
  HealthItem,
  HistoryItem,
  HistoryQuery,
  KeyDivergenceAdvisory,
  Page,
  ReconciliationFeedback,
  RecordHandle,
  RecordSummary,
  ShownRecordResult,
  StatusQuery,
  StatusResult,
  UnresolvedExclusiveGroup,
} from "./application-types";
import { basisEquals, createBasis, type RulesetIdentity } from "./domain/basis";
import { claimKeyOf, claimKeysEqual } from "./domain/claim-key";
import type {
  Actor,
  Claim,
  ClaimKey,
  JsonObject,
  JsonValue,
  PersistedRecord,
  RecordId,
  Scope,
} from "./domain/entry";
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
import { decodePersistedRecord, normalizeTimestamp } from "./domain/records";
import { LoreduError, type LoreduIssue } from "./errors";
import {
  createStreamPosition,
  type PositionedRecord,
  type RecordScan,
  type RecordStore,
  type StreamPosition,
} from "./ports/capabilities";
import { type ClaimSemantics, evaluateClaimPolicy, type ValidatedClaimPolicy } from "./ports/claim-policy";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const CURSOR_PREFIX = "loredu.cursor.v1.";
const TOKEN = /^[a-z0-9](?:[a-z0-9._:/-]*[a-z0-9])?$/;
const RECORD_ID = /^(ent|clm|rel|res|ver)_[0-9abcdefghjkmnpqrstvwxyz]{16}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const EMPTY_RECONCILIATION = Object.freeze({
  state: "not-applicable" as const,
  related: Object.freeze([]) as readonly [],
});

type Snapshot = {
  readonly head: StreamPosition;
  readonly records: readonly PositionedRecord[];
};
type CursorOperation = "claims" | "history" | "status";
type StatusKey = readonly [number, number, number];
type CursorPayload = {
  readonly version: 1;
  readonly operation: CursorOperation;
  readonly query: JsonObject;
  readonly basis: ReturnType<typeof createBasis>;
  readonly anchor: string;
  readonly resume: number | StatusKey;
};
type ParsedClaimRequest = {
  readonly limit: number;
  readonly filters: ClaimFilters;
  readonly query: JsonObject;
  readonly cursor?: CursorPayload;
};
type StatusComputedItem = {
  readonly key: StatusKey;
  readonly value: HealthItem | KeyDivergenceAdvisory;
  readonly health: boolean;
};
type ClaimGroup = {
  readonly key: ClaimKey;
  readonly members: readonly PositionedRecord[];
  readonly semantics: ClaimSemantics;
};
type CohortNode = {
  readonly claims: PositionedRecord[];
  parent: number;
  rank: number;
};
type Cohort = {
  readonly scope: Scope;
  readonly value: JsonValue;
  readonly nodes: CohortNode[];
  readonly nodeByClaimKey: Map<string, number>;
};
type IndexedResolution = {
  readonly targets: ReadonlySet<RecordId>;
};
type StatusIndex = {
  readonly byId: ReadonlyMap<RecordId, PositionedRecord>;
  readonly groups: readonly ClaimGroup[];
  readonly cohorts: readonly Cohort[];
  readonly resolutionsByTarget: ReadonlyMap<RecordId, readonly IndexedResolution[]>;
};

function validationFailed(
  issues: readonly LoreduIssue[],
  message = "Application query validation failed",
): never {
  throw new LoreduError("VALIDATION_FAILED", message, Object.freeze([...issues]));
}

function cursorInvalid(message = "Cursor is invalid"): never {
  throw new LoreduError("INVALID_CURSOR", message);
}

function cursorMismatch(message = "Cursor does not match this operation or snapshot"): never {
  throw new LoreduError("CURSOR_MISMATCH", message);
}

function ownValue(data: Readonly<Record<string, PropertyDescriptor>>, key: string): unknown {
  return hasOwnDescriptor(data, key) ? dataValue(data, key) : undefined;
}

function rejectUnknown(
  data: Readonly<Record<string, PropertyDescriptor>>,
  allowed: ReadonlySet<string>,
  issues: LoreduIssue[],
): void {
  for (const key of Object.keys(data)) {
    if (!allowed.has(key))
      issues.push(makeIssue("UNKNOWN_FIELD", `/${escapePointer(key)}`, "is not part of this query"));
  }
}

function parseLimit(value: unknown, present: boolean, issues: LoreduIssue[]): number {
  if (!present) return DEFAULT_LIMIT;
  if (typeof value !== "number") {
    issues.push(makeIssue("TYPE", "/limit", "must be a number"));
    return DEFAULT_LIMIT;
  }
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_LIMIT) {
    issues.push(makeIssue("RANGE", "/limit", "must be a safe integer from 1 through 200"));
    return DEFAULT_LIMIT;
  }
  return value;
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

function parseRecordId(value: unknown, path: string, issues: LoreduIssue[]): RecordId | undefined {
  if (typeof value !== "string") {
    issues.push(makeIssue("TYPE", path, "must be a record id string"));
    return undefined;
  }
  if (!RECORD_ID.test(value)) {
    issues.push(makeIssue("FORMAT", path, "must be a complete kind-prefixed Loredu record id"));
    return undefined;
  }
  return value as RecordId;
}

function parseScope(value: unknown, path: string, issues: LoreduIssue[]): Scope | undefined {
  const data = inspectObject(value, path, issues);
  if (!data) return undefined;
  const output = Object.create(null) as Record<string, string>;
  for (const key of Object.keys(data).sort(compareUnicodeScalars)) {
    const parsedKey = parseToken(key, `${path}/${escapePointer(key)}`, issues);
    const parsedValue = parseToken(dataValue(data, key), `${path}/${escapePointer(key)}`, issues);
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

function parseActor(value: unknown, path: string, issues: LoreduIssue[]): Actor | undefined {
  const data = inspectObject(value, path, issues);
  if (!data) return undefined;
  for (const key of Object.keys(data)) {
    if (key !== "type" && key !== "id")
      issues.push(makeIssue("UNKNOWN_FIELD", `${path}/${escapePointer(key)}`, "is not part of Actor"));
  }
  const type = ownValue(data, "type");
  const id = parseToken(ownValue(data, "id"), `${path}/id`, issues);
  if (type !== "human" && type !== "agent" && type !== "program" && type !== "system") {
    issues.push(makeIssue("FORMAT", `${path}/type`, "is not a supported Actor type"));
    return undefined;
  }
  return id ? Object.freeze({ type, id }) : undefined;
}

function frozenJsonObject(value: unknown): JsonObject {
  const issues: LoreduIssue[] = [];
  const copied = copyJsonObject(value, "", issues);
  if (!copied || issues.length > 0) throw new TypeError("internal value is not portable JSON");
  return copied;
}

function sameScope(left: Scope, right: Scope): boolean {
  const leftKeys = Object.keys(left).sort(compareUnicodeScalars);
  const rightKeys = Object.keys(right).sort(compareUnicodeScalars);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key])
  );
}

function scopeContains(actual: Scope, requested: Scope): boolean {
  return Object.keys(requested).every((key) => actual[key] === requested[key]);
}

function parseClaimsQuery(input: unknown): ParsedClaimRequest {
  const issues: LoreduIssue[] = [];
  const value = input === undefined ? {} : input;
  const data = inspectObject(value, "", issues);
  if (!data) validationFailed(issues);
  const allowed = new Set([
    "scope",
    "scope_match",
    "subject_type",
    "subject",
    "predicate",
    "perspective",
    "value",
    "actor",
    "since",
    "limit",
    "cursor",
  ]);
  rejectUnknown(data, allowed, issues);
  const hasCursor = hasOwnDescriptor(data, "cursor");
  const limit = parseLimit(ownValue(data, "limit"), hasOwnDescriptor(data, "limit"), issues);
  if (hasCursor) {
    for (const key of Object.keys(data)) {
      if (key !== "cursor" && key !== "limit")
        issues.push(makeIssue("UNKNOWN_FIELD", `/${escapePointer(key)}`, "cannot accompany cursor"));
    }
    const rawCursor = ownValue(data, "cursor");
    if (typeof rawCursor !== "string") issues.push(makeIssue("TYPE", "/cursor", "must be a string"));
    if (issues.length > 0) validationFailed(issues);
    const cursor = decodeCursor(rawCursor as string);
    if (cursor.operation !== "claims") cursorMismatch();
    const parsed = claimFiltersFromBasisQuery(cursor.query);
    return Object.freeze({ limit, filters: parsed.filters, query: parsed.query, cursor });
  }

  const filters: Record<string, unknown> = {};
  let scope: Scope | undefined;
  if (hasOwnDescriptor(data, "scope")) {
    scope = parseScope(ownValue(data, "scope"), "/scope", issues);
    if (scope) filters.scope = scope;
  }
  if (hasOwnDescriptor(data, "scope_match")) {
    const match = ownValue(data, "scope_match");
    if (match !== "subset" && match !== "exact")
      issues.push(makeIssue("FORMAT", "/scope_match", "must be subset or exact"));
    else if (match === "exact") filters.scope_match = "exact";
    if (!hasOwnDescriptor(data, "scope"))
      issues.push(makeIssue("REQUIRED", "/scope", "is required with scope_match"));
  }
  for (const key of ["subject_type", "subject", "predicate"] as const) {
    if (hasOwnDescriptor(data, key)) {
      const parsed = parseToken(ownValue(data, key), `/${key}`, issues);
      if (parsed) filters[key] = parsed;
    }
  }
  if (hasOwnDescriptor(data, "perspective")) {
    const perspective = ownValue(data, "perspective");
    if (perspective === null) filters.perspective = null;
    else {
      const parsed = parseToken(perspective, "/perspective", issues);
      if (parsed) filters.perspective = parsed;
    }
  }
  if (hasOwnDescriptor(data, "value")) {
    const copied = copyPortableJson(ownValue(data, "value"), "/value", issues);
    if (copied !== undefined) filters.value = copied;
  }
  if (hasOwnDescriptor(data, "actor")) {
    const actor = parseActor(ownValue(data, "actor"), "/actor", issues);
    if (actor) filters.actor = actor;
  }
  if (hasOwnDescriptor(data, "since")) {
    const normalized = normalizeTimestamp(ownValue(data, "since"), "/since", issues);
    if (normalized) filters.since = normalized;
  }
  if (issues.length > 0) validationFailed(issues);
  const frozenFilters = frozenJsonObject(filters) as ClaimFilters;
  const query = frozenJsonObject({ operation: "claims", filters: frozenFilters });
  return Object.freeze({ limit, filters: frozenFilters, query });
}

function claimFiltersFromBasisQuery(query: JsonObject): Pick<ParsedClaimRequest, "filters" | "query"> {
  try {
    if (query.operation !== "claims" || typeof query.filters !== "object" || query.filters === null)
      cursorInvalid();
    const parsed = parseClaimsQuery(query.filters);
    if (!jsonValuesEqual(parsed.query, query)) cursorMismatch("Cursor query is not normalized");
    return Object.freeze({ filters: parsed.filters, query: parsed.query });
  } catch (error) {
    if (error instanceof LoreduError && (error.code === "INVALID_CURSOR" || error.code === "CURSOR_MISMATCH"))
      throw error;
    cursorInvalid();
  }
}

function parseHistoryQuery(input: unknown): {
  readonly id: RecordId;
  readonly limit: number;
  readonly query: JsonObject;
  readonly cursor?: CursorPayload;
} {
  const issues: LoreduIssue[] = [];
  const data = inspectObject(input, "", issues);
  if (!data) validationFailed(issues);
  rejectUnknown(data, new Set(["id", "limit", "cursor"]), issues);
  const limit = parseLimit(ownValue(data, "limit"), hasOwnDescriptor(data, "limit"), issues);
  if (hasOwnDescriptor(data, "cursor")) {
    if (hasOwnDescriptor(data, "id"))
      issues.push(makeIssue("UNKNOWN_FIELD", "/id", "cannot accompany cursor"));
    const raw = ownValue(data, "cursor");
    if (typeof raw !== "string") issues.push(makeIssue("TYPE", "/cursor", "must be a string"));
    if (issues.length > 0) validationFailed(issues);
    const cursor = decodeCursor(raw as string);
    if (cursor.operation !== "history") cursorMismatch();
    const id = historyIdFromQuery(cursor.query);
    return Object.freeze({ id, limit, query: cursor.query, cursor });
  }
  if (!hasOwnDescriptor(data, "id")) issues.push(makeIssue("REQUIRED", "/id", "is required"));
  const id = parseRecordId(ownValue(data, "id"), "/id", issues);
  if (issues.length > 0 || !id) validationFailed(issues);
  return Object.freeze({ id, limit, query: frozenJsonObject({ operation: "history", id }) });
}

function historyIdFromQuery(query: JsonObject): RecordId {
  const issues: LoreduIssue[] = [];
  const data = inspectObject(query, "", issues);
  if (!data || Object.keys(data).length !== 2 || ownValue(data, "operation") !== "history") cursorInvalid();
  const id = parseRecordId(ownValue(data, "id"), "/id", issues);
  if (issues.length > 0 || !id) cursorInvalid();
  const normalized = frozenJsonObject({ operation: "history", id });
  if (!jsonValuesEqual(normalized, query)) cursorMismatch("Cursor query is not normalized");
  return id;
}

function parseStatusQuery(input: unknown): {
  readonly limit: number;
  readonly query: JsonObject;
  readonly cursor?: CursorPayload;
} {
  const issues: LoreduIssue[] = [];
  const value = input === undefined ? {} : input;
  const data = inspectObject(value, "", issues);
  if (!data) validationFailed(issues);
  rejectUnknown(data, new Set(["limit", "cursor"]), issues);
  const limit = parseLimit(ownValue(data, "limit"), hasOwnDescriptor(data, "limit"), issues);
  if (hasOwnDescriptor(data, "cursor")) {
    const raw = ownValue(data, "cursor");
    if (typeof raw !== "string") issues.push(makeIssue("TYPE", "/cursor", "must be a string"));
    if (issues.length > 0) validationFailed(issues);
    const cursor = decodeCursor(raw as string);
    if (cursor.operation !== "status") cursorMismatch();
    if (!jsonValuesEqual(cursor.query, frozenJsonObject({ operation: "status" })))
      cursorMismatch("Cursor query is not normalized");
    return Object.freeze({ limit, query: cursor.query, cursor });
  }
  if (issues.length > 0) validationFailed(issues);
  return Object.freeze({ limit, query: frozenJsonObject({ operation: "status" }) });
}

function encodeUtf8(value: string): readonly number[] {
  const bytes: number[] = [];
  for (const scalar of value) {
    const code = scalar.codePointAt(0) as number;
    if (code <= 0x7f) bytes.push(code);
    else if (code <= 0x7ff) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code <= 0xffff)
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
  }
  return bytes;
}

function decodeUtf8(bytes: readonly number[]): string {
  let output = "";
  for (let index = 0; index < bytes.length; ) {
    const first = bytes[index] as number;
    let code: number;
    let length: number;
    if (first <= 0x7f) {
      code = first;
      length = 1;
    } else if (first >= 0xc2 && first <= 0xdf) {
      code = first & 0x1f;
      length = 2;
    } else if (first >= 0xe0 && first <= 0xef) {
      code = first & 0x0f;
      length = 3;
    } else if (first >= 0xf0 && first <= 0xf4) {
      code = first & 0x07;
      length = 4;
    } else cursorInvalid();
    if (index + length > bytes.length) cursorInvalid();
    for (let offset = 1; offset < length; offset++) {
      const byte = bytes[index + offset] as number;
      if ((byte & 0xc0) !== 0x80) cursorInvalid();
      code = (code << 6) | (byte & 0x3f);
    }
    if (
      (length === 3 && code < 0x800) ||
      (length === 4 && code < 0x10000) ||
      (code >= 0xd800 && code <= 0xdfff) ||
      code > 0x10ffff
    )
      cursorInvalid();
    output += String.fromCodePoint(code);
    index += length;
  }
  return output;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function base64Encode(bytes: readonly number[]): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] as number;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const packed = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += BASE64[(packed >> 18) & 63] as string;
    output += BASE64[(packed >> 12) & 63] as string;
    if (second !== undefined) output += BASE64[(packed >> 6) & 63] as string;
    if (third !== undefined) output += BASE64[packed & 63] as string;
  }
  return output;
}

function base64Decode(value: string): readonly number[] {
  if (!BASE64URL.test(value) || value.length % 4 === 1) cursorInvalid();
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 4) {
    const chars = [value[index], value[index + 1], value[index + 2], value[index + 3]];
    const values = chars.map((char) => (char === undefined ? 0 : BASE64.indexOf(char)));
    if (values.some((item, itemIndex) => chars[itemIndex] !== undefined && item < 0)) cursorInvalid();
    const packed =
      ((values[0] as number) << 18) |
      ((values[1] as number) << 12) |
      ((values[2] as number) << 6) |
      (values[3] as number);
    bytes.push((packed >> 16) & 0xff);
    if (chars[2] !== undefined) bytes.push((packed >> 8) & 0xff);
    if (chars[3] !== undefined) bytes.push(packed & 0xff);
  }
  if (base64Encode(bytes) !== value) cursorInvalid();
  return bytes;
}

function encodeCursor(payload: CursorPayload): string {
  return `${CURSOR_PREFIX}${base64Encode(encodeUtf8(JSON.stringify(payload)))}`;
}

function decodeCursorPayload(token: string): CursorPayload {
  if (!token.startsWith(CURSOR_PREFIX)) cursorInvalid();
  const encoded = token.slice(CURSOR_PREFIX.length);
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeUtf8(base64Decode(encoded)));
  } catch (error) {
    if (error instanceof LoreduError) throw error;
    cursorInvalid();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) cursorInvalid();
  const object = parsed as Record<string, unknown>;
  const keys = Object.keys(object).sort();
  if (keys.join(",") !== "anchor,basis,operation,query,resume,version") cursorInvalid();
  if (object.version !== 1) cursorInvalid();
  if (object.operation !== "claims" && object.operation !== "history" && object.operation !== "status")
    cursorInvalid();
  if (typeof object.anchor !== "string") cursorInvalid();
  const queryIssues: LoreduIssue[] = [];
  const query = copyJsonObject(object.query, "/query", queryIssues);
  if (!query || queryIssues.length > 0) cursorInvalid();
  let basis: ReturnType<typeof createBasis>;
  try {
    basis = createBasis(object.basis as never);
  } catch {
    cursorInvalid();
  }
  if (!jsonValuesEqual(basis.query, query)) cursorMismatch("Cursor Basis query does not match cursor query");
  let resume: number | StatusKey;
  if (object.operation === "status") {
    if (
      !Array.isArray(object.resume) ||
      object.resume.length !== 3 ||
      !object.resume.every((item) => Number.isSafeInteger(item) && item >= 0)
    )
      cursorInvalid();
    resume = Object.freeze([object.resume[0], object.resume[1], object.resume[2]]) as StatusKey;
  } else {
    if (!Number.isSafeInteger(object.resume) || (object.resume as number) < 0) cursorInvalid();
    resume = object.resume as number;
  }
  if (basis.stream_position === 0 ? object.anchor !== "empty" : !RECORD_ID.test(object.anchor))
    cursorInvalid();
  if (object.operation === "status") {
    const statusResume = resume as StatusKey;
    if (statusResume[0] > 2 || statusResume[1] > basis.stream_position) cursorInvalid();
  } else if ((resume as number) < 1 || (resume as number) > basis.stream_position) cursorInvalid();
  return Object.freeze({
    version: 1,
    operation: object.operation,
    query,
    basis,
    anchor: object.anchor,
    resume,
  });
}

function decodeCursor(token: string): CursorPayload {
  try {
    return decodeCursorPayload(token);
  } catch (error) {
    if (error instanceof LoreduError && (error.code === "INVALID_CURSOR" || error.code === "CURSOR_MISMATCH"))
      throw error;
    cursorInvalid();
  }
}

function createCursor(
  operation: CursorOperation,
  query: JsonObject,
  basis: ReturnType<typeof createBasis>,
  snapshot: Snapshot,
  resume: number | StatusKey,
): string {
  const anchor =
    basis.stream_position === 0
      ? "empty"
      : (snapshot.records[Number(basis.stream_position) - 1]?.record.id as string);
  if (basis.stream_position > 0 && !anchor) throw new TypeError("snapshot has no cursor anchor");
  return encodeCursor(Object.freeze({ version: 1, operation, query, basis, anchor, resume }));
}

function sameRuleset(left: RulesetIdentity, right: RulesetIdentity): boolean {
  return (
    left.core === right.core &&
    left.claim_policy.id === right.claim_policy.id &&
    left.claim_policy.version === right.claim_policy.version
  );
}

async function readSnapshot(store: RecordStore): Promise<Snapshot> {
  let scan: RecordScan;
  try {
    scan = await store.scan();
  } catch (error) {
    if (error instanceof LoreduError) throw error;
    throw new LoreduError("STORE_IO_FAILED", "Store scan failed");
  }
  try {
    const head = createStreamPosition(scan.head);
    if (!Array.isArray(scan.records) || scan.records.length !== Number(head)) throw new TypeError();
    const ids = new Set<string>();
    const records = scan.records.map((item, index) => {
      const position = createStreamPosition(item.position);
      if (Number(position) !== index + 1) throw new TypeError();
      const record = decodePersistedRecord(item.record);
      if (ids.has(record.id)) throw new TypeError();
      ids.add(record.id);
      return Object.freeze({ position, record });
    });
    return Object.freeze({ head, records: Object.freeze(records) });
  } catch {
    throw new LoreduError("STORE_CORRUPT", "Store returned an invalid record snapshot");
  }
}

function pinnedSnapshot(current: Snapshot, cursor: CursorPayload, ruleset: RulesetIdentity): Snapshot {
  if (!sameRuleset(cursor.basis.ruleset, ruleset)) cursorMismatch("Cursor ruleset does not match");
  if (current.head < cursor.basis.stream_position) cursorMismatch("Cursor snapshot is no longer present");
  if (cursor.basis.stream_position === 0) {
    if (cursor.anchor !== "empty") cursorMismatch();
  } else if (current.records[Number(cursor.basis.stream_position) - 1]?.record.id !== cursor.anchor) {
    cursorMismatch("Cursor snapshot anchor does not match this store");
  }
  return Object.freeze({
    head: cursor.basis.stream_position,
    records: Object.freeze(current.records.slice(0, Number(cursor.basis.stream_position))),
  });
}

function makeBasis(head: StreamPosition, ruleset: RulesetIdentity, query: JsonObject) {
  return createBasis({ stream_position: head, ruleset, query });
}

function affordance(
  rel: Affordance["rel"],
  action: Affordance["action"],
  params: unknown,
  why: string,
): Affordance {
  return Object.freeze({ rel, action, params: frozenJsonObject(params), why });
}

function handle(record: PersistedRecord): RecordHandle {
  return Object.freeze({
    id: record.id,
    kind: record.kind,
    affordances: Object.freeze([
      affordance("show", "record.show", { id: record.id }, "inspect this record"),
      affordance(
        "history",
        "record.history",
        { id: record.id },
        "inspect records that directly reference this record",
      ),
    ]),
  });
}

function exactKeyClaimQuery(key: ClaimKey): JsonObject {
  return frozenJsonObject({
    scope: key.scope,
    scope_match: "exact",
    subject_type: key.subject.type,
    subject: key.subject.id,
    predicate: key.predicate,
    perspective: key.perspective ?? null,
  });
}

function keyClaimsAffordance(key: ClaimKey): Affordance {
  return affordance(
    "list",
    "claims.list",
    { query: exactKeyClaimQuery(key) },
    "inspect the complete exact-key group",
  );
}

function divergenceClaimsAffordance(scope: Scope, value: JsonValue): Affordance {
  return affordance(
    "list",
    "claims.list",
    { query: frozenJsonObject({ scope, scope_match: "exact", value }) },
    "inspect claims with this exact scope and value",
  );
}

function deduplicateAdvice(items: readonly Affordance[]): readonly Affordance[] {
  const seen = new Set<string>();
  const output: Affordance[] = [];
  for (const item of items) {
    const identity = `${item.rel}\u0000${item.action}\u0000${JSON.stringify(item.params)}`;
    if (!seen.has(identity)) {
      seen.add(identity);
      output.push(item);
    }
  }
  return Object.freeze(output);
}

function page(returned: number, total: number, cursor?: string): Page {
  return Object.freeze({ returned, total, ...(cursor === undefined ? {} : { cursor }) });
}

function claimsMatch(claim: Claim, filters: ClaimFilters): boolean {
  if (filters.scope !== undefined) {
    const matches =
      filters.scope_match === "exact"
        ? sameScope(claim.scope, filters.scope)
        : scopeContains(claim.scope, filters.scope);
    if (!matches) return false;
  }
  if (filters.subject_type !== undefined && claim.subject.type !== filters.subject_type) return false;
  if (filters.subject !== undefined && claim.subject.id !== filters.subject) return false;
  if (filters.predicate !== undefined && claim.predicate !== filters.predicate) return false;
  if (
    Object.hasOwn(filters, "perspective") &&
    (filters.perspective === null
      ? claim.perspective !== undefined
      : claim.perspective !== filters.perspective)
  )
    return false;
  if (Object.hasOwn(filters, "value") && !jsonValuesEqual(claim.value, filters.value as JsonValue))
    return false;
  if (
    filters.actor !== undefined &&
    (claim.actor.type !== filters.actor.type || claim.actor.id !== filters.actor.id)
  )
    return false;
  if (filters.since !== undefined && claim.recorded_at < filters.since) return false;
  return true;
}

function summary(record: PersistedRecord): RecordSummary {
  if (record.kind === "entry")
    return Object.freeze({
      kind: "entry",
      ...(record.title === undefined ? {} : { title: record.title }),
      ...(record.entry_type === undefined ? {} : { entry_type: record.entry_type }),
    });
  if (record.kind === "claim")
    return Object.freeze({
      kind: "claim",
      key: claimKeyOf(record),
      value: record.value,
      confidence: record.confidence,
    });
  if (record.kind === "relation")
    return Object.freeze({ kind: "relation", relation_type: record.relation_type });
  if (record.kind === "resolution")
    return Object.freeze({
      kind: "resolution",
      decision: record.decision,
      reason: record.reason,
      ...(record.effective_at === undefined ? {} : { effective_at: record.effective_at }),
    });
  return Object.freeze({ kind: "verification", result: record.result });
}

function references(record: PersistedRecord): readonly { readonly id: RecordId; readonly path: string }[] {
  if (record.kind === "entry") return Object.freeze([]);
  if (record.kind === "claim")
    return Object.freeze(
      record.derived_from.map((id, index) => Object.freeze({ id, path: `/derived_from/${index}` })),
    );
  if (record.kind === "relation")
    return Object.freeze([
      Object.freeze({ id: record.from, path: "/from" }),
      Object.freeze({ id: record.to, path: "/to" }),
    ]);
  if (record.kind === "resolution")
    return Object.freeze([
      ...record.targets.map((id, index) => Object.freeze({ id, path: `/targets/${index}` })),
      ...(record.replacement === undefined
        ? []
        : [Object.freeze({ id: record.replacement, path: "/replacement" })]),
    ]);
  return Object.freeze(record.targets.map((id, index) => Object.freeze({ id, path: `/targets/${index}` })));
}

function directlyReferences(record: PersistedRecord, id: RecordId): boolean {
  return references(record).some((reference) => reference.id === id);
}

function claimItem(item: PositionedRecord): ClaimItem {
  const claim = item.record as Claim;
  return Object.freeze({
    id: claim.id,
    position: item.position,
    recorded_at: claim.recorded_at,
    actor: claim.actor,
    key: claimKeyOf(claim),
    value: claim.value,
    confidence: claim.confidence,
    handles: Object.freeze([handle(claim)]),
  });
}

function historyItem(item: PositionedRecord): HistoryItem {
  return Object.freeze({
    id: item.record.id,
    position: item.position,
    recorded_at: item.record.recorded_at,
    actor: item.record.actor,
    scope: item.record.scope,
    summary: summary(item.record),
    handles: Object.freeze([handle(item.record)]),
  });
}

function policySemantics(policy: ValidatedClaimPolicy, key: ClaimKey): ClaimSemantics {
  const evaluated = evaluateClaimPolicy(policy, key);
  if (evaluated.issues.length > 0 || evaluated.semantics === undefined)
    validationFailed(evaluated.issues, "Claim policy validation failed");
  return evaluated.semantics;
}

function jsonIdentity(parts: readonly unknown[]): string {
  const encoded = JSON.stringify(parts);
  if (encoded === undefined) throw new TypeError("could not encode canonical identity");
  return encoded;
}

function claimKeyIdentity(key: ClaimKey): string {
  return jsonIdentity([key.scope, key.subject.type, key.subject.id, key.predicate, key.perspective ?? null]);
}

function cohortIdentity(scope: Scope, value: JsonValue): string {
  return jsonIdentity([scope, value]);
}

function cohortNode(cohort: Cohort, index: number): CohortNode {
  const node = cohort.nodes[index];
  if (!node) throw new TypeError("missing cohort node");
  return node;
}

function findCohortNode(cohort: Cohort, index: number): number {
  let root = index;
  while (cohortNode(cohort, root).parent !== root) root = cohortNode(cohort, root).parent;
  let current = index;
  while (cohortNode(cohort, current).parent !== current) {
    const next = cohortNode(cohort, current).parent;
    cohortNode(cohort, current).parent = root;
    current = next;
  }
  return root;
}

function uniteCohortNodes(cohort: Cohort, left: number, right: number): void {
  let leftRoot = findCohortNode(cohort, left);
  let rightRoot = findCohortNode(cohort, right);
  if (leftRoot === rightRoot) return;
  if (cohortNode(cohort, leftRoot).rank < cohortNode(cohort, rightRoot).rank)
    [leftRoot, rightRoot] = [rightRoot, leftRoot];
  cohortNode(cohort, rightRoot).parent = leftRoot;
  if (cohortNode(cohort, leftRoot).rank === cohortNode(cohort, rightRoot).rank)
    cohortNode(cohort, leftRoot).rank += 1;
}

function earlierRecordById(snapshot: Snapshot): ReadonlyMap<RecordId, PositionedRecord> {
  return new Map(snapshot.records.map((item) => [item.record.id, item]));
}

function buildStatusIndex(snapshot: Snapshot, policy: ValidatedClaimPolicy): StatusIndex {
  const byId = earlierRecordById(snapshot);
  const groupBuilders = new Map<string, { key: ClaimKey; members: PositionedRecord[] }>();
  const cohortByIdentity = new Map<string, Cohort>();
  const claimLocations = new Map<
    RecordId,
    { readonly cohort: Cohort; readonly node: number; readonly position: StreamPosition }
  >();

  for (const item of snapshot.records) {
    if (item.record.kind !== "claim") continue;
    const key = claimKeyOf(item.record);
    const keyIdentity = claimKeyIdentity(key);
    const group = groupBuilders.get(keyIdentity);
    if (group) group.members.push(item);
    else groupBuilders.set(keyIdentity, { key, members: [item] });

    const identity = cohortIdentity(item.record.scope, item.record.value);
    let cohort = cohortByIdentity.get(identity);
    if (!cohort) {
      cohort = {
        scope: item.record.scope,
        value: item.record.value,
        nodes: [],
        nodeByClaimKey: new Map(),
      };
      cohortByIdentity.set(identity, cohort);
    }
    let nodeIndex = cohort.nodeByClaimKey.get(keyIdentity);
    if (nodeIndex === undefined) {
      nodeIndex = cohort.nodes.length;
      cohort.nodeByClaimKey.set(keyIdentity, nodeIndex);
      cohort.nodes.push({ claims: [], parent: nodeIndex, rank: 0 });
    }
    cohortNode(cohort, nodeIndex).claims.push(item);
    claimLocations.set(item.record.id, { cohort, node: nodeIndex, position: item.position });
  }

  const groups = Object.freeze(
    [...groupBuilders.values()].map((group) =>
      Object.freeze({
        key: group.key,
        members: Object.freeze(group.members),
        semantics: policySemantics(policy, group.key),
      }),
    ),
  );
  const resolutionsByTarget = new Map<RecordId, IndexedResolution[]>();
  for (const item of snapshot.records) {
    if (item.record.kind !== "resolution") continue;
    const allReferencesBackward = references(item.record).every((reference) => {
      const target = byId.get(reference.id);
      return target !== undefined && target.position < item.position;
    });
    if (!allReferencesBackward) continue;
    const resolution = Object.freeze({ targets: new Set<RecordId>(item.record.targets) });
    for (const target of resolution.targets) {
      const resolutions = resolutionsByTarget.get(target) ?? [];
      resolutions.push(resolution);
      resolutionsByTarget.set(target, resolutions);
    }
  }
  for (const item of snapshot.records) {
    if (item.record.kind !== "relation" || item.record.relation_type !== "duplicates") continue;
    const from = claimLocations.get(item.record.from);
    const to = claimLocations.get(item.record.to);
    if (
      !from ||
      !to ||
      from.position >= item.position ||
      to.position >= item.position ||
      from.cohort !== to.cohort
    )
      continue;
    uniteCohortNodes(from.cohort, from.node, to.node);
  }
  return Object.freeze({
    byId,
    groups,
    cohorts: Object.freeze([...cohortByIdentity.values()]),
    resolutionsByTarget,
  });
}

function hasDifferentValues(members: readonly PositionedRecord[]): boolean {
  const first = (members[0]?.record as Claim | undefined)?.value;
  return first !== undefined && members.some((item) => !jsonValuesEqual((item.record as Claim).value, first));
}

function unresolvedGroups(
  index: StatusIndex,
): readonly { item: UnresolvedExclusiveGroup; position: number }[] {
  const output: { item: UnresolvedExclusiveGroup; position: number }[] = [];
  for (const group of index.groups) {
    if (group.semantics !== "exclusive" || !hasDifferentValues(group.members)) continue;
    const representative = group.members[0] as PositionedRecord;
    const resolutions = index.resolutionsByTarget.get(representative.record.id) ?? [];
    if (
      resolutions.some((resolution) =>
        group.members.every((claim) => resolution.targets.has(claim.record.id)),
      )
    )
      continue;
    output.push({
      position: Number(representative.position),
      item: Object.freeze({
        kind: "unresolved-exclusive-group",
        key: group.key,
        claim_count: group.members.length,
        representative: handle(representative.record),
        claims: keyClaimsAffordance(group.key),
      }),
    });
  }
  return Object.freeze(output);
}

function danglingReferences(
  snapshot: Snapshot,
  byId: ReadonlyMap<RecordId, PositionedRecord>,
): readonly { item: DanglingRecordReference; position: number }[] {
  const output: { item: DanglingRecordReference; position: number }[] = [];
  for (const record of snapshot.records) {
    for (const reference of references(record.record)) {
      const target = byId.get(reference.id);
      if (target === undefined || target.position >= record.position)
        output.push({
          position: Number(record.position),
          item: Object.freeze({
            kind: "dangling-record-reference",
            record: handle(record.record),
            path: reference.path,
            target: reference.id,
          }),
        });
    }
  }
  return Object.freeze(output);
}

function divergenceAdvisories(
  index: StatusIndex,
): readonly { item: KeyDivergenceAdvisory; position: number }[] {
  const output: { item: KeyDivergenceAdvisory; position: number }[] = [];
  for (const cohort of index.cohorts) {
    if (cohort.nodes.length < 2) continue;
    const representativesByRoot = new Map<number, PositionedRecord>();
    cohort.nodes.forEach((node, nodeIndex) => {
      const root = findCohortNode(cohort, nodeIndex);
      const candidate = node.claims[0] as PositionedRecord;
      const current = representativesByRoot.get(root);
      if (!current || candidate.position < current.position) representativesByRoot.set(root, candidate);
    });
    const representatives = [...representativesByRoot.values()].sort(
      (left, right) => Number(left.position) - Number(right.position),
    );
    if (representatives.length < 2) continue;
    output.push({
      position: Number((representatives[0] as PositionedRecord).position),
      item: Object.freeze({
        kind: "key-divergence",
        scope: cohort.scope,
        value: cohort.value,
        component_count: representatives.length,
        representatives: Object.freeze([
          handle((representatives[0] as PositionedRecord).record),
          handle((representatives[1] as PositionedRecord).record),
        ]) as readonly [RecordHandle, RecordHandle],
        claims: divergenceClaimsAffordance(cohort.scope, cohort.value),
      }),
    });
  }
  output.sort((left, right) => left.position - right.position);
  return Object.freeze(output);
}

function statusItems(
  snapshot: Snapshot,
  policy: ValidatedClaimPolicy,
): {
  readonly items: readonly StatusComputedItem[];
  readonly groupCount: number;
  readonly danglingCount: number;
  readonly advisoryCount: number;
} {
  const index = buildStatusIndex(snapshot, policy);
  const groups = unresolvedGroups(index);
  const dangling = danglingReferences(snapshot, index.byId);
  const advisories = divergenceAdvisories(index);
  const output: StatusComputedItem[] = [];
  const appendClass = (
    classRank: number,
    values: readonly { readonly item: HealthItem | KeyDivergenceAdvisory; readonly position: number }[],
    health: boolean,
  ) => {
    const ordinals = new Map<number, number>();
    for (const value of values) {
      const ordinal = ordinals.get(value.position) ?? 0;
      ordinals.set(value.position, ordinal + 1);
      output.push(
        Object.freeze({
          key: Object.freeze([classRank, value.position, ordinal]) as StatusKey,
          value: value.item,
          health,
        }),
      );
    }
  };
  appendClass(0, groups, true);
  appendClass(1, dangling, true);
  appendClass(2, advisories, false);
  return Object.freeze({
    items: Object.freeze(output),
    groupCount: groups.length,
    danglingCount: dangling.length,
    advisoryCount: advisories.length,
  });
}

function compareStatusKey(left: StatusKey, right: StatusKey): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

export function createApplicationReadServices(
  store: RecordStore,
  policy: ValidatedClaimPolicy,
  ruleset: RulesetIdentity,
) {
  async function snapshotFor(cursor: CursorPayload | undefined): Promise<Snapshot> {
    const current = await readSnapshot(store);
    return cursor === undefined ? current : pinnedSnapshot(current, cursor, ruleset);
  }

  return Object.freeze({
    async claimFeedback(
      claim: Claim,
      position: StreamPosition,
      semantics: ClaimSemantics,
    ): Promise<{
      readonly feedback: ReconciliationFeedback;
      readonly advice: readonly Affordance[];
    }> {
      const snapshot = await readSnapshot(store);
      if (snapshot.head < position || snapshot.records[Number(position) - 1]?.record.id !== claim.id)
        throw new LoreduError("STORE_CORRUPT", "Committed Claim is absent from its returned position");
      const key = claimKeyOf(claim);
      const earlier = snapshot.records
        .slice(0, Number(position) - 1)
        .filter((item): item is PositionedRecord & { record: Claim } => item.record.kind === "claim")
        .filter((item) => claimKeysEqual(claimKeyOf(item.record), key));
      if (earlier.length === 0)
        return Object.freeze({
          feedback: Object.freeze({
            state: "new-key",
            key,
            related: Object.freeze([]) as readonly [],
          }),
          advice: Object.freeze([]),
        });
      const equal = earlier.filter((item) => jsonValuesEqual(item.record.value, claim.value));
      const different = earlier.filter((item) => !jsonValuesEqual(item.record.value, claim.value));
      const state =
        different.length > 0 && semantics === "exclusive"
          ? "conflict-candidate"
          : equal.length > 0
            ? "corroboration"
            : "coexisting";
      const related = state === "corroboration" ? equal : different;
      const representative = related[0] as PositionedRecord;
      const claims = keyClaimsAffordance(key);
      const feedback = Object.freeze({
        state,
        key,
        related_count: related.length,
        related: Object.freeze([handle(representative.record)]) as readonly [RecordHandle],
        claims,
      });
      const advice =
        state === "conflict-candidate"
          ? Object.freeze([
              claims,
              affordance(
                "show",
                "record.show",
                { id: representative.record.id },
                "inspect the earlier representative",
              ),
              affordance("show", "record.show", { id: claim.id }, "inspect the new claim"),
            ])
          : Object.freeze([]);
      return Object.freeze({ feedback, advice });
    },

    async show(idInput: RecordId): Promise<ApplicationResponse<ShownRecordResult>> {
      const issues: LoreduIssue[] = [];
      const id = parseRecordId(idInput, "/id", issues);
      if (issues.length > 0 || !id) validationFailed(issues);
      const snapshot = await readSnapshot(store);
      const found = snapshot.records.find((item) => item.record.id === id);
      if (!found) throw new LoreduError("RECORD_NOT_FOUND", `Record does not exist: ${id}`);
      const byId = earlierRecordById(snapshot);
      const handles: RecordHandle[] = [handle(found.record)];
      const seen = new Set<string>([found.record.id]);
      for (const reference of references(found.record)) {
        const target = byId.get(reference.id);
        if (target && target.position < found.position && !seen.has(target.record.id)) {
          seen.add(target.record.id);
          handles.push(handle(target.record));
        }
      }
      const basis = makeBasis(snapshot.head, ruleset, frozenJsonObject({ operation: "show", id }));
      return Object.freeze({
        ok: true,
        result: Object.freeze({
          record: found.record,
          position: found.position,
          handles: Object.freeze(handles),
        }),
        reconciliation: EMPTY_RECONCILIATION,
        advice: Object.freeze([]),
        basis,
      });
    },

    async claims(queryInput?: ClaimQuery): Promise<ApplicationListResponse<ClaimItem>> {
      const parsed = parseClaimsQuery(queryInput);
      const snapshot = await snapshotFor(parsed.cursor);
      const basis = parsed.cursor?.basis ?? makeBasis(snapshot.head, ruleset, parsed.query);
      if (
        parsed.cursor &&
        (!basisEquals(basis, parsed.cursor.basis) || !jsonValuesEqual(basis.query, parsed.query))
      )
        cursorMismatch();
      const resume = parsed.cursor === undefined ? 0 : (parsed.cursor.resume as number);
      const matches = snapshot.records
        .filter((item): item is PositionedRecord & { record: Claim } => item.record.kind === "claim")
        .filter((item) => claimsMatch(item.record, parsed.filters));
      if (parsed.cursor && !matches.some((item) => Number(item.position) === resume)) cursorInvalid();
      const remaining = matches.filter((item) => Number(item.position) > resume);
      const selected = remaining.slice(0, parsed.limit);
      const result = Object.freeze(selected.map(claimItem));
      const cursor =
        remaining.length > selected.length
          ? createCursor(
              "claims",
              parsed.query,
              basis,
              snapshot,
              Number((selected[selected.length - 1] as PositionedRecord).position),
            )
          : undefined;
      const advice =
        cursor === undefined
          ? Object.freeze([])
          : Object.freeze([
              affordance(
                "continue",
                "claims.list",
                { cursor, ...(parsed.limit === DEFAULT_LIMIT ? {} : { limit: parsed.limit }) },
                "continue this pinned Claim list",
              ),
            ]);
      return Object.freeze({
        ok: true,
        result,
        reconciliation: EMPTY_RECONCILIATION,
        advice,
        basis,
        page: page(result.length, matches.length, cursor),
      });
    },

    async history(queryInput: HistoryQuery): Promise<ApplicationListResponse<HistoryItem>> {
      const parsed = parseHistoryQuery(queryInput);
      const snapshot = await snapshotFor(parsed.cursor);
      const basis = parsed.cursor?.basis ?? makeBasis(snapshot.head, ruleset, parsed.query);
      if (!snapshot.records.some((item) => item.record.id === parsed.id))
        throw new LoreduError("RECORD_NOT_FOUND", `Record does not exist: ${parsed.id}`);
      const resume = parsed.cursor === undefined ? 0 : (parsed.cursor.resume as number);
      const matches = snapshot.records.filter(
        (item) => item.record.id === parsed.id || directlyReferences(item.record, parsed.id),
      );
      if (parsed.cursor && !matches.some((item) => Number(item.position) === resume)) cursorInvalid();
      const remaining = matches.filter((item) => Number(item.position) > resume);
      const selected = remaining.slice(0, parsed.limit);
      const result = Object.freeze(selected.map(historyItem));
      const cursor =
        remaining.length > selected.length
          ? createCursor(
              "history",
              parsed.query,
              basis,
              snapshot,
              Number((selected[selected.length - 1] as PositionedRecord).position),
            )
          : undefined;
      const advice =
        cursor === undefined
          ? Object.freeze([])
          : Object.freeze([
              affordance(
                "continue",
                "history.list",
                { cursor, ...(parsed.limit === DEFAULT_LIMIT ? {} : { limit: parsed.limit }) },
                "continue this pinned record history",
              ),
            ]);
      return Object.freeze({
        ok: true,
        result,
        reconciliation: EMPTY_RECONCILIATION,
        advice,
        basis,
        page: page(result.length, matches.length, cursor),
      });
    },

    async status(queryInput?: StatusQuery): Promise<ApplicationStatusResponse> {
      const parsed = parseStatusQuery(queryInput);
      const snapshot = await snapshotFor(parsed.cursor);
      const basis = parsed.cursor?.basis ?? makeBasis(snapshot.head, ruleset, parsed.query);
      const computed = statusItems(snapshot, policy);
      const resume = parsed.cursor?.resume as StatusKey | undefined;
      if (resume && !computed.items.some((item) => compareStatusKey(item.key, resume) === 0)) cursorInvalid();
      const remaining =
        resume === undefined
          ? computed.items
          : computed.items.filter((item) => compareStatusKey(item.key, resume) > 0);
      const selected = remaining.slice(0, parsed.limit);
      const cursor =
        remaining.length > selected.length
          ? createCursor(
              "status",
              parsed.query,
              basis,
              snapshot,
              (selected[selected.length - 1] as StatusComputedItem).key,
            )
          : undefined;
      const attention = Object.freeze(
        selected.filter((item) => item.health).map((item) => item.value as HealthItem),
      );
      const advisories = Object.freeze(
        selected.filter((item) => !item.health).map((item) => item.value as KeyDivergenceAdvisory),
      );
      const result: StatusResult = Object.freeze({
        healthy: computed.groupCount === 0 && computed.danglingCount === 0,
        health: Object.freeze({
          unresolved_exclusive_groups: computed.groupCount,
          dangling_record_references: computed.danglingCount,
        }),
        advisory_count: computed.advisoryCount,
        attention,
        advisories,
      });
      const corrective: Affordance[] = [];
      for (const item of attention) {
        if (item.kind === "unresolved-exclusive-group") {
          corrective.push(item.claims, item.representative.affordances[0] as Affordance);
        } else corrective.push(item.record.affordances[0] as Affordance);
      }
      if (cursor !== undefined)
        corrective.push(
          affordance(
            "continue",
            "status.read",
            { cursor, ...(parsed.limit === DEFAULT_LIMIT ? {} : { limit: parsed.limit }) },
            "continue this pinned status report",
          ),
        );
      return Object.freeze({
        ok: true,
        result,
        reconciliation: EMPTY_RECONCILIATION,
        advice: deduplicateAdvice(corrective),
        basis,
        page: page(selected.length, computed.items.length, cursor),
      });
    },

    async readHead(): Promise<ApplicationResponse<HeadResult>> {
      let head: StreamPosition;
      try {
        head = createStreamPosition(await store.head());
      } catch (error) {
        if (error instanceof LoreduError) throw error;
        throw new LoreduError("STORE_IO_FAILED", "Store head read failed");
      }
      const basis = makeBasis(head, ruleset, frozenJsonObject({ operation: "head" }));
      return Object.freeze({
        ok: true,
        result: Object.freeze({ stream_position: head }),
        reconciliation: EMPTY_RECONCILIATION,
        advice: Object.freeze([]),
        basis,
      });
    },
  });
}

export { affordance, EMPTY_RECONCILIATION, handle, keyClaimsAffordance, makeBasis };
