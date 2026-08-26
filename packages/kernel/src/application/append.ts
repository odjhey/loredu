import { RECORD_ID_ENTROPY_BYTES, type RecordId, recordIdFromBytes } from "../domain/record-id";
import { RECORD_SCHEMA_ID } from "../domain/record-kind";
import {
  type PersistedRecord,
  parsePersistedRecord,
  parseRecordDraft,
  type RecordDraft,
} from "../domain/records";
import { RecordValidationError } from "../domain/validation-error";
import type { Clock, RandomSource } from "../ports/capabilities";
import type { RecordStore, StreamPosition } from "../ports/record-store";

export interface ApplicationCapabilities {
  readonly store: RecordStore;
  readonly clock: Clock;
  readonly random: RandomSource;
}

export interface AppendRecordResult {
  readonly record: PersistedRecord;
  readonly ref: Readonly<{ id: RecordId; kind: PersistedRecord["kind"] }>;
  readonly position: StreamPosition;
}

async function requireReference(store: RecordStore, id: string, field: string): Promise<void> {
  if ((await store.get(id)) === undefined) {
    throw new RecordValidationError(field, `referenced record ${JSON.stringify(id)} does not exist`);
  }
}

async function checkReferences(draft: RecordDraft, store: RecordStore): Promise<void> {
  switch (draft.kind) {
    case "entry":
      return;
    case "claim":
      for (let i = 0; i < (draft.derived_from?.length ?? 0); i += 1)
        await requireReference(store, draft.derived_from?.[i] as string, `derived_from[${i}]`);
      return;
    case "relation":
      await requireReference(store, draft.from.id, "from.id");
      await requireReference(store, draft.to.id, "to.id");
      return;
    case "resolution":
      for (let i = 0; i < draft.targets.length; i += 1)
        await requireReference(store, draft.targets[i] as string, `targets[${i}]`);
      if (draft.replacement !== undefined) await requireReference(store, draft.replacement, "replacement");
      return;
    case "verification":
      for (let i = 0; i < draft.targets.length; i += 1)
        await requireReference(store, draft.targets[i] as string, `targets[${i}]`);
  }
}

/** Validate, check references, stamp exactly once, and commit one canonical record. */
export async function appendRecord(
  input: unknown,
  capabilities: ApplicationCapabilities,
): Promise<AppendRecordResult> {
  const draft = parseRecordDraft(input);
  await checkReferences(draft, capabilities.store);

  const bytes = capabilities.random.nextBytes(RECORD_ID_ENTROPY_BYTES);
  const id = recordIdFromBytes(draft.kind, bytes);
  const recordedAt = capabilities.clock.now();
  const record = parsePersistedRecord({
    ...draft,
    schema: RECORD_SCHEMA_ID,
    id,
    recorded_at: recordedAt,
    scope: draft.scope ?? {},
    metadata: draft.metadata ?? {},
    sources: draft.sources ?? [],
    ...(draft.kind === "claim" ? { derived_from: draft.derived_from ?? [] } : {}),
  });
  const position = await capabilities.store.append(record);
  return Object.freeze({ record, ref: Object.freeze({ id: record.id, kind: record.kind }), position });
}

export interface LoreduApplication {
  append(draft: unknown): Promise<AppendRecordResult>;
  get(id: RecordId | string): Promise<PersistedRecord | undefined>;
  stream(afterPosition?: StreamPosition): ReturnType<RecordStore["stream"]>;
  head(): Promise<StreamPosition>;
}

export function createApplication(capabilities: ApplicationCapabilities): LoreduApplication {
  return Object.freeze({
    append: (draft: unknown) => appendRecord(draft, capabilities),
    get: (id: RecordId | string) => capabilities.store.get(id),
    stream: (afterPosition?: StreamPosition) => capabilities.store.stream(afterPosition),
    head: () => capabilities.store.head(),
  });
}
