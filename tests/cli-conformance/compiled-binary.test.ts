import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import {
  type ClaimPolicy,
  createInstant,
  createLoreduApplication,
  DEFAULT_CLAIM_POLICY,
  decodePersistedRecord,
  decodeRecordDraft,
  type JsonValue,
  type RecordDraft,
  type RecordId,
} from "@loredu/kernel";
import { InMemoryStore } from "@loredu/kernel/testing";
import { encodePlainFileRecord, PlainFileStore, recordFileName } from "@loredu/store-plainfile";

const workspace = resolve(import.meta.dir, "../..");
const binary = join(workspace, "packages/cli/dist/lor");
const conformanceBinary = join(workspace, "packages/cli/dist/lor-conformance");
const homes: string[] = [];

interface Invocation {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface ConformanceCapabilities {
  readonly instant: number;
  readonly entropy: string;
  readonly policy?: "default" | "coexisting";
}

async function invokeExecutable(
  executable: string,
  args: readonly string[],
  stdin: string | Uint8Array | undefined,
  cwd: string,
  loreduHome: string,
  extraEnvironment: Readonly<Record<string, string>> = {},
): Promise<Invocation> {
  const process = Bun.spawn([executable, ...args], {
    cwd,
    env: { ...Bun.env, ...extraEnvironment, LOREDU_HOME: loreduHome },
    stdin: stdin === undefined ? "ignore" : new Blob([stdin]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  return { exitCode, stdout, stderr };
}

async function invoke(
  home: string,
  args: readonly string[],
  stdin?: string | Uint8Array,
  cwd: string = workspace,
  loreduHome: string = home,
): Promise<Invocation> {
  return invokeExecutable(binary, args, stdin, cwd, loreduHome);
}

function invokeConformance(
  home: string,
  args: readonly string[],
  capabilities: ConformanceCapabilities,
): Promise<Invocation> {
  return invokeExecutable(conformanceBinary, args, undefined, workspace, home, {
    LOREDU_TEST_INSTANT: String(capabilities.instant),
    LOREDU_TEST_ENTROPY: capabilities.entropy,
    LOREDU_TEST_POLICY: capabilities.policy ?? "default",
  });
}

async function invokeShell(home: string, command: string): Promise<Invocation> {
  const process = Bun.spawn(["/bin/sh", "-c", command], {
    cwd: workspace,
    env: {
      ...Bun.env,
      LOREDU_HOME: home,
      PATH: `${join(workspace, "packages/cli/dist")}:${Bun.env.PATH ?? ""}`,
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  return { exitCode, stdout, stderr };
}

async function invokeWithOpenStdin(home: string, args: readonly string[]): Promise<Invocation> {
  const process = Bun.spawn([binary, ...args], {
    cwd: workspace,
    env: { ...Bun.env, LOREDU_HOME: home },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  const outcome = await Promise.race([
    process.exited.then((exitCode) => ({ kind: "exit" as const, exitCode })),
    Bun.sleep(1_000).then(() => ({ kind: "timeout" as const })),
  ]);
  if (outcome.kind === "timeout") {
    process.kill();
    await process.exited;
    throw new Error("compiled lor waited for stdin before store preflight");
  }
  const [stdout, stderr] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  return { exitCode: outcome.exitCode, stdout, stderr };
}

function json(invocation: Invocation): Record<string, unknown> {
  expect(invocation.stdout.endsWith("\n")).toBe(true);
  expect(invocation.stdout.trimEnd().includes("\n")).toBe(false);
  expect(invocation.stderr).toBe("");
  return JSON.parse(invocation.stdout) as Record<string, unknown>;
}

async function freshHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), "loredu-cli-"));
  homes.push(home);
  return home;
}

async function invokeWithFeedbackReadFailure(
  home: string,
  root: string,
  args: readonly string[],
): Promise<Invocation> {
  const records = join(root, "records");
  const displaced = join(root, "records-feedback-unavailable");
  const saboteur = Bun.spawn(
    [
      "/bin/sh",
      "-c",
      'while [ ! -d "$LOREDU_TEST_ROOT/.loredu/write.lock" ]; do :; done\n' +
        "i=0\n" +
        'while [ "$i" -lt 10000 ]; do\n' +
        '  printf "" > "$LOREDU_TEST_ROOT/.loredu/write.lock/padding-$i" 2>/dev/null || break\n' +
        "  i=$((i + 1))\n" +
        "done\n" +
        'while [ -d "$LOREDU_TEST_ROOT/.loredu/write.lock" ]; do :; done\n' +
        'mv "$LOREDU_TEST_ROOT/records" "$LOREDU_TEST_ROOT/records-feedback-unavailable"',
    ],
    {
      env: { ...Bun.env, LOREDU_TEST_ROOT: root },
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    },
  );
  await Bun.sleep(10);
  const invocation = await invoke(home, args);
  const sabotage = await Promise.race([
    saboteur.exited.then((exitCode) => ({ exitCode })),
    Bun.sleep(5_000).then(() => undefined),
  ]);
  if (sabotage === undefined) {
    saboteur.kill();
    await saboteur.exited;
    throw new Error("feedback-read failure injection timed out");
  }
  expect(sabotage).toEqual({ exitCode: 0 });
  await rename(displaced, records);
  return invocation;
}

function withoutRuns(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutRuns);
  if (typeof value !== "object" || value === null) return value;
  const output = Object.create(null) as Record<string, unknown>;
  for (const [key, item] of Object.entries(value)) {
    if (key !== "run") output[key] = withoutRuns(item);
  }
  return output;
}

function deterministicApplication(
  store: InMemoryStore,
  capabilities: ConformanceCapabilities,
  claimPolicy: ClaimPolicy = DEFAULT_CLAIM_POLICY,
) {
  const bytes = Uint8Array.from({ length: 10 }, (_, index) =>
    Number.parseInt(capabilities.entropy.slice(index * 2, index * 2 + 2), 16),
  );
  return createLoreduApplication({
    store,
    clock: { now: () => createInstant(capabilities.instant) },
    randomSource: { nextBytes: () => bytes.slice() },
    claimPolicy,
  });
}

function readApplication(root: string) {
  return createLoreduApplication({
    store: new PlainFileStore(root),
    clock: {
      now: () => {
        throw new Error("read operation consumed Clock");
      },
    },
    randomSource: {
      nextBytes: () => {
        throw new Error("read operation consumed RandomSource");
      },
    },
  });
}

function cursorPayload(cursor: string): Record<string, unknown> {
  const prefix = "loredu.cursor.v1.";
  expect(cursor.startsWith(prefix)).toBe(true);
  return JSON.parse(Buffer.from(cursor.slice(prefix.length), "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
}

function encodeCursor(payload: Record<string, unknown>): string {
  return `loredu.cursor.v1.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

function expectRenderedAffordances(value: unknown, selector: string): void {
  if (Array.isArray(value)) {
    for (const item of value) expectRenderedAffordances(item, selector);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const object = value as Record<string, unknown>;
  if (
    typeof object.rel === "string" &&
    typeof object.action === "string" &&
    typeof object.why === "string" &&
    typeof object.params === "object"
  ) {
    expect(typeof object.run).toBe("string");
    if (object.action !== "store.init") expect(object.run as string).toContain(" --store ");
    expect(object.run as string).toContain(selector.includes(" ") ? "'" : selector);
  }
  for (const item of Object.values(object)) expectRenderedAffordances(item, selector);
}

beforeAll(async () => {
  const build = Bun.spawn(["bun", "run", "build"], {
    cwd: workspace,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(build.stdout).text(),
    new Response(build.stderr).text(),
    build.exited,
  ]);
  expect(`${stdout}${stderr}`, "compiled binary build output").toContain("Exited with code 0");
  expect(exitCode).toBe(0);

  const fixtureBuild = Bun.spawn(
    ["bun", "build", "--compile", "--outfile", conformanceBinary, "packages/cli/bin/lor-conformance.ts"],
    { cwd: workspace, stdout: "pipe", stderr: "pipe" },
  );
  const [fixtureStdout, fixtureStderr, fixtureExit] = await Promise.all([
    new Response(fixtureBuild.stdout).text(),
    new Response(fixtureBuild.stderr).text(),
    fixtureBuild.exited,
  ]);
  expect(fixtureExit, `${fixtureStdout}${fixtureStderr}`).toBe(0);
});

afterAll(async () => {
  await Promise.all(homes.map((home) => rm(home, { recursive: true, force: true })));
});

test("every M1.5 semantic command returns one equivalent JSON envelope — @covers T50", async () => {
  const home = await freshHome();
  const initialized = json(await invoke(home, ["init", "work", "--json"]));
  expect(initialized.ok).toBe(true);
  expect((initialized.result as { selector: string }).selector).toBe("work");
  const root = (initialized.result as { root: string }).root;
  const mirror = new InMemoryStore();
  const capabilities: readonly ConformanceCapabilities[] = [
    { instant: 1_700_000_000_000, entropy: "00010203040506070809" },
    { instant: 1_700_000_000_001, entropy: "10111213141516171819" },
    { instant: 1_700_000_000_002, entropy: "20212223242526272829" },
    { instant: 1_700_000_000_003, entropy: "30313233343536373839" },
    { instant: 1_700_000_000_004, entropy: "40414243444546474849" },
  ];
  const addAndCompare = async (
    args: readonly string[],
    draftInput: RecordDraft,
    capability: ConformanceCapabilities,
  ) => {
    const cli = json(await invokeConformance(home, args, capability));
    const direct = await deterministicApplication(mirror, capability).add(draftInput);
    expect(withoutRuns(cli)).toEqual(JSON.parse(JSON.stringify(direct)));
    return cli;
  };
  const actor = { type: "agent" as const, id: "compiled-test" };

  const entryDraft = decodeRecordDraft({ kind: "entry", actor, body: "evidence" });
  const entry = await addAndCompare(
    ["add", "--json", "--store", "work", "entry", "--actor", "agent:compiled-test", "--body", "evidence"],
    entryDraft,
    capabilities[0] as ConformanceCapabilities,
  );
  const entryId = (entry.result as { id: string }).id as RecordId;

  const claimDraft = decodeRecordDraft({
    kind: "claim",
    actor,
    scope: { repo: "loredu" },
    subject: { type: "code-area", id: "cli" },
    predicate: "state",
    value: "compiled",
    confidence: "observed",
    derived_from: [entryId],
  });
  const claim = await addAndCompare(
    [
      "add",
      "claim",
      "--store",
      "work",
      "--actor",
      "agent:compiled-test",
      "--scope",
      "repo=loredu",
      "--subject-type",
      "code-area",
      "--subject",
      "cli",
      "--predicate",
      "state",
      "--value",
      "compiled",
      "--confidence",
      "observed",
      "--derived-from",
      entryId,
      "--json",
    ],
    claimDraft,
    capabilities[1] as ConformanceCapabilities,
  );
  const claimId = (claim.result as { id: string }).id as RecordId;

  const relationDraft = decodeRecordDraft({
    kind: "relation",
    actor,
    from: claimId,
    to: entryId,
    relation_type: "supports",
  });
  await addAndCompare(
    [
      "--store",
      "work",
      "relate",
      "--actor",
      "agent:compiled-test",
      "--from",
      claimId,
      "--to",
      entryId,
      "--type",
      "supports",
      "--json",
    ],
    relationDraft,
    capabilities[2] as ConformanceCapabilities,
  );

  const resolutionDraft = decodeRecordDraft({
    kind: "resolution",
    actor,
    targets: [claimId],
    decision: "prefer",
    replacement: claimId,
    reason: "verified source",
  });
  await addAndCompare(
    [
      "resolve",
      "--store",
      "work",
      "--actor",
      "agent:compiled-test",
      "--target",
      claimId,
      "--decision",
      "prefer",
      "--replacement",
      claimId,
      "--reason",
      "verified source",
      "--json",
    ],
    resolutionDraft,
    capabilities[3] as ConformanceCapabilities,
  );

  const verificationDraft = decodeRecordDraft({
    kind: "verification",
    actor,
    targets: [claimId],
    verified_against: [{ ref: "repo=loredu", snapshot: "abc123" }],
    result: "confirmed",
  });
  await addAndCompare(
    [
      "add",
      "verification",
      "--store",
      "work",
      "--actor",
      "agent:compiled-test",
      "--target",
      claimId,
      "--verified-against-json",
      '{"ref":"repo=loredu","snapshot":"abc123"}',
      "--result",
      "confirmed",
      "--json",
    ],
    verificationDraft,
    capabilities[4] as ConformanceCapabilities,
  );

  const app = readApplication(root);
  const shown = json(await invoke(home, ["show", claimId, "--store", "work", "--json"]));
  expect(withoutRuns(shown)).toEqual(JSON.parse(JSON.stringify(await app.show(claimId))));
  const claims = json(await invoke(home, ["claims", "--store", "work", "--json"]));
  expect(withoutRuns(claims)).toEqual(JSON.parse(JSON.stringify(await app.claims())));
  const history = json(await invoke(home, ["history", claimId, "--store", "work", "--json"]));
  expect(withoutRuns(history)).toEqual(JSON.parse(JSON.stringify(await app.history({ id: claimId }))));
  const status = json(await invoke(home, ["status", "--store", "work", "--json"]));
  expect(withoutRuns(status)).toEqual(JSON.parse(JSON.stringify(await app.status())));
  const bare = json(await invoke(home, ["--store", "work", "--json"]));
  expect(bare).toEqual(status);
  const head = json(await invoke(home, ["--json", "--store", "work", "head"]));
  expect(withoutRuns(head)).toEqual(JSON.parse(JSON.stringify(await app.readHead())));
  const currentCapabilities = {
    instant: 1_700_000_000_005,
    entropy: "50515253545556575859",
  } as const;
  const current = json(
    await invokeConformance(
      home,
      [
        "current",
        "--store",
        "work",
        "--scope",
        "repo=loredu",
        "--valid-at",
        "2026-03-10T00:00:00Z",
        "--json",
      ],
      currentCapabilities,
    ),
  );
  const directCurrent = await createLoreduApplication({
    store: new PlainFileStore(root),
    clock: { now: () => createInstant(currentCapabilities.instant) },
    randomSource: { nextBytes: () => new Uint8Array(10) },
  }).current({ scope: { repo: "loredu" }, valid_at: "2026-03-10T00:00:00Z" });
  expect(withoutRuns(current)).toEqual(JSON.parse(JSON.stringify(directCurrent)));
  expectRenderedAffordances(current, "work");
  expect(json(await invoke(home, ["skill", "--json"]))).toMatchObject({ ok: true, basis: null });
});

test("compiled Claim additions render M2 pair feedback and committed fallback — @covers T53", async () => {
  const home = await freshHome();
  expect((await invoke(home, ["init", "feedback", "--json"])).exitCode).toBe(0);
  const claimArgs = [
    "add",
    "claim",
    "--store",
    "feedback",
    "--actor",
    "agent:feedback-test",
    "--scope",
    "repo=loredu",
    "--subject-type",
    "code-area",
    "--subject",
    "cli-query",
    "--predicate",
    "state",
    "--confidence",
    "observed",
  ] as const;

  const first = json(await invoke(home, [...claimArgs, "--value", "ready", "--json"]));
  expect(first.reconciliation).toMatchObject({ state: "new-key", related: [] });
  const firstId = (first.result as { id: string }).id;

  const second = json(await invoke(home, [...claimArgs, "--value", "ready", "--json"]));
  expect(second.reconciliation).toMatchObject({
    state: "duplicate",
    related_count: 1,
    related: [{ id: firstId }],
  });
  expect(second.advice).toEqual([]);

  const third = json(await invoke(home, [...claimArgs, "--value", "changed", "--json"]));
  const thirdId = (third.result as { id: string }).id;
  expect(third.reconciliation).toMatchObject({
    state: "conflict-candidate",
    related_count: 2,
    related: [{ id: firstId }],
  });
  expect((third.advice as { action: string; params: unknown }[]).map(({ action }) => action)).toEqual([
    "claims.list",
    "record.show",
    "record.show",
  ]);
  expect((third.advice as { params: { id?: string } }[])[2]?.params.id).toBe(thirdId);
  expectRenderedAffordances(third, "feedback");

  const text = await invoke(home, [...claimArgs, "--value", "another"]);
  expect(text.exitCode).toBe(0);
  expect(text.stdout).toContain('reconciliation: {"state":"conflict-candidate"');
  expect(text.stdout).toContain("advice: lor --store feedback claims");

  const unavailable = json(
    await invokeWithFeedbackReadFailure(home, join(home, "stores", "feedback"), [
      ...claimArgs,
      "--value",
      "committed",
      "--json",
    ]),
  );
  const unavailableId = (unavailable.result as { id: string }).id;
  expect(unavailable).toMatchObject({
    ok: true,
    result: { id: unavailableId, kind: "claim", position: 5 },
    reconciliation: {
      state: "unavailable",
      reason: "post-commit-read-failed",
      related: [],
    },
    advice: [{ rel: "status", action: "status.read", params: {}, run: "lor --store feedback status" }],
    basis: { stream_position: 5, query: { operation: "add", id: unavailableId } },
  });
  expect((unavailable.reconciliation as { key: { subject: { id: string } } }).key.subject.id).toBe(
    "cli-query",
  );
  expect(
    (
      json(await invoke(home, ["head", "--store", "feedback", "--json"])).result as {
        stream_position: number;
      }
    ).stream_position,
  ).toBe(5);

  const unavailableText = await invokeWithFeedbackReadFailure(home, join(home, "stores", "feedback"), [
    ...claimArgs,
    "--value",
    "committed-text",
  ]);
  expect(unavailableText.exitCode).toBe(0);
  expect(unavailableText.stdout).toContain('reconciliation: {"state":"unavailable"');
  expect(unavailableText.stdout).toContain('"reason":"post-commit-read-failed"');
  expect(unavailableText.stdout).toContain("advice: lor --store feedback status");
  expect(unavailableText.stdout).not.toContain("add claim");

  expect((await invoke(home, ["init", "coexisting", "--json"])).exitCode).toBe(0);
  const coexistingArgs = [
    "add",
    "claim",
    "--store",
    "coexisting",
    "--actor",
    "agent:feedback-test",
    "--scope",
    "repo=loredu",
    "--subject-type",
    "code-area",
    "--subject",
    "coexisting-policy",
    "--predicate",
    "state",
    "--confidence",
    "observed",
  ] as const;
  const coexistingFirst = json(
    await invokeConformance(home, [...coexistingArgs, "--value", "left", "--json"], {
      instant: 1_700_000_100_000,
      entropy: "50515253545556575859",
      policy: "coexisting",
    }),
  );
  const coexistingFirstId = (coexistingFirst.result as { id: string }).id;
  expect(coexistingFirst.reconciliation).toMatchObject({ state: "new-key", related: [] });
  const coexistingInvocation = await invokeConformance(
    home,
    [...coexistingArgs, "--value", "right", "--json"],
    {
      instant: 1_700_000_100_001,
      entropy: "60616263646566676869",
      policy: "coexisting",
    },
  );
  expect(coexistingInvocation.exitCode).toBe(0);
  const coexisting = json(coexistingInvocation);
  expect(coexisting.reconciliation).toEqual({
    state: "coexisting",
    key: {
      scope: { repo: "loredu" },
      subject: { type: "code-area", id: "coexisting-policy" },
      predicate: "state",
    },
    related_count: 1,
    related: [
      {
        id: coexistingFirstId,
        kind: "claim",
        affordances: [
          expect.objectContaining({ action: "record.show", run: expect.any(String) }),
          expect.objectContaining({ action: "record.history", run: expect.any(String) }),
        ],
      },
    ],
    claims: expect.objectContaining({
      action: "claims.list",
      params: {
        query: {
          scope: { repo: "loredu" },
          scope_match: "exact",
          subject_type: "code-area",
          subject: "coexisting-policy",
          predicate: "state",
          perspective: null,
        },
      },
      run: expect.any(String),
    }),
  });
  expect(coexisting.advice).toEqual([]);
  expect(coexisting.basis).toMatchObject({
    stream_position: 2,
    ruleset: { claim_policy: { id: "loredu.test.coexisting", version: "1" } },
    query: { operation: "add", id: (coexisting.result as { id: string }).id },
  });
});

test("compiled key-divergence stays advisory until explicit duplicate judgment", async () => {
  const home = await freshHome();
  expect((await invoke(home, ["init", "divergence", "--json"])).exitCode).toBe(0);
  const addClaim = async (predicate: string) =>
    json(
      await invoke(home, [
        "add",
        "claim",
        "--store",
        "divergence",
        "--actor",
        "agent:divergence-test",
        "--scope",
        "repo=loredu",
        "--subject-type",
        "code-area",
        "--subject",
        "query-chain",
        "--predicate",
        predicate,
        "--value-json",
        '{"path":"packages/cli"}',
        "--confidence",
        "observed",
        "--json",
      ]),
    );

  const first = await addClaim("location");
  const second = await addClaim("location-path");
  const firstId = (first.result as { id: string }).id;
  const secondId = (second.result as { id: string }).id;
  expect(first.reconciliation).toMatchObject({ state: "new-key" });
  expect(second.reconciliation).toMatchObject({ state: "new-key" });

  const divergent = await invoke(home, ["status", "--store", "divergence", "--check", "--json"]);
  expect(divergent.exitCode).toBe(0);
  const divergentEnvelope = json(divergent);
  expect(divergentEnvelope.result).toMatchObject({
    healthy: true,
    advisory_count: 1,
    advisories: [
      {
        kind: "key-divergence",
        component_count: 2,
        representatives: [{ id: firstId }, { id: secondId }],
      },
    ],
  });
  expect(divergentEnvelope.advice).toEqual([]);
  expectRenderedAffordances(divergentEnvelope, "divergence");

  const relation = json(
    await invoke(home, [
      "relate",
      "--store",
      "divergence",
      "--actor",
      "agent:divergence-test",
      "--from",
      firstId,
      "--to",
      secondId,
      "--type",
      "duplicates",
      "--json",
    ]),
  );
  expect((relation.result as { id: string }).id).toMatch(/^rel_/);

  const suppressed = await invoke(home, ["status", "--store", "divergence", "--check", "--json"]);
  expect(suppressed.exitCode).toBe(0);
  expect(json(suppressed).result).toMatchObject({
    healthy: true,
    advisory_count: 0,
    advisories: [],
  });
});

test("compiled binary maps stable execution categories — @covers T51", async () => {
  const home = await freshHome();
  const usageFailure = await invoke(home, ["head", "--unknown", "--json"]);
  expect(usageFailure.exitCode).toBe(2);
  expect((json(usageFailure).error as { code: string }).code).toBe("CLI_USAGE");

  const missingStore = await invoke(home, ["head", "--store", "work", "--json"]);
  expect(missingStore.exitCode).toBe(3);
  const missingStoreEnvelope = json(missingStore);
  expect((missingStoreEnvelope.error as { code: string }).code).toBe("STORE_NOT_FOUND");
  expect((missingStoreEnvelope.error as { message: string }).message).toBe("selected store was not found");
  expect((missingStoreEnvelope.error as { message: string }).message).not.toContain(home);
  expect((missingStoreEnvelope.advice as { run: string }[])[0]?.run).toBe("lor init work");

  const missingMutationStore = await invoke(home, [
    "add",
    "--json",
    "entry",
    "--actor",
    "agent:compiled-test",
    "--body",
    "valid body",
    "--store",
    "work",
  ]);
  expect(missingMutationStore.exitCode).toBe(3);
  expect((json(missingMutationStore).error as { code: string }).code).toBe("STORE_NOT_FOUND");

  expect((await invoke(home, ["init", "--json"])).exitCode).toBe(0);
  const existingStore = await invoke(home, ["init", "--json"]);
  expect(existingStore.exitCode).toBe(4);
  expect((json(existingStore).error as { code: string }).code).toBe("STORE_ALREADY_EXISTS");

  const invalidDraft = await invoke(home, [
    "add",
    "entry",
    "--actor",
    "agent:compiled-test",
    "--body",
    "   ",
    "--json",
  ]);
  expect(invalidDraft.exitCode).toBe(2);
  expect((json(invalidDraft).error as { code: string }).code).toBe("VALIDATION_FAILED");

  const claimArgs = [
    "add",
    "claim",
    "--actor",
    "agent:compiled-test",
    "--scope",
    "repo=loredu",
    "--subject-type",
    "code-area",
    "--subject",
    "status",
    "--predicate",
    "state",
    "--confidence",
    "observed",
    "--json",
  ];
  expect((await invoke(home, [...claimArgs, "--value", "first"])).exitCode).toBe(0);
  expect((await invoke(home, [...claimArgs, "--value", "second"])).exitCode).toBe(0);
  const ordinaryStatus = await invoke(home, ["status", "--json"]);
  expect(ordinaryStatus.exitCode).toBe(0);
  expect((json(ordinaryStatus).result as { healthy: boolean }).healthy).toBe(false);
  const checkedStatus = await invoke(home, ["status", "--check", "--json"]);
  expect(checkedStatus.exitCode).toBe(5);
  const checkedEnvelope = json(checkedStatus);
  expect(
    (checkedEnvelope.result as { health: { unresolved_exclusive_groups: number } }).health
      .unresolved_exclusive_groups,
  ).toBe(1);
  expect((checkedEnvelope.advice as { run: string }[])[0]?.run).toBe(
    "lor claims --scope repo=loredu --exact-scope --subject-type code-area --subject status --predicate state --without-perspective",
  );
});

test("relative Loredu homes reject named/default stores but not version or explicit paths", async () => {
  const home = await freshHome();
  const cwd = join(home, "cwd");
  await Bun.write(join(cwd, ".keep"), "");
  const relativeHome = "relative-home";
  const expectedVersion = `lor 0.0.0 (schema loredu.record/v1, store plainfile, home ${join(homedir(), ".loredu")})\n`;
  for (const flag of ["--version", "-v"]) {
    const version = await invoke(home, [flag], undefined, cwd, relativeHome);
    expect(version.exitCode).toBe(0);
    expect(version.stdout).toBe(expectedVersion);
    expect(version.stderr).toBe("");
  }

  for (const args of [
    ["head", "--json"],
    ["head", "--store", "named", "--json"],
  ]) {
    const failure = await invoke(home, args, undefined, cwd, relativeHome);
    expect(failure.exitCode).toBe(2);
    const envelope = json(failure);
    expect((envelope.error as { code: string }).code).toBe("VALIDATION_FAILED");
    expect((envelope.error as { issues: { path: string }[] }).issues).toEqual([
      expect.objectContaining({ path: "/environment/LOREDU_HOME" }),
    ]);
    expect(failure.stdout).not.toContain(cwd);
  }
  expect(await Bun.file(join(cwd, relativeHome)).exists()).toBe(false);

  const explicit = join(home, "explicit-store");
  const initialized = json(await invoke(home, ["init", explicit, "--json"], undefined, cwd, relativeHome));
  const initializedRoot = (initialized.result as { root: string }).root;
  expect(isAbsolute(initializedRoot)).toBe(true);
  expect(initializedRoot).toEndWith("/explicit-store");
  expect(
    (await invoke(home, ["head", "--store", explicit, "--json"], undefined, cwd, relativeHome)).exitCode,
  ).toBe(0);
  expect(await Bun.file(join(cwd, relativeHome)).exists()).toBe(false);
});

test("explicit path selection initializes and opens only that store", async () => {
  const home = await freshHome();
  const root = join(home, "outside", "chosen-store");
  const initialized = json(await invoke(home, ["init", root, "--json"]));
  expect((initialized.result as { root: string; selector: string }).selector).toBe(root);
  expect((initialized.result as { root: string }).root).toEndWith("/outside/chosen-store");

  const head = json(await invoke(home, ["--store", root, "head", "--json"]));
  expect((head.result as { stream_position: number }).stream_position).toBe(0);
  const implicit = await invoke(home, ["head", "--json"]);
  expect(implicit.exitCode).toBe(3);
});

test("relative Loredu homes are rejected instead of drifting with cwd", async () => {
  const cwd = await freshHome();
  const invocation = await invoke("relative-home", ["init", "--json"], undefined, cwd);
  const envelope = json(invocation);

  expect(invocation.exitCode).toBe(2);
  expect((envelope.error as { code: string }).code).toBe("VALIDATION_FAILED");
  expect(await Bun.file(join(cwd, "relative-home", "stores", "default")).exists()).toBe(false);
});

test("missing leading-dash path advice remains executable", async () => {
  const home = await freshHome();
  for (const selector of ["--missing/store", "-missing/store"]) {
    const missingInvocation = await invoke(home, ["head", "--store", selector, "--json"], undefined, home);
    expect(missingInvocation.exitCode).toBe(3);
    const missing = json(missingInvocation);
    expect((missing.error as { code: string }).code).toBe("STORE_NOT_FOUND");
    expect((missing.advice as { run: string }[])[0]?.run).toBe(`lor init --store ${selector}`);

    const initialized = json(await invoke(home, ["init", "--store", selector, "--json"], undefined, home));
    expect((initialized.result as { selector: string }).selector).toBe(selector);
    expect((initialized.result as { root: string }).root).toEndWith(`/${selector}`);
    const head = json(await invoke(home, ["head", "--store", selector, "--json"], undefined, home));
    expect((head.result as { stream_position: number }).stream_position).toBe(0);
    expect((await invoke(home, ["head", "--json"], undefined, home)).exitCode).toBe(3);
    expect((await invoke(home, ["head", "--store", "another", "--json"], undefined, home)).exitCode).toBe(3);
  }
});

test("text mode renders primary results and semantic labels", async () => {
  const home = await freshHome();
  const initialized = await invoke(home, ["init"]);
  expect(initialized.exitCode).toBe(0);
  expect(initialized.stdout).toContain("initialized store at");
  expect(initialized.stdout).toContain('basis: {"stream_position":0');

  const added = await invoke(home, [
    "add",
    "entry",
    "--actor",
    "agent:compiled-test",
    "--body",
    "text output",
  ]);
  expect(added.exitCode).toBe(0);
  expect(added.stdout).toMatch(/^ent_[0-9abcdefghjkmnpqrstvwxyz]{16}\n/);
  expect(added.stdout).toContain("kind: entry");
  expect(added.stdout).toContain("position: 1");
  expect(added.stdout).toContain("handle: lor show");
  expect(added.stdout).toContain('reconciliation: {"state":"not-applicable","related":[]}');
  expect(added.stdout).toContain('basis: {"stream_position":1');
  const head = await invoke(home, ["head"]);
  expect(head.stdout).toStartWith("stream_position=1\n");
});

test("version spellings remain ordinary option values", async () => {
  const home = await freshHome();
  expect((await invoke(home, ["init", "--json"])).exitCode).toBe(0);
  for (const body of ["-v", "--version"]) {
    const added = json(
      await invoke(home, ["add", "entry", "--actor", "agent:compiled-test", "--body", body, "--json"]),
    );
    const shown = json(await invoke(home, ["show", (added.result as { id: string }).id, "--json"]));
    expect((shown.result as { record: { body: string } }).record.body).toBe(body);
  }
});

test("stdin is not consumed before selected-store preflight", async () => {
  const home = await freshHome();
  const missing = await invokeWithOpenStdin(home, [
    "add",
    "entry",
    "--store",
    "missing",
    "--actor",
    "agent:compiled-test",
    "--body",
    "-",
    "--json",
  ]);
  expect(missing.exitCode).toBe(3);
  expect((json(missing).error as { code: string }).code).toBe("STORE_NOT_FOUND");

  const invalid = await invokeWithOpenStdin(home, [
    "add",
    "entry",
    "--store",
    "INVALID",
    "--actor",
    "agent:compiled-test",
    "--body",
    "-",
    "--json",
  ]);
  expect(invalid.exitCode).toBe(2);
  expect((json(invalid).error as { code: string }).code).toBe("VALIDATION_FAILED");
});

test("stdin Entry body survives compiled storage and show byte-exact — @covers T52", async () => {
  const home = await freshHome();
  expect((await invoke(home, ["init", "--json"])).exitCode).toBe(0);
  const body = "first line\nsecond λ line\nfinal line\n";
  const added = json(
    await invoke(home, ["add", "entry", "--actor", "agent:compiled-test", "--body", "-", "--json"], body),
  );
  const id = (added.result as { id: string }).id;
  const shown = json(await invoke(home, ["show", id, "--json"]));
  expect((shown.result as { record: { body: string } }).record.body).toBe(body);

  const bomBody = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(body)]);
  const bomAdded = json(
    await invoke(home, ["add", "entry", "--actor", "agent:compiled-test", "--body", "-", "--json"], bomBody),
  );
  const bomShown = json(await invoke(home, ["show", (bomAdded.result as { id: string }).id, "--json"]));
  expect((bomShown.result as { record: { body: string } }).record.body).toBe(`\uFEFF${body}`);

  const largeBody = "large output line\n".repeat(32_768);
  const largeAdded = json(
    await invoke(
      home,
      ["add", "entry", "--actor", "agent:compiled-test", "--body", "-", "--json"],
      largeBody,
    ),
  );
  const largeShown = json(await invoke(home, ["show", (largeAdded.result as { id: string }).id, "--json"]));
  expect((largeShown.result as { record: { body: string } }).record.body).toBe(largeBody);
});

test("unknown options cannot hide JSON mode", async () => {
  const home = await freshHome();
  const failure = await invoke(home, ["head", "--body", "--json"]);
  expect(failure.exitCode).toBe(2);
  expect((json(failure).error as { code: string }).code).toBe("CLI_USAGE");
});

test("invalid prototype-shaped scope keys reach domain validation", async () => {
  const home = await freshHome();
  expect((await invoke(home, ["init", "--json"])).exitCode).toBe(0);
  const failure = await invoke(home, [
    "add",
    "entry",
    "--actor",
    "agent:compiled-test",
    "--scope",
    "__proto__=x",
    "--body",
    "must not append",
    "--json",
  ]);
  expect(failure.exitCode).toBe(2);
  expect((json(failure).error as { code: string }).code).toBe("VALIDATION_FAILED");
  const head = json(await invoke(home, ["head", "--json"]));
  expect((head.result as { stream_position: number }).stream_position).toBe(0);
});

test("portable JSON object keys survive rendering", async () => {
  const home = await freshHome();
  expect((await invoke(home, ["init", "--json"])).exitCode).toBe(0);
  const added = json(
    await invoke(home, [
      "add",
      "claim",
      "--actor",
      "agent:compiled-test",
      "--subject-type",
      "code-area",
      "--subject",
      "rendering",
      "--predicate",
      "state",
      "--value-json",
      '{"__proto__":"kept","nested":{"__proto__":"nested"}}',
      "--confidence",
      "observed",
      "--json",
    ]),
  );
  const shown = json(await invoke(home, ["show", (added.result as { id: string }).id, "--json"]));
  const value = (shown.result as { record: { value: Record<string, unknown> } }).record.value;
  expect(Object.getOwnPropertyDescriptor(value, "__proto__")?.value).toBe("kept");
  expect(Object.getOwnPropertyDescriptor(value.nested as Record<string, unknown>, "__proto__")?.value).toBe(
    "nested",
  );

  const affordanceShaped = {
    rel: "show",
    action: "record.show",
    why: "portable data",
    params: { id: "ent_0000000000000000" },
  };
  const second = json(
    await invoke(home, [
      "add",
      "claim",
      "--actor",
      "agent:compiled-test",
      "--subject-type",
      "code-area",
      "--subject",
      "rendering-affordance-shape",
      "--predicate",
      "state",
      "--value-json",
      JSON.stringify(affordanceShaped),
      "--confidence",
      "observed",
      "--json",
    ]),
  );
  const secondShown = json(await invoke(home, ["show", (second.result as { id: string }).id, "--json"]));
  expect((secondShown.result as { record: { value: unknown } }).record.value).toEqual(affordanceShaped);
});

test("bare binary is live orientation and command help is strict — @covers T58", async () => {
  const home = await freshHome();
  expect((await invoke(home, ["init", "--json"])).exitCode).toBe(0);
  const orientation = await invoke(home, []);
  expect(orientation.exitCode).toBe(0);
  expect(orientation.stdout).toContain("healthy: true");
  expect(orientation.stdout).not.toContain("usage:");

  const help = await invoke(home, ["add", "entry", "--help"]);
  expect(help.exitCode).toBe(0);
  expect(help.stdout).toStartWith("usage: lor add entry");

  const unknown = await invoke(home, ["head", "--wat", "--json"]);
  expect(unknown.exitCode).toBe(2);
  expect((json(unknown).error as { message: string }).message).toContain("--wat");
});

test("claims/history filters and status checks paginate with preserved selectors and limits", async () => {
  const home = await freshHome();
  const selector = join(home, "query store's records");
  expect((await invoke(home, ["init", selector, "--json"])).exitCode).toBe(0);
  const addClaim = async (subject: string, value: string) =>
    json(
      await invoke(home, [
        "add",
        "claim",
        "--store",
        selector,
        "--actor",
        "agent:query-test",
        "--scope",
        "repo=loredu",
        "--scope",
        "package=cli",
        "--subject-type",
        "code-area",
        "--subject",
        subject,
        "--predicate",
        "state",
        "--value",
        value,
        "--confidence",
        "observed",
        "--json",
      ]),
    );

  const first = await addClaim("one", "old");
  const second = await addClaim("one", "new");
  const third = await addClaim("two", "left");
  const fourth = await addClaim("two", "right");
  const ids = [first, second, third, fourth].map((item) => (item.result as { id: string }).id);
  const perspectiveClaim = json(
    await invoke(home, [
      "add",
      "claim",
      "--store",
      selector,
      "--actor",
      "agent:query-test",
      "--scope",
      "repo=loredu",
      "--scope",
      "package=cli",
      "--scope",
      "view=expanded",
      "--subject-type",
      "code-area",
      "--subject",
      "perspective",
      "--predicate",
      "state",
      "--perspective",
      "documented",
      "--value",
      "present",
      "--confidence",
      "observed",
      "--json",
    ]),
  );
  const perspectiveId = (perspectiveClaim.result as { id: string }).id;

  const filtered = json(
    await invoke(home, [
      "claims",
      "--store",
      selector,
      "--scope",
      "package=cli",
      "--scope",
      "repo=loredu",
      "--exact-scope",
      "--subject-type",
      "code-area",
      "--subject",
      "one",
      "--predicate",
      "state",
      "--without-perspective",
      "--value-json",
      '"old"',
      "--actor",
      "agent:query-test",
      "--since",
      "0000-01-01T00:00:00.000Z",
      "--limit",
      "1",
      "--json",
    ]),
  );
  expect((filtered.result as { id: string }[]).map(({ id }) => id)).toEqual([ids[0] as string]);
  expect(filtered.page).toEqual({ returned: 1, total: 1 });
  const presentPerspective = json(
    await invoke(home, [
      "claims",
      "--store",
      selector,
      "--scope",
      "repo=loredu",
      "--perspective",
      "documented",
      "--json",
    ]),
  );
  expect((presentPerspective.result as { id: string }[]).map(({ id }) => id)).toEqual([perspectiveId]);

  const checked = await invoke(home, ["status", "--store", selector, "--limit", "1", "--check", "--json"]);
  expect(checked.exitCode).toBe(5);
  const firstStatus = json(checked);
  expect(firstStatus.page).toMatchObject({ returned: 1, total: 2 });
  expect(
    (
      firstStatus.result as {
        health: { unresolved_exclusive_groups: number; dangling_record_references: number };
      }
    ).health,
  ).toEqual({
    unresolved_exclusive_groups: 2,
    dangling_record_references: 0,
  });
  const continuation = (firstStatus.advice as { action: string; run: string }[]).at(-1);
  expect(continuation).toMatchObject({ action: "status.read" });
  expect(continuation?.run).toContain(" --limit 1");
  expect(continuation?.run).toContain(" --store ");
  const secondStatus = json(await invokeShell(home, `${continuation?.run as string} --json`));
  expect(secondStatus.page).toEqual({ returned: 1, total: 2 });
  expect((secondStatus.result as { attention: unknown[] }).attention).toHaveLength(1);

  for (const targets of [ids.slice(0, 2), ids.slice(2, 4)]) {
    const resolved = await invoke(home, [
      "resolve",
      "--store",
      selector,
      "--actor",
      "agent:query-test",
      ...targets.flatMap((id) => ["--target", id]),
      "--decision",
      "leave_disputed",
      "--reason",
      "complete group inspected",
      "--json",
    ]);
    expect(resolved.exitCode).toBe(0);
  }
  expect((await invoke(home, ["status", "--store", selector, "--check", "--json"])).exitCode).toBe(0);
});

test("fresh-store skill journey records in two commands and follows affordances to health — @covers T57, T65, T73", async () => {
  const home = await freshHome();
  const source = await readFile(join(workspace, "docs/v0.x/execution/agent-skill.md"), "utf8");
  const closing = source.indexOf("\n---\n", 4);
  expect(closing).toBeGreaterThan(0);
  const expectedGuide = source.slice(closing + "\n---\n".length);
  const skill = await invoke(home, ["skill"]);
  expect(skill.exitCode).toBe(0);
  expect(skill.stdout).toBe(expectedGuide);
  expect(skill.stderr).toBe("");
  const selector = join(home, "agent store's chain");
  expect((await invoke(home, ["init", selector, "--json"])).exitCode).toBe(0);
  const orientation = json(await invoke(home, ["--store", selector, "--json"]));
  expect((orientation.result as { healthy: boolean }).healthy).toBe(true);

  let recordingCommands = 0;
  recordingCommands += 1;
  const entry = json(
    await invoke(home, [
      "add",
      "entry",
      "--store",
      selector,
      "--actor",
      "agent:skill-test",
      "--type",
      "finding",
      "--title",
      "query chain",
      "--source-json",
      '{"ref":"repo=loredu","locator":"packages/cli","snapshot":"m15q"}',
      "--body",
      "evidence body",
      "--json",
    ]),
  );
  const entryId = (entry.result as { id: string }).id;
  recordingCommands += 1;
  const firstClaim = json(
    await invoke(home, [
      "add",
      "claim",
      "--store",
      selector,
      "--actor",
      "agent:skill-test",
      "--scope",
      "repo=loredu",
      "--subject-type",
      "code-area",
      "--subject",
      "query-chain",
      "--predicate",
      "state",
      "--value",
      "old",
      "--derived-from",
      entryId,
      "--confidence",
      "observed",
      "--json",
    ]),
  );
  expect(recordingCommands).toBe(2);
  expect(firstClaim.reconciliation).toMatchObject({ state: "new-key" });
  const firstClaimId = (firstClaim.result as { id: string }).id;

  const corroborating = json(
    await invoke(home, [
      "add",
      "claim",
      "--store",
      selector,
      "--actor",
      "agent:skill-test",
      "--scope",
      "repo=loredu",
      "--subject-type",
      "code-area",
      "--subject",
      "query-chain",
      "--predicate",
      "state",
      "--value",
      "old",
      "--derived-from",
      entryId,
      "--confidence",
      "observed",
      "--json",
    ]),
  );
  const corroboratingId = (corroborating.result as { id: string }).id;
  const conflict = json(
    await invoke(home, [
      "add",
      "claim",
      "--store",
      selector,
      "--actor",
      "agent:skill-test",
      "--scope",
      "repo=loredu",
      "--subject-type",
      "code-area",
      "--subject",
      "query-chain",
      "--predicate",
      "state",
      "--value",
      "new",
      "--derived-from",
      entryId,
      "--confidence",
      "observed",
      "--json",
    ]),
  );
  const conflictId = (conflict.result as { id: string }).id;
  expectRenderedAffordances(conflict, selector);

  const exactQueryRun = (conflict.advice as { action: string; run: string }[]).find(
    ({ action }) => action === "claims.list",
  )?.run;
  expect(exactQueryRun).toBeDefined();
  const listed = json(await invokeShell(home, `${exactQueryRun} --limit 1 --json`));
  const claimIds: string[] = [];
  let page = listed;
  while (true) {
    claimIds.push(...(page.result as { id: string }[]).map(({ id }) => id));
    expectRenderedAffordances(page, selector);
    const next = (page.advice as { action: string; run: string }[]).find(
      ({ action }) => action === "claims.list",
    );
    if (next === undefined) break;
    expect(next.run).toContain(" --limit 1");
    page = json(await invokeShell(home, `${next.run} --json`));
  }
  expect(claimIds).toEqual([firstClaimId, corroboratingId, conflictId]);

  const shownClaim = json(
    await invokeShell(
      home,
      `${
        (
          listed.result as { handles: { affordances: { action: string; run: string }[] }[] }[]
        )[0]?.handles[0]?.affordances.find(({ action }) => action === "record.show")?.run as string
      } --json`,
    ),
  );
  expect((shownClaim.result as { handles: { id: string }[] }).handles.map(({ id }) => id)).toEqual([
    firstClaimId,
    entryId,
  ]);
  expectRenderedAffordances(shownClaim, selector);
  const entryHandle = (
    shownClaim.result as { handles: { id: string; affordances: { run: string }[] }[] }
  ).handles.find(({ id }) => id === entryId);
  const shownEntry = json(await invokeShell(home, `${entryHandle?.affordances[0]?.run as string} --json`));
  expect((shownEntry.result as { record: { sources: JsonValue[] } }).record.sources).toEqual([
    { ref: "repo=loredu", locator: "packages/cli", snapshot: "m15q" },
  ]);

  const relation = json(
    await invoke(home, [
      "relate",
      "--store",
      selector,
      "--actor",
      "agent:skill-test",
      "--from",
      corroboratingId,
      "--to",
      firstClaimId,
      "--type",
      "duplicates",
      "--json",
    ]),
  );
  expect((relation.result as { id: string }).id).toMatch(/^rel_/);
  const resolution = json(
    await invoke(home, [
      "resolve",
      "--store",
      selector,
      "--actor",
      "agent:skill-test",
      ...claimIds.flatMap((id) => ["--target", id]),
      "--decision",
      "prefer",
      "--replacement",
      conflictId,
      "--reason",
      "source verified",
      "--json",
    ]),
  );
  const resolutionId = (resolution.result as { id: string }).id;
  const verification = json(
    await invoke(home, [
      "add",
      "verification",
      "--store",
      selector,
      "--actor",
      "agent:skill-test",
      "--target",
      conflictId,
      "--verified-against-json",
      '{"ref":"repo=loredu","snapshot":"m15q"}',
      "--result",
      "confirmed",
      "--json",
    ]),
  );
  const verificationId = (verification.result as { id: string }).id;

  const historyRun = (
    conflict.result as { handle: { affordances: { action: string; run: string }[] } }
  ).handle.affordances.find(({ action }) => action === "record.history")?.run;
  const history = json(await invokeShell(home, `${historyRun as string} --limit 2 --json`));
  const historyIds: string[] = [];
  let historyPage = history;
  while (true) {
    historyIds.push(...(historyPage.result as { id: string }[]).map(({ id }) => id));
    expectRenderedAffordances(historyPage, selector);
    const next = (historyPage.advice as { action: string; run: string }[]).find(
      ({ action }) => action === "history.list",
    );
    if (next === undefined) break;
    expect(next.run).toContain(" --limit 2");
    historyPage = json(await invokeShell(home, `${next.run} --json`));
  }
  expect(historyIds).toEqual([conflictId, resolutionId, verificationId]);

  const healthy = await invoke(home, ["status", "--store", selector, "--check", "--json"]);
  expect(healthy.exitCode).toBe(0);
  expect((json(healthy).result as { healthy: boolean }).healthy).toBe(true);
});

test("show and status render valid ids while invalid references and SourceRefs terminate — @covers T74", async () => {
  const home = await freshHome();
  const selector = join(home, "terminal-store");
  const initialized = json(await invoke(home, ["init", selector, "--json"]));
  const root = (initialized.result as { root: string }).root;
  const invalidFrom = "ent_0000000000000001";
  const invalidTo = "clm_0000000000000001";
  const relation = decodePersistedRecord({
    schema: "loredu.record/v1",
    kind: "relation",
    id: "rel_0000000000000001",
    recorded_at: "2026-01-01T00:00:00.000Z",
    actor: { type: "agent", id: "fixture.agent" },
    relation_type: "supports",
    from: invalidFrom,
    to: invalidTo,
    scope: {},
    metadata: {},
    sources: [],
  });
  await Bun.write(
    join(root, "records", recordFileName(1 as never, relation.id)),
    encodePlainFileRecord(relation),
  );

  const entry = json(
    await invoke(home, [
      "add",
      "entry",
      "--store",
      selector,
      "--actor",
      "agent:terminal-test",
      "--source-json",
      '{"ref":"ent_0000000000000001","locator":"external-only","snapshot":"v1"}',
      "--body",
      "external source reference",
      "--json",
    ]),
  );
  const entryId = (entry.result as { id: string }).id;
  const shownRelation = json(await invoke(home, ["show", relation.id, "--store", selector, "--json"]));
  expect((shownRelation.result as { record: { from: string; to: string } }).record).toMatchObject({
    from: invalidFrom,
    to: invalidTo,
  });
  expect((shownRelation.result as { handles: { id: string }[] }).handles.map(({ id }) => id)).toEqual([
    relation.id,
  ]);
  expect(JSON.stringify(shownRelation)).not.toContain(`show ${invalidFrom}`);
  expect(JSON.stringify(shownRelation)).not.toContain(`show ${invalidTo}`);

  const shownEntry = json(await invoke(home, ["show", entryId, "--store", selector, "--json"]));
  expect((shownEntry.result as { handles: { id: string }[] }).handles.map(({ id }) => id)).toEqual([entryId]);
  expect(JSON.stringify(shownEntry)).not.toContain("show ent_0000000000000001");

  const status = json(await invoke(home, ["status", "--store", selector, "--json"]));
  const dangling = (status.result as { attention: Record<string, unknown>[] }).attention;
  expect(dangling.map(({ target }) => target)).toEqual([invalidFrom, invalidTo]);
  expect(dangling.every(({ target }) => typeof target === "string")).toBe(true);
  expectRenderedAffordances(status, selector);
});

test("compiled cursors reject malformed and wrong operation/query/ruleset/store tokens without restart", async () => {
  const home = await freshHome();
  for (const store of ["left", "right"]) {
    expect((await invoke(home, ["init", store, "--json"])).exitCode).toBe(0);
    for (const subject of ["one", "two"]) {
      expect(
        (
          await invoke(home, [
            "add",
            "claim",
            "--store",
            store,
            "--actor",
            "agent:cursor-test",
            "--subject-type",
            "item",
            "--subject",
            subject,
            "--predicate",
            "state",
            "--value",
            store,
            "--confidence",
            "observed",
            "--json",
          ])
        ).exitCode,
      ).toBe(0);
    }
  }
  const first = json(await invoke(home, ["claims", "--store", "left", "--limit", "1", "--json"]));
  const cursor = (first.page as { cursor: string }).cursor;
  const pinnedHead = (first.basis as { stream_position: number }).stream_position;
  expect(
    (
      await invoke(home, [
        "add",
        "claim",
        "--store",
        "left",
        "--actor",
        "agent:cursor-test",
        "--subject-type",
        "item",
        "--subject",
        "three",
        "--predicate",
        "state",
        "--value",
        "left",
        "--confidence",
        "observed",
        "--json",
      ])
    ).exitCode,
  ).toBe(0);
  const continued = json(
    await invoke(home, ["claims", "--store", "left", "--cursor", cursor, "--limit", "1", "--json"]),
  );
  expect(continued.page).toEqual({ returned: 1, total: 2 });
  expect((continued.basis as { stream_position: number }).stream_position).toBe(pinnedHead);
  const fresh = json(await invoke(home, ["claims", "--store", "left", "--json"]));
  expect(fresh.result as unknown[]).toHaveLength(3);
  expect((fresh.basis as { stream_position: number }).stream_position).toBe(pinnedHead + 1);

  const malformed = await invoke(home, ["claims", "--store", "left", "--cursor", "bad", "--json"]);
  expect(malformed.exitCode).toBe(2);
  expect((json(malformed).error as { code: string }).code).toBe("INVALID_CURSOR");

  const wrongOperation = await invoke(home, ["history", "--store", "left", "--cursor", cursor, "--json"]);
  expect(wrongOperation.exitCode).toBe(2);
  expect((json(wrongOperation).error as { code: string }).code).toBe("CURSOR_MISMATCH");

  const queryPayload = cursorPayload(cursor);
  queryPayload.query = { filters: { predicate: "other" }, operation: "claims" };
  const wrongQuery = await invoke(home, [
    "claims",
    "--store",
    "left",
    "--cursor",
    encodeCursor(queryPayload),
    "--json",
  ]);
  expect(wrongQuery.exitCode).toBe(2);
  expect((json(wrongQuery).error as { code: string }).code).toBe("CURSOR_MISMATCH");

  const rulesetPayload = cursorPayload(cursor);
  const basis = rulesetPayload.basis as { ruleset: { claim_policy: { version: string } } };
  basis.ruleset.claim_policy.version = "foreign";
  const wrongRuleset = await invoke(home, [
    "claims",
    "--store",
    "left",
    "--cursor",
    encodeCursor(rulesetPayload),
    "--json",
  ]);
  expect(wrongRuleset.exitCode).toBe(2);
  expect((json(wrongRuleset).error as { code: string }).code).toBe("CURSOR_MISMATCH");

  const wrongStore = await invoke(home, ["claims", "--store", "right", "--cursor", cursor, "--json"]);
  expect(wrongStore.exitCode).toBe(2);
  expect((json(wrongStore).error as { code: string }).code).toBe("CURSOR_MISMATCH");
  expect(json(wrongStore).result as unknown).toBeNull();
});

test("embedded skill text remains source-exact and requires no store", async () => {
  const home = await freshHome();
  const source = await readFile(join(workspace, "docs/v0.x/execution/agent-skill.md"), "utf8");
  const closing = source.indexOf("\n---\n", 4);
  expect(closing).toBeGreaterThan(0);
  const expected = source.slice(closing + "\n---\n".length);

  const text = await invoke(home, ["skill"]);
  expect(text.exitCode).toBe(0);
  expect(text.stdout).toBe(expected);
  expect(text.stderr).toBe("");

  const envelope = json(await invoke(home, ["skill", "--json"]));
  expect((envelope.result as { guide: string }).guide).toBe(expected);
  expect(envelope.basis).toBeNull();
});
