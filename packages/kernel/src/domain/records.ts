import { LoreduError, type LoreduIssue } from "../errors";
import type {
  Actor,
  ActorType,
  Claim,
  ClaimDraft,
  ClaimId,
  Confidence,
  Entry,
  EntryDraft,
  EntryId,
  JsonObject,
  JsonValue,
  Metadata,
  PersistedRecord,
  RecordDraft,
  RecordId,
  RecordKind,
  Relation,
  RelationDraft,
  RelationId,
  RelationType,
  Resolution,
  ResolutionDecision,
  ResolutionDraft,
  Scope,
  SourceRef,
  Subject,
  Verification,
  VerificationDraft,
  VerificationResult,
  VerificationSourceRef,
} from "./entry";
import { RECORD_SCHEMA_ID } from "./entry";
import {
  compareUnicodeScalars,
  copyPortableJson,
  type DescriptorMap,
  dataValue,
  escapePointer,
  hasData,
  hasOwnDescriptor,
  inspectArray,
  inspectObject,
  isScalarText,
  makeIssue,
  scalarLength,
} from "./portable-json";

const TOKEN = /^[a-z0-9](?:[a-z0-9._:/-]*[a-z0-9])?$/;
const ID = /^(ent|clm|rel|res|ver)_[0-9abcdefghjkmnpqrstvwxyz]{16}$/;
const COMMON = ["kind", "actor", "scope", "metadata", "sources"] as const;
const RESERVED = new Set(["schema", "id", "recorded_at"]);
const KIND_PREFIX: Readonly<Record<RecordKind, string>> = {
  entry: "ent",
  claim: "clm",
  relation: "rel",
  resolution: "res",
  verification: "ver",
};
const ACTOR_TYPES: readonly ActorType[] = ["human", "agent", "program", "system"];
const CONFIDENCES: readonly Confidence[] = [
  "candidate",
  "observed",
  "corroborated",
  "confirmed",
  "authoritative",
];
const RELATION_TYPES: readonly RelationType[] = [
  "supports",
  "contradicts",
  "duplicates",
  "supersedes",
  "derived_from",
  "related_to",
];
const RESOLUTION_DECISIONS: readonly ResolutionDecision[] = [
  "prefer",
  "supersede",
  "retract",
  "leave_disputed",
];
const VERIFICATION_RESULTS: readonly VerificationResult[] = [
  "confirmed",
  "contradicted",
  "unchanged",
  "needs_revalidation",
];

type ParsedCommon = {
  actor: Actor | undefined;
  scope: Scope;
  metadata: Metadata;
  sources: readonly SourceRef[];
};
const MISSING = Symbol("missing required field");

