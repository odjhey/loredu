import type { RecordHandle } from "./application-types";
import { claimKeyOf, claimKeysEqual } from "./domain/claim-key";
import type { Claim, ClaimId, ClaimKey, JsonObject, Relation, Resolution, SourceRef } from "./domain/entry";
import {
  compareUnicodeScalars,
  copyJsonObject,
  dataValue,
  escapePointer,
  hasOwnDescriptor,
  inspectObject,
  isScalarText,
  jsonValuesEqual,
  makeIssue,
  scalarLength,
} from "./domain/portable-json";
import { decodePersistedRecord } from "./domain/records";
import { LoreduError, type LoreduIssue } from "./errors";
import type { PositionedRecord, StreamPosition } from "./ports/capabilities";
import type { ClaimSemantics, ValidatedClaimPolicy } from "./ports/claim-policy";

const TOKEN = /^[a-z0-9](?:[a-z0-9._:/-]*[a-z0-9])?$/;
const CLAIM_ID = /^clm_[0-9abcdefghjkmnpqrstvwxyz]{16}$/;
const ADVICE_LIMIT = 200;

export type DerivedRelationType =
  | "duplicate"
  | "corroboration"
  | "support"
  | "conflict"
  | "coexistence"
  | "temporal-succession";
export interface DerivedRelation {
  readonly relation: DerivedRelationType;
  readonly from: RecordHandle;
  readonly to: RecordHandle;
}
export type CurrentKnowledgeState = "preferred" | "coexisting" | "disputed" | "retracted";

export interface PositionedClaim {
  readonly position: StreamPosition;
  readonly record: Claim;
}
export interface PositionedRelation {
  readonly position: StreamPosition;
  readonly record: Relation;
}
export interface PositionedResolution {
  readonly position: StreamPosition;
  readonly record: Resolution;
}
export interface ClaimPolicyAdviceContext {
  readonly query: JsonObject;
  readonly claims: readonly PositionedClaim[];
  readonly relations: readonly PositionedRelation[];
  readonly resolutions: readonly PositionedResolution[];
}
export interface PolicyAdvisoryDraft {
  readonly code: string;
  readonly claims: readonly [ClaimId] | readonly [ClaimId, ClaimId];
  readonly details: JsonObject;
}
export interface PolicyAdvisory {
  readonly kind: "policy-advisory";
  readonly code: string;
  readonly policy: { readonly id: string; readonly version: string };
  readonly claims: readonly [RecordHandle] | readonly [RecordHandle, RecordHandle];
  readonly details: JsonObject;
}

/** Internal pair carrying positioned Claims; rendered public projections add handles later. */
export interface ClassifiedClaimPair {
  readonly relation: DerivedRelationType;
  readonly from: PositionedClaim;
  readonly to: PositionedClaim;
}

export interface ReconciledClaimGroup {
  readonly key: ClaimKey;
  readonly semantics: ClaimSemantics;
  readonly state: CurrentKnowledgeState;
  readonly claims: readonly PositionedClaim[];
  readonly values: readonly { readonly claims: readonly PositionedClaim[] }[];
  readonly relations: readonly ClassifiedClaimPair[];
  readonly resolution?: PositionedResolution;
  readonly cycle: boolean;
}

function sameActor(left: Claim, right: Claim): boolean {
  return left.actor.type === right.actor.type && left.actor.id === right.actor.id;
}

function sourceIdentity(source: SourceRef): string {
  return JSON.stringify([source.ref, source.locator ?? null, source.snapshot ?? null]);
}

function evidenceIdentity(claim: Claim): string {
  return JSON.stringify([
    [...claim.derived_from].map(String).sort(compareUnicodeScalars),
    claim.sources.map(sourceIdentity).sort(compareUnicodeScalars),
  ]);
}

