import { assertDenseDataArray, enumerableOwnDataKeys } from "./own-properties";
import { RecordValidationError } from "./validation-error";

export type JsonPrimitive = null | boolean | number | string;
export type JsonArray = readonly JsonValue[];
export type JsonObject = Readonly<{ [key: string]: JsonValue }>;
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function propertyPath(path: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

/** Validate, deeply copy, key-sort, and freeze one structural JSON value. */
export function canonicalizeJsonValue(value: unknown, field = "value"): JsonValue {
  return canonicalize(value, field, new WeakSet<object>());
}

function canonicalize(value: unknown, path: string, ancestors: WeakSet<object>): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RecordValidationError(path, "must be a finite JSON number");
    }
    return value;
  }

  if (typeof value !== "object") {
    throw new RecordValidationError(path, "must be a JSON value");
  }

  if (ancestors.has(value)) {
    throw new RecordValidationError(path, "must not contain a circular reference");
  }
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      assertDenseDataArray(value, path);
      const result: JsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        result.push(canonicalize(value[index], `${path}[${index}]`, ancestors));
      }
      return Object.freeze(result);
    }

    if (!isPlainObject(value)) {
      throw new RecordValidationError(path, "must be a plain JSON object");
    }

    const result: Record<string, JsonValue> = {};
    for (const key of enumerableOwnDataKeys(value, path).sort()) {
      Object.defineProperty(result, key, {
        value: canonicalize((value as Record<string, unknown>)[key], propertyPath(path, key), ancestors),
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(result);
  } finally {
    ancestors.delete(value);
  }
}

function canonicalJsonEqual(left: JsonValue, right: JsonValue): boolean {
  if (left === right) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => canonicalJsonEqual(value, right[index] as JsonValue));
  }

  const leftObject = left as JsonObject;
  const rightObject = right as JsonObject;
  const leftKeys = Object.keys(leftObject);
  const rightKeys = Object.keys(rightObject);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        canonicalJsonEqual(leftObject[key] as JsonValue, rightObject[key] as JsonValue),
    )
  );
}

/** Structural, type-preserving equality for JSON values. Invalid values fail loudly. */
export function jsonValuesEqual(left: unknown, right: unknown): boolean {
  return canonicalJsonEqual(canonicalizeJsonValue(left, "left"), canonicalizeJsonValue(right, "right"));
}
