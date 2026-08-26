import { canonicalizeJsonValue, type JsonValue } from "./json-value";
import {
  assertExactOwnDataProperties,
  assertOwnDataProperties,
  copyDenseDataArray,
  enumerableOwnDataKeys,
} from "./own-properties";
import {
  assertRecordIdForKind,
  type ClaimId,
  type EntryId,
  type RecordIdFor,
  type RelationId,
  type ResolutionId,
  type VerificationId,
} from "./record-id";
import { RECORD_SCHEMA_ID, type RecordKind } from "./record-kind";
import { RecordValidationError } from "./validation-error";

export const ACTOR_TYPES = Object.freeze(["human", "agent", "program", "system"] as const);
export const CLAIM_CONFIDENCES = Object.freeze([
  "candidate",
  "observed",
  "corroborated",
  "confirmed",
  "authoritative",
] as const);
export const RELATION_TYPES = Object.freeze([
  "supports",
  "contradicts",
  "duplicates",
  "supersedes",
  "derived_from",
  "related_to",
] as const);
export const RESOLUTION_DECISIONS = Object.freeze([
  "prefer",
  "supersede",
  "retract",
  "leave_disputed",
] as const);
export const VERIFICATION_RESULTS = Object.freeze([
  "confirmed",
  "contradicted",
  "unchanged",
  "needs_revalidation",
] as const);

export type ActorType = (typeof ACTOR_TYPES)[number];
export type ClaimConfidence = (typeof CLAIM_CONFIDENCES)[number];
export type RelationType = (typeof RELATION_TYPES)[number];
export type ResolutionDecision = (typeof RESOLUTION_DECISIONS)[number];
export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];

export interface Actor {
  readonly type: ActorType;
  readonly id: string;
}

export interface Subject {
  readonly type: string;
  readonly id: string;
}

export type Scope = Readonly<{ [key: string]: string }>;
export type Metadata = Readonly<{ [key: string]: JsonValue }>;

export interface SourceRef {
  readonly ref: string;
  readonly locator?: string;
  readonly snapshot?: string;
}

export interface VerificationBasis {
  readonly source: string;
  readonly snapshot?: string;
}

export type RelationEndpoint = {
  readonly [K in RecordKind]: Readonly<{ id: RecordIdFor<K>; kind: K }>;
}[RecordKind];

export interface DraftEnvelope<K extends RecordKind> {
  readonly kind: K;
  readonly actor: Actor;
  readonly scope?: Scope;
  readonly metadata?: Metadata;
  readonly sources?: readonly SourceRef[];
}

export interface PersistedEnvelope<K extends RecordKind> {
  readonly schema: typeof RECORD_SCHEMA_ID;
  readonly kind: K;
  readonly id: RecordIdFor<K>;
  readonly recorded_at: string;
  readonly actor: Actor;
  readonly scope: Scope;
  readonly metadata: Metadata;
  readonly sources: readonly SourceRef[];
}

export interface EntryDraft extends DraftEnvelope<"entry"> {
  readonly body: string;
  readonly title?: string;
  readonly entry_type?: string;
}

export interface ClaimDraft extends DraftEnvelope<"claim"> {
  readonly subject: Subject;
  readonly predicate: string;
  readonly value: JsonValue;
  readonly claim_class?: string;
  readonly perspective?: string;
  readonly confidence: ClaimConfidence;
  readonly valid_from?: string;
  readonly valid_until?: string;
  readonly derived_from?: readonly EntryId[];
}

export interface RelationDraft extends DraftEnvelope<"relation"> {
  readonly relation_type: RelationType;
  readonly from: RelationEndpoint;
  readonly to: RelationEndpoint;
}

export interface ResolutionDraft extends DraftEnvelope<"resolution"> {
  readonly targets: readonly (ClaimId | RelationId)[];
  readonly decision: ResolutionDecision;
  readonly replacement?: ClaimId;
  readonly effective_at?: string;
  readonly reason: string;
}

export interface VerificationDraft extends DraftEnvelope<"verification"> {
  readonly targets: readonly ClaimId[];
  readonly verified_against: readonly VerificationBasis[];
  readonly result: VerificationResult;
}

export type RecordDraft = EntryDraft | ClaimDraft | RelationDraft | ResolutionDraft | VerificationDraft;

export interface Entry extends PersistedEnvelope<"entry"> {
  readonly id: EntryId;
  readonly body: string;
  readonly title?: string;
  readonly entry_type?: string;
}

