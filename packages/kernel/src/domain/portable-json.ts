import type { LoreduIssue, LoreduIssueCode } from "../errors";
import type { JsonObject, JsonValue } from "./entry";

export type DescriptorMap = Readonly<Record<string, PropertyDescriptor>>;

export function makeIssue(code: LoreduIssueCode, path: string, message: string): LoreduIssue {
  return Object.freeze({ code, path, message });
}
export function escapePointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
export function scalarLength(value: string): number {
  return [...value].length;
}
export function compareUnicodeScalars(left: string, right: string): number {
  const leftScalars = [...left];
  const rightScalars = [...right];
  const length = Math.min(leftScalars.length, rightScalars.length);
  for (let index = 0; index < length; index++) {
    const difference = (leftScalars[index]?.codePointAt(0) ?? 0) - (rightScalars[index]?.codePointAt(0) ?? 0);
    if (difference !== 0) return difference;
  }
  return leftScalars.length - rightScalars.length;
}
export function isScalarText(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
export function inspectObject(
  value: unknown,
  path: string,
  issues: LoreduIssue[],
): DescriptorMap | undefined {
  if (typeof value !== "object" || value === null) {
    issues.push(makeIssue("TYPE", path, "must be a plain object"));
    return undefined;
  }
  try {
    if (Array.isArray(value)) {
      issues.push(makeIssue("TYPE", path, "must be a plain object"));
      return undefined;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      issues.push(makeIssue("TYPE", path, "must have Object.prototype or null prototype"));
    if (Object.getOwnPropertySymbols(value).length > 0)
      issues.push(makeIssue("UNKNOWN_FIELD", path, "must not have symbol fields"));
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!("value" in descriptor) || !descriptor.enumerable)
        issues.push(
          makeIssue("TYPE", `${path}/${escapePointer(key)}`, "must be an enumerable own data property"),
        );
    }
    return descriptors;
  } catch {
    issues.push(makeIssue("TYPE", path, "could not be inspected as plain data"));
    return undefined;
  }
}
export function hasData(data: DescriptorMap, key: string): boolean {
  const descriptor = Object.hasOwn(data, key) ? data[key] : undefined;
  return descriptor !== undefined && "value" in descriptor && descriptor.enumerable === true;
}
export function hasOwnDescriptor(data: DescriptorMap, key: string): boolean {
  return Object.hasOwn(data, key);
}
export function dataValue(data: DescriptorMap, key: string): unknown {
  const descriptor = Object.hasOwn(data, key) ? data[key] : undefined;
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
export function inspectArray(
  value: unknown,
  path: string,
  issues: LoreduIssue[],
): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(value)) {
      issues.push(makeIssue("TYPE", path, "must be an array"));
      return undefined;
    }
    if (Object.getPrototypeOf(value) !== Array.prototype)
      issues.push(makeIssue("TYPE", path, "must have Array.prototype"));
    if (Object.getOwnPropertySymbols(value).length > 0)
      issues.push(makeIssue("UNKNOWN_FIELD", path, "must not have symbol fields"));
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, "length");
    const rawLength = lengthDescriptor && "value" in lengthDescriptor ? lengthDescriptor.value : -1;
    if (typeof rawLength !== "number" || !Number.isSafeInteger(rawLength) || rawLength < 0) {
      issues.push(makeIssue("TYPE", path, "must have a valid array length"));
      return undefined;
    }
    const length = rawLength;
    const result: unknown[] = [];
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (key === "length") continue;
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key)
        issues.push(
          makeIssue("UNKNOWN_FIELD", `${path}/${escapePointer(key)}`, "is an array extra property"),
        );
      else if (!("value" in descriptor) || !descriptor.enumerable)
        issues.push(makeIssue("TYPE", `${path}/${key}`, "must be an enumerable own data element"));
      else result[index] = descriptor.value;
    }
    for (let index = 0; index < length; index++) {
      if (!Object.hasOwn(descriptors, String(index)))
        issues.push(makeIssue("REQUIRED", `${path}/${index}`, "array must be dense"));
    }
    result.length = length;
    return result;
  } catch {
    issues.push(makeIssue("TYPE", path, "could not be inspected as plain array data"));
    return undefined;
  }
}
function defineFrozenData(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: false,
    writable: false,
  });
}
export function copyPortableJson(
  value: unknown,
  path: string,
  issues: LoreduIssue[],
  ancestors = new Set<object>(),
): JsonValue | undefined {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (isScalarText(value)) return value;
    issues.push(makeIssue("FORMAT", path, "must contain only Unicode scalar values"));
    return undefined;
  }
  if (typeof value === "number") {
    if (Number.isFinite(value) && !Object.is(value, -0)) return value;
    issues.push(makeIssue("FORMAT", path, "must be a finite JSON number other than -0"));
    return undefined;
  }
  if (typeof value !== "object" || value === null) {
    issues.push(makeIssue("TYPE", path, "must be portable JSON data"));
    return undefined;
  }
  if (ancestors.has(value)) {
    issues.push(makeIssue("FORMAT", path, "must be acyclic JSON data"));
    return undefined;
  }
  ancestors.add(value);
  let isArray: boolean;
  try {
    isArray = Array.isArray(value);
  } catch {
    issues.push(makeIssue("TYPE", path, "could not be inspected as plain JSON data"));
    ancestors.delete(value);
    return undefined;
  }
  if (isArray) {
    const input = inspectArray(value, path, issues);
    const output: JsonValue[] = [];
    if (input) {
      for (let index = 0; index < input.length; index++) {
        const copied = copyPortableJson(input[index], `${path}/${index}`, issues, ancestors);
        if (copied !== undefined) output[index] = copied;
      }
      output.length = input.length;
    }
    ancestors.delete(value);
    return Object.freeze(output);
  }
  const data = inspectObject(value, path, issues);
  const output = Object.create(null) as Record<string, JsonValue>;
  if (data) {
    for (const key of Object.keys(data).sort(compareUnicodeScalars)) {
      if (!isScalarText(key))
        issues.push(
          makeIssue("FORMAT", `${path}/${escapePointer(key)}`, "property name must contain Unicode scalars"),
        );
      const copied = copyPortableJson(
        dataValue(data, key),
        `${path}/${escapePointer(key)}`,
        issues,
        ancestors,
      );
      if (copied !== undefined) defineFrozenData(output, key, copied);
    }
  }
  ancestors.delete(value);
  return Object.freeze(output);
}
export function copyJsonObject(value: unknown, path: string, issues: LoreduIssue[]): JsonObject | undefined {
  const copied = copyPortableJson(value, path, issues);
  if (copied === null || Array.isArray(copied) || typeof copied !== "object") {
    if (copied !== undefined) issues.push(makeIssue("TYPE", path, "must be a JSON object"));
    return undefined;
  }
  return copied as JsonObject;
}

export function jsonValuesEqual(left: JsonValue, right: JsonValue): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (typeof left !== "object" || typeof right !== "object") return false;
  const leftArray = Array.isArray(left);
  if (leftArray !== Array.isArray(right)) return false;
  if (leftArray) {
    const leftValues = left as readonly JsonValue[];
    const rightValues = right as readonly JsonValue[];
    return (
      leftValues.length === rightValues.length &&
      leftValues.every((value, index) => jsonValuesEqual(value, rightValues[index] as JsonValue))
    );
  }
  const leftObject = left as JsonObject;
  const rightObject = right as JsonObject;
  const leftKeys = Object.keys(leftObject).sort(compareUnicodeScalars);
  const rightKeys = Object.keys(rightObject).sort(compareUnicodeScalars);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        jsonValuesEqual(leftObject[key] as JsonValue, rightObject[key] as JsonValue),
    )
  );
}
