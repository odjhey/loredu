import { describe, expect, test } from "bun:test";
import {
  type Clock,
  createInstant,
  createLoreduApplication,
  type Instant,
  type Ranker,
  type RecordId,
} from "@loredu/kernel";
import { InMemoryStore, SeededRandomSource } from "@loredu/kernel/testing";

const PREFIX = "loredu.cursor.v1.";
const NOW = createInstant(Date.parse("2026-01-02T03:04:05.000Z"));
const ACTOR = { type: "agent" as const, id: "cursor-parity" };

type Operation = "claims" | "history" | "status" | "current" | "lore";
type CursorPayload = Record<string, unknown> & {
  operation: Operation;
  query: Record<string, unknown>;
  basis: { query: Record<string, unknown> };
};

class CountingClock implements Clock {
  calls = 0;
  now(): Instant {
    this.calls++;
    return NOW;
  }
}

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("expected test value to be present");
  return value;
}

function decode(token: string): CursorPayload {
  return JSON.parse(Buffer.from(token.slice(PREFIX.length), "base64url").toString("utf8")) as CursorPayload;
}

function encode(value: unknown): string {
  return `${PREFIX}${Buffer.from(JSON.stringify(value)).toString("base64url")}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function fixture() {
  const store = new InMemoryStore();
  const clock = new CountingClock();
  let rankCalls = 0;
  const ranker: Ranker = {
    id: "test.cursor-parity",
    version: "1",
    rank(context) {
      rankCalls++;
      return context.candidates.map(({ index }) => index);
    },
  };
  const application = createLoreduApplication({
    store,
    clock,
    randomSource: new SeededRandomSource(71),
    ranker,
  });
  const addClaim = async (subject: string, value: string) =>
    application.add({
      kind: "claim" as const,
      actor: ACTOR,
      scope: { repo: "loredu" },
      subject: { type: "component", id: subject },
      predicate: "cursor-parity",
      value,
      confidence: "confirmed" as const,
    });
  const first = await addClaim("one", "A");
  await addClaim("one", "B");
  await addClaim("two", "C");
  await addClaim("two", "D");
  await application.add({
    kind: "verification",
    actor: ACTOR,
    targets: [first.result.id],
    verified_against: [{ ref: "test", snapshot: "v1" }],
    result: "confirmed",
  });

  const claims = must((await application.claims({ limit: 1 })).page.cursor);
  const history = must(
    (await application.history({ id: first.result.id as RecordId, limit: 1 })).page.cursor,
  );
  const status = must((await application.status({ limit: 1 })).page.cursor);
  const current = must((await application.current({ limit: 1 })).page.cursor);
  const loreResponse = await application.lore({ activity: "cursor-parity", max_items: 1 });
  const lore = must(
    must(loreResponse.result.packet.sections.find(({ name }) => name === "conflicts")).page.cursor,
  );
  return {
    application,
    clock,
    rankCalls: () => rankCalls,
    cursors: { claims, history, status, current, lore } satisfies Record<Operation, string>,
  };
}

function receiver(
  application: Awaited<ReturnType<typeof fixture>>["application"],
  operation: Operation,
  cursor: string,
): Promise<unknown> {
  if (operation === "claims") return application.claims({ cursor });
  if (operation === "history") return application.history({ cursor });
  if (operation === "status") return application.status({ cursor });
  if (operation === "current") return application.current({ cursor });
  return application.lore({ cursor });
}

const OPERATIONS: readonly Operation[] = ["claims", "history", "status", "current", "lore"];

describe("shared cursor transport and declared-schema parity", () => {
  test("every genuine operation cursor mismatches every other endpoint after full schema validation", async () => {
    const { application, clock, rankCalls, cursors } = await fixture();
    const clockBefore = clock.calls;
    const rankBefore = rankCalls();
    for (const source of OPERATIONS) {
      for (const target of OPERATIONS) {
        if (source === target) continue;
        await expect(receiver(application, target, cursors[source])).rejects.toMatchObject({
          code: "CURSOR_MISMATCH",
        });
      }
    }
    expect(clock.calls).toBe(clockBefore);
    expect(rankCalls()).toBe(rankBefore);
  });

  test("malformed declared-operation schemas are invalid at every endpoint", async () => {
    const { application, clock, rankCalls, cursors } = await fixture();
    const malformed: Record<Operation, string> = {
      claims: encode(
        (() => {
          const value = clone(decode(cursors.claims));
          delete value.query.filters;
          delete value.basis.query.filters;
          return value;
        })(),
      ),
      history: encode(
        (() => {
          const value = clone(decode(cursors.history));
          delete value.query.id;
          delete value.basis.query.id;
          return value;
        })(),
      ),
      status: encode(
        (() => {
          const value = clone(decode(cursors.status));
          value.query.excess = true;
          value.basis.query.excess = true;
          return value;
        })(),
      ),
      current: encode(
        (() => {
          const value = clone(decode(cursors.current));
          delete value.computed_at;
          return value;
        })(),
      ),
      lore: encode(
        (() => {
          const value = clone(decode(cursors.lore));
          delete value.query.activity;
          delete value.basis.query.activity;
          return value;
        })(),
      ),
    };
    const clockBefore = clock.calls;
    const rankBefore = rankCalls();
    for (const source of OPERATIONS)
      for (const target of OPERATIONS)
        await expect(receiver(application, target, malformed[source])).rejects.toMatchObject({
          code: "INVALID_CURSOR",
        });
    expect(clock.calls).toBe(clockBefore);
    expect(rankCalls()).toBe(rankBefore);
  });

  test("transport, discriminator, version, and top-level shape failures stay invalid everywhere", async () => {
    const { application, clock, rankCalls, cursors } = await fixture();
    const arbitraryOperation = clone(decode(cursors.claims));
    arbitraryOperation.operation = "arbitrary" as Operation;
    const wrongVersion = clone(decode(cursors.claims));
    wrongVersion.version = 2;
    const missing = clone(decode(cursors.claims));
    Reflect.deleteProperty(missing, "basis");
    const excess = clone(decode(cursors.claims));
    excess.excess = true;
    const malformed = [
      encode(arbitraryOperation),
      encode(wrongVersion),
      encode([]),
      `${PREFIX}*`,
      `${PREFIX}${Buffer.from([0xff]).toString("base64url")}`,
      `${PREFIX}${Buffer.from("{").toString("base64url")}`,
      encode(missing),
      encode(excess),
    ];
    const clockBefore = clock.calls;
    const rankBefore = rankCalls();
    for (const cursor of malformed)
      for (const target of OPERATIONS)
        await expect(receiver(application, target, cursor)).rejects.toMatchObject({
          code: "INVALID_CURSOR",
        });
    expect(clock.calls).toBe(clockBefore);
    expect(rankCalls()).toBe(rankBefore);
  });
});
