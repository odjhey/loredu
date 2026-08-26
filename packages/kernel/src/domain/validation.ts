import { RECORD_ID_PREFIX, RECORD_SCHEMA_ID, type RecordKind } from "./record-kind";
import type { ClaimKey, ClaimKeyInput, JsonValue, LoreduDraft, LoreduRecord } from "./records";

export type ValidationCode =
  | "invalid_type"
  | "missing_field"
  | "unknown_field"
  | "invalid_value"
  | "unsupported_schema";
export interface ValidationError {
  readonly path: string;
  readonly code: ValidationCode;
  readonly message: string;
}
export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly ValidationError[] };

const TOKEN = /^[a-z0-9](?:[a-z0-9._:/-]*[a-z0-9])?$/;
const RECORD_ID = /^(ent|clm|rel|res|ver)_[0-9a-hjkmnp-tv-z]{16}$/;
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;
const kinds = ["entry", "claim", "relation", "resolution", "verification"] as const;
const actors = ["human", "agent", "program", "system"] as const;
const relations = [
  "supports",
  "contradicts",
  "duplicates",
  "supersedes",
  "derived_from",
  "related_to",
] as const;
const decisions = ["prefer", "supersede", "retract", "leave_disputed"] as const;
const results = ["confirmed", "contradicted", "unchanged", "needs_revalidation"] as const;
const confidences = ["candidate", "observed", "corroborated", "confirmed", "authoritative"] as const;

type ObjectValue = Record<string, unknown>;
const isObject = (value: unknown): value is ObjectValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const issue = (errors: ValidationError[], path: string, code: ValidationCode, message: string): void => {
  errors.push({ path, code, message });
};
function unknowns(
  value: ObjectValue,
  allowed: readonly string[],
  errors: ValidationError[],
  base = "",
): void {
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      issue(errors, base ? `${base}.${key}` : key, "unknown_field", `Unknown field '${key}'.`);
}
function required(value: ObjectValue, key: string, errors: ValidationError[], base = ""): unknown {
  if (!Object.hasOwn(value, key))
    issue(errors, base ? `${base}.${key}` : key, "missing_field", `Required field '${key}' is missing.`);
  return value[key];
}
function string(value: unknown, path: string, errors: ValidationError[], nonempty = false): value is string {
  if (typeof value !== "string") {
    issue(errors, path, "invalid_type", "Expected a string.");
    return false;
  }
  if (nonempty && value.length === 0) {
    issue(errors, path, "invalid_value", "Must be non-empty.");
    return false;
  }
  return true;
}
function token(value: unknown, path: string, errors: ValidationError[]): value is string {
  if (!string(value, path, errors)) return false;
  if (value.length > 128 || !TOKEN.test(value)) {
    issue(
      errors,
      path,
      "invalid_value",
      "Must be a lowercase identifier-safe token of at most 128 characters.",
    );
    return false;
  }
  return true;
}
function enumeration(
  value: unknown,
  path: string,
  allowed: readonly string[],
  errors: ValidationError[],
): void {
  if (!string(value, path, errors)) return;
  if (!allowed.includes(value))
    issue(errors, path, "invalid_value", `Expected one of: ${allowed.join(", ")}.`);
}
function timestamp(value: unknown, path: string, errors: ValidationError[]): void {
  if (!string(value, path, errors)) return;
  const match = TIMESTAMP.exec(value);
  if (!match) {
    issue(errors, path, "invalid_value", "Expected a valid RFC 3339 timestamp with an explicit offset or Z.");
    return;
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const valid =
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= (monthDays[month - 1] ?? 0) &&
    Number(hourText) <= 23 &&
    Number(minuteText) <= 59 &&
    Number(secondText) <= 59 &&
    (offsetHourText === undefined || (Number(offsetHourText) <= 23 && Number(offsetMinuteText) <= 59));
  if (!valid || Number.isNaN(Date.parse(value)))
    issue(errors, path, "invalid_value", "Expected a valid RFC 3339 timestamp with an explicit offset or Z.");
}

export function canonicalizeJsonValue(value: unknown, path = "value"): ValidationResult<JsonValue> {
  const errors: ValidationError[] = [];
  const ancestors = new WeakSet<object>();
  const walk = (item: unknown, at: string): JsonValue | undefined => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number") {
      if (Number.isFinite(item)) return item;
      issue(errors, at, "invalid_value", "JSON numbers must be finite.");
      return;
    }
    if (Array.isArray(item)) {
      if (ancestors.has(item)) {
        issue(errors, at, "invalid_value", "JSON values cannot contain cycles.");
        return;
      }
      ancestors.add(item);
      const output: JsonValue[] = [];
      item.forEach((child, index) => {
        const next = walk(child, `${at}[${index}]`);
        if (next !== undefined) output.push(next);
      });
      ancestors.delete(item);
      return output;
    }
    if (isObject(item)) {
      if (ancestors.has(item)) {
        issue(errors, at, "invalid_value", "JSON values cannot contain cycles.");
        return;
      }
      ancestors.add(item);
      const output: Record<string, JsonValue> = {};
      for (const key of Object.keys(item).sort()) {
        const next = walk(item[key], at ? `${at}.${key}` : key);
        if (next !== undefined) output[key] = next;
      }
      ancestors.delete(item);
      return output;
    }
    issue(errors, at, "invalid_type", "Expected a JSON-serializable value.");
  };
  const output = walk(value, path);
  return errors.length > 0 || output === undefined
    ? { ok: false, errors }
    : { ok: true, value: deepFreeze(output) };
}

