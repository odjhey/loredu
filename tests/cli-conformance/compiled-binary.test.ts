import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const workspace = resolve(import.meta.dir, "../..");
const binary = join(workspace, "packages/cli/dist/lor");
const homes: string[] = [];

interface Invocation {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function invoke(
  home: string,
  args: readonly string[],
  stdin?: string | Uint8Array,
  cwd: string = workspace,
): Promise<Invocation> {
  const process = Bun.spawn([binary, ...args], {
    cwd,
    env: { ...Bun.env, LOREDU_HOME: home },
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
});

afterAll(async () => {
  await Promise.all(homes.map((home) => rm(home, { recursive: true, force: true })));
});

test("compiled first-slice semantic commands return one JSON envelope", async () => {
  const home = await freshHome();
  const initialized = json(await invoke(home, ["init", "work", "--json"]));
  expect(initialized.ok).toBe(true);
  expect((initialized.result as { selector: string }).selector).toBe("work");

  const entry = json(
    await invoke(home, [
      "add",
      "--json",
      "--store",
      "work",
      "entry",
      "--actor",
      "agent:compiled-test",
      "--body",
      "evidence",
    ]),
  );
  const entryId = (entry.result as { id: string }).id;
  expect(entryId).toMatch(/^ent_/);

  const claim = json(
    await invoke(home, [
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
    ]),
  );
  const claimId = (claim.result as { id: string }).id;
  expect(claimId).toMatch(/^clm_/);

  const relation = json(
    await invoke(home, [
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
    ]),
  );
  expect((relation.result as { id: string }).id).toMatch(/^rel_/);

  const resolution = json(
    await invoke(home, [
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
    ]),
  );
  expect((resolution.result as { id: string }).id).toMatch(/^res_/);

  const verification = json(
    await invoke(home, [
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
    ]),
  );
  expect((verification.result as { id: string }).id).toMatch(/^ver_/);

  expect((claim.reconciliation as { state: string }).state).toBe("new-key");
  for (const envelope of [entry, relation, resolution, verification]) {
    expect(Object.keys(envelope)).toEqual(["ok", "result", "reconciliation", "advice", "basis"]);
    expect(envelope.reconciliation).toEqual({ state: "not-applicable", related: [] });
    const result = envelope.result as {
      handle: { affordances: readonly { run: string }[] };
    };
    expect(result.handle.affordances.map(({ run }) => run)).toEqual([
      expect.stringContaining("lor --store work show"),
      expect.stringContaining("lor --store work history"),
    ]);
  }

  const shown = json(await invoke(home, ["show", claimId, "--store", "work", "--json"]));
  expect((shown.result as { record: { id: string } }).record.id).toBe(claimId);
  const head = json(await invoke(home, ["--json", "--store", "work", "head"]));
  expect((head.result as { stream_position: number }).stream_position).toBe(5);
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
  const selector = "--missing/store";
  const missing = json(await invoke(home, ["head", "--store", selector, "--json"], undefined, home));
  expect((missing.advice as { run: string }[])[0]?.run).toBe("lor init --store --missing/store");

  const initialized = json(await invoke(home, ["init", "--store", selector, "--json"], undefined, home));
  expect((initialized.result as { selector: string }).selector).toBe(selector);
  expect((initialized.result as { root: string }).root).toEndWith("/--missing/store");
  const head = json(await invoke(home, ["head", "--store", selector, "--json"], undefined, home));
  expect((head.result as { stream_position: number }).stream_position).toBe(0);
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

test("embedded skill text is source-exact and requires no store", async () => {
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
