import { homedir } from "node:os";
import { isAbsolute, sep } from "node:path";
import {
  type Claim,
  type ClaimKey,
  claimKeyOf,
  claimKeysEqual,
  createBasis,
  createLoreduApplication,
  createStreamPosition,
  DEFAULT_RULESET_IDENTITY,
  decodeRecordDraft,
  type JsonObject,
  type JsonValue,
  jsonValuesEqual,
  LoreduError,
  type PersistedRecord,
  type PositionedRecord,
  RECORD_SCHEMA_ID,
  type RecordDraft,
  type RecordId,
  type RecordKind,
  type Scope,
  type StreamPosition,
} from "@loredu/kernel";
import {
  defaultLoreduHome,
  initializePlainFileStore,
  PlainFileStore,
  resolveStoreRoot,
  STORE_ADAPTER_NAME,
  type StoreRootSelection,
} from "@loredu/store-plainfile";
import { CryptographicRandomSource, SystemClock } from "./capabilities";
import { EMBEDDED_AGENT_SKILL } from "./embedded-skill";
import { LOR_VERSION } from "./version";

export interface CliIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly readStdin: () => Promise<Uint8Array>;
}

interface Affordance {
  readonly rel: "show" | "history" | "list" | "status" | "continue" | "init";
  readonly action:
    | "record.show"
    | "record.history"
    | "claims.list"
    | "history.list"
    | "status.read"
    | "store.init";
  readonly params: JsonObject;
  readonly why: string;
}

interface BaseResponse {
  readonly ok: true;
  readonly result: unknown;
  readonly reconciliation: { readonly state: "not-applicable"; readonly related: readonly [] };
  readonly advice: readonly Affordance[];
  readonly basis: ReturnType<typeof createBasis> | null;
  readonly page?: { readonly returned: number; readonly total: number };
}

interface ParsedOptions {
  readonly values: ReadonlyMap<string, readonly string[]>;
  readonly flags: ReadonlySet<string>;
  readonly positionals: readonly string[];
  readonly json: boolean;
  readonly store?: string;
}

interface OptionSpec {
  readonly value: boolean;
  readonly repeat?: boolean;
}

class CliUsageError extends Error {
  readonly code = "CLI_USAGE";
}

class CliExpectedError extends Error {
  readonly issues: readonly [] = Object.freeze([]) as readonly [];

  constructor(
    readonly code: "RECORD_NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

const NOT_APPLICABLE = Object.freeze({
  state: "not-applicable" as const,
  related: Object.freeze([]) as readonly [],
});
const RECORD_ID = /^(ent|clm|rel|res|ver)_[0-9abcdefghjkmnpqrstvwxyz]{16}$/;
const GLOBAL_SPECS: Readonly<Record<string, OptionSpec>> = {
  "--json": { value: false },
  "--store": { value: true },
};
const VALUE_OPTIONS = new Set([
  "--store",
  "--actor",
  "--body",
  "--type",
  "--title",
  "--scope",
  "--metadata-json",
  "--source-json",
  "--subject-type",
  "--subject",
  "--predicate",
  "--value",
  "--value-json",
  "--confidence",
  "--class",
  "--perspective",
  "--valid-from",
  "--valid-until",
  "--derived-from",
  "--from",
  "--to",
  "--target",
  "--decision",
  "--replacement",
  "--reason",
  "--effective-at",
  "--verified-against-json",
  "--result",
  "--limit",
  "--cursor",
  "--since",
]);

const HELP: Readonly<Record<string, string>> = {
  init: "usage: lor init [<selector>] [--json]",
  "add entry":
    "usage: lor add entry --actor <type:id> --body <text|-> [--type <token>] [--title <text>] [common options]",
  "add claim":
    "usage: lor add claim --actor <type:id> --subject-type <token> --subject <token> --predicate <token> (--value <string> | --value-json <json>) --confidence <value> [common options]",
  relate:
    "usage: lor relate --actor <type:id> --from <record-id> --to <record-id> --type <relation-type> [common options]",
  resolve:
    "usage: lor resolve --actor <type:id> --target <claim-or-relation-id>... --decision <decision> --reason <text> [common options]",
  "add verification":
    "usage: lor add verification --actor <type:id> --target <claim-id>... --verified-against-json <SourceRef>... --result <result> [common options]",
  show: "usage: lor show <record-id> [--json]",
  head: "usage: lor head [--json]",
  status: "usage: lor status [--check] [--json]",
  skill: "usage: lor skill [--json]",
};

const COMMON_SPECS: Readonly<Record<string, OptionSpec>> = {
  "--actor": { value: true },
  "--scope": { value: true, repeat: true },
  "--metadata-json": { value: true },
  "--source-json": { value: true, repeat: true },
};

function usage(message: string): never {
  throw new CliUsageError(message);
}

function detectsJson(argv: readonly string[]): boolean {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json") return true;
    if (token !== undefined && VALUE_OPTIONS.has(token)) index += 1;
  }
  return false;
}

function parseOptions(
  tokens: readonly string[],
  commandSpecs: Readonly<Record<string, OptionSpec>>,
  initial: { readonly json?: boolean; readonly store?: string } = {},
): ParsedOptions {
  const specs = { ...GLOBAL_SPECS, ...commandSpecs };
  const values = new Map<string, string[]>();
  const flags = new Set<string>();
  const positionals: string[] = [];
  let json = initial.json ?? false;
  let store = initial.store;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) continue;
    if (token === "--") usage("the -- delimiter is not supported");
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const spec = specs[token];
    if (spec === undefined) usage(`unknown option: ${token}`);
    if (spec.value) {
      const value = tokens[index + 1];
      if (value === undefined) usage(`${token} requires a value`);
      index += 1;
      if (token === "--store") {
        if (store !== undefined) usage("--store may be supplied only once");
        store = value;
        continue;
      }
      const existing = values.get(token) ?? [];
      if (!spec.repeat && existing.length > 0) usage(`${token} may be supplied only once`);
      existing.push(value);
      values.set(token, existing);
      continue;
    }
    if (token === "--json") {
      if (json) usage("--json may be supplied only once");
      json = true;
      continue;
    }
    if (flags.has(token)) usage(`${token} may be supplied only once`);
    flags.add(token);
  }

  return {
    values,
    flags,
    positionals: Object.freeze(positionals),
    json,
    ...(store === undefined ? {} : { store }),
  };
}