export function jsonValuesEqual(left: unknown, right: unknown): boolean {
  const a = canonicalizeJsonValue(left);
  const b = canonicalizeJsonValue(right);
  return a.ok && b.ok && JSON.stringify(a.value) === JSON.stringify(b.value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function clone<T>(value: T): T {
  const copy = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(copy);
    if (isObject(item))
      return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, copy(child)]));
    return item;
  };
  return deepFreeze(copy(value) as T);
}

function scope(value: unknown, errors: ValidationError[]): void {
  if (!isObject(value)) {
    issue(errors, "scope", "invalid_type", "Expected a flat object.");
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    token(key, `scope.${key}`, errors);
    token(item, `scope.${key}`, errors);
  }
}
function metadata(value: unknown, errors: ValidationError[]): void {
  if (!isObject(value)) {
    issue(errors, "metadata", "invalid_type", "Expected a flat object.");
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    const split = key.indexOf(".");
    if (
      split < 1 ||
      split === key.length - 1 ||
      !token(key.slice(0, split), `metadata.${key}`, []) ||
      !token(key.slice(split + 1), `metadata.${key}`, []) ||
      key.startsWith("loredu.")
    )
      issue(
        errors,
        `metadata.${key}`,
        "invalid_value",
        "Metadata keys must be foreign <namespace>.<name> identifiers; 'loredu.' is reserved.",
      );
    const canonical = canonicalizeJsonValue(item, `metadata.${key}`);
    if (!canonical.ok) errors.push(...canonical.errors);
  }
}
function actor(value: unknown, errors: ValidationError[]): void {
  if (!isObject(value)) {
    issue(errors, "actor", "invalid_type", "Expected an actor object.");
    return;
  }
  unknowns(value, ["type", "id"], errors, "actor");
  enumeration(required(value, "type", errors, "actor"), "actor.type", actors, errors);
  token(required(value, "id", errors, "actor"), "actor.id", errors);
}
function sourceRef(value: unknown, path: string, errors: ValidationError[], sourceKey = "ref"): void {
  if (!isObject(value)) {
    issue(errors, path, "invalid_type", "Expected a source object.");
    return;
  }
  const allowed = sourceKey === "ref" ? ["ref", "locator", "snapshot"] : ["source", "snapshot"];
  unknowns(value, allowed, errors, path);
  const ref = required(value, sourceKey, errors, path);
  if (
    string(ref, `${path}.${sourceKey}`, errors) &&
    (ref.length > 1024 || ref.trim() !== ref || ref.length === 0)
  )
    issue(
      errors,
      `${path}.${sourceKey}`,
      "invalid_value",
      "Source references must be trimmed, non-empty, and at most 1024 characters.",
    );
  for (const key of allowed.slice(1))
    if (value[key] !== undefined) string(value[key], `${path}.${key}`, errors);
}
function array(
  value: unknown,
  path: string,
  errors: ValidationError[],
  nonempty = false,
): value is readonly unknown[] {
  if (!Array.isArray(value)) {
    issue(errors, path, "invalid_type", "Expected an array.");
    return false;
  }
  if (nonempty && value.length === 0) issue(errors, path, "invalid_value", "Must contain at least one item.");
  return true;
}
function recordId(value: unknown, path: string, errors: ValidationError[]): void {
  if (typeof value !== "string") issue(errors, path, "invalid_type", "Expected a Loredu record id string.");
  else if (!RECORD_ID.test(value)) issue(errors, path, "invalid_value", "Expected a Loredu record id.");
}
function ids(value: unknown, path: string, errors: ValidationError[], nonempty = false): void {
  if (array(value, path, errors, nonempty))
    value.forEach((item, index) => {
      recordId(item, `${path}[${index}]`, errors);
    });
}