function sameFingerprint(left: Claim, right: Claim): boolean {
  return (
    claimKeysEqual(claimKeyOf(left), claimKeyOf(right)) &&
    jsonValuesEqual(left.value, right.value) &&
    Object.hasOwn(left, "claim_class") === Object.hasOwn(right, "claim_class") &&
    left.claim_class === right.claim_class &&
    left.confidence === right.confidence &&
    Object.hasOwn(left, "valid_from") === Object.hasOwn(right, "valid_from") &&
    left.valid_from === right.valid_from &&
    Object.hasOwn(left, "valid_until") === Object.hasOwn(right, "valid_until") &&
    left.valid_until === right.valid_until &&
    evidenceIdentity(left) === evidenceIdentity(right)
  );
}

function evidenceIsNonempty(claim: Claim): boolean {
  return claim.derived_from.length > 0 || claim.sources.length > 0;
}

function intervalsDisjoint(left: Claim, right: Claim): boolean {
  return (
    (left.valid_until !== undefined &&
      right.valid_from !== undefined &&
      left.valid_until < right.valid_from) ||
    (right.valid_until !== undefined && left.valid_from !== undefined && right.valid_until < left.valid_from)
  );
}

function externallyLater(left: PositionedClaim, right: PositionedClaim): PositionedClaim {
  if (
    left.record.valid_until !== undefined &&
    right.record.valid_from !== undefined &&
    left.record.valid_until < right.record.valid_from
  )
    return right;
  return left;
}

/** Exact ADR 0027 classifier. Different ClaimKeys deliberately return no relation. */
export function classifyClaimPair(
  left: PositionedClaim,
  right: PositionedClaim,
  semantics: ClaimSemantics,
): ClassifiedClaimPair | undefined {
  if (!claimKeysEqual(claimKeyOf(left.record), claimKeyOf(right.record))) return undefined;
  if (left.record.id === right.record.id) return undefined;

  const laterPosition = left.position > right.position ? left : right;
  const earlierPosition = laterPosition === left ? right : left;
  if (intervalsDisjoint(left.record, right.record)) {
    const laterInterval = externallyLater(left, right);
    return Object.freeze({
      relation: "temporal-succession",
      from: laterInterval,
      to: laterInterval === left ? right : left,
    });
  }
  if (!jsonValuesEqual(left.record.value, right.record.value))
    return Object.freeze({
      relation: semantics === "exclusive" ? "conflict" : "coexistence",
      from: laterPosition,
      to: earlierPosition,
    });

  const equalEvidence = evidenceIdentity(left.record) === evidenceIdentity(right.record);
  const duplicate =
    sameFingerprint(left.record, right.record) &&
    (sameActor(left.record, right.record) || (equalEvidence && evidenceIsNonempty(left.record)));
  const relation = duplicate
    ? "duplicate"
    : !sameActor(left.record, right.record) || !equalEvidence
      ? "corroboration"
      : "support";
  return Object.freeze({ relation, from: laterPosition, to: earlierPosition });
}

function valueGroups(
  claims: readonly PositionedClaim[],
): readonly { readonly claims: readonly PositionedClaim[] }[] {
  const groups: PositionedClaim[][] = [];
  for (const claim of claims) {
    const found = groups.find((group) =>
      jsonValuesEqual((group[0] as PositionedClaim).record.value, claim.record.value),
    );
    if (found) found.push(claim);
    else groups.push([claim]);
  }
  return Object.freeze(groups.map((group) => Object.freeze({ claims: Object.freeze(group) })));
}

function backwardResolution(
  resolution: PositionedResolution,
  visibleById: ReadonlyMap<string, PositionedRecord>,
): boolean {
  const replacement =
    resolution.record.replacement === undefined ? undefined : visibleById.get(resolution.record.replacement);
  return (
    resolution.record.targets.length > 0 &&
    resolution.record.targets.every((id) => {
      const target = visibleById.get(id);
      return target !== undefined && target.position < resolution.position;
    }) &&
    (resolution.record.replacement === undefined ||
      (replacement !== undefined &&
        replacement.record.kind === "claim" &&
        replacement.position < resolution.position))
  );
}

