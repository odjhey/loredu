import {
  type Entry,
  type EntryDraft,
  type JsonValue,
  type PersistedRecord,
  type PersistedRecordFor,
  RECORD_SCHEMA_ID,
  type RecordDraft,
  type RecordId,
  type SourceRef,
} from "./domain/entry";
import {
  type Clock,
  createStreamPosition,
  type RandomSource,
  type RecordStore,
  type StreamPosition,
} from "./ports/capabilities";

export type LoreduErrorCode =
  | "VALIDATION_FAILED"
  | "DUPLICATE_RECORD_ID"
  | "RANDOM_SOURCE_FAILED"
  | "CLOCK_FAILED"
  | "STORE_APPEND_FAILED";
export type LoreduIssueCode = "REQUIRED" | "TYPE" | "FORMAT" | "RANGE" | "UNKNOWN_FIELD" | "RESERVED_FIELD";
export interface LoreduIssue {
  readonly code: LoreduIssueCode;
  readonly path: string;
  readonly message: string;
}
export class LoreduError extends Error {
  constructor(
    readonly code: LoreduErrorCode,
    message: string,
    readonly issues: readonly LoreduIssue[] = [],
  ) {
    super(message);
    this.name = "LoreduError";
  }
}
export interface AppendRecordResult<R extends PersistedRecord = PersistedRecord> {
  readonly record: R;
  readonly position: StreamPosition;
}
export interface LoreduApplicationDependencies {
  readonly store: RecordStore;
  readonly clock: Clock;
  readonly randomSource: RandomSource;
}
export interface LoreduApplication {
  append<D extends RecordDraft>(draft: D): Promise<AppendRecordResult<PersistedRecordFor<D>>>;
}

const TOKEN = /^[a-z0-9](?:[a-z0-9._:/-]*[a-z0-9])?$/;
const METADATA_KEY = /^[a-z0-9](?:[a-z0-9_:/-]*[a-z0-9])?\.[a-z0-9](?:[a-z0-9._:/-]*[a-z0-9])?$/;
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
type Data = Readonly<Record<string, PropertyDescriptor>>;