function extractGlobals(argv: readonly string[]): {
  readonly rest: readonly string[];
  readonly json: boolean;
  readonly store?: string;
} {
  const rest: string[] = [];
  let json = false;
  let store: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) continue;
    if (token === "--json") {
      if (json) usage("--json may be supplied only once");
      json = true;
      continue;
    }
    if (token === "--store") {
      if (store !== undefined) usage("--store may be supplied only once");
      const value = argv[index + 1];
      if (value === undefined) usage("--store requires a value");
      store = value;
      index += 1;
      continue;
    }
    rest.push(token);
    if (VALUE_OPTIONS.has(token)) {
      const value = argv[index + 1];
      if (value !== undefined) {
        rest.push(value);
        index += 1;
      }
    }
  }
  return { rest: Object.freeze(rest), json, ...(store === undefined ? {} : { store }) };
}

function option(options: ParsedOptions, name: string): string | undefined {
  return options.values.get(name)?.[0];
}

function options(optionsValue: ParsedOptions, name: string): readonly string[] {
  return optionsValue.values.get(name) ?? [];
}

function requiredOption(optionsValue: ParsedOptions, name: string): string {
  const value = option(optionsValue, name);
  if (value === undefined) usage(`${name} is required`);
  return value;
}

function parseJson(value: string, path: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new LoreduError("VALIDATION_FAILED", `invalid JSON for ${path}`, [
      Object.freeze({ code: "FORMAT", path, message: "must be valid JSON" }),
    ]);
  }
}

function parseActor(value: string): unknown {
  const separator = value.indexOf(":");
  if (separator < 1 || separator === value.length - 1) {
    throw new LoreduError("VALIDATION_FAILED", "actor must use type:id", [
      Object.freeze({ code: "FORMAT", path: "/actor", message: "must use type:id" }),
    ]);
  }
  return { type: value.slice(0, separator), id: value.slice(separator + 1) };
}

function parseScope(values: readonly string[]): Scope | undefined {
  if (values.length === 0) return undefined;
  const scope: Record<string, string> = {};
  for (const pair of values) {
    const separator = pair.indexOf("=");
    if (separator < 1 || separator === pair.length - 1) {
      throw new LoreduError("VALIDATION_FAILED", "scope must use key=value", [
        Object.freeze({ code: "FORMAT", path: "/scope", message: "must use key=value" }),
      ]);
    }
    const key = pair.slice(0, separator);
    if (Object.hasOwn(scope, key)) {
      throw new LoreduError("VALIDATION_FAILED", "scope keys must be unique", [
        Object.freeze({ code: "DUPLICATE", path: `/scope/${key}`, message: "duplicates a scope key" }),
      ]);
    }
    scope[key] = pair.slice(separator + 1);
  }
  return scope;
}

function commonDraft(optionsValue: ParsedOptions): Record<string, unknown> {
  const scope = parseScope(options(optionsValue, "--scope"));
  const metadataText = option(optionsValue, "--metadata-json");
  const sourceTexts = options(optionsValue, "--source-json");
  return {
    actor: parseActor(requiredOption(optionsValue, "--actor")),
    ...(scope === undefined ? {} : { scope }),
    ...(metadataText === undefined ? {} : { metadata: parseJson(metadataText, "/metadata") }),
    ...(sourceTexts.length === 0
      ? {}
      : { sources: sourceTexts.map((value, index) => parseJson(value, `/sources/${index}`)) }),
  };
}