function completeResolution(resolution: PositionedResolution, claims: readonly PositionedClaim[]): boolean {
  const direct = new Set(resolution.record.targets);
  if (!claims.every((claim) => direct.has(claim.record.id))) return false;
  if (resolution.record.decision === "prefer" || resolution.record.decision === "supersede")
    return (
      resolution.record.replacement !== undefined &&
      direct.has(resolution.record.replacement) &&
      claims.some((claim) => claim.record.id === resolution.record.replacement)
    );
  return resolution.record.replacement === undefined;
}

function directedCycleMembers(edges: readonly (readonly [ClaimId, ClaimId])[]): ReadonlySet<ClaimId> {
  const outgoing = new Map<ClaimId, ClaimId[]>();
  const incoming = new Map<ClaimId, ClaimId[]>();
  const selfLoops = new Set<ClaimId>();
  const adjacency = (graph: Map<ClaimId, ClaimId[]>, id: ClaimId): ClaimId[] => {
    const existing = graph.get(id);
    if (existing) return existing;
    const created: ClaimId[] = [];
    graph.set(id, created);
    return created;
  };
  for (const [from, to] of edges) {
    adjacency(outgoing, from).push(to);
    adjacency(outgoing, to);
    adjacency(incoming, to).push(from);
    adjacency(incoming, from);
    if (from === to) selfLoops.add(from);
  }

  const visited = new Set<ClaimId>();
  const finished: ClaimId[] = [];
  for (const start of outgoing.keys()) {
    if (visited.has(start)) continue;
    visited.add(start);
    const stack: { id: ClaimId; next: number }[] = [{ id: start, next: 0 }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1] as { id: ClaimId; next: number };
      const neighbors = outgoing.get(frame.id) as ClaimId[];
      const next = neighbors[frame.next];
      if (next !== undefined) {
        frame.next++;
        if (!visited.has(next)) {
          visited.add(next);
          stack.push({ id: next, next: 0 });
        }
      } else {
        finished.push(frame.id);
        stack.pop();
      }
    }
  }

  const assigned = new Set<ClaimId>();
  const members = new Set<ClaimId>();
  for (let index = finished.length - 1; index >= 0; index--) {
    const start = finished[index] as ClaimId;
    if (assigned.has(start)) continue;
    assigned.add(start);
    const component: ClaimId[] = [];
    const pending = [start];
    while (pending.length > 0) {
      const current = pending.pop() as ClaimId;
      component.push(current);
      for (const next of incoming.get(current) as ClaimId[]) {
        if (assigned.has(next)) continue;
        assigned.add(next);
        pending.push(next);
      }
    }
    if (component.length > 1 || selfLoops.has(start)) for (const member of component) members.add(member);
  }
  return members;
}

/**
 * Reconciles selected applicable Claims while using a separate full recorded-visible record index only
 * for Resolution reference eligibility. Public `current` composes selection and summaries around it.
 */
