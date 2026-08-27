export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export const RECORD_SCHEMA_ID = "loredu.record/v1" as const;
export type RecordSchemaId = typeof RECORD_SCHEMA_ID;

export type RecordKind = "entry" | "claim" | "relation" | "resolution" | "verification";
export type RecordIdPrefix = "ent" | "clm" | "rel" | "res" | "ver";
export type EntryId = Brand<string, "EntryId">;
export type ClaimId = Brand<string, "ClaimId">;
export type RelationId = Brand<string, "RelationId">;
export type ResolutionId = Brand<string, "ResolutionId">;
export type VerificationId = Brand<string, "VerificationId">;
export type RecordId = EntryId | ClaimId | RelationId | ResolutionId | VerificationId;

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export type ActorType = "human" | "agent" | "program" | "system";
export interface Actor {
  readonly type: ActorType;
  readonly id: string;
}
export type Scope = Readonly<Record<string, string>>;
export type Metadata = Readonly<Record<string, JsonValue>>;
export interface SourceRef {
  readonly ref: string;
  readonly locator?: string;
  readonly snapshot?: string;
}

export interface EntryDraft {
  readonly kind: "entry";
  readonly actor: Actor;
  readonly body: string;
  readonly title?: string;
  readonly entry_type?: string;
  readonly scope?: Scope;
  readonly metadata?: Metadata;
  readonly sources?: readonly SourceRef[];
}

export interface Entry {
  readonly schema: RecordSchemaId;
  readonly kind: "entry";
  readonly id: EntryId;
  readonly recorded_at: string;
  readonly actor: Actor;
  readonly body: string;
  readonly title?: string;
  readonly entry_type?: string;
  readonly scope: Scope;
  readonly metadata: Metadata;
  readonly sources: readonly SourceRef[];
}

/** P0's closed public slice. Later M0 slices add the other settled families. */
export type RecordDraft = EntryDraft;
export type PersistedRecord = Entry;
export type PersistedRecordFor<D extends RecordDraft> = D extends EntryDraft ? Entry : never;
