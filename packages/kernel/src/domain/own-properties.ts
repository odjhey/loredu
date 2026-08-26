import { RecordValidationError } from "./validation-error";

function nestedField(field: string, key: string): string {
  return field === "record" ? key : `${field}.${key}`;
}

function descriptorOf(object: object, key: PropertyKey, field: string): PropertyDescriptor {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor === undefined) {
    throw new RecordValidationError(field, "could not inspect an own property");
  }
  return descriptor;
}

function assertDataDescriptor(descriptor: PropertyDescriptor, field: string): void {
  if (!("value" in descriptor)) {
    throw new RecordValidationError(field, "must be an own data property, not an accessor");
  }
}

/** Reject symbol keys and accessors before a discriminator or schema field is read. */
export function assertOwnDataProperties(object: object, field: string): void {
  for (const key of Reflect.ownKeys(object)) {
    if (typeof key === "symbol") {
      throw new RecordValidationError(field, "must not contain symbol-keyed fields");
    }
    assertDataDescriptor(descriptorOf(object, key, nestedField(field, key)), nestedField(field, key));
  }
}

/** Enforce one exact fixed-field object boundary, including hidden own fields. */
export function assertExactOwnDataProperties(
  object: object,
  allowed: readonly string[],
  field: string,
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Reflect.ownKeys(object)) {
    if (typeof key === "symbol") {
      throw new RecordValidationError(field, "must not contain symbol-keyed fields");
    }
    const path = nestedField(field, key);
    if (!allowedKeys.has(key)) {
      throw new RecordValidationError(path, "is not a recognized field");
    }
    assertDataDescriptor(descriptorOf(object, key, path), path);
  }
}

/** Return dynamic map/JSON keys after proving none are hidden, symbolic, or accessors. */
export function enumerableOwnDataKeys(object: object, field: string): string[] {
  const keys: string[] = [];
  for (const key of Reflect.ownKeys(object)) {
    if (typeof key === "symbol") {
      throw new RecordValidationError(field, "must not contain symbol-keyed fields");
    }
    const path = nestedField(field, key);
    const descriptor = descriptorOf(object, key, path);
    assertDataDescriptor(descriptor, path);
    if (!descriptor.enumerable) {
      throw new RecordValidationError(path, "must be an enumerable data property");
    }
    keys.push(key);
  }
  return keys;
}

function arrayIndexOf(key: string, length: number): number | undefined {
  if (!/^(0|[1-9][0-9]*)$/.test(key)) return undefined;
  const index = Number(key);
  if (!Number.isSafeInteger(index) || index >= length || index >= 0xffff_ffff) return undefined;
  return index;
}

/** Allow only `length` and dense own data indices on a contract collection. */
export function assertDenseDataArray(value: unknown, field: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new RecordValidationError(field, "must be an array");
  }

  const lengthPath = `${field}.length`;
  const lengthDescriptor = descriptorOf(value, "length", lengthPath);
  assertDataDescriptor(lengthDescriptor, lengthPath);
  const length = lengthDescriptor.value as number;
  const seen = new Set<number>();
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") {
      throw new RecordValidationError(field, "must not contain symbol-keyed properties");
    }
    if (key === "length") continue;
    const index = arrayIndexOf(key, length);
    if (index === undefined) {
      throw new RecordValidationError(`${field}.${key}`, "is an unsupported array property");
    }
    const path = `${field}[${index}]`;
    assertDataDescriptor(descriptorOf(value, key, path), path);
    seen.add(index);
  }

  for (let index = 0; index < length; index += 1) {
    if (!seen.has(index)) {
      throw new RecordValidationError(`${field}[${index}]`, "must not be a sparse array element");
    }
  }
}

/** Copy validated own index values without dispatching through the caller's prototype. */
export function copyDenseDataArray(value: unknown, field: string): unknown[] {
  assertDenseDataArray(value, field);
  const length = descriptorOf(value, "length", `${field}.length`).value as number;
  const copy: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    copy[index] = descriptorOf(value, String(index), `${field}[${index}]`).value;
  }
  return copy;
}