export function reconcileApplicableClaimGroup(input: {
  readonly claims: readonly PositionedClaim[];
  readonly visibleRecords: readonly PositionedRecord[];
  readonly relations?: readonly PositionedRelation[];
  readonly resolutions?: readonly PositionedResolution[];
  readonly semantics: ClaimSemantics;
}): ReconciledClaimGroup {
  const claims = Object.freeze([...input.claims].sort((a, b) => Number(a.position) - Number(b.position)));
  if (claims.length === 0) throw new TypeError("reconciliation requires an applicable Claim");
  const key = claimKeyOf((claims[0] as PositionedClaim).record);
  if (claims.some((claim) => !claimKeysEqual(key, claimKeyOf(claim.record))))
    throw new TypeError("reconciliation cannot cross an exact ClaimKey");
  const claimsById = new Map(claims.map((claim) => [claim.record.id, claim]));
  const visibleById = new Map(input.visibleRecords.map((item) => [item.record.id, item] as const));
  for (const claim of claims)
    if (visibleById.get(claim.record.id)?.record.kind !== "claim")
      throw new TypeError("applicable Claims must belong to the visible record index");
  const relations = Object.freeze(
    [...(input.relations ?? [])].sort((a, b) => Number(a.position) - Number(b.position)),
  );
  const resolutions = Object.freeze(
    [...(input.resolutions ?? [])]
      .filter((resolution) => backwardResolution(resolution, visibleById))
      .sort((a, b) => Number(a.position) - Number(b.position)),
  );
  const derived: ClassifiedClaimPair[] = [];
  for (let later = 1; later < claims.length; later++)
    for (let earlier = 0; earlier < later; earlier++) {
      const pair = classifyClaimPair(
        claims[later] as PositionedClaim,
        claims[earlier] as PositionedClaim,
        input.semantics,
      );
      if (pair) derived.push(pair);
    }

  const winner = [...resolutions].reverse().find((resolution) => completeResolution(resolution, claims));
  if (winner) {
    if (winner.record.decision === "retract")
      return Object.freeze({
        key,
        semantics: input.semantics,
        state: "retracted",
        claims,
        values: Object.freeze([]),
        relations: Object.freeze(derived),
        resolution: winner,
        cycle: false,
      });
    if (winner.record.decision === "leave_disputed")
      return Object.freeze({
        key,
        semantics: input.semantics,
        state: "disputed",
        claims,
        values: valueGroups(claims),
        relations: Object.freeze(derived),
        resolution: winner,
        cycle: false,
      });
    const replacement = claimsById.get(winner.record.replacement as ClaimId) as PositionedClaim;
    const selected = Object.freeze(
      winner.record.decision === "prefer"
        ? [
            replacement,
            ...claims.filter(
              (claim) =>
                claim !== replacement && jsonValuesEqual(claim.record.value, replacement.record.value),
            ),
          ]
        : [replacement],
    );
    return Object.freeze({
      key,
      semantics: input.semantics,
      state: "preferred",
      claims: selected,
      values: valueGroups(selected),
      relations: Object.freeze(derived),
      resolution: winner,
      cycle: false,
    });
  }

  const activeEdges: (readonly [ClaimId, ClaimId])[] = [];
  for (const relation of relations) {
    if (relation.record.relation_type !== "supersedes") continue;
    const from = claimsById.get(relation.record.from as ClaimId);
    const to = claimsById.get(relation.record.to as ClaimId);
    if (!from || !to || from.position >= relation.position || to.position >= relation.position) continue;
    const control = [...resolutions]
      .reverse()
      .find((resolution) => resolution.record.targets.includes(relation.record.id));
    if (control && control.record.decision !== "prefer") continue;
    activeEdges.push(Object.freeze([from.record.id, to.record.id]));
  }
  const cycleMembers = directedCycleMembers(activeEdges);
  const removed = new Set(activeEdges.filter((edge) => !cycleMembers.has(edge[1])).map((edge) => edge[1]));
  const survivors = Object.freeze(claims.filter((claim) => !removed.has(claim.record.id)));
  const values = valueGroups(survivors);
  return Object.freeze({
    key,
    semantics: input.semantics,
    state:
      cycleMembers.size > 0
        ? "disputed"
        : values.length === 1
          ? "preferred"
          : input.semantics === "coexisting"
            ? "coexisting"
            : "disputed",
    claims: survivors,
    values,
    relations: Object.freeze(derived),
    cycle: cycleMembers.size > 0,
  });
}

function positioned<T extends PositionedClaim | PositionedRelation | PositionedResolution>(value: T): T {
  return Object.freeze({
    position: value.position,
    record: decodePersistedRecord(value.record),
  }) as T;
}

