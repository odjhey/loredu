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
): Promise<Invocation> {
  const process = Bun.spawn([binary, ...args], {
    cwd: workspace,
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

test("compiled first-slice semantic commands return one JSON envelope — @covers T50", async () => {
  const home = await freshHome();
  const initialized = json(await invoke(home, ["init", "work", "--json"]));
  expect(initialized.ok).toBe(true);
  expect((initialized.result as { selector: string }).selector).toBe("work");

  const entry = json(
    await invoke(home, [
      "--store",
      "work",
      "add",
      "entry",
      "--actor",
      "agent:compiled-test",
      "--body",
      "evidence",
      "--json",
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

  for (const envelope of [entry, claim, relation, resolution, verification]) {
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

  const missingStore = await invoke(home, ["head", "--json"]);
  expect(missingStore.exitCode).toBe(3);
  expect((json(missingStore).error as { code: string }).code).toBe("STORE_NOT_FOUND");

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

test("text mode renders primary results and semantic labels", async () => {
  const home = await freshHome();
  const initialized = await invoke(home, ["init"]);
  expect(initialized.exitCode).toBe(0);
  expect(initialized.stdout).toContain("initialized store at");
  expect(initialized.stdout).toContain("basis: stream_position=0");

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
  expect(added.stdout).toContain("reconciliation: not-applicable");
  const head = await invoke(home, ["head"]);
  expect(head.stdout).toStartWith("stream_position=1\n");
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