function recordId(value: string): RecordId {
  if (!RECORD_ID.test(value)) {
    throw new LoreduError("VALIDATION_FAILED", "record id is invalid", [
      Object.freeze({ code: "FORMAT", path: "/id", message: "must be a complete Loredu record id" }),
    ]);
  }
  return value as RecordId;
}

function selectionFor(selector: string | undefined): StoreRootSelection {
  if (selector === undefined) return { kind: "default" };
  if (isAbsolute(selector) || selector.includes(sep) || selector.startsWith(`.${sep}`)) {
    return { kind: "path", path: selector };
  }
  return { kind: "name", name: selector };
}

function resolveRoot(selector: string | undefined): string {
  try {
    const loreduHome = process.env.LOREDU_HOME;
    return resolveStoreRoot(selectionFor(selector), {
      ...(loreduHome === undefined ? {} : { loreduHome }),
      osHome: homedir(),
      cwd: process.cwd(),
    });
  } catch {
    throw new LoreduError("VALIDATION_FAILED", "store selector is invalid", [
      Object.freeze({ code: "FORMAT", path: "/store", message: "must be a valid store name or path" }),
    ]);
  }
}

function basis(position: StreamPosition, query: JsonObject): ReturnType<typeof createBasis> {
  return createBasis({ stream_position: position, ruleset: DEFAULT_RULESET_IDENTITY, query });
}

function handle(
  id: RecordId,
  kind: RecordKind,
): {
  readonly id: RecordId;
  readonly kind: RecordKind;
  readonly affordances: readonly Affordance[];
} {
  return Object.freeze({
    id,
    kind,
    affordances: Object.freeze([
      Object.freeze({
        rel: "show",
        action: "record.show",
        params: Object.freeze({ id }),
        why: "inspect the record",
      }),
      Object.freeze({
        rel: "history",
        action: "record.history",
        params: Object.freeze({ id }),
        why: "inspect directly related history",
      }),
    ]),
  });
}

function success(result: unknown, position: StreamPosition, query: JsonObject): BaseResponse {
  return Object.freeze({
    ok: true,
    result,
    reconciliation: NOT_APPLICABLE,
    advice: Object.freeze([]),
    basis: basis(position, query),
  });
}

function referenceFields(record: PersistedRecord): readonly { readonly path: string; readonly id: RecordId }[] {
  if (record.kind === "claim") {
    return record.derived_from.map((id, index) => ({ path: `/derived_from/${index}`, id }));
  }
  if (record.kind === "relation") {
    return [
      { path: "/from", id: record.from },
      { path: "/to", id: record.to },
    ];
  }
  if (record.kind === "resolution") {
    return [
      ...record.targets.map((id, index) => ({ path: `/targets/${index}`, id })),
      ...(record.replacement === undefined ? [] : [{ path: "/replacement", id: record.replacement }]),
    ];
  }
  if (record.kind === "verification") {
    return record.targets.map((id, index) => ({ path: `/targets/${index}`, id }));
  }
  return [];
}

function referencedIds(record: PersistedRecord): readonly RecordId[] {
  return referenceFields(record).map(({ id }) => id);
}

function scopesEqual(left: Scope, right: Scope): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key])
  );
}

function claimsAffordance(key: ClaimKey): Affordance {
  return Object.freeze({
    rel: "list",
    action: "claims.list",
    params: Object.freeze({
      query: Object.freeze({
        scope: key.scope,
        scope_match: "exact",
        subject_type: key.subject.type,
        subject: key.subject.id,
        predicate: key.predicate,
        perspective: key.perspective ?? null,
      }),
    }),
    why: "inspect the complete exact-key group",
  });
}

function cohortClaimsAffordance(scope: Scope, value: JsonValue): Affordance {
  return Object.freeze({
    rel: "list",
    action: "claims.list",
    params: Object.freeze({
      query: Object.freeze({ scope, scope_match: "exact", value }),
    }),
    why: "inspect claims with this scope and value",
  });
}

