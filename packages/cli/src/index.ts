import { homedir } from "node:os";
import { isAbsolute, sep } from "node:path";
import {
  type Actor,
  type Affordance,
  type ClaimPolicy,
  type ClaimQuery,
  type Clock,
  type CurrentQuery,
  createBasis,
  createLoreduApplication,
  createStreamPosition,
  DEFAULT_CLAIM_POLICY,
  DEFAULT_RULESET_IDENTITY,
  decodeRecordDraft,
  type HistoryQuery,
  type JsonValue,
  LoreduError,
  type RandomSource,
  RECORD_SCHEMA_ID,
  type RecordDraft,
  type RecordId,
  type Scope,
  type StatusQuery,
  type WorkingLoreBasis,
  type WorkingLoreQuery,
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

/** Optional application dependencies supplied by an embedding composition root. */
export interface CliRunOptions {
  readonly claimPolicy?: ClaimPolicy;
  readonly clock?: Clock;
  readonly randomSource?: RandomSource;
}

interface BaseResponse {
  readonly ok: true;
  readonly result: unknown;
  readonly reconciliation: unknown;
  readonly advice: readonly Affordance[];
  readonly basis: ReturnType<typeof createBasis> | WorkingLoreBasis | null;
  readonly page?: { readonly returned: number; readonly total: number; readonly cursor?: string };
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

const NOT_APPLICABLE = Object.freeze({
  state: "not-applicable" as const,
  related: Object.freeze([]) as readonly [],
});
const RECORD_ID = /^(ent|clm|rel|res|ver)_[0-9abcdefghjkmnpqrstvwxyz]{16}$/;
const GLOBAL_SPECS: Readonly<Record<string, OptionSpec>> = {
  "--json": { value: false },
  "--store": { value: true },
};
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
  history: "usage: lor history [<record-id>] [--limit <n>] [--cursor <token>] [--json]",
  claims: "usage: lor claims [filters] [--limit <n>] [--cursor <token>] [--json]",
  current:
    "usage: lor current [--scope <key=value>]... [--as-of <rfc3339>] [--valid-at <rfc3339>] [--limit <n>] [--cursor <token>] [--json]",
  lore: "usage: lor lore --activity <token> [--scope <key=value>]... [--corpus-json <SourceRef>] [--max-items <n>] [--max-chars <n>] [--cursor <token>] [--json]",
  head: "usage: lor head [--json]",
  status: "usage: lor status [--check] [--limit <n>] [--cursor <token>] [--json]",
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

function commandPath(argv: readonly string[]): string | undefined {
  const words: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--store") {
      index += 1;
      continue;
    }
    if (token === "--json") continue;
    if (token !== undefined) words.push(token);
    if (words.length === 2 || (words.length === 1 && words[0] !== "add")) break;
  }
  if (words[0] === "add" && words[1] !== undefined) return `add ${words[1]}`;
  return words[0];
}

function recognizedValueOptions(argv: readonly string[]): ReadonlySet<string> {
  const path = commandPath(argv);
  const values = new Set<string>(["--store"]);
  const add = (...names: readonly string[]) => {
    for (const name of names) values.add(name);
  };
  if (path?.startsWith("add ") || path === "relate" || path === "resolve") {
    add("--actor", "--scope", "--metadata-json", "--source-json");
  }
  if (path === "add entry") add("--body", "--type", "--title");
  if (path === "add claim") {
    add(
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
    );
  }
  if (path === "relate") add("--from", "--to", "--type");
  if (path === "resolve") add("--target", "--decision", "--replacement", "--reason", "--effective-at");
  if (path === "add verification") add("--target", "--verified-against-json", "--result");
  if (path === "history") add("--limit", "--cursor");
  if (path === "claims") {
    add(
      "--scope",
      "--subject-type",
      "--subject",
      "--predicate",
      "--perspective",
      "--value",
      "--value-json",
      "--actor",
      "--since",
      "--same-key-as",
      "--limit",
      "--cursor",
    );
  }
  if (path === "status") add("--limit", "--cursor");
  if (path === "current") add("--scope", "--as-of", "--valid-at", "--limit", "--cursor");
  if (path === "lore")
    add("--activity", "--scope", "--corpus-json", "--max-items", "--max-chars", "--cursor");
  return values;
}