export interface Claim extends PersistedEnvelope<"claim"> {
  readonly id: ClaimId;
  readonly subject: Subject;
  readonly predicate: string;
  readonly value: JsonValue;
  readonly claim_class?: string;
  readonly perspective?: string;
  readonly confidence: ClaimConfidence;
  readonly valid_from?: string;
  readonly valid_until?: string;
  readonly derived_from: readonly EntryId[];
}

export interface Relation extends PersistedEnvelope<"relation"> {
  readonly id: RelationId;
  readonly relation_type: RelationType;
  readonly from: RelationEndpoint;
  readonly to: RelationEndpoint;
}

export interface Resolution extends PersistedEnvelope<"resolution"> {
  readonly id: ResolutionId;
  readonly targets: readonly (ClaimId | RelationId)[];
  readonly decision: ResolutionDecision;
  readonly replacement?: ClaimId;
  readonly effective_at?: string;
  readonly reason: string;
}

export interface Verification extends PersistedEnvelope<"verification"> {
  readonly id: VerificationId;
  readonly targets: readonly ClaimId[];
  readonly verified_against: readonly VerificationBasis[];
  readonly result: VerificationResult;
}

export type PersistedRecord = Entry | Claim | Relation | Resolution | Verification;

const IDENTIFIER_PATTERN = /^[a-z0-9]([a-z0-9._:/-]*[a-z0-9])?$/;
const RFC3339_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/;
const MEBIBYTE = 1024 * 1024;

const COMMON_DRAFT_KEYS = ["kind", "actor", "scope", "metadata", "sources"] as const;
const COMMON_PERSISTED_KEYS = [
  "schema",
  "kind",
  "id",
  "recorded_at",
  "actor",
  "scope",
  "metadata",
  "sources",
] as const;

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function expectObject(value: unknown, field: string): { [key: string]: unknown } {
  if (typeof value !== "object" || value === null || Array.isArray(value) || !isPlainObject(value)) {
    throw new RecordValidationError(field, "must be a plain object");
  }
  return value as { [key: string]: unknown };
}

function hasOwn(object: { [key: string]: unknown }, key: string): boolean {
  return Object.hasOwn(object, key);
}

function expectExactKeys(
  object: { [key: string]: unknown },
  allowed: readonly string[],
  field: string,
): void {
  assertExactOwnDataProperties(object, allowed, field);
}

function required(object: { [key: string]: unknown }, key: string, path = key): unknown {
  if (!hasOwn(object, key)) throw new RecordValidationError(path, "is required");
  return object[key];
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new RecordValidationError(field, "must be a string");
  return value;
}

export function assertIdentifierSafeToken(value: unknown, field = "value"): asserts value is string {
  if (typeof value !== "string" || value.length > 128 || !IDENTIFIER_PATTERN.test(value)) {
    throw new RecordValidationError(
      field,
      "must be a lowercase identifier-safe token of at most 128 characters with separators only internally",
    );
  }
}

function expectEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new RecordValidationError(field, `must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

function codePointLength(value: string): number {
  let length = 0;
  for (const _character of value) length += 1;
  return length;
}

function expectSourceString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || codePointLength(value) > 1024) {
    throw new RecordValidationError(field, "must be a non-whitespace string of at most 1024 characters");
  }
  return value;
}

function parseSourceRef(value: unknown, field: string): SourceRef {
  const object = expectObject(value, field);
  expectExactKeys(object, ["ref", "locator", "snapshot"], field);
  const ref = expectSourceString(required(object, "ref", `${field}.ref`), `${field}.ref`);
  const locator = hasOwn(object, "locator")
    ? expectSourceString(object.locator, `${field}.locator`)
    : undefined;
  const snapshot = hasOwn(object, "snapshot")
    ? expectSourceString(object.snapshot, `${field}.snapshot`)
    : undefined;
  return Object.freeze({
    ref,
    ...(locator === undefined ? {} : { locator }),
    ...(snapshot === undefined ? {} : { snapshot }),
  });
}

function parseSources(value: unknown, field: string): readonly SourceRef[] {
  const items = copyDenseDataArray(value, field);
  const sources: SourceRef[] = [];
  for (let index = 0; index < items.length; index += 1) {
    sources[index] = parseSourceRef(items[index], `${field}[${index}]`);
  }
  return Object.freeze(sources);
}

function parseActor(value: unknown, field = "actor"): Actor {
  const object = expectObject(value, field);
  expectExactKeys(object, ["type", "id"], field);
  const type = expectEnum(required(object, "type", `${field}.type`), ACTOR_TYPES, `${field}.type`);
  const id = required(object, "id", `${field}.id`);
  assertIdentifierSafeToken(id, `${field}.id`);
  return Object.freeze({ type, id });
}

function parseScope(value: unknown, field = "scope"): Scope {
  const object = expectObject(value, field);
  const scope: { [key: string]: string } = {};
  for (const key of enumerableOwnDataKeys(object, field)) {
    assertIdentifierSafeToken(key, `${field} key ${JSON.stringify(key)}`);
    const item = object[key];
    assertIdentifierSafeToken(item, `${field}.${key}`);
    Object.defineProperty(scope, key, {
      value: item,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return Object.freeze(scope);
}

function parseMetadata(value: unknown, field = "metadata"): Metadata {
  const object = expectObject(value, field);
  const metadata: { [key: string]: JsonValue } = {};
  for (const key of enumerableOwnDataKeys(object, field)) {
    const separator = key.indexOf(".");
    if (separator <= 0 || separator === key.length - 1) {
      throw new RecordValidationError(`${field} key ${JSON.stringify(key)}`, "must be <namespace>.<name>");
    }
    const namespace = key.slice(0, separator);
    const name = key.slice(separator + 1);
    assertIdentifierSafeToken(namespace, `${field} key ${JSON.stringify(key)} namespace`);
    assertIdentifierSafeToken(name, `${field} key ${JSON.stringify(key)} name`);
    if (namespace === "loredu") {
      throw new RecordValidationError(
        `${field}.${key}`,
        "uses the reserved loredu namespace; the M0 registry is empty",
      );
    }
    Object.defineProperty(metadata, key, {
      value: canonicalizeJsonValue(object[key], `${field}.${key}`),
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return Object.freeze(metadata);
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

function expectText(
  value: unknown,
  field: string,
  limit: number,
  limitDescription: string,
  measureBytes = false,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RecordValidationError(field, "must contain at least one non-whitespace character");
  }
  const size = measureBytes ? utf8ByteLength(value) : codePointLength(value);
  if (size > limit) throw new RecordValidationError(field, `must be at most ${limitDescription}`);
  return value;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

interface ParsedInstant {
  readonly epochSecond: bigint;
  readonly fraction: string;
}

function daysFromCivil(year: number, month: number, day: number): number {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const shiftedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * shiftedMonth + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

function parseInstant(value: unknown, field: string): ParsedInstant {
  if (typeof value !== "string") throw new RecordValidationError(field, "must be an RFC3339 instant string");
  const match = RFC3339_PATTERN.exec(value);
  if (!match) {
    throw new RecordValidationError(field, "must be an RFC3339 instant with an explicit Z or numeric offset");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === "Z" ? 0 : Number(match[10]);
  const offsetMinute = match[8] === "Z" ? 0 : Number(match[11]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    throw new RecordValidationError(field, "must contain a valid RFC3339 calendar value");
  }

  const localSecond =
    BigInt(daysFromCivil(year, month, day)) * 86_400n + BigInt(hour * 3_600 + minute * 60 + second);
  const offsetMagnitude = BigInt(offsetHour * 3_600 + offsetMinute * 60);
  const signedOffset = match[8] === "Z" || match[9] === "+" ? offsetMagnitude : -offsetMagnitude;
  return Object.freeze({
    epochSecond: localSecond - signedOffset,
    fraction: match[7] ?? "",
  });
}

function compareInstants(left: ParsedInstant, right: ParsedInstant): number {
  if (left.epochSecond < right.epochSecond) return -1;
  if (left.epochSecond > right.epochSecond) return 1;
  const length = Math.max(left.fraction.length, right.fraction.length);
  for (let index = 0; index < length; index += 1) {
    const leftDigit = left.fraction.charCodeAt(index) || 48;
    const rightDigit = right.fraction.charCodeAt(index) || 48;
    if (leftDigit < rightDigit) return -1;
    if (leftDigit > rightDigit) return 1;
  }
  return 0;
}

function expectInstant(value: unknown, field: string): string {
  parseInstant(value, field);
  return value as string;
}

function parseSubject(value: unknown): Subject {
  const object = expectObject(value, "subject");
  expectExactKeys(object, ["type", "id"], "subject");
  const type = required(object, "type", "subject.type");
  const id = required(object, "id", "subject.id");
  assertIdentifierSafeToken(type, "subject.type");
  assertIdentifierSafeToken(id, "subject.id");
  return Object.freeze({ type, id });
}

function parseReferenceIds<K extends RecordKind>(
  value: unknown,
  allowedKinds: readonly K[],
  field: string,
  nonEmpty: boolean,
): readonly RecordIdFor<K>[] {
  const items = copyDenseDataArray(value, field);
  if (nonEmpty && items.length === 0) throw new RecordValidationError(field, "must be a non-empty array");
  const ids: RecordIdFor<K>[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const id = items[index];
    const path = `${field}[${index}]`;
    let accepted = false;
    for (const kind of allowedKinds) {
      try {
        assertRecordIdForKind(id, kind, path);
        ids[index] = id as RecordIdFor<K>;
        accepted = true;
        break;
      } catch (error) {
        if (!(error instanceof RecordValidationError)) throw error;
      }
    }
    if (!accepted) {
      throw new RecordValidationError(path, `must be an id for kind: ${allowedKinds.join(" or ")}`);
    }
  }
  return Object.freeze(ids);
}

function parseEndpoint(value: unknown, field: string): RelationEndpoint {
  const object = expectObject(value, field);
  expectExactKeys(object, ["id", "kind"], field);
  const kind = expectEnum(
    required(object, "kind", `${field}.kind`),
    ["entry", "claim", "relation", "resolution", "verification"] as const,
    `${field}.kind`,
  );
  const id = required(object, "id", `${field}.id`);
  assertRecordIdForKind(id, kind, `${field}.id`);
  return Object.freeze({ id, kind }) as RelationEndpoint;
}

function parseVerificationBasis(value: unknown, field: string): VerificationBasis {
  const object = expectObject(value, field);
  expectExactKeys(object, ["source", "snapshot"], field);
  const source = expectSourceString(required(object, "source", `${field}.source`), `${field}.source`);
  const snapshot = hasOwn(object, "snapshot")
    ? expectSourceString(object.snapshot, `${field}.snapshot`)
    : undefined;
  return Object.freeze({ source, ...(snapshot === undefined ? {} : { snapshot }) });
}

interface DraftCommon {
  readonly actor: Actor;
  readonly scope?: Scope;
  readonly metadata?: Metadata;
  readonly sources?: readonly SourceRef[];
}

function parseDraftCommon(object: { [key: string]: unknown }, familyKeys: readonly string[]): DraftCommon {
  expectExactKeys(object, [...COMMON_DRAFT_KEYS, ...familyKeys], "record");
  const actor = parseActor(required(object, "actor", "actor"));
  const scope = hasOwn(object, "scope") ? parseScope(object.scope) : undefined;
  const metadata = hasOwn(object, "metadata") ? parseMetadata(object.metadata) : undefined;
  const sources = hasOwn(object, "sources") ? parseSources(object.sources, "sources") : undefined;
  return Object.freeze({
    actor,
    ...(scope === undefined ? {} : { scope }),
    ...(metadata === undefined ? {} : { metadata }),
    ...(sources === undefined ? {} : { sources }),
  });
}

interface PersistedCommon {
  readonly schema: typeof RECORD_SCHEMA_ID;
  readonly id: string;
  readonly recorded_at: string;
  readonly actor: Actor;
  readonly scope: Scope;
  readonly metadata: Metadata;
  readonly sources: readonly SourceRef[];
}

function parsePersistedCommon<K extends RecordKind>(
  object: { [key: string]: unknown },
  kind: K,
  familyKeys: readonly string[],
): PersistedCommon {
  expectExactKeys(object, [...COMMON_PERSISTED_KEYS, ...familyKeys], "record");
  const schema = required(object, "schema", "schema");
  if (schema !== RECORD_SCHEMA_ID) {
    throw new RecordValidationError("schema", `unknown schema; expected ${RECORD_SCHEMA_ID}`);
  }
  const id = required(object, "id", "id");
  assertRecordIdForKind(id, kind, "id");
  return Object.freeze({
    schema,
    id,
    recorded_at: expectInstant(required(object, "recorded_at", "recorded_at"), "recorded_at"),
    actor: parseActor(required(object, "actor", "actor")),
    scope: parseScope(required(object, "scope", "scope")),
    metadata: parseMetadata(required(object, "metadata", "metadata")),
    sources: parseSources(required(object, "sources", "sources"), "sources"),
  });
}

function parseKind(object: { [key: string]: unknown }): RecordKind {
  return expectEnum(
    required(object, "kind", "kind"),
    ["entry", "claim", "relation", "resolution", "verification"] as const,
    "kind",
  );
}

function parseEntryFields(object: {
  [key: string]: unknown;
}): Pick<EntryDraft, "body" | "title" | "entry_type"> {
  const body = expectText(required(object, "body", "body"), "body", MEBIBYTE, "1 MiB", true);
  const title = hasOwn(object, "title")
    ? expectText(object.title, "title", 1024, "1024 characters")
    : undefined;
  const entryType = hasOwn(object, "entry_type") ? expectString(object.entry_type, "entry_type") : undefined;
  return Object.freeze({
    body,
    ...(title === undefined ? {} : { title }),
    ...(entryType === undefined ? {} : { entry_type: entryType }),
  });
}

function parseClaimFields(
  object: { [key: string]: unknown },
  persisted: boolean,
): Omit<ClaimDraft, keyof DraftEnvelope<"claim">> & { readonly derived_from?: readonly EntryId[] } {
  const subject = parseSubject(required(object, "subject", "subject"));
  const predicate = required(object, "predicate", "predicate");
  assertIdentifierSafeToken(predicate, "predicate");
  let perspective: string | undefined;
  if (hasOwn(object, "perspective")) {
    const suppliedPerspective = object.perspective;
    assertIdentifierSafeToken(suppliedPerspective, "perspective");
    perspective = suppliedPerspective;
  }
  const claimClass = hasOwn(object, "claim_class")
    ? expectString(object.claim_class, "claim_class")
    : undefined;
  const validFrom = hasOwn(object, "valid_from") ? expectInstant(object.valid_from, "valid_from") : undefined;
  const validUntil = hasOwn(object, "valid_until")
    ? expectInstant(object.valid_until, "valid_until")
    : undefined;
  if (
    validFrom !== undefined &&
    validUntil !== undefined &&
    compareInstants(parseInstant(validUntil, "valid_until"), parseInstant(validFrom, "valid_from")) < 0
  ) {
    throw new RecordValidationError("valid_until", "must not precede valid_from");
  }
  const derivedFrom = hasOwn(object, "derived_from")
    ? (parseReferenceIds(
        object.derived_from,
        ["entry"] as const,
        "derived_from",
        false,
      ) as readonly EntryId[])
    : undefined;
  if (persisted && derivedFrom === undefined) {
    throw new RecordValidationError("derived_from", "is required on a persisted claim (use [] when empty)");
  }
  return Object.freeze({
    subject,
    predicate,
    value: canonicalizeJsonValue(required(object, "value", "value"), "value"),
    ...(claimClass === undefined ? {} : { claim_class: claimClass }),
    ...(perspective === undefined ? {} : { perspective }),
    confidence: expectEnum(required(object, "confidence", "confidence"), CLAIM_CONFIDENCES, "confidence"),
    ...(validFrom === undefined ? {} : { valid_from: validFrom }),
    ...(validUntil === undefined ? {} : { valid_until: validUntil }),
    ...(derivedFrom === undefined ? {} : { derived_from: derivedFrom }),
  });
}

function parseRelationFields(object: {
  [key: string]: unknown;
}): Pick<RelationDraft, "relation_type" | "from" | "to"> {
  return Object.freeze({
    relation_type: expectEnum(
      required(object, "relation_type", "relation_type"),
      RELATION_TYPES,
      "relation_type",
    ),
    from: parseEndpoint(required(object, "from", "from"), "from"),
    to: parseEndpoint(required(object, "to", "to"), "to"),
  });
}

function parseResolutionFields(object: {
  [key: string]: unknown;
}): Pick<ResolutionDraft, "targets" | "decision" | "replacement" | "effective_at" | "reason"> {
  const targets = parseReferenceIds(
    required(object, "targets", "targets"),
    ["claim", "relation"] as const,
    "targets",
    true,
  ) as readonly (ClaimId | RelationId)[];
  let replacement: ClaimId | undefined;
  if (hasOwn(object, "replacement")) {
    const suppliedReplacement = object.replacement;
    assertRecordIdForKind(suppliedReplacement, "claim", "replacement");
    replacement = suppliedReplacement;
  }
  const effectiveAt = hasOwn(object, "effective_at")
    ? expectInstant(object.effective_at, "effective_at")
    : undefined;
  return Object.freeze({
    targets,
    decision: expectEnum(required(object, "decision", "decision"), RESOLUTION_DECISIONS, "decision"),
    ...(replacement === undefined ? {} : { replacement }),
    ...(effectiveAt === undefined ? {} : { effective_at: effectiveAt }),
    reason: expectText(required(object, "reason", "reason"), "reason", 2048, "2048 characters"),
  });
}

function parseVerificationFields(object: {
  [key: string]: unknown;
}): Pick<VerificationDraft, "targets" | "verified_against" | "result"> {
  const targets = parseReferenceIds(
    required(object, "targets", "targets"),
    ["claim"] as const,
    "targets",
    true,
  ) as readonly ClaimId[];
  const basis = copyDenseDataArray(
    required(object, "verified_against", "verified_against"),
    "verified_against",
  );
  if (basis.length === 0) {
    throw new RecordValidationError("verified_against", "must be a non-empty array");
  }
  const verifiedAgainst: VerificationBasis[] = [];
  for (let index = 0; index < basis.length; index += 1) {
    verifiedAgainst[index] = parseVerificationBasis(basis[index], `verified_against[${index}]`);
  }
  return Object.freeze({
    targets,
    verified_against: Object.freeze(verifiedAgainst),
    result: expectEnum(required(object, "result", "result"), VERIFICATION_RESULTS, "result"),
  });
}

const ENTRY_FIELDS = ["body", "title", "entry_type"] as const;
const CLAIM_FIELDS = [
  "subject",
  "predicate",
  "value",
  "claim_class",
  "perspective",
  "confidence",
  "valid_from",
  "valid_until",
  "derived_from",
] as const;
const RELATION_FIELDS = ["relation_type", "from", "to"] as const;
const RESOLUTION_FIELDS = ["targets", "decision", "replacement", "effective_at", "reason"] as const;
const VERIFICATION_FIELDS = ["targets", "verified_against", "result"] as const;

/** Validate caller input, reject stamped fields, deeply copy it, and freeze the draft. */
export function parseRecordDraft(value: unknown): RecordDraft {
  const object = expectObject(value, "record");
  assertOwnDataProperties(object, "record");
  for (const forbidden of ["schema", "id", "recorded_at"] as const) {
    if (hasOwn(object, forbidden)) {
      throw new RecordValidationError(forbidden, "is application-owned and must not be supplied on a draft");
    }
  }
  const kind = parseKind(object);
  switch (kind) {
    case "entry":
      return Object.freeze({
        kind,
        ...parseDraftCommon(object, ENTRY_FIELDS),
        ...parseEntryFields(object),
      });
    case "claim":
      return Object.freeze({
        kind,
        ...parseDraftCommon(object, CLAIM_FIELDS),
        ...parseClaimFields(object, false),
      });
    case "relation":
      return Object.freeze({
        kind,
        ...parseDraftCommon(object, RELATION_FIELDS),
        ...parseRelationFields(object),
      });
    case "resolution":
      return Object.freeze({
        kind,
        ...parseDraftCommon(object, RESOLUTION_FIELDS),
        ...parseResolutionFields(object),
      });
    case "verification":
      return Object.freeze({
        kind,
        ...parseDraftCommon(object, VERIFICATION_FIELDS),
        ...parseVerificationFields(object),
      });
  }
}

/** Validate a complete known-schema record, deeply copy it, and freeze the public value. */
export function parsePersistedRecord(value: unknown): PersistedRecord {
  const object = expectObject(value, "record");
  assertOwnDataProperties(object, "record");
  const schema = required(object, "schema", "schema");
  if (schema !== RECORD_SCHEMA_ID) {
    throw new RecordValidationError("schema", `unknown schema; expected ${RECORD_SCHEMA_ID}`);
  }
  const kind = parseKind(object);
  switch (kind) {
    case "entry":
      return Object.freeze({
        kind,
        ...parsePersistedCommon(object, kind, ENTRY_FIELDS),
        ...parseEntryFields(object),
      }) as Entry;
    case "claim":
      return Object.freeze({
        kind,
        ...parsePersistedCommon(object, kind, CLAIM_FIELDS),
        ...parseClaimFields(object, true),
      }) as Claim;
    case "relation":
      return Object.freeze({
        kind,
        ...parsePersistedCommon(object, kind, RELATION_FIELDS),
        ...parseRelationFields(object),
      }) as Relation;
    case "resolution":
      return Object.freeze({
        kind,
        ...parsePersistedCommon(object, kind, RESOLUTION_FIELDS),
        ...parseResolutionFields(object),
      }) as Resolution;
    case "verification":
      return Object.freeze({
        kind,
        ...parsePersistedCommon(object, kind, VERIFICATION_FIELDS),
        ...parseVerificationFields(object),
      }) as Verification;
  }
}