function distinctAdvice(items: readonly Affordance[]): readonly Affordance[] {
  const seen = new Set<string>();
  return Object.freeze(
    items.filter((item) => {
      const identity = `${item.rel}\u0000${item.action}\u0000${JSON.stringify(item.params)}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    }),
  );
}

function statusResult(scan: {
  readonly records: readonly PositionedRecord[];
}): {
  readonly result: Readonly<Record<string, unknown>>;
  readonly advice: readonly Affordance[];
  readonly total: number;
} {
  type PositionedClaim = PositionedRecord & { readonly record: Claim };
  const claims = scan.records.filter(
    (item): item is PositionedClaim => item.record.kind === "claim",
  );
  const byId = new Map(scan.records.map((item) => [item.record.id, item]));
  const groups: { key: ClaimKey; members: PositionedClaim[] }[] = [];
  for (const item of claims) {
    const key = claimKeyOf(item.record);
    const existing = groups.find((group) => claimKeysEqual(group.key, key));
    if (existing === undefined) groups.push({ key, members: [item] });
    else existing.members.push(item);
  }

  const resolutions = scan.records.filter((item) => item.record.kind === "resolution");
  const unresolved = groups.filter((group) => {
    const firstValue = (group.members[0] as PositionedClaim).record.value;
    if (!group.members.some((item) => !jsonValuesEqual(item.record.value, firstValue))) return false;
    return !resolutions.some((resolution) => {
      const record = resolution.record;
      if (record.kind !== "resolution") return false;
      const eligible = referenceFields(record).every(({ id }) => {
        const target = byId.get(id);
        return target !== undefined && target.position < resolution.position;
      });
      return eligible && group.members.every((item) => record.targets.includes(item.record.id));
    });
  });

  const dangling = scan.records.flatMap((item) =>
    referenceFields(item.record)
      .filter(({ id }) => {
        const target = byId.get(id);
        return target === undefined || target.position >= item.position;
      })
      .map(({ path, id }) => ({ item, path, target: id })),
  );

  const attention: Record<string, unknown>[] = [];
  const advice: Affordance[] = [];
  for (const group of unresolved) {
    const representative = group.members[0] as PositionedClaim;
    const claimsLink = claimsAffordance(group.key);
    const representativeHandle = handle(representative.record.id, representative.record.kind);
    attention.push({
      kind: "unresolved-exclusive-group",
      key: group.key,
      claim_count: group.members.length,
      representative: representativeHandle,
      claims: claimsLink,
    });
    advice.push(claimsLink, representativeHandle.affordances[0] as Affordance);
  }
  for (const item of dangling) {
    const recordHandle = handle(item.item.record.id, item.item.record.kind);
    attention.push({
      kind: "dangling-record-reference",
      record: recordHandle,
      path: item.path,
      target: item.target,
    });
    advice.push(recordHandle.affordances[0] as Affordance);
  }

  const cohorts: { scope: Scope; value: JsonValue; members: PositionedClaim[] }[] = [];
  for (const item of claims) {
    const cohort = cohorts.find(
      (candidate) =>
        scopesEqual(candidate.scope, item.record.scope) && jsonValuesEqual(candidate.value, item.record.value),
    );
    if (cohort === undefined) {
      cohorts.push({ scope: item.record.scope, value: item.record.value, members: [item] });
    } else cohort.members.push(item);
  }
  const advisories: { item: Record<string, unknown>; position: number }[] = [];
  for (const cohort of cohorts) {
    const nodes: { key: ClaimKey; members: PositionedClaim[] }[] = [];
    for (const member of cohort.members) {
      const key = claimKeyOf(member.record);
      const node = nodes.find((candidate) => claimKeysEqual(candidate.key, key));
      if (node === undefined) nodes.push({ key, members: [member] });
      else node.members.push(member);
    }
    if (nodes.length < 2) continue;
    const parent = nodes.map((_, index) => index);
    const find = (index: number): number => {
      let root = index;
      while (parent[root] !== root) root = parent[root] as number;
      while (parent[index] !== index) {
        const next = parent[index] as number;
        parent[index] = root;
        index = next;
      }
      return root;
    };
    const nodeByClaim = new Map<RecordId, number>();
    nodes.forEach((node, index) => node.members.forEach((member) => nodeByClaim.set(member.record.id, index)));
    for (const relation of scan.records) {
      if (relation.record.kind !== "relation" || relation.record.relation_type !== "duplicates") continue;
      const from = byId.get(relation.record.from);
      const to = byId.get(relation.record.to);
      const left = nodeByClaim.get(relation.record.from);
      const right = nodeByClaim.get(relation.record.to);
      if (
        from === undefined ||
        to === undefined ||
        from.position >= relation.position ||
        to.position >= relation.position ||
        left === undefined ||
        right === undefined
      ) {
        continue;
      }
      parent[find(right)] = find(left);
    }
    const components = new Map<number, PositionedClaim>();
    nodes.forEach((node, index) => {
      const representative = node.members[0] as PositionedClaim;
      const root = find(index);
      const current = components.get(root);
      if (current === undefined || representative.position < current.position) {
        components.set(root, representative);
      }
    });
    const representatives = [...components.values()].sort((left, right) => left.position - right.position);
    if (representatives.length < 2) continue;
    advisories.push({
      position: (representatives[0] as PositionedClaim).position,
      item: {
        kind: "key-divergence",
        scope: cohort.scope,
        value: cohort.value,
        component_count: representatives.length,
        representatives: representatives.slice(0, 2).map((item) => handle(item.record.id, item.record.kind)),
        claims: cohortClaimsAffordance(cohort.scope, cohort.value),
      },
    });
  }
  advisories.sort((left, right) => left.position - right.position);
  const healthy = unresolved.length === 0 && dangling.length === 0;
  return {
    result: Object.freeze({
      healthy,
      health: Object.freeze({
        unresolved_exclusive_groups: unresolved.length,
        dangling_record_references: dangling.length,
      }),
      advisory_count: advisories.length,
      attention: Object.freeze(attention),
      advisories: Object.freeze(advisories.map(({ item }) => item)),
    }),
    advice: distinctAdvice(advice),
    total: attention.length + advisories.length,
  };
}

function shellWord(value: string): string {
  return /^[a-zA-Z0-9_./:=+-]+$/.test(value) ? value : `'${value.replaceAll("'", `'"'"'`)}'`;
}

function runFor(affordance: Affordance, selector: string | undefined): string {
  const prefix = `lor${selector === undefined ? "" : ` --store ${shellWord(selector)}`}`;
  const params = affordance.params as Record<string, JsonValue>;
  if (affordance.action === "record.show") return `${prefix} show ${shellWord(String(params.id))}`;
  if (affordance.action === "record.history") return `${prefix} history ${shellWord(String(params.id))}`;
  if (affordance.action === "status.read") {
    const cursor = params.cursor;
    let command =
      cursor === undefined ? `${prefix} status` : `${prefix} status --cursor ${shellWord(String(cursor))}`;
    if (params.limit !== undefined) command += ` --limit ${String(params.limit)}`;
    return command;
  }
  if (affordance.action === "store.init") return `lor init ${shellWord(String(params.selector))}`;
  if (affordance.action === "history.list") {
    let command = `${prefix} history --cursor ${shellWord(String(params.cursor))}`;
    if (params.limit !== undefined) command += ` --limit ${String(params.limit)}`;
    return command;
  }
  const query = params.query as Record<string, JsonValue> | undefined;
  let command = `${prefix} claims`;
  if (query !== undefined) {
    const scope = query.scope as Record<string, string> | undefined;
    if (scope !== undefined) {
      for (const key of Object.keys(scope).sort()) command += ` --scope ${shellWord(`${key}=${scope[key]}`)}`;
    }
    if (query.scope_match === "exact") command += " --exact-scope";
    if (query.subject_type !== undefined)
      command += ` --subject-type ${shellWord(String(query.subject_type))}`;
    if (query.subject !== undefined) command += ` --subject ${shellWord(String(query.subject))}`;
    if (query.predicate !== undefined) command += ` --predicate ${shellWord(String(query.predicate))}`;
    if (Object.hasOwn(query, "perspective")) {
      command +=
        query.perspective === null
          ? " --without-perspective"
          : ` --perspective ${shellWord(String(query.perspective))}`;
    }
    if (query.value !== undefined) {
      command += ` --value-json ${shellWord(JSON.stringify(query.value))}`;
    }
    if (query.actor !== undefined) {
      const actor = query.actor as Record<string, JsonValue>;
      command += ` --actor ${shellWord(`${String(actor.type)}:${String(actor.id)}`)}`;
    }
    if (query.since !== undefined) command += ` --since ${shellWord(String(query.since))}`;
    if (query.limit !== undefined) command += ` --limit ${String(query.limit)}`;
  }
  if (params.cursor !== undefined) command += ` --cursor ${shellWord(String(params.cursor))}`;
  if (params.limit !== undefined) command += ` --limit ${String(params.limit)}`;
  return command;
}

function rendered(value: unknown, selector: string | undefined): unknown {
  if (Array.isArray(value)) return value.map((item) => rendered(item, selector));
  if (typeof value !== "object" || value === null) return value;
  const object = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(object)) output[key] = rendered(item, selector);
  if (
    typeof object.rel === "string" &&
    typeof object.action === "string" &&
    typeof object.why === "string" &&
    typeof object.params === "object" &&
    object.params !== null
  ) {
    output.run = runFor(object as unknown as Affordance, selector);
  }
  return output;
}

function emitJson(io: CliIo, value: unknown): void {
  io.out(`${JSON.stringify(value)}\n`);
}

function emitText(io: CliIo, response: BaseResponse, selector: string | undefined): void {
  const result = response.result as Record<string, unknown>;
  if (typeof result.id === "string") io.out(`${result.id}\n`);
  else if (typeof result.stream_position === "number") io.out(`stream_position=${result.stream_position}\n`);
  else if (result.record !== undefined) io.out(`record: ${JSON.stringify(result.record)}\n`);
  else if (typeof result.root === "string") io.out(`initialized store at ${result.root}\n`);
  else if (typeof result.healthy === "boolean") {
    const health = result.health as Record<string, number>;
    io.out(
      `healthy: ${result.healthy}\nopen exclusive groups: ${health.unresolved_exclusive_groups}    dangling record refs: ${health.dangling_record_references}\nadvisories: ${String(result.advisory_count)}\n`,
    );
  } else io.out(`${JSON.stringify(result)}\n`);
  io.out(`reconciliation: ${response.reconciliation.state}\n`);
  for (const advice of response.advice) io.out(`advice: ${runFor(advice, selector)}\n`);
  if (response.basis !== null) io.out(`basis: stream_position=${response.basis.stream_position}\n`);
  if (response.page !== undefined) {
    io.out(`page: returned=${response.page.returned} total=${response.page.total}\n`);
  }
}

function cliFailure(
  error: unknown,
  selector: string | undefined,
): {
  readonly envelope: unknown;
  readonly exit: number;
} {
  let code: string;
  let message: string;
  let issues: readonly unknown[] = [];
  if (error instanceof CliUsageError) {
    code = "CLI_USAGE";
    message = error.message;
  } else if (error instanceof LoreduError || error instanceof CliExpectedError) {
    code = error.code;
    message = error.message;
    issues = error.issues;
  } else {
    code = "INTERNAL_ERROR";
    message = "unexpected internal failure";
  }

  const storeCodes = new Set([
    "DUPLICATE_RECORD_ID",
    "STORE_ALREADY_EXISTS",
    "STORE_LOCKED",
    "STORE_CORRUPT",
    "STORE_IO_FAILED",
    "STORE_APPEND_FAILED",
  ]);
  const validationCodes = new Set([
    "CLI_USAGE",
    "VALIDATION_FAILED",
    "REFERENCE_CHECK_FAILED",
    "INVALID_CURSOR",
    "CURSOR_MISMATCH",
  ]);
  const exit = validationCodes.has(code)
    ? 2
    : code === "STORE_NOT_FOUND" || code === "RECORD_NOT_FOUND"
      ? 3
      : storeCodes.has(code)
        ? 4
        : 6;
  const advice: Affordance[] = [];
  if (code === "STORE_NOT_FOUND") {
    advice.push({
      rel: "init",
      action: "store.init",
      params: { selector: selector ?? "default" },
      why: "initialize the selected store",
    });
  }
  const envelope = {
    ok: false,
    result: null,
    reconciliation: NOT_APPLICABLE,
    advice,
    basis: null,
    error: { code, message, issues },
  };
  return { envelope, exit };
}

async function appendDraft(draft: RecordDraft, selector: string | undefined): Promise<BaseResponse> {
  const store = new PlainFileStore(resolveRoot(selector));
  await store.head();
  const application = createLoreduApplication({
    store,
    clock: new SystemClock(),
    randomSource: new CryptographicRandomSource(),
  });
  const appended = await application.append(draft);
  const result = Object.freeze({
    id: appended.record.id,
    kind: appended.record.kind,
    position: appended.position,
    handle: handle(appended.record.id, appended.record.kind),
  });
  return success(result, appended.position, { operation: "add", id: appended.record.id });
}

function commonSpecs(extra: Readonly<Record<string, OptionSpec>>): Readonly<Record<string, OptionSpec>> {
  return { ...COMMON_SPECS, ...extra };
}

async function execute(
  argv: readonly string[],
  io: CliIo,
): Promise<{
  readonly response?: BaseResponse;
  readonly direct?: string;
  readonly exit: number;
  readonly json: boolean;
  readonly selector?: string;
}> {
  if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "-v")) {
    return { direct: `${versionLine()}\n`, exit: 0, json: false };
  }
  if (argv.includes("--version") || argv.includes("-v")) usage("--version and -v must be used alone");

  const global = extractGlobals(argv);
  const tokens = global.rest;
  const first = tokens[0];
  let path: string;
  let optionTokens: readonly string[];
  if (first === undefined) {
    path = "status";
    optionTokens = [];
  } else if (
    first === "add" &&
    (tokens[1] === "entry" || tokens[1] === "claim" || tokens[1] === "verification")
  ) {
    path = `add ${tokens[1]}`;
    optionTokens = tokens.slice(2);
  } else if (["init", "relate", "resolve", "show", "head", "status", "skill"].includes(first)) {
    path = first;
    optionTokens = tokens.slice(1);
  } else {
    usage(`unknown command: ${first}`);
  }

  if (optionTokens.length === 1 && optionTokens[0] === "--help") {
    if (global.json || global.store !== undefined) usage("--help cannot be combined with global options");
    return { direct: `${HELP[path]}\n`, exit: 0, json: false };
  }

  if (path === "skill") {
    const parsed = parseOptions(optionTokens, {}, global);
    if (parsed.store !== undefined || parsed.positionals.length > 0) usage("skill accepts only --json");
    if (!parsed.json) return { direct: EMBEDDED_AGENT_SKILL, exit: 0, json: false };
    return {
      response: Object.freeze({
        ok: true,
        result: Object.freeze({ guide: EMBEDDED_AGENT_SKILL }),
        reconciliation: NOT_APPLICABLE,
        advice: Object.freeze([]),
        basis: null,
      }),
      exit: 0,
      json: true,
    };
  }

  if (path === "init") {
    const parsed = parseOptions(optionTokens, {}, global);
    if (parsed.positionals.length > 1) usage("init accepts at most one selector");
    if (parsed.store !== undefined && parsed.positionals.length === 1) {
      usage("init positional selector and --store are mutually exclusive");
    }
    const selector = parsed.store ?? parsed.positionals[0];
    const root = resolveRoot(selector);
    await initializePlainFileStore(root);
    return {
      response: success(Object.freeze({ root, selector: selector ?? "default" }), createStreamPosition(0), {
        operation: "init",
      }),
      exit: 0,
      json: parsed.json,
      ...(selector === undefined ? {} : { selector }),
    };
  }

  if (path === "add entry") {
    const parsed = parseOptions(
      optionTokens,
      commonSpecs({ "--body": { value: true }, "--type": { value: true }, "--title": { value: true } }),
      global,
    );
    if (parsed.positionals.length > 0) usage("add entry accepts no positional arguments");
    const common = commonDraft(parsed);
    const bodyOption = requiredOption(parsed, "--body");
    let body = bodyOption;
    if (bodyOption === "-") {
      try {
        body = new TextDecoder("utf-8", { fatal: true }).decode(await io.readStdin());
      } catch {
        throw new LoreduError("VALIDATION_FAILED", "stdin is not valid UTF-8", [
          Object.freeze({ code: "FORMAT", path: "/body", message: "stdin must be valid UTF-8" }),
        ]);
      }
    }
    const draft = decodeRecordDraft({
      kind: "entry",
      ...common,
      body,
      ...(option(parsed, "--type") === undefined ? {} : { entry_type: option(parsed, "--type") }),
      ...(option(parsed, "--title") === undefined ? {} : { title: option(parsed, "--title") }),
    });
    return {
      response: await appendDraft(draft, parsed.store),
      exit: 0,
      json: parsed.json,
      ...(parsed.store === undefined ? {} : { selector: parsed.store }),
    };
  }

  if (path === "add claim") {
    const parsed = parseOptions(
      optionTokens,
      commonSpecs({
        "--subject-type": { value: true },
        "--subject": { value: true },
        "--predicate": { value: true },
        "--value": { value: true },
        "--value-json": { value: true },
        "--confidence": { value: true },
        "--class": { value: true },
        "--perspective": { value: true },
        "--valid-from": { value: true },
        "--valid-until": { value: true },
        "--derived-from": { value: true, repeat: true },
      }),
      global,
    );
    if (parsed.positionals.length > 0) usage("add claim accepts no positional arguments");
    const scalarValue = option(parsed, "--value");
    const jsonValue = option(parsed, "--value-json");
    if ((scalarValue === undefined) === (jsonValue === undefined))
      usage("exactly one of --value or --value-json is required");
    const draft = decodeRecordDraft({
      kind: "claim",
      ...commonDraft(parsed),
      subject: { type: requiredOption(parsed, "--subject-type"), id: requiredOption(parsed, "--subject") },
      predicate: requiredOption(parsed, "--predicate"),
      value: scalarValue ?? parseJson(jsonValue as string, "/value"),
      confidence: requiredOption(parsed, "--confidence"),
      ...(option(parsed, "--class") === undefined ? {} : { claim_class: option(parsed, "--class") }),
      ...(option(parsed, "--perspective") === undefined
        ? {}
        : { perspective: option(parsed, "--perspective") }),
      ...(option(parsed, "--valid-from") === undefined ? {} : { valid_from: option(parsed, "--valid-from") }),
      ...(option(parsed, "--valid-until") === undefined
        ? {}
        : { valid_until: option(parsed, "--valid-until") }),
      ...(options(parsed, "--derived-from").length === 0
        ? {}
        : { derived_from: options(parsed, "--derived-from") }),
    });
    return {
      response: await appendDraft(draft, parsed.store),
      exit: 0,
      json: parsed.json,
      ...(parsed.store === undefined ? {} : { selector: parsed.store }),
    };
  }

  if (path === "relate") {
    const parsed = parseOptions(
      optionTokens,
      commonSpecs({ "--from": { value: true }, "--to": { value: true }, "--type": { value: true } }),
      global,
    );
    if (parsed.positionals.length > 0) usage("relate accepts no positional arguments");
    const draft = decodeRecordDraft({
      kind: "relation",
      ...commonDraft(parsed),
      from: requiredOption(parsed, "--from"),
      to: requiredOption(parsed, "--to"),
      relation_type: requiredOption(parsed, "--type"),
    });
    return {
      response: await appendDraft(draft, parsed.store),
      exit: 0,
      json: parsed.json,
      ...(parsed.store === undefined ? {} : { selector: parsed.store }),
    };
  }

  if (path === "resolve") {
    const parsed = parseOptions(
      optionTokens,
      commonSpecs({
        "--target": { value: true, repeat: true },
        "--decision": { value: true },
        "--replacement": { value: true },
        "--reason": { value: true },
        "--effective-at": { value: true },
      }),
      global,
    );
    if (parsed.positionals.length > 0) usage("resolve accepts no positional arguments");
    const draft = decodeRecordDraft({
      kind: "resolution",
      ...commonDraft(parsed),
      targets: options(parsed, "--target"),
      decision: requiredOption(parsed, "--decision"),
      reason: requiredOption(parsed, "--reason"),
      ...(option(parsed, "--replacement") === undefined
        ? {}
        : { replacement: option(parsed, "--replacement") }),
      ...(option(parsed, "--effective-at") === undefined
        ? {}
        : { effective_at: option(parsed, "--effective-at") }),
    });
    return {
      response: await appendDraft(draft, parsed.store),
      exit: 0,
      json: parsed.json,
      ...(parsed.store === undefined ? {} : { selector: parsed.store }),
    };
  }

  if (path === "add verification") {
    const parsed = parseOptions(
      optionTokens,
      commonSpecs({
        "--target": { value: true, repeat: true },
        "--verified-against-json": { value: true, repeat: true },
        "--result": { value: true },
      }),
      global,
    );
    if (parsed.positionals.length > 0) usage("add verification accepts no positional arguments");
    const draft = decodeRecordDraft({
      kind: "verification",
      ...commonDraft(parsed),
      targets: options(parsed, "--target"),
      verified_against: options(parsed, "--verified-against-json").map((value, index) =>
        parseJson(value, `/verified_against/${index}`),
      ),
      result: requiredOption(parsed, "--result"),
    });
    return {
      response: await appendDraft(draft, parsed.store),
      exit: 0,
      json: parsed.json,
      ...(parsed.store === undefined ? {} : { selector: parsed.store }),
    };
  }

  if (path === "show") {
    const parsed = parseOptions(optionTokens, {}, global);
    if (parsed.positionals.length !== 1) usage("show requires exactly one record id");
    const id = recordId(parsed.positionals[0] as string);
    const scan = await new PlainFileStore(resolveRoot(parsed.store)).scan();
    const item = scan.records.find(({ record }) => record.id === id);
    if (item === undefined) throw new CliExpectedError("RECORD_NOT_FOUND", `record not found: ${id}`);
    const byId = new Map(scan.records.map((candidate) => [candidate.record.id, candidate]));
    const handles = [handle(item.record.id, item.record.kind)];
    for (const reference of referencedIds(item.record)) {
      const target = byId.get(reference);
      if (
        target !== undefined &&
        target.position < item.position &&
        !handles.some((value) => value.id === reference)
      ) {
        handles.push(handle(target.record.id, target.record.kind));
      }
    }
    const response = success(
      Object.freeze({ record: item.record, position: item.position, handles: Object.freeze(handles) }),
      scan.head,
      { operation: "show", id },
    );
    return {
      response,
      exit: 0,
      json: parsed.json,
      ...(parsed.store === undefined ? {} : { selector: parsed.store }),
    };
  }

  if (path === "head") {
    const parsed = parseOptions(optionTokens, {}, global);
    if (parsed.positionals.length > 0) usage("head accepts no positional arguments");
    const position = await new PlainFileStore(resolveRoot(parsed.store)).head();
    return {
      response: success(Object.freeze({ stream_position: position }), position, { operation: "head" }),
      exit: 0,
      json: parsed.json,
      ...(parsed.store === undefined ? {} : { selector: parsed.store }),
    };
  }

  const parsed = parseOptions(optionTokens, { "--check": { value: false } }, global);
  if (parsed.positionals.length > 0) usage("status accepts no positional arguments");
  const scan = await new PlainFileStore(resolveRoot(parsed.store)).scan();
  const status = statusResult(scan);
  const response = Object.freeze({
    ...success(status.result, scan.head, { operation: "status" }),
    advice: status.advice,
    page: Object.freeze({ returned: status.total, total: status.total }),
  });
  return {
    response,
    exit: parsed.flags.has("--check") && status.result.healthy === false ? 5 : 0,
    json: parsed.json,
    ...(parsed.store === undefined ? {} : { selector: parsed.store }),
  };
}