/** Builds ADR 0027's exact frozen policy context from an already selected Claim set C. */
export function createClaimPolicyAdviceContext(input: {
  readonly query: JsonObject;
  readonly claims: readonly PositionedClaim[];
  readonly relations: readonly PositionedRelation[];
  readonly resolutions: readonly PositionedResolution[];
  readonly validAt: string;
}): ClaimPolicyAdviceContext {
  const queryIssues: LoreduIssue[] = [];
  const query = copyJsonObject(input.query, "/query", queryIssues);
  if (!query || queryIssues.length > 0)
    throw new LoreduError("VALIDATION_FAILED", "ClaimPolicy advice context validation failed", queryIssues);
  const claims = Object.freeze(
    [...input.claims]
      .filter(
        (claim) =>
          (claim.record.valid_from === undefined || claim.record.valid_from <= input.validAt) &&
          (claim.record.valid_until === undefined || input.validAt <= claim.record.valid_until),
      )
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map(positioned),
  );
  const claimById = new Map(claims.map((claim) => [claim.record.id, claim]));
  const relations = Object.freeze(
    [...input.relations]
      .filter((relation) => {
        const from = claimById.get(relation.record.from as ClaimId);
        const to = claimById.get(relation.record.to as ClaimId);
        return (
          from !== undefined &&
          to !== undefined &&
          from.position < relation.position &&
          to.position < relation.position
        );
      })
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map(positioned),
  );
  const relationById = new Map(relations.map((relation) => [relation.record.id, relation]));
  const resolutions = Object.freeze(
    [...input.resolutions]
      .filter((resolution) => {
        if (
          resolution.record.targets.length === 0 ||
          (resolution.record.effective_at !== undefined && resolution.record.effective_at > input.validAt)
        )
          return false;
        const targetsAdmitted = resolution.record.targets.every((id) => {
          const target = claimById.get(id as ClaimId) ?? relationById.get(id as never);
          return target !== undefined && target.position < resolution.position;
        });
        const replacement = resolution.record.replacement;
        return (
          targetsAdmitted &&
          (replacement === undefined ||
            (claimById.get(replacement)?.position ?? resolution.position) < resolution.position)
        );
      })
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map(positioned),
  );
  return Object.freeze({ query, claims, relations, resolutions });
}

function adviceFailure(issues: readonly LoreduIssue[]): never {
  throw new LoreduError(
    "VALIDATION_FAILED",
    "ClaimPolicy advice validation failed",
    Object.freeze([...issues]),
  );
}

function adviceArray(value: unknown): readonly unknown[] {
  let array = false;
  let length: unknown;
  try {
    array = Array.isArray(value);
    if (array) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value as object, "length");
      length = descriptor && "value" in descriptor ? descriptor.value : undefined;
    }
  } catch {
    adviceFailure([makeIssue("TYPE", "", "could not inspect ClaimPolicy advice array")]);
  }
  if (!array) adviceFailure([makeIssue("TYPE", "", "must be an array")]);
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0)
    adviceFailure([makeIssue("TYPE", "", "must have a valid own array length")]);
  if (length > ADVICE_LIMIT)
    adviceFailure([makeIssue("RANGE", "", "must contain at most 200 policy advisories")]);

  let prototype: object | null;
  let keys: readonly PropertyKey[];
  let snapshotLength: PropertyDescriptor | undefined;
  try {
    prototype = Reflect.getPrototypeOf(value as object);
    snapshotLength = Reflect.getOwnPropertyDescriptor(value as object, "length");
    keys = Reflect.ownKeys(value as object);
  } catch {
    adviceFailure([makeIssue("TYPE", "", "could not inspect ClaimPolicy advice array")]);
  }
  if (!snapshotLength || !("value" in snapshotLength) || snapshotLength.value !== length)
    adviceFailure([makeIssue("TYPE", "", "array length changed during inspection")]);

  const issues: LoreduIssue[] = [];
  if (prototype !== Array.prototype) issues.push(makeIssue("TYPE", "", "must have Array.prototype"));
  const indexes = new Set<number>();
  for (const key of keys) {
    if (typeof key === "symbol") {
      issues.push(makeIssue("UNKNOWN_FIELD", "", "must not have symbol fields"));
      continue;
    }
    if (key === "length") continue;
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key)
      issues.push(makeIssue("UNKNOWN_FIELD", `/${escapePointer(String(key))}`, "is an array extra property"));
    else indexes.add(index);
  }
  for (let index = 0; index < length; index++)
    if (!indexes.has(index)) issues.push(makeIssue("REQUIRED", `/${index}`, "array must be dense"));
  if (issues.length > 0) adviceFailure(issues);

  const result: unknown[] = [];
  try {
    for (let index = 0; index < length; index++) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value as object, String(index));
      if (!descriptor) issues.push(makeIssue("REQUIRED", `/${index}`, "array must be dense"));
      else if (!("value" in descriptor) || !descriptor.enumerable)
        issues.push(makeIssue("TYPE", `/${index}`, "must be an enumerable own data element"));
      else result[index] = descriptor.value;
    }
  } catch {
    adviceFailure([makeIssue("TYPE", "", "could not inspect ClaimPolicy advice array")]);
  }
  if (issues.length > 0) adviceFailure(issues);
  result.length = length;
  return result;
}