const common = ["kind", "actor", "scope", "metadata"];
const sourceFields = ["sources"];
function validateShape(input: unknown, complete: boolean): ValidationResult<LoreduDraft | LoreduRecord> {
  const errors: ValidationError[] = [];
  if (!isObject(input))
    return { ok: false, errors: [{ path: "", code: "invalid_type", message: "Expected a record object." }] };
  const envelope = complete ? ["schema", "id", "recorded_at"] : [];
  const kind = required(input, "kind", errors);
  enumeration(kind, "kind", kinds, errors);
  actor(required(input, "actor", errors), errors);
  if (input.scope !== undefined) scope(input.scope, errors);
  if (input.metadata !== undefined) metadata(input.metadata, errors);
  if (complete) {
    const schema = required(input, "schema", errors);
    if (schema !== RECORD_SCHEMA_ID)
      issue(
        errors,
        "schema",
        "unsupported_schema",
        `Unsupported record schema '${String(schema)}'; expected '${RECORD_SCHEMA_ID}'.`,
      );
    if (typeof kind === "string") {
      const id = required(input, "id", errors);
      const idResult = validateRecordId(id, kinds.includes(kind as never) ? (kind as RecordKind) : undefined);
      if (!idResult.ok) errors.push(...idResult.errors);
    }
    timestamp(required(input, "recorded_at", errors), "recorded_at", errors);
  }
  const sources = (): void => {
    if (input.sources !== undefined && array(input.sources, "sources", errors))
      input.sources.forEach((item, i) => {
        sourceRef(item, `sources[${i}]`, errors);
      });
  };
  switch (kind) {
    case "entry":
      unknowns(input, [...common, ...envelope, ...sourceFields, "body", "title", "entry_type"], errors);
      string(required(input, "body", errors), "body", errors, true);
      if (input.title !== undefined) string(input.title, "title", errors);
      if (input.entry_type !== undefined) string(input.entry_type, "entry_type", errors);
      sources();
      break;
    case "claim": {
      unknowns(
        input,
        [
          ...common,
          ...envelope,
          ...sourceFields,
          "derived_from",
          "subject",
          "predicate",
          "value",
          "claim_class",
          "perspective",
          "confidence",
          "valid_from",
          "valid_until",
        ],
        errors,
      );
      if (input.derived_from !== undefined) ids(input.derived_from, "derived_from", errors);
      const subject = required(input, "subject", errors);
      if (!isObject(subject)) issue(errors, "subject", "invalid_type", "Expected a subject object.");
      else {
        unknowns(subject, ["type", "id"], errors, "subject");
        token(required(subject, "type", errors, "subject"), "subject.type", errors);
        token(required(subject, "id", errors, "subject"), "subject.id", errors);
      }
      token(required(input, "predicate", errors), "predicate", errors);
      if (!Object.hasOwn(input, "value"))
        issue(errors, "value", "missing_field", "Required field 'value' is missing.");
      else {
        const result = canonicalizeJsonValue(input.value);
        if (!result.ok) errors.push(...result.errors);
      }
      if (input.claim_class !== undefined) string(input.claim_class, "claim_class", errors);
      if (input.perspective !== undefined) token(input.perspective, "perspective", errors);
      enumeration(required(input, "confidence", errors), "confidence", confidences, errors);
      if (input.valid_from !== undefined) timestamp(input.valid_from, "valid_from", errors);
      if (input.valid_until !== undefined) timestamp(input.valid_until, "valid_until", errors);
      sources();
      break;
    }
    case "relation":
      unknowns(input, [...common, ...envelope, ...sourceFields, "from", "to", "relation_type"], errors);
      recordId(required(input, "from", errors), "from", errors);
      recordId(required(input, "to", errors), "to", errors);
      enumeration(required(input, "relation_type", errors), "relation_type", relations, errors);
      sources();
      break;
    case "resolution":
      unknowns(
        input,
        [
          ...common,
          ...envelope,
          ...sourceFields,
          "targets",
          "decision",
          "replacement",
          "effective_at",
          "reason",
        ],
        errors,
      );
      ids(required(input, "targets", errors), "targets", errors, true);
      enumeration(required(input, "decision", errors), "decision", decisions, errors);
      if (input.replacement !== undefined) recordId(input.replacement, "replacement", errors);
      if (input.effective_at !== undefined) timestamp(input.effective_at, "effective_at", errors);
      string(required(input, "reason", errors), "reason", errors, true);
      sources();
      break;
    case "verification":
      unknowns(input, [...common, ...envelope, "targets", "verified_against", "result"], errors);
      ids(required(input, "targets", errors), "targets", errors, true);
      {
        const basis = required(input, "verified_against", errors);
        if (array(basis, "verified_against", errors, true))
          basis.forEach((item, i) => {
            sourceRef(item, `verified_against[${i}]`, errors, "source");
          });
      }
      enumeration(required(input, "result", errors), "result", results, errors);
      break;
    default:
      unknowns(input, [...common, ...envelope], errors);
  }
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: clone(input) as unknown as LoreduDraft | LoreduRecord };
}

