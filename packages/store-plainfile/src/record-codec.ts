import {
  decodePersistedRecord,
  encodePersistedRecord,
  LoreduError,
  type PersistedRecord,
  type RecordKind,
} from "@loredu/kernel";
import { parseStrictJson } from "./strict-json";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const COMMON_FIELDS = [
  "schema",
  "kind",
  "id",
  "recorded_at",
  "actor",
  "scope",
  "metadata",
  "sources",
] as const;

const FAMILY_FIELDS: Readonly<Record<RecordKind, readonly string[]>> = {
  entry: ["title", "entry_type"],
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

function corrupt(message: string, issues: LoreduError["issues"] = []): LoreduError {
  return new LoreduError("STORE_CORRUPT", message, issues);
}

type JsonShape =
  | "dynamic"
  | { readonly kind: "object"; readonly keys: readonly string[] }
  | { readonly kind: "array"; readonly items: JsonShape };

const ACTOR_SHAPE = { kind: "object", keys: ["type", "id"] } as const satisfies JsonShape;
const SUBJECT_SHAPE = { kind: "object", keys: ["type", "id"] } as const satisfies JsonShape;
const SOURCE_SHAPE = {
  kind: "object",
  keys: ["ref", "locator", "snapshot"],
} as const satisfies JsonShape;
const SOURCE_LIST_SHAPE = { kind: "array", items: SOURCE_SHAPE } as const satisfies JsonShape;
const FIELD_SHAPES: Readonly<Record<string, JsonShape>> = {
  actor: ACTOR_SHAPE,
  subject: SUBJECT_SHAPE,
  sources: SOURCE_LIST_SHAPE,
  verified_against: SOURCE_LIST_SHAPE,
};

function compareUnicodeScalars(left: string, right: string): number {
  const leftScalars = [...left];
  const rightScalars = [...right];
  const length = Math.min(leftScalars.length, rightScalars.length);
  for (let index = 0; index < length; index++) {
    const difference =
      (leftScalars[index]?.codePointAt(0) ?? 0) - (rightScalars[index]?.codePointAt(0) ?? 0);
    if (difference !== 0) return difference;
  }
  return leftScalars.length - rightScalars.length;
}

function canonicalJson(value: unknown, shape: JsonShape = "dynamic"): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw corrupt("field contains a non-JSON value");
    return encoded;
  }

  if (Array.isArray(value)) {
    const itemShape = shape !== "dynamic" && shape.kind === "array" ? shape.items : "dynamic";
    return `[${value.map((item) => canonicalJson(item, itemShape)).join(",")}]`;
  }

  const object = value as Readonly<Record<string, unknown>>;
  let keys: readonly string[];
  if (shape !== "dynamic" && shape.kind === "object") {
    const unknown = Object.keys(object).find((key) => !shape.keys.includes(key));
    if (unknown !== undefined) throw corrupt(`fixed-shape field has unknown key: ${unknown}`);
    keys = shape.keys.filter((key) => Object.hasOwn(object, key));
  } else {
    keys = Object.keys(object).sort(compareUnicodeScalars);
  }
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

function jsonLine(field: string, value: unknown): string {
  return `${field}: ${canonicalJson(value, FIELD_SHAPES[field])}\n`;
}

/** Encode one canonical strict-YAML/frontmatter Markdown record file. */
export function encodePlainFileRecord(record: PersistedRecord): Uint8Array {
  const canonical = decodePersistedRecord(record);
  const data = encodePersistedRecord(canonical) as Readonly<Record<string, unknown>>;
  let text = "---\n";
  for (const field of [...COMMON_FIELDS, ...FAMILY_FIELDS[canonical.kind]]) {
    if (Object.hasOwn(data, field)) text += jsonLine(field, data[field]);
  }
  text += "---\n";
  if (canonical.kind === "entry") text += canonical.body;
  return encoder.encode(text);
}

/** Decode the exact JSON-valued YAML subset accepted by plain-file v1. */
export function decodePlainFileRecord(bytes: Uint8Array): PersistedRecord {
  try {
    if (!(bytes instanceof Uint8Array)) throw corrupt("record file must be bytes");
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
      throw corrupt("record file must not have a UTF-8 BOM");
    const text = decoder.decode(bytes);
    if (!text.startsWith("---\n")) throw corrupt("record file must start with an LF frontmatter delimiter");
    const closing = text.indexOf("\n---\n", 4);
    if (closing < 0) throw corrupt("record file is missing its LF closing delimiter");
    const header = text.slice(4, closing);
    if (header.length === 0 || header.includes("\r"))
      throw corrupt("frontmatter must use nonempty LF-only header lines");

    const fields = Object.create(null) as Record<string, unknown>;
    for (const line of header.split("\n")) {
      const match = /^([a-z][a-z0-9_]*): (.+)$/u.exec(line);
      if (!match) throw corrupt("frontmatter lines must be <field>: <JSON value>");
      const field = match[1] as string;
      if (Object.hasOwn(fields, field)) throw corrupt(`duplicate frontmatter field: ${field}`);
      Object.defineProperty(fields, field, {
        value: parseStrictJson(match[2] as string),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }

    if (Object.hasOwn(fields, "body")) throw corrupt("body is not a frontmatter field");
    const body = text.slice(closing + 5);
    if (fields.kind === "entry") {
      Object.defineProperty(fields, "body", {
        value: body,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    } else if (body.length !== 0) {
      throw corrupt("structured record Markdown body must be empty");
    }

    try {
      return decodePersistedRecord(fields);
    } catch (error) {
      if (error instanceof LoreduError)
        throw corrupt("record frontmatter does not decode as a persisted record", error.issues);
      throw error;
    }
  } catch (error) {
    if (error instanceof LoreduError && error.code === "STORE_CORRUPT") throw error;
    throw corrupt("record file is not valid strict plain-file v1 data");
  }
}