function adviceClaimTuple(
  value: unknown,
  path: string,
  issues: LoreduIssue[],
): readonly unknown[] | undefined {
  let array = false;
  let length: unknown;
  try {
    array = Array.isArray(value);
    if (array) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value as object, "length");
      length = descriptor && "value" in descriptor ? descriptor.value : undefined;
    }
  } catch {
    issues.push(makeIssue("TYPE", path, "could not inspect advisory Claim tuple"));
    return undefined;
  }
  if (!array) {
    issues.push(makeIssue("TYPE", path, "must be an array"));
    return undefined;
  }
  if (length !== 1 && length !== 2) {
    issues.push(makeIssue("RANGE", path, "must name one or two Claims"));
    return undefined;
  }

  let prototype: object | null;
  let snapshotLength: PropertyDescriptor | undefined;
  try {
    prototype = Reflect.getPrototypeOf(value as object);
    snapshotLength = Reflect.getOwnPropertyDescriptor(value as object, "length");
  } catch {
    issues.push(makeIssue("TYPE", path, "could not inspect advisory Claim tuple"));
    return undefined;
  }
  if (!snapshotLength || !("value" in snapshotLength) || snapshotLength.value !== length) {
    issues.push(makeIssue("TYPE", path, "array length changed during inspection"));
    return undefined;
  }

  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value as object);
  } catch {
    issues.push(makeIssue("TYPE", path, "could not inspect advisory Claim tuple"));
    return undefined;
  }
  const issueCount = issues.length;
  if (prototype !== Array.prototype) issues.push(makeIssue("TYPE", path, "must have Array.prototype"));
  const indexes = new Set<number>();
  for (const key of keys) {
    if (typeof key === "symbol") {
      issues.push(makeIssue("UNKNOWN_FIELD", path, "must not have symbol fields"));
      continue;
    }
    if (key === "length") continue;
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key)
      issues.push(
        makeIssue("UNKNOWN_FIELD", `${path}/${escapePointer(String(key))}`, "is an array extra property"),
      );
    else indexes.add(index);
  }
  for (let index = 0; index < length; index++)
    if (!indexes.has(index)) issues.push(makeIssue("REQUIRED", `${path}/${index}`, "array must be dense"));
  if (issues.length > issueCount) return undefined;

  const result: unknown[] = [];
  try {
    for (let index = 0; index < length; index++) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value as object, String(index));
      if (!descriptor) issues.push(makeIssue("REQUIRED", `${path}/${index}`, "array must be dense"));
      else if (!("value" in descriptor) || !descriptor.enumerable)
        issues.push(makeIssue("TYPE", `${path}/${index}`, "must be an enumerable own data element"));
      else result[index] = descriptor.value;
    }
  } catch {
    issues.push(makeIssue("TYPE", path, "could not inspect advisory Claim tuple"));
    return undefined;
  }
  if (issues.length > issueCount) return undefined;
  result.length = length;
  return result;
}

function required(
  data: Readonly<Record<string, PropertyDescriptor>>,
  key: string,
  path: string,
  issues: LoreduIssue[],
): unknown {
  if (!hasOwnDescriptor(data, key)) {
    issues.push(makeIssue("REQUIRED", path, "is required"));
    return undefined;
  }
  return dataValue(data, key);
}