function ownValue(data: DescriptorMap, key: string, path: string, issues: LoreduIssue[]): unknown {
  if (!hasOwnDescriptor(data, key)) {
    issues.push(makeIssue("REQUIRED", path, "is required"));
    return MISSING;
  }
  return hasData(data, key) ? dataValue(data, key) : undefined;
}
function optionalValue(data: DescriptorMap, key: string): { present: boolean; value: unknown } {
  return {
    present: hasOwnDescriptor(data, key),
    value: hasData(data, key) ? dataValue(data, key) : undefined,
  };
}
function token(value: unknown, path: string, issues: LoreduIssue[]): string | undefined {
  if (value === MISSING) return undefined;
  if (typeof value !== "string") {
    issues.push(makeIssue("TYPE", path, "must be a string"));
    return undefined;
  }
  if (!isScalarText(value) || scalarLength(value) > 128 || !TOKEN.test(value)) {
    issues.push(
      makeIssue("FORMAT", path, "must be a lowercase identifier-safe token of at most 128 scalars"),
    );
    return undefined;
  }
  return value;
}
function parseEntryBody(value: unknown, issues: LoreduIssue[]): string | undefined {
  if (value === MISSING) return undefined;
  if (typeof value !== "string") {
    issues.push(makeIssue("TYPE", "/body", "must be a string"));
    return undefined;
  }
  if (!isScalarText(value)) {
    issues.push(makeIssue("FORMAT", "/body", "must contain only Unicode scalar values"));
    return undefined;
  }
  if (!/\S/u.test(value)) {
    issues.push(makeIssue("REQUIRED", "/body", "must contain non-whitespace text"));
    return undefined;
  }
  return value;
}
function scalarString(
  value: unknown,
  path: string,
  issues: LoreduIssue[],
  options: { trim?: boolean; minimum?: number; maximum?: number } = {},
): string | undefined {
  if (value === MISSING) return undefined;
  if (typeof value !== "string") {
    issues.push(makeIssue("TYPE", path, "must be a string"));
    return undefined;
  }
  const length = scalarLength(value);
  if (
    !isScalarText(value) ||
    (options.trim === true && value !== value.trim()) ||
    length < (options.minimum ?? 0) ||
    length > (options.maximum ?? Number.POSITIVE_INFINITY)
  ) {
    issues.push(makeIssue("FORMAT", path, "has invalid text format or length"));
    return undefined;
  }
  return value;
}
function enumeration<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  issues: LoreduIssue[],
): T | undefined {
  if (value === MISSING) return undefined;
  if (typeof value !== "string") {
    issues.push(makeIssue("TYPE", path, "must be a string"));
    return undefined;
  }
  if (!(allowed as readonly string[]).includes(value)) {
    issues.push(makeIssue("FORMAT", path, "is not a supported value"));
    return undefined;
  }
  return value as T;
}
function parseActor(value: unknown, issues: LoreduIssue[]): Actor | undefined {
  if (value === MISSING) return undefined;
  const data = inspectObject(value, "/actor", issues);
  if (!data) return undefined;
  rejectUnknown(data, new Set(["type", "id"]), "/actor", issues);
  const type = enumeration(ownValue(data, "type", "/actor/type", issues), ACTOR_TYPES, "/actor/type", issues);
  const id = token(ownValue(data, "id", "/actor/id", issues), "/actor/id", issues);
  return type && id ? Object.freeze({ type, id }) : undefined;
}
function parseSubject(value: unknown, issues: LoreduIssue[]): Subject | undefined {
  if (value === MISSING) return undefined;
  const data = inspectObject(value, "/subject", issues);
  if (!data) return undefined;
  rejectUnknown(data, new Set(["type", "id"]), "/subject", issues);
  const type = token(ownValue(data, "type", "/subject/type", issues), "/subject/type", issues);
  const id = token(ownValue(data, "id", "/subject/id", issues), "/subject/id", issues);
  return type && id ? Object.freeze({ type, id }) : undefined;
}
function parseScope(value: unknown, issues: LoreduIssue[]): Scope {
  const data = inspectObject(value, "/scope", issues);
  const output = Object.create(null) as Record<string, string>;
  if (data) {
    for (const key of Object.keys(data).sort(compareUnicodeScalars)) {
      const parsedKey = token(key, `/scope/${escapePointer(key)}`, issues);
      const parsedValue = token(dataValue(data, key), `/scope/${escapePointer(key)}`, issues);
      if (parsedKey && parsedValue)
        Object.defineProperty(output, parsedKey, {
          value: parsedValue,
          enumerable: true,
          configurable: false,
          writable: false,
        });
    }
  }
  return Object.freeze(output);
}
function validMetadataKey(key: string): boolean {
  const separator = key.indexOf(".");
  if (separator <= 0 || separator === key.length - 1) return false;
  const namespace = key.slice(0, separator);
  const name = key.slice(separator + 1);
  return (
    namespace !== "loredu" &&
    TOKEN.test(namespace) &&
    TOKEN.test(name) &&
    scalarLength(namespace) <= 128 &&
    scalarLength(name) <= 128
  );
}
function parseMetadata(value: unknown, issues: LoreduIssue[]): Metadata {
  const data = inspectObject(value, "/metadata", issues);
  const output = Object.create(null) as Record<string, JsonValue>;
  if (data) {
    for (const key of Object.keys(data).sort(compareUnicodeScalars)) {
      const path = `/metadata/${escapePointer(key)}`;
      if (!isScalarText(key) || !validMetadataKey(key)) {
        issues.push(makeIssue("FORMAT", path, "must be a non-reserved namespaced metadata key"));
        continue;
      }
      const copied = copyPortableJson(dataValue(data, key), path, issues);
      if (copied !== undefined)
        Object.defineProperty(output, key, {
          value: copied,
          enumerable: true,
          configurable: false,
          writable: false,
        });
    }
  }
  return Object.freeze(output);
}
function parseSourceRef(
  value: unknown,
  path: string,
  issues: LoreduIssue[],
  requireSnapshot = false,
): SourceRef | VerificationSourceRef | undefined {
  const data = inspectObject(value, path, issues);
  if (!data) return undefined;
  rejectUnknown(data, new Set(["ref", "locator", "snapshot"]), path, issues);
  const ref = scalarString(ownValue(data, "ref", `${path}/ref`, issues), `${path}/ref`, issues, {
    trim: true,
    minimum: 1,
    maximum: 1024,
  });
  const locatorInput = optionalValue(data, "locator");
  const snapshotInput = optionalValue(data, "snapshot");
  const locator = locatorInput.present
    ? scalarString(locatorInput.value, `${path}/locator`, issues, { trim: true, minimum: 1, maximum: 1024 })
    : undefined;
  let snapshot: string | undefined;
  if (requireSnapshot && !snapshotInput.present)
    issues.push(makeIssue("REQUIRED", `${path}/snapshot`, "is required for verification basis"));
  else if (snapshotInput.present)
    snapshot = scalarString(snapshotInput.value, `${path}/snapshot`, issues, {
      trim: true,
      minimum: 1,
      maximum: 256,
    });
  if (!ref || (requireSnapshot && !snapshot)) return undefined;
  return Object.freeze({
    ref,
    ...(locatorInput.present && locator ? { locator } : {}),
    ...(snapshotInput.present && snapshot ? { snapshot } : {}),
  });
}
function sourceEqual(left: SourceRef, right: SourceRef): boolean {
  return left.ref === right.ref && left.locator === right.locator && left.snapshot === right.snapshot;
}
function parseSources(
  value: unknown,
  path: string,
  issues: LoreduIssue[],
  options: { nonempty?: boolean; requireSnapshot?: boolean } = {},
): readonly SourceRef[] {
  if (value === MISSING) return Object.freeze([]);
  const array = inspectArray(value, path, issues);
  const output: SourceRef[] = [];
  if (array) {
    if (options.nonempty && array.length === 0) issues.push(makeIssue("RANGE", path, "must not be empty"));
    for (let index = 0; index < array.length; index++) {
      const source = parseSourceRef(array[index], `${path}/${index}`, issues, options.requireSnapshot);
      if (!source) continue;
      if (output.some((existing) => sourceEqual(existing, source)))
        issues.push(makeIssue("DUPLICATE", `${path}/${index}`, "duplicates an earlier SourceRef"));
      else output.push(source);
    }
  }
  return Object.freeze(output);
}
function parseCommon(data: DescriptorMap, issues: LoreduIssue[]): ParsedCommon {
  const actor = parseActor(ownValue(data, "actor", "/actor", issues), issues);
  const scopeInput = optionalValue(data, "scope");
  const metadataInput = optionalValue(data, "metadata");
  const sourcesInput = optionalValue(data, "sources");
  return {
    actor,
    scope: scopeInput.present ? parseScope(scopeInput.value, issues) : Object.freeze(Object.create(null)),
    metadata: metadataInput.present
      ? parseMetadata(metadataInput.value, issues)
      : Object.freeze(Object.create(null)),
    sources: sourcesInput.present ? parseSources(sourcesInput.value, "/sources", issues) : Object.freeze([]),
  };
}
function rejectUnknown(
  data: DescriptorMap,
  allowed: ReadonlySet<string>,
  path: string,
  issues: LoreduIssue[],
): void {
  for (const key of Object.keys(data)) {
    if (!allowed.has(key))
      issues.push(makeIssue("UNKNOWN_FIELD", `${path}/${escapePointer(key)}`, "is not part of this object"));
  }
}
function rejectRootUnknown(
  data: DescriptorMap,
  allowed: ReadonlySet<string>,
  persisted: boolean,
  issues: LoreduIssue[],
): void {
  for (const key of Object.keys(data)) {
    if (!persisted && RESERVED.has(key))
      issues.push(makeIssue("RESERVED_FIELD", `/${escapePointer(key)}`, "is application-owned"));
    else if (!allowed.has(key))
      issues.push(makeIssue("UNKNOWN_FIELD", `/${escapePointer(key)}`, "is not part of this record family"));
  }
}
function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
function daysFromCivil(year: number, month: number, day: number): number {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * adjustedMonth + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}
export function normalizeTimestamp(value: unknown, path: string, issues: LoreduIssue[]): string | undefined {
  if (value === MISSING) return undefined;
  if (typeof value !== "string") {
    issues.push(makeIssue("TYPE", path, "must be an RFC3339 timestamp string"));
    return undefined;
  }
  if (!isScalarText(value)) {
    issues.push(makeIssue("FORMAT", path, "must contain only Unicode scalar values"));
    return undefined;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(
    value,
  );
  if (!match) {
    issues.push(makeIssue("FORMAT", path, "must be strict RFC3339 with millisecond-or-coarser precision"));
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const milliseconds = Number((match[7] ?? "").padEnd(3, "0"));
  const zone = match[8] as string;
  let offset = 0;
  let offsetValid = true;
  if (zone !== "Z") {
    const offsetHours = Number(zone.slice(1, 3));
    const offsetMinutes = Number(zone.slice(4, 6));
    offsetValid =
      !(zone === "-00:00") &&
      offsetHours <= 14 &&
      offsetMinutes <= 59 &&
      (offsetHours !== 14 || offsetMinutes === 0);
    offset = (zone.startsWith("-") ? -1 : 1) * (offsetHours * 60 + offsetMinutes);
  }
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    !offsetValid
  ) {
    issues.push(makeIssue("FORMAT", path, "contains an invalid calendar date, time, or known offset"));
    return undefined;
  }
  const epoch =
    daysFromCivil(year, month, day) * 86_400_000 +
    hour * 3_600_000 +
    minute * 60_000 +
    second * 1_000 +
    milliseconds -
    offset * 60_000;
  if (epoch < -62_167_219_200_000 || epoch > 253_402_300_799_999) {
    issues.push(makeIssue("RANGE", path, "normalizes outside the four-digit-year Instant range"));
    return undefined;
  }
  return new Date(epoch).toISOString();
}
function parseRecordId(
  value: unknown,
  path: string,
  issues: LoreduIssue[],
  expectedKinds?: readonly RecordKind[],
): RecordId | undefined {
  if (value === MISSING) return undefined;
  if (typeof value !== "string") {
    issues.push(makeIssue("TYPE", path, "must be a record id string"));
    return undefined;
  }
  const match = ID.exec(value);
  if (!match) {
    issues.push(makeIssue("FORMAT", path, "must be a complete kind-prefixed Loredu record id"));
    return undefined;
  }
  if (expectedKinds && !expectedKinds.some((kind) => KIND_PREFIX[kind] === match[1])) {
    issues.push(makeIssue("FORMAT", path, "record id prefix does not match the required kind"));
    return undefined;
  }
  return value as RecordId;
}
function parseIdArray(
  value: unknown,
  path: string,
  issues: LoreduIssue[],
  expectedKinds: readonly RecordKind[],
  nonempty: boolean,
): readonly RecordId[] {
  if (value === MISSING) return Object.freeze([]);
  const array = inspectArray(value, path, issues);
  const output: RecordId[] = [];
  if (array) {
    if (nonempty && array.length === 0) issues.push(makeIssue("RANGE", path, "must not be empty"));
    for (let index = 0; index < array.length; index++) {
      const id = parseRecordId(array[index], `${path}/${index}`, issues, expectedKinds);
      if (!id) continue;
      if (output.includes(id))
        issues.push(makeIssue("DUPLICATE", `${path}/${index}`, "duplicates an earlier id"));
      else output.push(id);
    }
  }
  return Object.freeze(output);
}
function familyAllowed(kind: RecordKind, persisted: boolean): ReadonlySet<string> {
  const fields: Record<RecordKind, readonly string[]> = {
    entry: ["body", "title", "entry_type"],
    claim: [
      "subject",
      "predicate",
      "value",
      "confidence",
      "claim_class",
      "perspective",
      "valid_from",
      "valid_until",
      "derived_from",
    ],
    relation: ["relation_type", "from", "to"],
    resolution: ["targets", "decision", "replacement", "reason", "effective_at"],
    verification: ["targets", "verified_against", "result"],
  };
  return new Set([...COMMON, ...fields[kind], ...(persisted ? ["schema", "id", "recorded_at"] : [])]);
}
function orderedIssues(issues: LoreduIssue[]): readonly LoreduIssue[] {
  const unique = new Map<string, LoreduIssue>();
  for (const item of issues) unique.set(`${item.path}\u0000${item.code}`, item);
  return Object.freeze(
    [...unique.values()].sort(
      (left, right) =>
        compareUnicodeScalars(left.path, right.path) || compareUnicodeScalars(left.code, right.code),
    ),
  );
}
function fail(issues: LoreduIssue[], persisted: boolean): never {
  throw new LoreduError(
    "VALIDATION_FAILED",
    `${persisted ? "Persisted record" : "Record draft"} validation failed`,
    orderedIssues(issues),
  );
}

function decode(input: unknown, persisted: boolean): RecordDraft | PersistedRecord {
  const issues: LoreduIssue[] = [];
  const data = inspectObject(input, "", issues);
  if (!data) fail(issues, persisted);
  const kind = enumeration(
    ownValue(data, "kind", "/kind", issues),
    ["entry", "claim", "relation", "resolution", "verification"] as const,
    "/kind",
    issues,
  );
  if (!kind) fail(issues, persisted);
  rejectRootUnknown(data, familyAllowed(kind, persisted), persisted, issues);
  const common = parseCommon(data, issues);
  let schema: typeof RECORD_SCHEMA_ID | undefined;
  let id: RecordId | undefined;
  let recordedAt: string | undefined;
  if (persisted) {
    const schemaInput = ownValue(data, "schema", "/schema", issues);
    if (schemaInput === RECORD_SCHEMA_ID) schema = RECORD_SCHEMA_ID;
    else if (schemaInput !== MISSING)
      issues.push(makeIssue("UNKNOWN_SCHEMA", "/schema", "must be the known loredu.record/v1 schema"));
    id = parseRecordId(ownValue(data, "id", "/id", issues), "/id", issues, [kind]);
    recordedAt = normalizeTimestamp(
      ownValue(data, "recorded_at", "/recorded_at", issues),
      "/recorded_at",
      issues,
    );
  }
  const envelope = persisted && schema && id && recordedAt ? { schema, id, recorded_at: recordedAt } : {};
  let output: RecordDraft | PersistedRecord | undefined;
  if (kind === "entry") {
    const body = parseEntryBody(ownValue(data, "body", "/body", issues), issues);
    const titleInput = optionalValue(data, "title");
    const entryTypeInput = optionalValue(data, "entry_type");
    const title = titleInput.present
      ? scalarString(titleInput.value, "/title", issues, { trim: true, minimum: 1, maximum: 256 })
      : undefined;
    const entryType = entryTypeInput.present ? token(entryTypeInput.value, "/entry_type", issues) : undefined;
    if (common.actor && body)
      output = Object.freeze({
        ...envelope,
        kind,
        actor: common.actor,
        body,
        ...(titleInput.present && title ? { title } : {}),
        ...(entryTypeInput.present && entryType ? { entry_type: entryType } : {}),
        scope: common.scope,
        metadata: common.metadata,
        sources: common.sources,
      }) as EntryDraft | Entry;
  } else if (kind === "claim") {
    const subject = parseSubject(ownValue(data, "subject", "/subject", issues), issues);
    const predicate = token(ownValue(data, "predicate", "/predicate", issues), "/predicate", issues);
    const valuePresent = hasOwnDescriptor(data, "value");
    if (!valuePresent) issues.push(makeIssue("REQUIRED", "/value", "is required"));
    const value =
      valuePresent && hasData(data, "value")
        ? copyPortableJson(dataValue(data, "value"), "/value", issues)
        : undefined;
    const confidence = enumeration(
      ownValue(data, "confidence", "/confidence", issues),
      CONFIDENCES,
      "/confidence",
      issues,
    );
    const claimClassInput = optionalValue(data, "claim_class");
    const perspectiveInput = optionalValue(data, "perspective");
    const validFromInput = optionalValue(data, "valid_from");
    const validUntilInput = optionalValue(data, "valid_until");
    const derivedInput = optionalValue(data, "derived_from");
    const claimClass = claimClassInput.present
      ? token(claimClassInput.value, "/claim_class", issues)
      : undefined;
    const perspective = perspectiveInput.present
      ? token(perspectiveInput.value, "/perspective", issues)
      : undefined;
    const validFrom = validFromInput.present
      ? normalizeTimestamp(validFromInput.value, "/valid_from", issues)
      : undefined;
    const validUntil = validUntilInput.present
      ? normalizeTimestamp(validUntilInput.value, "/valid_until", issues)
      : undefined;
    if (validFrom && validUntil && validFrom > validUntil)
      issues.push(makeIssue("RANGE", "/valid_until", "must not precede valid_from"));
    const derivedFrom = derivedInput.present
      ? (parseIdArray(derivedInput.value, "/derived_from", issues, ["entry"], false) as readonly EntryId[])
      : Object.freeze([]);
    if (common.actor && subject && predicate && value !== undefined && confidence)
      output = Object.freeze({
        ...envelope,
        kind,
        actor: common.actor,
        subject,
        predicate,
        value,
        confidence,
        ...(claimClassInput.present && claimClass ? { claim_class: claimClass } : {}),
        ...(perspectiveInput.present && perspective ? { perspective } : {}),
        ...(validFromInput.present && validFrom ? { valid_from: validFrom } : {}),
        ...(validUntilInput.present && validUntil ? { valid_until: validUntil } : {}),
        derived_from: derivedFrom,
        scope: common.scope,
        metadata: common.metadata,
        sources: common.sources,
      }) as ClaimDraft | Claim;
  } else if (kind === "relation") {
    const relationType = enumeration(
      ownValue(data, "relation_type", "/relation_type", issues),
      RELATION_TYPES,
      "/relation_type",
      issues,
    );
    const expected = relationType === "derived_from" ? (["claim"] as const) : undefined;
    const from = parseRecordId(ownValue(data, "from", "/from", issues), "/from", issues, expected);
    const to = parseRecordId(ownValue(data, "to", "/to", issues), "/to", issues, expected);
    if (from && to && from === to) issues.push(makeIssue("FORMAT", "/to", "must differ from from"));
    if (common.actor && relationType && from && to)
      output = Object.freeze({
        ...envelope,
        kind,
        actor: common.actor,
        relation_type: relationType,
        from,
        to,
        scope: common.scope,
        metadata: common.metadata,
        sources: common.sources,
      }) as RelationDraft | Relation;
  } else if (kind === "resolution") {
    const targets = parseIdArray(
      ownValue(data, "targets", "/targets", issues),
      "/targets",
      issues,
      ["claim", "relation"],
      true,
    ) as readonly (ClaimId | RelationId)[];
    const decision = enumeration(
      ownValue(data, "decision", "/decision", issues),
      RESOLUTION_DECISIONS,
      "/decision",
      issues,
    );
    const replacementInput = optionalValue(data, "replacement");
    const replacement = replacementInput.present
      ? (parseRecordId(replacementInput.value, "/replacement", issues, ["claim"]) as ClaimId | undefined)
      : undefined;
    const reason = scalarString(ownValue(data, "reason", "/reason", issues), "/reason", issues, {
      trim: true,
      minimum: 1,
      maximum: 4096,
    });
    const effectiveInput = optionalValue(data, "effective_at");
    const effectiveAt = effectiveInput.present
      ? normalizeTimestamp(effectiveInput.value, "/effective_at", issues)
      : undefined;
    if (common.actor && decision && reason)
      output = Object.freeze({
        ...envelope,
        kind,
        actor: common.actor,
        targets,
        decision,
        ...(replacementInput.present && replacement ? { replacement } : {}),
        reason,
        ...(effectiveInput.present && effectiveAt ? { effective_at: effectiveAt } : {}),
        scope: common.scope,
        metadata: common.metadata,
        sources: common.sources,
      }) as ResolutionDraft | Resolution;
  } else {
    const targets = parseIdArray(
      ownValue(data, "targets", "/targets", issues),
      "/targets",
      issues,
      ["claim"],
      true,
    ) as readonly ClaimId[];
    const verified = parseSources(
      ownValue(data, "verified_against", "/verified_against", issues),
      "/verified_against",
      issues,
      { nonempty: true, requireSnapshot: true },
    ) as readonly VerificationSourceRef[];
    const result = enumeration(
      ownValue(data, "result", "/result", issues),
      VERIFICATION_RESULTS,
      "/result",
      issues,
    );
    if (common.actor && result)
      output = Object.freeze({
        ...envelope,
        kind,
        actor: common.actor,
        targets,
        verified_against: verified,
        result,
        scope: common.scope,
        metadata: common.metadata,
        sources: common.sources,
      }) as VerificationDraft | Verification;
  }
  if (issues.length > 0 || !output || (persisted && (!schema || !id || !recordedAt))) fail(issues, persisted);
  return output;
}

export function decodeRecordDraft(input: unknown): RecordDraft {
  return decode(input, false) as RecordDraft;
}
export function decodePersistedRecord(input: unknown): PersistedRecord {
  return decode(input, true) as PersistedRecord;
}
export function encodePersistedRecord(record: PersistedRecord): JsonObject {
  return decodePersistedRecord(record) as unknown as JsonObject;
}
