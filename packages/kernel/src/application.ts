import {
  type Entry,
  type EntryDraft,
  type JsonValue,
  type PersistedRecord,
  type PersistedRecordFor,
  RECORD_SCHEMA_ID,
  type RecordDraft,
  type RecordId,
} from "./domain/entry";
import type { Clock, RandomSource, RecordStore, StreamPosition } from "./ports/capabilities";

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

function issue(code: LoreduIssueCode, path: string, message: string): LoreduIssue {
  return Object.freeze({ code, path, message });
}
function plainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function copyJson(
  value: unknown,
  path: string,
  issues: LoreduIssue[],
  seen: Set<object>,
): JsonValue | undefined {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (Number.isFinite(value) && !Object.is(value, -0)) return value;
    issues.push(issue("FORMAT", path, "must be a finite JSON number other than -0"));
    return undefined;
  }
  if (typeof value !== "object" || value === null) {
    issues.push(issue("TYPE", path, "must be JSON data"));
    return undefined;
  }
  if (seen.has(value)) {
    issues.push(issue("FORMAT", path, "must be acyclic JSON data"));
    return undefined;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const result: JsonValue[] = [];
    for (let index = 0; index < value.length; index++)
      result.push(copyJson(value[index], `${path}/${index}`, issues, seen) as JsonValue);
    seen.delete(value);
    return Object.freeze(result);
  }
  if (!plainObject(value)) {
    issues.push(issue("TYPE", path, "must be a plain JSON object"));
    seen.delete(value);
    return undefined;
  }
  const result: Record<string, JsonValue> = {};
  for (const key of Object.keys(value).sort())
    result[key] = copyJson(value[key], `${path}/${key}`, issues, seen) as JsonValue;
  seen.delete(value);
  return Object.freeze(result);
}
function validateEntry(input: unknown): EntryDraft {
  const issues: LoreduIssue[] = [];
  if (!plainObject(input))
    throw new LoreduError("VALIDATION_FAILED", "Entry draft validation failed", [
      issue("TYPE", "", "must be a plain object"),
    ]);
  const allowed = new Set(["kind", "actor", "body", "title", "entry_type", "scope", "metadata", "sources"]);
  for (const key of Object.keys(input)) {
    if (key === "schema" || key === "id" || key === "recorded_at")
      issues.push(issue("RESERVED_FIELD", `/${key}`, "is application-owned"));
    else if (!allowed.has(key))
      issues.push(issue("UNKNOWN_FIELD", `/${key}`, "is not part of an Entry draft"));
  }
  if (input.kind !== "entry") issues.push(issue("FORMAT", "/kind", "must equal entry"));
  if (typeof input.body !== "string") issues.push(issue("TYPE", "/body", "must be a string"));
  else if (!/\S/u.test(input.body))
    issues.push(issue("REQUIRED", "/body", "must contain non-whitespace text"));
  if (!plainObject(input.actor)) issues.push(issue("TYPE", "/actor", "must be a plain actor object"));
  else {
    for (const key of Object.keys(input.actor))
      if (key !== "type" && key !== "id")
        issues.push(issue("UNKNOWN_FIELD", `/actor/${key}`, "is not part of actor"));
    if (!["human", "agent", "program", "system"].includes(input.actor.type as string))
      issues.push(issue("FORMAT", "/actor/type", "must be a supported actor type"));
    if (typeof input.actor.id !== "string" || input.actor.id.length > 128 || !TOKEN.test(input.actor.id))
      issues.push(issue("FORMAT", "/actor/id", "must be a lowercase token of at most 128 characters"));
  }
  const scope: Record<string, string> = {};
  if (input.scope !== undefined) {
    if (!plainObject(input.scope)) issues.push(issue("TYPE", "/scope", "must be a plain object"));
    else
      for (const [key, value] of Object.entries(input.scope)) {
        if (
          !TOKEN.test(key) ||
          key.length > 128 ||
          typeof value !== "string" ||
          !TOKEN.test(value) ||
          value.length > 128
        )
          issues.push(issue("FORMAT", `/scope/${key}`, "scope keys and values must be tokens"));
        else scope[key] = value;
      }
  }
  const metadata: Record<string, JsonValue> = {};
  if (input.metadata !== undefined) {
    if (!plainObject(input.metadata)) issues.push(issue("TYPE", "/metadata", "must be a plain object"));
    else
      for (const [key, value] of Object.entries(input.metadata)) {
        if (!METADATA_KEY.test(key) || key.startsWith("loredu."))
          issues.push(issue("FORMAT", `/metadata/${key}`, "must be a non-reserved namespaced key"));
        else metadata[key] = copyJson(value, `/metadata/${key}`, issues, new Set()) as JsonValue;
      }
  }
  if (input.sources !== undefined && (!Array.isArray(input.sources) || input.sources.length > 0))
    issues.push(issue("TYPE", "/sources", "P0 Entry supports only an empty sources array"));
  if (
    input.title !== undefined &&
    (typeof input.title !== "string" ||
      input.title !== input.title.trim() ||
      input.title.length === 0 ||
      input.title.length > 256)
  )
    issues.push(issue("FORMAT", "/title", "must be trimmed and 1..256 characters"));
  if (
    input.entry_type !== undefined &&
    (typeof input.entry_type !== "string" || !TOKEN.test(input.entry_type) || input.entry_type.length > 128)
  )
    issues.push(issue("FORMAT", "/entry_type", "must be a token"));
  if (issues.length)
    throw new LoreduError(
      "VALIDATION_FAILED",
      "Entry draft validation failed",
      issues.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code)),
    );
  return {
    kind: "entry",
    actor: Object.freeze({ ...(input.actor as { type: EntryDraft["actor"]["type"]; id: string }) }),
    body: input.body as string,
    ...(input.title === undefined ? {} : { title: input.title as string }),
    ...(input.entry_type === undefined ? {} : { entry_type: input.entry_type as string }),
    scope: Object.freeze(scope),
    metadata: Object.freeze(metadata),
    sources: Object.freeze([]),
  };
}
function idFrom(bytes: Uint8Array): RecordId {
  if (bytes.length !== 10)
    throw new LoreduError("RANDOM_SOURCE_FAILED", "RandomSource must return exactly 10 bytes");
  const byteAt = (index: number) => bytes.at(index) ?? 0;
  let suffix = "";
  for (let i = 0; i < 10; i += 5) {
    const n =
      byteAt(i) * 2 ** 32 +
      byteAt(i + 1) * 2 ** 24 +
      byteAt(i + 2) * 2 ** 16 +
      byteAt(i + 3) * 2 ** 8 +
      byteAt(i + 4);
    for (let shift = 35; shift >= 0; shift -= 5) suffix += ALPHABET[Math.floor(n / 2 ** shift) & 31];
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
        const position = await store.append(record);
        if (position <= 0) throw new Error("nonpositive position");
        return Object.freeze({ record, position }) as AppendRecordResult<PersistedRecordFor<D>>;
      } catch (error) {
        if (error instanceof LoreduError) throw error;
        throw new LoreduError("STORE_APPEND_FAILED", "Store append failed");
      }
    },
  });
}
