function fail(message: string): never {
  throw new SyntaxError(message);
}

class JsonParser {
  #index = 0;

  constructor(readonly source: string) {}

  parse(): unknown {
    const value = this.#value();
    this.#whitespace();
    if (this.#index !== this.source.length) fail("unexpected trailing JSON input");
    return value;
  }

  #value(): unknown {
    this.#whitespace();
    const token = this.source[this.#index];
    if (token === '"') return this.#string();
    if (token === "{") return this.#object();
    if (token === "[") return this.#array();
    if (token === "t") return this.#literal("true", true);
    if (token === "f") return this.#literal("false", false);
    if (token === "n") return this.#literal("null", null);
    return this.#number();
  }

  #object(): Readonly<Record<string, unknown>> {
    this.#index++;
    const result = Object.create(null) as Record<string, unknown>;
    const keys = new Set<string>();
    this.#whitespace();
    if (this.source[this.#index] === "}") {
      this.#index++;
      return result;
    }
    for (;;) {
      this.#whitespace();
      if (this.source[this.#index] !== '"') fail("JSON object key must be a string");
      const key = this.#string();
      if (keys.has(key)) fail(`duplicate JSON object key: ${key}`);
      keys.add(key);
      this.#whitespace();
      if (this.source[this.#index] !== ":") fail("JSON object key must be followed by a colon");
      this.#index++;
      Object.defineProperty(result, key, {
        value: this.#value(),
        enumerable: true,
        configurable: true,
        writable: true,
      });
      this.#whitespace();
      const separator = this.source[this.#index++];
      if (separator === "}") return result;
      if (separator !== ",") fail("JSON object fields must be comma-separated");
    }
  }

  #array(): readonly unknown[] {
    this.#index++;
    const result: unknown[] = [];
    this.#whitespace();
    if (this.source[this.#index] === "]") {
      this.#index++;
      return result;
    }
    for (;;) {
      result.push(this.#value());
      this.#whitespace();
      const separator = this.source[this.#index++];
      if (separator === "]") return result;
      if (separator !== ",") fail("JSON array elements must be comma-separated");
    }
  }

  #string(): string {
    const start = this.#index++;
    let escaped = false;
    while (this.#index < this.source.length) {
      const character = this.source[this.#index++];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') {
        return JSON.parse(this.source.slice(start, this.#index)) as string;
      }
    }
    return fail("unterminated JSON string");
  }

  #number(): number {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.source.slice(this.#index));
    if (!match) fail("expected a JSON value");
    this.#index += match[0].length;
    return JSON.parse(match[0]) as number;
  }

  #literal<T>(spelling: string, value: T): T {
    if (!this.source.startsWith(spelling, this.#index)) fail("invalid JSON literal");
    this.#index += spelling.length;
    return value;
  }

  #whitespace(): void {
    while (
      this.source[this.#index] === " " ||
      this.source[this.#index] === "\t" ||
      this.source[this.#index] === "\n" ||
      this.source[this.#index] === "\r"
    ) {
      this.#index++;
    }
  }
}

/** Parse JSON while rejecting duplicate object keys at every nesting level. */
export function parseStrictJson(source: string): unknown {
  return new JsonParser(source).parse();
}