/** Renders the direct metadata line without resolving a store. */
export function versionLine(home: string = defaultLoreduHome()): string {
  return `lor ${LOR_VERSION} (schema ${RECORD_SCHEMA_ID}, store ${STORE_ADAPTER_NAME}, home ${home})`;
}

/** Runs one CLI invocation. Every emitted payload owns its trailing LF. */
export async function run(argv: readonly string[], io: CliIo): Promise<number> {
  const wantsJson = detectsJson(argv);
  let selector: string | undefined;
  try {
    const execution = await execute(argv, io);
    selector = execution.selector;
    if (execution.direct !== undefined) io.out(execution.direct);
    else if (execution.response !== undefined) {
      if (execution.json) emitJson(io, rendered(execution.response, execution.selector));
      else emitText(io, execution.response, execution.selector);
    }
    return execution.exit;
  } catch (error) {
    try {
      selector = extractGlobals(argv).store;
    } catch {}
    const failure = cliFailure(error, selector);
    if (wantsJson) emitJson(io, rendered(failure.envelope, selector));
    else {
      const envelope = failure.envelope as {
        error: { code: string; message: string };
        advice: readonly Affordance[];
      };
      io.out(`error: ${envelope.error.code}: ${envelope.error.message}\n`);
      for (const advice of envelope.advice) io.out(`advice: ${runFor(advice, selector)}\n`);
    }
    return failure.exit;
  }
}