function detectsJson(argv: readonly string[]): boolean {
  const valueOptions = recognizedValueOptions(argv);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json") return true;
    if (token !== undefined && valueOptions.has(token)) index += 1;
  }
  return false;
}

function containsVersionOption(argv: readonly string[]): boolean {
  const valueOptions = recognizedValueOptions(argv);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--version" || token === "-v") return true;
    if (token !== undefined && valueOptions.has(token)) index += 1;
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
    if (!token.startsWith("-")) {
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
  const valueOptions = recognizedValueOptions(argv);
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
    if (valueOptions.has(token)) {
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

function escapePointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function parseScope(values: readonly string[]): Scope | undefined {
  if (values.length === 0) return undefined;
  const scope = Object.create(null) as Record<string, string>;
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
        Object.freeze({
          code: "DUPLICATE",
          path: `/scope/${escapePointer(key)}`,
          message: "duplicates a scope key",
        }),
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

function limitOption(optionsValue: ParsedOptions): number | undefined {
  const value = option(optionsValue, "--limit");
  return value === undefined ? undefined : Number(value);
}

function hasAnyOption(optionsValue: ParsedOptions, names: readonly string[]): boolean {
  return names.some((name) => optionsValue.values.has(name) || optionsValue.flags.has(name));
}

function selectionFor(selector: string | undefined): StoreRootSelection {
  if (selector === undefined) return { kind: "default" };
  if (isAbsolute(selector) || selector.includes(sep) || selector.startsWith(`.${sep}`)) {
    return { kind: "path", path: selector };
  }
  return { kind: "name", name: selector };
}

function resolveRoot(selector: string | undefined): string {
  const selection = selectionFor(selector);
  const loreduHome = process.env.LOREDU_HOME;
  if (selection.kind !== "path" && loreduHome !== undefined && loreduHome !== "" && !isAbsolute(loreduHome)) {
    throw new LoreduError("VALIDATION_FAILED", "LOREDU_HOME must be an absolute path", [
      Object.freeze({
        code: "FORMAT",
        path: "/environment/LOREDU_HOME",
        message: "must be an absolute path",
      }),
    ]);
  }
  try {
    return resolveStoreRoot(selection, {
      ...(loreduHome === undefined ? {} : { loreduHome }),
      osHome: homedir(),
      cwd: process.cwd(),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new LoreduError("VALIDATION_FAILED", "store selector is invalid", [
        Object.freeze({ code: "FORMAT", path: "/store", message: "must be a valid store name or path" }),
      ]);
    }
    throw new LoreduError("STORE_IO_FAILED", "store path could not be resolved");
  }
}

function initSuccess(root: string, selector: string | undefined): BaseResponse {
  const position = createStreamPosition(0);
  return Object.freeze({
    ok: true,
    result: Object.freeze({ root, selector: selector ?? "default" }),
    reconciliation: NOT_APPLICABLE,
    advice: Object.freeze([]),
    basis: createBasis({
      stream_position: position,
      ruleset: DEFAULT_RULESET_IDENTITY,
      query: { operation: "init" },
    }),
  });
}

function composeApplication(selector: string | undefined, options: CliRunOptions) {
  const store = new PlainFileStore(resolveRoot(selector));
  return {
    store,
    application: createLoreduApplication({
      store,
      clock: options.clock ?? new SystemClock(),
      randomSource: options.randomSource ?? new CryptographicRandomSource(),
      claimPolicy: options.claimPolicy ?? DEFAULT_CLAIM_POLICY,
    }),
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
  if (affordance.action === "current.read") {
    let command = `${prefix} current`;
    const query = params.query as Record<string, JsonValue> | undefined;
    const scope = query?.scope as Record<string, string> | undefined;
    if (scope !== undefined)
      for (const key of Object.keys(scope).sort()) command += ` --scope ${shellWord(`${key}=${scope[key]}`)}`;
    if (query?.as_of !== undefined) command += ` --as-of ${shellWord(String(query.as_of))}`;
    if (query?.valid_at !== undefined) command += ` --valid-at ${shellWord(String(query.valid_at))}`;
    if (params.cursor !== undefined) command += ` --cursor ${shellWord(String(params.cursor))}`;
    if (params.limit !== undefined) command += ` --limit ${String(params.limit)}`;
    return command;
  }
  if (affordance.action === "lore.read") {
    let command = `${prefix} lore`;
    const query = params.query as Record<string, JsonValue> | undefined;
    if (query !== undefined) {
      command += ` --activity ${shellWord(String(query.activity))}`;
      const scope = query.scope as Record<string, string> | undefined;
      if (scope !== undefined)
        for (const key of Object.keys(scope).sort())
          command += ` --scope ${shellWord(`${key}=${scope[key]}`)}`;
      if (query.corpus !== undefined) command += ` --corpus-json ${shellWord(JSON.stringify(query.corpus))}`;
    }
    if (params.cursor !== undefined) command += ` --cursor ${shellWord(String(params.cursor))}`;
    if (params.max_items !== undefined) command += ` --max-items ${String(params.max_items)}`;
    if (params.max_chars !== undefined) command += ` --max-chars ${String(params.max_chars)}`;
    return command;
  }
  if (affordance.action === "store.init") {
    const target = shellWord(String(params.selector));
    return String(params.selector).startsWith("-") ? `lor init --store ${target}` : `lor init ${target}`;
  }
  if (affordance.action === "history.list") {
    let command = `${prefix} history --cursor ${shellWord(String(params.cursor))}`;
    if (params.limit !== undefined) command += ` --limit ${String(params.limit)}`;
    return command;
  }
  const query = params.query as Record<string, JsonValue> | undefined;
  let command = `${prefix} claims`;
  if (query !== undefined) {
    if (query.same_key_as !== undefined) command += ` --same-key-as ${shellWord(String(query.same_key_as))}`;
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

function cloneProtocolValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneProtocolValue);
  if (typeof value !== "object" || value === null) return value;
  const output = Object.create(null) as Record<string, unknown>;
  for (const [key, item] of Object.entries(value)) output[key] = cloneProtocolValue(item);
  return output;
}

function renderAffordance(value: Affordance, selector: string | undefined): Record<string, unknown> {
  const output = cloneProtocolValue(value) as Record<string, unknown>;
  output.run = runFor(value, selector);
  return output;
}

function renderHandle(value: unknown, selector: string | undefined): unknown {
  if (typeof value !== "object" || value === null) return cloneProtocolValue(value);
  const handleValue = value as Record<string, unknown>;
  const output = cloneProtocolValue(value) as Record<string, unknown>;
  if (Array.isArray(handleValue.affordances)) {
    output.affordances = handleValue.affordances.map((item) =>
      renderAffordance(item as Affordance, selector),
    );
  }
  return output;
}

function renderSemanticNode(value: unknown, selector: string | undefined): unknown {
  if (Array.isArray(value)) return value.map((item) => renderSemanticNode(item, selector));
  if (typeof value !== "object" || value === null) return value;
  const semantic = value as Record<string, unknown>;
  const output = cloneProtocolValue(value) as Record<string, unknown>;
  if (semantic.handle !== undefined) output.handle = renderHandle(semantic.handle, selector);
  if (Array.isArray(semantic.handles))
    output.handles = semantic.handles.map((item) => renderHandle(item, selector));
  if (Array.isArray(semantic.related))
    output.related = semantic.related.map((item) => renderHandle(item, selector));
  if (semantic.representative !== undefined)
    output.representative = renderHandle(semantic.representative, selector);
  if (Array.isArray(semantic.representatives))
    output.representatives = semantic.representatives.map((item) => renderHandle(item, selector));
  if (semantic.kind === "dangling-record-reference" && semantic.record !== undefined)
    output.record = renderHandle(semantic.record, selector);
  if (Array.isArray(semantic.claims))
    output.claims = semantic.claims.map((item) => renderHandle(item, selector));
  else if (semantic.claims !== undefined)
    output.claims = renderAffordance(semantic.claims as Affordance, selector);
  if (Array.isArray(semantic.values)) {
    output.values = semantic.values.map((item) => {
      const renderedValue = cloneProtocolValue(item) as Record<string, unknown>;
      const currentValue = item as Record<string, unknown>;
      if (currentValue.representative !== undefined)
        renderedValue.representative = renderHandle(currentValue.representative, selector);
      return renderedValue;
    });
  }
  if (semantic.history !== undefined && typeof semantic.history === "object") {
    const history = semantic.history as Record<string, unknown>;
    const renderedHistory = cloneProtocolValue(history) as Record<string, unknown>;
    if (Array.isArray(history.relations)) {
      renderedHistory.relations = history.relations.map((item) => {
        const relation = item as Record<string, unknown>;
        return {
          ...(cloneProtocolValue(item) as Record<string, unknown>),
          from: renderHandle(relation.from, selector),
          to: renderHandle(relation.to, selector),
        };
      });
    }
    if (history.latest_resolution !== undefined)
      renderedHistory.latest_resolution = renderHandle(history.latest_resolution, selector);
    output.history = renderedHistory;
  }
  if (semantic.packet !== undefined) output.packet = renderSemanticNode(semantic.packet, selector);
  if (Array.isArray(semantic.sections))
    output.sections = semantic.sections.map((item) => renderSemanticNode(item, selector));
  if (semantic.knowledge !== undefined) output.knowledge = renderSemanticNode(semantic.knowledge, selector);
  if (Array.isArray(semantic.items))
    output.items = semantic.items.map((item) => renderSemanticNode(item, selector));
  if (Array.isArray(semantic.attention))
    output.attention = semantic.attention.map((item) => renderSemanticNode(item, selector));
  if (Array.isArray(semantic.advisories))
    output.advisories = semantic.advisories.map((item) => renderSemanticNode(item, selector));
  return output;
}

function rendered(value: unknown, selector: string | undefined): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return cloneProtocolValue(value);
  }
  const response = value as Record<string, unknown>;
  const output = cloneProtocolValue(value) as Record<string, unknown>;
  if (response.result !== null) output.result = renderSemanticNode(response.result, selector);
  output.reconciliation = renderSemanticNode(response.reconciliation, selector);
  if (Array.isArray(response.advice)) {
    output.advice = response.advice.map((item) => renderAffordance(item as Affordance, selector));
  }
  return output;
}

function emitJson(io: CliIo, value: unknown): void {
  io.out(`${JSON.stringify(value)}\n`);
}

function emitText(io: CliIo, response: BaseResponse, selector: string | undefined): void {
  const result = response.result as Record<string, unknown>;
  let remainingAdvice = response.advice;
  if (typeof result.id === "string") {
    io.out(`${result.id}\nkind: ${String(result.kind)}\nposition: ${String(result.position)}\n`);
    const resultHandle = result.handle as { readonly affordances?: readonly Affordance[] } | undefined;
    for (const affordance of resultHandle?.affordances ?? []) {
      io.out(`handle: ${runFor(affordance, selector)}\n`);
    }
  } else if (typeof result.stream_position === "number") {
    io.out(`stream_position=${result.stream_position}\n`);
  } else if (result.record !== undefined) {
    io.out(`record: ${JSON.stringify(result.record)}\nposition: ${String(result.position)}\n`);
    for (const resultHandle of (result.handles as readonly {
      readonly affordances: readonly Affordance[];
    }[]) ?? []) {
      for (const affordance of resultHandle.affordances) io.out(`handle: ${runFor(affordance, selector)}\n`);
    }
  } else if (typeof result.root === "string") {
    io.out(`initialized store at ${result.root}\nselector: ${String(result.selector)}\n`);
  } else if (result.packet !== undefined && typeof result.computed_at === "string") {
    const packet = result.packet as Record<string, unknown>;
    const orientation = packet.orientation as Record<string, number>;
    io.out(
      `orientation: current=${orientation.current_count} patterns=${orientation.pattern_count} candidates=${orientation.candidate_count} conflicts=${orientation.conflict_count} needs_revalidation=${orientation.needs_revalidation_count} attention=${orientation.attention_count}\n`,
    );
    io.out(`activity: ${String(packet.activity)}\nfilters: ${JSON.stringify(packet.filters)}\n`);
    const continuationCursors = new Set<string>();
    const packetSections = new Map(
      (packet.sections as readonly Record<string, unknown>[]).map((section) => [section.name, section]),
    );
    const sectionCounts = [
      ["current", "current_count"],
      ["patterns", "pattern_count"],
      ["candidates", "candidate_count"],
      ["conflicts", "conflict_count"],
      ["needs_revalidation", "needs_revalidation_count"],
    ] as const;
    for (const [name, count] of sectionCounts) {
      const section = packetSections.get(name);
      const page = section?.page as
        | { readonly returned: number; readonly total: number; readonly cursor?: string }
        | undefined;
      io.out(`${name}: returned=${page?.returned ?? 0} total=${page?.total ?? orientation[count]}\n`);
      for (const item of (section?.items as readonly Record<string, unknown>[] | undefined) ?? []) {
        const knowledge = item.knowledge as Record<string, unknown>;
        io.out(`  item: ${String(item.summary)}\n`);
        io.out(
          `    key: ${JSON.stringify(knowledge.key)} state=${String(knowledge.state)} values=${String(knowledge.value_count)}\n`,
        );
        io.out(`    claims: ${runFor(knowledge.claims as Affordance, selector)}\n`);
        for (const representative of knowledge.representatives as readonly Record<string, unknown>[]) {
          io.out(`    representative: ${String(representative.id)}\n`);
          for (const affordance of (representative.affordances as readonly Affordance[]) ?? [])
            io.out(`      disclosure: ${runFor(affordance, selector)}\n`);
        }
      }
      if (page?.cursor !== undefined) {
        continuationCursors.add(page.cursor);
        const continuation = response.advice.find(
          (item) => item.action === "lore.read" && item.params.cursor === page.cursor,
        );
        if (continuation !== undefined) io.out(`  continuation: ${runFor(continuation, selector)}\n`);
      }
    }
    remainingAdvice = response.advice.filter(
      (item) =>
        !(
          item.action === "lore.read" &&
          typeof item.params.cursor === "string" &&
          continuationCursors.has(item.params.cursor)
        ),
    );
    const budget = packet.budget as Record<string, number>;
    io.out(
      `budget: used_items=${budget.used_items}/${budget.max_items} used_chars=${budget.used_chars}/${budget.max_chars}\n`,
    );
    io.out(`computed_at: ${result.computed_at}\n`);
  } else if (Array.isArray(result.items) && typeof result.computed_at === "string") {
    for (const item of result.items as readonly Record<string, unknown>[]) {
      if (item.kind === "knowledge") {
        const key = item.key as Record<string, unknown>;
        io.out(`knowledge: ${JSON.stringify(key)} state=${String(item.state)}\n`);
        for (const value of (item.values as readonly Record<string, unknown>[]) ?? [])
          io.out(
            `  value: ${JSON.stringify(value.value)} representative=${String((value.representative as Record<string, unknown>).id)}\n`,
          );
      } else io.out(`policy-advisory: ${JSON.stringify(renderSemanticNode(item, selector))}\n`);
    }
    io.out(`computed_at: ${result.computed_at}\n`);
  } else if (typeof result.healthy === "boolean") {
    const health = result.health as Record<string, number>;
    io.out(
      `healthy: ${result.healthy}\nopen exclusive groups: ${health.unresolved_exclusive_groups}    dangling record refs: ${health.dangling_record_references}\nadvisories: ${String(result.advisory_count)}\n`,
    );
    for (const item of (result.attention as readonly unknown[]) ?? []) {
      io.out(`attention: ${JSON.stringify(renderSemanticNode(item, selector))}\n`);
    }
    for (const item of (result.advisories as readonly unknown[]) ?? []) {
      io.out(`advisory: ${JSON.stringify(renderSemanticNode(item, selector))}\n`);
    }
  } else io.out(`${JSON.stringify(renderSemanticNode(result, selector))}\n`);
  io.out(`reconciliation: ${JSON.stringify(renderSemanticNode(response.reconciliation, selector))}\n`);
  for (const advice of remainingAdvice) io.out(`advice: ${runFor(advice, selector)}\n`);
  if (response.basis !== null) io.out(`basis: ${JSON.stringify(response.basis)}\n`);
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
  } else if (error instanceof LoreduError) {
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
  const safeMessage: Readonly<Record<string, string>> = {
    STORE_NOT_FOUND: "selected store was not found",
    STORE_ALREADY_EXISTS: "selected store already exists",
    STORE_LOCKED: "selected store is locked",
    STORE_CORRUPT: "selected store is corrupt",
    STORE_IO_FAILED: "store operation failed",
    STORE_APPEND_FAILED: "store append failed",
    DUPLICATE_RECORD_ID: "record id already exists",
    RANDOM_SOURCE_FAILED: "cryptographic random source failed",
    CLOCK_FAILED: "system clock failed",
  };
  message = safeMessage[code] ?? message;
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

async function addDraft(
  draft: RecordDraft,
  selector: string | undefined,
  options: CliRunOptions,
): Promise<BaseResponse> {
  const { store, application } = composeApplication(selector, options);
  await store.head();
  return application.add(draft);
}

function commonSpecs(extra: Readonly<Record<string, OptionSpec>>): Readonly<Record<string, OptionSpec>> {
  return { ...COMMON_SPECS, ...extra };
}

async function execute(
  argv: readonly string[],
  io: CliIo,
  runOptions: CliRunOptions,
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
  if (containsVersionOption(argv)) usage("--version and -v must be used alone");

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
  } else if (
    [
      "init",
      "relate",
      "resolve",
      "show",
      "history",
      "claims",
      "current",
      "lore",
      "head",
      "status",
      "skill",
    ].includes(first)
  ) {
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
      response: initSuccess(root, selector),
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
    const bodyOption = requiredOption(parsed, "--body");
    const draftInput = {
      kind: "entry",
      ...commonDraft(parsed),
      body: bodyOption === "-" ? "stdin-pending" : bodyOption,
      ...(option(parsed, "--type") === undefined ? {} : { entry_type: option(parsed, "--type") }),
      ...(option(parsed, "--title") === undefined ? {} : { title: option(parsed, "--title") }),
    };
    let draft = decodeRecordDraft(draftInput);
    let prepared: ReturnType<typeof composeApplication> | undefined;
    if (bodyOption === "-") {
      prepared = composeApplication(parsed.store, runOptions);
      await prepared.store.head();
      const stdin = await io.readStdin();
      let body: string;
      try {
        body = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(stdin);
      } catch {
        throw new LoreduError("VALIDATION_FAILED", "stdin is not valid UTF-8", [
          Object.freeze({ code: "FORMAT", path: "/body", message: "stdin must be valid UTF-8" }),
        ]);
      }
      draft = decodeRecordDraft({ ...draftInput, body });
    }
    return {
      response:
        prepared === undefined
          ? await addDraft(draft, parsed.store, runOptions)
          : await prepared.application.add(draft),
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
      response: await addDraft(draft, parsed.store, runOptions),
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
      response: await addDraft(draft, parsed.store, runOptions),
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
      response: await addDraft(draft, parsed.store, runOptions),
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
      response: await addDraft(draft, parsed.store, runOptions),
      exit: 0,
      json: parsed.json,
      ...(parsed.store === undefined ? {} : { selector: parsed.store }),
    };
  }

  if (path === "show") {
    const parsed = parseOptions(optionTokens, {}, global);
    if (parsed.positionals.length !== 1) usage("show requires exactly one record id");
    const id = recordId(parsed.positionals[0] as string);
    const response = await composeApplication(parsed.store, runOptions).application.show(id);
    return {
      response,
      exit: 0,
      json: parsed.json,
      ...(parsed.store === undefined ? {} : { selector: parsed.store }),
    };
  }

  if (path === "history") {
    const parsed = parseOptions(
      optionTokens,
      { "--limit": { value: true }, "--cursor": { value: true } },
      global,
    );
    const cursor = option(parsed, "--cursor");
    if (cursor === undefined && parsed.positionals.length !== 1)
      usage("history requires exactly one record id without --cursor");
    if (cursor !== undefined && parsed.positionals.length > 0)
      usage("history positional id cannot accompany --cursor");
    const limit = limitOption(parsed);
    const query: HistoryQuery =
      cursor === undefined
        ? {
            id: recordId(parsed.positionals[0] as string),
            ...(limit === undefined ? {} : { limit }),
          }
        : { cursor, ...(limit === undefined ? {} : { limit }) };
    return {
      response: await composeApplication(parsed.store, runOptions).application.history(query),
      exit: 0,
      json: parsed.json,
      ...(parsed.store === undefined ? {} : { selector: parsed.store }),
    };
  }

  if (path === "claims") {
    const parsed = parseOptions(
      optionTokens,
      {
        "--scope": { value: true, repeat: true },
        "--exact-scope": { value: false },
        "--subject-type": { value: true },
        "--subject": { value: true },
        "--predicate": { value: true },
        "--perspective": { value: true },
        "--without-perspective": { value: false },
        "--value": { value: true },
        "--value-json": { value: true },
        "--actor": { value: true },
        "--since": { value: true },
        "--same-key-as": { value: true },
        "--limit": { value: true },
        "--cursor": { value: true },
      },
      global,
    );
    if (parsed.positionals.length > 0) usage("claims accepts no positional arguments");
    const cursor = option(parsed, "--cursor");
    const limit = limitOption(parsed);
    const filterOptions = [
      "--scope",
      "--exact-scope",
      "--subject-type",
      "--subject",
      "--predicate",
      "--perspective",
      "--without-perspective",
      "--value",
      "--value-json",
      "--actor",
      "--since",
      "--same-key-as",
    ] as const;
    if (cursor !== undefined && hasAnyOption(parsed, filterOptions))
      usage("claim filters cannot accompany --cursor");

    let query: ClaimQuery;
    if (cursor !== undefined) {
      query = { cursor, ...(limit === undefined ? {} : { limit }) };
    } else {
      const scopePairs = options(parsed, "--scope");
      const exactScope = parsed.flags.has("--exact-scope");
      const perspective = option(parsed, "--perspective");
      const withoutPerspective = parsed.flags.has("--without-perspective");
      if (perspective !== undefined && withoutPerspective)
        usage("--perspective and --without-perspective are mutually exclusive");
      const scalarValue = option(parsed, "--value");
      const jsonValue = option(parsed, "--value-json");
      if (scalarValue !== undefined && jsonValue !== undefined)
        usage("--value and --value-json are mutually exclusive");
      const sameKeyAs = option(parsed, "--same-key-as");
      const otherFilters = filterOptions.filter((name) => name !== "--same-key-as");
      if (sameKeyAs !== undefined && hasAnyOption(parsed, otherFilters))
        usage("--same-key-as is mutually exclusive with every other claim filter");
      const actorValue = option(parsed, "--actor");
      const subjectType = option(parsed, "--subject-type");
      const subject = option(parsed, "--subject");
      const predicate = option(parsed, "--predicate");
      const since = option(parsed, "--since");
      const scope =
        scopePairs.length === 0 ? (exactScope ? ({} as Scope) : undefined) : parseScope(scopePairs);
      query = {
        ...(sameKeyAs === undefined ? {} : { same_key_as: sameKeyAs }),
        ...(scope === undefined ? {} : { scope }),
        ...(exactScope ? { scope_match: "exact" as const } : {}),
        ...(subjectType === undefined ? {} : { subject_type: subjectType }),
        ...(subject === undefined ? {} : { subject }),
        ...(predicate === undefined ? {} : { predicate }),
        ...(withoutPerspective ? { perspective: null } : perspective === undefined ? {} : { perspective }),
        ...(scalarValue !== undefined
          ? { value: scalarValue }
          : jsonValue === undefined
            ? {}
            : { value: parseJson(jsonValue, "/value") as JsonValue }),
        ...(actorValue === undefined ? {} : { actor: parseActor(actorValue) as Actor }),
        ...(since === undefined ? {} : { since }),
        ...(limit === undefined ? {} : { limit }),
      } as ClaimQuery;
    }
    return {
      response: await composeApplication(parsed.store, runOptions).application.claims(query),
      exit: 0,
      json: parsed.json,
      ...(parsed.store === undefined ? {} : { selector: parsed.store }),
    };
  }

  if (path === "current") {
    const parsed = parseOptions(
      optionTokens,
      {
        "--scope": { value: true, repeat: true },
        "--as-of": { value: true },
        "--valid-at": { value: true },
        "--limit": { value: true },
        "--cursor": { value: true },
      },
      global,
    );
    if (parsed.positionals.length > 0) usage("current accepts no positional arguments");
    const cursor = option(parsed, "--cursor");
    const limit = limitOption(parsed);
    if (cursor !== undefined && hasAnyOption(parsed, ["--scope", "--as-of", "--valid-at"]))
      usage("current filters cannot accompany --cursor");
    const scope = parseScope(options(parsed, "--scope"));
    const asOf = option(parsed, "--as-of");
    const validAt = option(parsed, "--valid-at");
    const query: CurrentQuery =
      cursor === undefined
        ? {
            ...(scope === undefined ? {} : { scope }),
            ...(asOf === undefined ? {} : { as_of: asOf }),
            ...(validAt === undefined ? {} : { valid_at: validAt }),
            ...(limit === undefined ? {} : { limit }),
          }
        : { cursor, ...(limit === undefined ? {} : { limit }) };
    return {
      response: await composeApplication(parsed.store, runOptions).application.current(query),
      exit: 0,
      json: parsed.json,
      ...(parsed.store === undefined ? {} : { selector: parsed.store }),
    };
  }

  if (path === "lore") {
    const parsed = parseOptions(
      optionTokens,
      {
        "--activity": { value: true },
        "--scope": { value: true, repeat: true },
        "--corpus-json": { value: true },
        "--max-items": { value: true },
        "--max-chars": { value: true },
        "--cursor": { value: true },
      },
      global,
    );
    if (parsed.positionals.length > 0) usage("lore accepts no positional arguments");
    const cursor = option(parsed, "--cursor");
    if (cursor !== undefined && hasAnyOption(parsed, ["--activity", "--scope", "--corpus-json"]))
      usage("lore filters cannot accompany --cursor");
    const maxItemsText = option(parsed, "--max-items");
    const maxCharsText = option(parsed, "--max-chars");
    const budgets = {
      ...(maxItemsText === undefined ? {} : { max_items: Number(maxItemsText) }),
      ...(maxCharsText === undefined ? {} : { max_chars: Number(maxCharsText) }),
    };
    let query: WorkingLoreQuery;
    if (cursor !== undefined) query = { cursor, ...budgets };
    else {
      const scope = parseScope(options(parsed, "--scope"));
      const corpusText = option(parsed, "--corpus-json");
      query = {
        activity: requiredOption(parsed, "--activity"),
        ...(scope === undefined ? {} : { scope }),
        ...(corpusText === undefined ? {} : { corpus: parseJson(corpusText, "/corpus") }),
        ...budgets,
      } as WorkingLoreQuery;
    }
    return {
      response: await composeApplication(parsed.store, runOptions).application.lore(query),
      exit: 0,
      json: parsed.json,
      ...(parsed.store === undefined ? {} : { selector: parsed.store }),
    };
  }

  if (path === "head") {
    const parsed = parseOptions(optionTokens, {}, global);
    if (parsed.positionals.length > 0) usage("head accepts no positional arguments");
    return {
      response: await composeApplication(parsed.store, runOptions).application.readHead(),
      exit: 0,
      json: parsed.json,
      ...(parsed.store === undefined ? {} : { selector: parsed.store }),
    };
  }

  const parsed = parseOptions(
    optionTokens,
    { "--check": { value: false }, "--limit": { value: true }, "--cursor": { value: true } },
    global,
  );
  if (parsed.positionals.length > 0) usage("status accepts no positional arguments");
  const cursor = option(parsed, "--cursor");
  if (cursor !== undefined && parsed.flags.has("--check")) usage("--check cannot accompany --cursor");
  const limit = limitOption(parsed);
  const query: StatusQuery =
    cursor === undefined
      ? { ...(limit === undefined ? {} : { limit }) }
      : { cursor, ...(limit === undefined ? {} : { limit }) };
  const response = await composeApplication(parsed.store, runOptions).application.status(query);
  const statusResult = response.result as { readonly healthy: boolean };
  return {
    response,
    exit: parsed.flags.has("--check") && !statusResult.healthy ? 5 : 0,
    json: parsed.json,
    ...(parsed.store === undefined ? {} : { selector: parsed.store }),
  };
}

/** Renders the direct metadata line without resolving a store. */
export function versionLine(home: string = defaultLoreduHome({}, homedir())): string {
  return `lor ${LOR_VERSION} (schema ${RECORD_SCHEMA_ID}, store ${STORE_ADAPTER_NAME}, home ${home})`;
}

/** Runs one CLI invocation. Every emitted payload owns its trailing LF. */
export async function run(argv: readonly string[], io: CliIo, options: CliRunOptions = {}): Promise<number> {
  const wantsJson = detectsJson(argv);
  let selector: string | undefined;
  try {
    const execution = await execute(argv, io, options);
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