function issue(code: LoreduIssueCode, path: string, message: string): LoreduIssue {
  return Object.freeze({ code, path, message });
}
function pointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
function scalarLength(value: string): number {
  return [...value].length;
}
function isScalarText(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
function inspectObject(value: unknown, path: string, issues: LoreduIssue[]): Data | undefined {
  if (typeof value !== "object" || value === null) {
    issues.push(issue("TYPE", path, "must be a plain object"));
    return undefined;
  }
  try {
    if (Array.isArray(value)) {
      issues.push(issue("TYPE", path, "must be a plain object"));
      return undefined;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      issues.push(issue("TYPE", path, "must have Object.prototype or null prototype"));
      return undefined;
    }
    if (Object.getOwnPropertySymbols(value).length > 0)
      issues.push(issue("UNKNOWN_FIELD", path, "must not have symbol fields"));
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!("value" in descriptor) || !descriptor.enumerable) {
        issues.push(issue("TYPE", `${path}/${pointer(key)}`, "must be an enumerable own data property"));
      }
    }
    return descriptors;
  } catch {
    issues.push(issue("TYPE", path, "could not be inspected as plain data"));
    return undefined;
  }
}
function dataValue(data: Data, key: string): unknown {
  const descriptor = data[key];
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
function inspectArray(value: unknown, path: string, issues: LoreduIssue[]): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(value)) {
      issues.push(issue("TYPE", path, "must be an array"));
      return undefined;
    }
    if (Object.getPrototypeOf(value) !== Array.prototype)
      issues.push(issue("TYPE", path, "must have Array.prototype"));
    if (Object.getOwnPropertySymbols(value).length > 0)
      issues.push(issue("UNKNOWN_FIELD", path, "must not have symbol fields"));
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = value.length;
    const result: unknown[] = [];
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (key === "length") continue;
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key) {
        issues.push(issue("UNKNOWN_FIELD", `${path}/${pointer(key)}`, "is an array extra property"));
      } else if (!("value" in descriptor) || !descriptor.enumerable) {
        issues.push(issue("TYPE", `${path}/${key}`, "must be an enumerable own data element"));
      } else result[index] = descriptor.value;
    }
    for (let index = 0; index < length; index++) {
      if (!Object.hasOwn(descriptors, String(index)))
        issues.push(issue("REQUIRED", `${path}/${index}`, "array must be dense"));
    }
    result.length = length;
    return result;
  } catch {
    issues.push(issue("TYPE", path, "could not be inspected as plain array data"));
    return undefined;
  }
}
function copyJson(
  value: unknown,
  path: string,
  issues: LoreduIssue[],
  ancestors: Set<object>,
): JsonValue | undefined {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (isScalarText(value)) return value;
    issues.push(issue("FORMAT", path, "must contain only Unicode scalar values"));
    return undefined;
  }
  if (typeof value === "number") {
    if (Number.isFinite(value) && !Object.is(value, -0)) return value;
    issues.push(issue("FORMAT", path, "must be a finite JSON number other than -0"));
    return undefined;
  }
  if (typeof value !== "object" || value === null) {
    issues.push(issue("TYPE", path, "must be JSON data"));
    return undefined;
  }
  if (ancestors.has(value)) {
    issues.push(issue("FORMAT", path, "must be acyclic JSON data"));
    return undefined;
  }
  ancestors.add(value);
  let arrayValue: boolean;
  try {
    arrayValue = Array.isArray(value);
  } catch {
    issues.push(issue("TYPE", path, "could not be inspected as plain JSON data"));
    ancestors.delete(value);
    return undefined;
  }
  if (arrayValue) {
    const array = inspectArray(value, path, issues);
    const result: JsonValue[] = [];
    if (array)
      for (let index = 0; index < array.length; index++)
        result.push(copyJson(array[index], `${path}/${index}`, issues, ancestors) as JsonValue);
    ancestors.delete(value);
    return Object.freeze(result);
  }
  const data = inspectObject(value, path, issues);
  const result: Record<string, JsonValue> = {};
  if (data) {
    for (const key of Object.keys(data).sort()) {
      if (!isScalarText(key))
        issues.push(
          issue("FORMAT", `${path}/${pointer(key)}`, "property name must contain only Unicode scalar values"),
        );
      result[key] = copyJson(dataValue(data, key), `${path}/${pointer(key)}`, issues, ancestors) as JsonValue;
    }
  }
  ancestors.delete(value);
  return Object.freeze(result);
}
function validateSource(value: unknown, path: string, issues: LoreduIssue[]): SourceRef | undefined {
  const data = inspectObject(value, path, issues);
  if (!data) return undefined;
  for (const key of Object.keys(data))
    if (!["ref", "locator", "snapshot"].includes(key))
      issues.push(issue("UNKNOWN_FIELD", `${path}/${pointer(key)}`, "is not part of SourceRef"));
  const result: { ref?: string; locator?: string; snapshot?: string } = {};
  for (const [key, maximum] of [
    ["ref", 1024],
    ["locator", 1024],
    ["snapshot", 256],
  ] as const) {
    const field = dataValue(data, key);
    if (key === "ref" && !Object.hasOwn(data, key))
      issues.push(issue("REQUIRED", `${path}/ref`, "is required"));
    else if (field !== undefined) {
      if (typeof field !== "string") issues.push(issue("TYPE", `${path}/${key}`, "must be a string"));
      else if (
        !isScalarText(field) ||
        field !== field.trim() ||
        scalarLength(field) === 0 ||
        scalarLength(field) > maximum
      )
        issues.push(
          issue(
            "FORMAT",
            `${path}/${key}`,
            `must be trimmed Unicode scalar text of 1..${maximum} characters`,
          ),
        );
      else result[key] = field;
    }
  }
  return result.ref === undefined ? undefined : Object.freeze(result as SourceRef);
}
function sourceEqual(left: SourceRef, right: SourceRef): boolean {
  return left.ref === right.ref && left.locator === right.locator && left.snapshot === right.snapshot;
}
function validateEntry(input: unknown): EntryDraft {
  const issues: LoreduIssue[] = [];
  const data = inspectObject(input, "", issues);
  if (!data)
    throw new LoreduError("VALIDATION_FAILED", "Entry draft validation failed", Object.freeze(issues));
  const allowed = new Set(["kind", "actor", "body", "title", "entry_type", "scope", "metadata", "sources"]);
  for (const key of Object.keys(data)) {
    if (["schema", "id", "recorded_at"].includes(key))
      issues.push(issue("RESERVED_FIELD", `/${key}`, "is application-owned"));
    else if (!allowed.has(key))
      issues.push(issue("UNKNOWN_FIELD", `/${pointer(key)}`, "is not part of an Entry draft"));
  }
  const kind = dataValue(data, "kind");
  const body = dataValue(data, "body");
  if (kind !== "entry") issues.push(issue("FORMAT", "/kind", "must equal entry"));
  if (typeof body !== "string") issues.push(issue("TYPE", "/body", "must be a string"));
  else if (!isScalarText(body))
    issues.push(issue("FORMAT", "/body", "must contain only Unicode scalar values"));
  else if (!/\S/u.test(body)) issues.push(issue("REQUIRED", "/body", "must contain non-whitespace text"));

  const actorData = inspectObject(dataValue(data, "actor"), "/actor", issues);
  let actor: EntryDraft["actor"] | undefined;
  if (actorData) {
    for (const key of Object.keys(actorData))
      if (key !== "type" && key !== "id")
        issues.push(issue("UNKNOWN_FIELD", `/actor/${pointer(key)}`, "is not part of actor"));
    const type = dataValue(actorData, "type");
    const id = dataValue(actorData, "id");
    if (!["human", "agent", "program", "system"].includes(type as string))
      issues.push(issue("FORMAT", "/actor/type", "must be a supported actor type"));
    if (typeof id !== "string" || !isScalarText(id) || scalarLength(id) > 128 || !TOKEN.test(id))
      issues.push(issue("FORMAT", "/actor/id", "must be a lowercase token of at most 128 characters"));
    else actor = Object.freeze({ type: type as EntryDraft["actor"]["type"], id });
  }

  const scope: Record<string, string> = {};
  if (Object.hasOwn(data, "scope")) {
    const scopeData = inspectObject(dataValue(data, "scope"), "/scope", issues);
    if (scopeData)
      for (const key of Object.keys(scopeData)) {
        const value = dataValue(scopeData, key);
        if (
          !isScalarText(key) ||
          !TOKEN.test(key) ||
          scalarLength(key) > 128 ||
          typeof value !== "string" ||
          !isScalarText(value) ||
          !TOKEN.test(value) ||
          scalarLength(value) > 128
        )
          issues.push(issue("FORMAT", `/scope/${pointer(key)}`, "scope keys and values must be tokens"));
        else scope[key] = value;
      }
  }
  const metadata: Record<string, JsonValue> = {};
  if (Object.hasOwn(data, "metadata")) {
    const metadataData = inspectObject(dataValue(data, "metadata"), "/metadata", issues);
    if (metadataData)
      for (const key of Object.keys(metadataData)) {
        if (!METADATA_KEY.test(key) || key.startsWith("loredu."))
          issues.push(issue("FORMAT", `/metadata/${pointer(key)}`, "must be a non-reserved namespaced key"));
        else
          metadata[key] = copyJson(
            dataValue(metadataData, key),
            `/metadata/${pointer(key)}`,
            issues,
            new Set(),
          ) as JsonValue;
      }
  }
  const sources: SourceRef[] = [];
  if (Object.hasOwn(data, "sources")) {
    const sourceInput = inspectArray(dataValue(data, "sources"), "/sources", issues);
    if (sourceInput)
      for (let index = 0; index < sourceInput.length; index++) {
        const source = validateSource(sourceInput[index], `/sources/${index}`, issues);
        if (source) {
          if (sources.some((existing) => sourceEqual(existing, source)))
            issues.push(issue("FORMAT", `/sources/${index}`, "duplicates an earlier SourceRef"));
          else sources.push(source);
        }
      }
  }
  const title = dataValue(data, "title");
  if (
    title !== undefined &&
    (typeof title !== "string" ||
      !isScalarText(title) ||
      title !== title.trim() ||
      scalarLength(title) === 0 ||
      scalarLength(title) > 256)
  )
    issues.push(issue("FORMAT", "/title", "must be trimmed Unicode scalar text of 1..256 characters"));
  const entryType = dataValue(data, "entry_type");
  if (
    entryType !== undefined &&
    (typeof entryType !== "string" ||
      !isScalarText(entryType) ||
      !TOKEN.test(entryType) ||
      scalarLength(entryType) > 128)
  )
    issues.push(issue("FORMAT", "/entry_type", "must be a token"));
  if (issues.length > 0 || !actor || typeof body !== "string") {
    const ordered = issues.sort(
      (left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
    );
    throw new LoreduError("VALIDATION_FAILED", "Entry draft validation failed", Object.freeze(ordered));
  }
  return {
    kind: "entry",
    actor,
    body,
    ...(title === undefined ? {} : { title: title as string }),
    ...(entryType === undefined ? {} : { entry_type: entryType as string }),
    scope: Object.freeze(scope),
    metadata: Object.freeze(metadata),
    sources: Object.freeze(sources),
  };
}
function idFrom(bytes: Uint8Array): RecordId {
  if (bytes.length !== 10)
    throw new LoreduError("RANDOM_SOURCE_FAILED", "RandomSource must return exactly 10 bytes");
  const byteAt = (index: number) => bytes.at(index) ?? 0;
  let suffix = "";
  for (let index = 0; index < 10; index += 5) {
    const number =
      byteAt(index) * 2 ** 32 +
      byteAt(index + 1) * 2 ** 24 +
      byteAt(index + 2) * 2 ** 16 +
      byteAt(index + 3) * 2 ** 8 +
      byteAt(index + 4);
    for (let shift = 35; shift >= 0; shift -= 5) suffix += ALPHABET[Math.floor(number / 2 ** shift) & 31];
  }
  return `ent_${suffix}` as RecordId;
}
export function createLoreduApplication({
  store,
  clock,
  randomSource,
}: LoreduApplicationDependencies): LoreduApplication {
  return Object.freeze({
    async append<D extends RecordDraft>(input: D) {
      const draft = validateEntry(input);
      let id: RecordId;
      try {
        id = idFrom(randomSource.nextBytes(10));
      } catch (error) {
        if (error instanceof LoreduError) throw error;
        throw new LoreduError("RANDOM_SOURCE_FAILED", "RandomSource failed");
      }
      let recordedAt: string;
      try {
        recordedAt = new Date(clock.now()).toISOString();
      } catch {
        throw new LoreduError("CLOCK_FAILED", "Clock failed");
      }
      const record = Object.freeze({
        ...draft,
        schema: RECORD_SCHEMA_ID,
        id,
        recorded_at: recordedAt,
      }) as Entry;
      try {
        const position = createStreamPosition(await store.append(record));
        if (position === 0) throw new RangeError("append position must be positive");
        return Object.freeze({ record, position }) as AppendRecordResult<PersistedRecordFor<D>>;
      } catch (error) {
        if (error instanceof LoreduError) throw error;
        throw new LoreduError("STORE_APPEND_FAILED", "Store append failed");
      }
    },
  });
}