/** Invokes and validates one deterministic advisory stream. Omitted advice returns empty without a call. */
export function evaluateClaimPolicyAdvice(
  policy: ValidatedClaimPolicy,
  context: ClaimPolicyAdviceContext,
): readonly PolicyAdvisoryDraft[] {
  if (!policy.advise) return Object.freeze([]);
  let returned: unknown;
  try {
    returned = policy.advise(context);
  } catch {
    adviceFailure([makeIssue("TYPE", "", "ClaimPolicy advise failed")]);
  }
  const values = adviceArray(returned);
  const issues: LoreduIssue[] = [];
  const claimPositions = new Map(context.claims.map((claim) => [claim.record.id, claim.position]));
  const output: { value: PolicyAdvisoryDraft; ordinal: number; positions: readonly number[] }[] = [];
  for (let index = 0; index < values.length; index++) {
    const path = `/${index}`;
    const data = inspectObject(values[index], path, issues);
    if (!data) continue;
    for (const key of Object.keys(data))
      if (key !== "code" && key !== "claims" && key !== "details")
        issues.push(
          makeIssue("UNKNOWN_FIELD", `${path}/${escapePointer(key)}`, "is not part of PolicyAdvisoryDraft"),
        );
    const code = required(data, "code", `${path}/code`, issues);
    if (typeof code !== "string" || !isScalarText(code) || scalarLength(code) > 128 || !TOKEN.test(code))
      issues.push(makeIssue("FORMAT", `${path}/code`, "must be an identifier-safe token"));
    const claimValues = adviceClaimTuple(
      required(data, "claims", `${path}/claims`, issues),
      `${path}/claims`,
      issues,
    );
    const ids: ClaimId[] = [];
    if (claimValues) {
      for (let claimIndex = 0; claimIndex < claimValues.length; claimIndex++) {
        const id = claimValues[claimIndex];
        if (typeof id !== "string" || !CLAIM_ID.test(id))
          issues.push(makeIssue("FORMAT", `${path}/claims/${claimIndex}`, "must be a Claim id"));
        else if (!claimPositions.has(id as ClaimId))
          issues.push(
            makeIssue("FORMAT", `${path}/claims/${claimIndex}`, "must name a Claim in the advice context"),
          );
        else if (ids.includes(id as ClaimId))
          issues.push(makeIssue("DUPLICATE", `${path}/claims/${claimIndex}`, "must name distinct Claims"));
        else ids.push(id as ClaimId);
      }
    }
    const details = copyJsonObject(
      required(data, "details", `${path}/details`, issues),
      `${path}/details`,
      issues,
    );
    if (typeof code !== "string" || !TOKEN.test(code) || !details || ids.length < 1 || ids.length > 2)
      continue;
    ids.sort((left, right) => Number(claimPositions.get(left)) - Number(claimPositions.get(right)));
    const claims = Object.freeze([...ids]) as unknown as readonly [ClaimId] | readonly [ClaimId, ClaimId];
    output.push({
      value: Object.freeze({ code, claims, details }),
      ordinal: index,
      positions: Object.freeze(ids.map((id) => Number(claimPositions.get(id)))),
    });
  }
  if (issues.length > 0) adviceFailure(issues);
  const seen = new Set<string>();
  for (const item of output) {
    const identity = JSON.stringify(item.value);
    if (seen.has(identity))
      adviceFailure([makeIssue("DUPLICATE", "", "contains an exact duplicate policy advisory")]);
    seen.add(identity);
  }
  output.sort(
    (left, right) =>
      compareUnicodeScalars(left.value.code, right.value.code) ||
      (left.positions[0] ?? 0) - (right.positions[0] ?? 0) ||
      (left.positions[1] ?? 0) - (right.positions[1] ?? 0) ||
      left.ordinal - right.ordinal,
  );
  return Object.freeze(output.map((item) => item.value));
}
