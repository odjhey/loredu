import { expect, test } from "bun:test";
import type { Entry, EntryDraft, LoreduDraft, LoreduRecord } from "../packages/kernel/src/index";

function compileTimeBoundaries(draft: EntryDraft, record: Entry): void {
  // @ts-expect-error drafts never expose kernel-owned identity
  draft.id;
  // @ts-expect-error drafts never expose kernel-owned history time
  draft.recorded_at;
  // @ts-expect-error drafts never expose the persisted schema identity
  draft.schema;
  // @ts-expect-error persisted records are immutable
  record.body = "changed";
  // @ts-expect-error nested persisted values are immutable
  record.actor.id = "changed";
  // @ts-expect-error a persisted record is not assignable to a draft through an exact constructor
  const invalidDraft: EntryDraft = { ...record, id: record.id };
  void invalidDraft;
}

void compileTimeBoundaries;

test("draft and record unions remain discriminated", () => {
  const draftKind: LoreduDraft["kind"] = "verification";
  const recordKind: LoreduRecord["kind"] = "resolution";
  expect([draftKind, recordKind]).toEqual(["verification", "resolution"]);
});
