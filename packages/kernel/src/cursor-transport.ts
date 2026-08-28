import { LoreduError } from "./errors";

const CURSOR_PREFIX = "loredu.cursor.v1.";
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export type CursorOperation = "claims" | "history" | "status" | "current" | "lore";
export type CursorTransportPayload = Record<string, unknown> & {
  readonly version: 1;
  readonly operation: CursorOperation;
};

function cursorInvalid(message = "Cursor is invalid"): never {
  throw new LoreduError("INVALID_CURSOR", message);
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

export function encodeCursorTransport(payload: object): string {
  return `${CURSOR_PREFIX}${base64Encode(encodeUtf8(JSON.stringify(payload)))}`;
}

export function decodeCursorTransport(token: string): CursorTransportPayload {
  try {
    if (!token.startsWith(CURSOR_PREFIX)) cursorInvalid();
    const parsed = JSON.parse(decodeUtf8(base64Decode(token.slice(CURSOR_PREFIX.length)))) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) cursorInvalid();
    const payload = parsed as Record<string, unknown>;
    if (payload.version !== 1) cursorInvalid();
    if (
      payload.operation !== "claims" &&
      payload.operation !== "history" &&
      payload.operation !== "status" &&
      payload.operation !== "current" &&
      payload.operation !== "lore"
    )
      cursorInvalid();
    return payload as CursorTransportPayload;
  } catch (error) {
    if (error instanceof LoreduError && error.code === "INVALID_CURSOR") throw error;
    cursorInvalid();
  }
}