export function validateDraft(input: unknown): ValidationResult<LoreduDraft> {
  return validateShape(input, false) as ValidationResult<LoreduDraft>;
}
export function validateRecord(input: unknown): ValidationResult<LoreduRecord> {
  return validateShape(input, true) as ValidationResult<LoreduRecord>;
}
export function validateRecordId(value: unknown, expectedKind?: RecordKind): ValidationResult<string> {
  const errors: ValidationError[] = [];
  if (!string(value, "id", errors) || !RECORD_ID.test(value))
    issue(errors, "id", "invalid_value", "Expected <kind-prefix>_<16 lowercase Crockford base32 symbols>.");
  else if (expectedKind && !value.startsWith(`${RECORD_ID_PREFIX[expectedKind]}_`))
    issue(errors, "id", "invalid_value", `Record id prefix must agree with kind '${expectedKind}'.`);
  return errors.length ? { ok: false, errors } : { ok: true, value: value as string };
}
export function canonicalClaimKey(input: ClaimKeyInput): ValidationResult<ClaimKey> {
  const probe = {
    kind: "claim",
    actor: { type: "system", id: "loredu" },
    confidence: "candidate",
    value: null,
    ...input,
  };
  const result = validateDraft(probe);
  if (!result.ok) return result;
  const key: ClaimKey = {
    scope: Object.entries(input.scope ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    subject: { type: input.subject.type, id: input.subject.id },
    predicate: input.predicate,
    ...(input.perspective === undefined ? {} : { perspective: input.perspective }),
  };
  return { ok: true, value: clone(key) };
}
export function claimKeysEqual(left: ClaimKey, right: ClaimKey): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
