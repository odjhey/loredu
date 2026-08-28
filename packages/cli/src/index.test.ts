import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ClaimId, type ClaimPolicy, createInstant } from "@loredu/kernel";
import { type CliIo, run } from "./index";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function capture(readStdin: CliIo["readStdin"]): {
  readonly io: CliIo;
  readonly stdout: () => string;
  readonly stderr: () => string;
} {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      out: (text) => {
        stdout += text;
      },
      err: (text) => {
        stderr += text;
      },
      readStdin,
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

test("unsupported short and bundled options are usage failures", async () => {
  for (const option of ["-x", "-xyz"]) {
    const invocation = capture(async () => {
      throw new Error("usage failures must not read stdin");
    });
    const exit = await run(["show", option, "--json"], invocation.io);

    expect(exit).toBe(2);
    expect(invocation.stderr()).toBe("");
    expect(JSON.parse(invocation.stdout())).toMatchObject({
      ok: false,
      error: { code: "CLI_USAGE", message: `unknown option: ${option}` },
    });
  }
});

test("stdin read failures retain the internal failure exit category after store preflight", async () => {
  const root = await mkdtemp(join(tmpdir(), "loredu-cli-unit-"));
  roots.push(root);
  const store = join(root, "store");
  const init = capture(async () => {
    throw new Error("init must not read stdin");
  });
  expect(await run(["init", store, "--json"], init.io)).toBe(0);

  let reads = 0;
  const invocation = capture(async () => {
    reads += 1;
    throw new Error("stdin read failed");
  });
  const exit = await run(
    ["add", "entry", "--store", store, "--actor", "agent:test", "--body", "-", "--json"],
    invocation.io,
  );

  expect(exit).toBe(6);
  expect(reads).toBe(1);
  expect(invocation.stderr()).toBe("");
  expect(JSON.parse(invocation.stdout())).toMatchObject({
    ok: false,
    error: { code: "INTERNAL_ERROR", message: "unexpected internal failure" },
  });
});

test("current recursively renders projection handles without interpreting policy details as protocol", async () => {
  const root = await mkdtemp(join(tmpdir(), "loredu-cli-unit-"));
  roots.push(root);
  const store = join(root, "store");
  const noStdin = async () => {
    throw new Error("invocation must not read stdin");
  };
  const init = capture(noStdin);
  expect(await run(["init", store, "--json"], init.io)).toBe(0);
  const policy: ClaimPolicy = {
    id: "test.cli-advice",
    version: "1",
    validateClaimKey: () => [],
    semantics: () => "exclusive",
    advise(context) {
      return [
        {
          code: "review",
          claims: [context.claims[0]?.record.id as ClaimId],
          details: {
            rel: "show",
            action: "record.show",
            params: { id: "ent_0000000000000000" },
            why: "portable policy data",
          },
        },
      ];
    },
  };
  const runOptions = {
    claimPolicy: policy,
    clock: { now: () => createInstant(1_700_000_000_000) },
    randomSource: { nextBytes: () => new Uint8Array(10) },
  };
  const added = capture(noStdin);
  expect(
    await run(
      [
        "add",
        "claim",
        "--store",
        store,
        "--actor",
        "agent:test",
        "--subject-type",
        "code-area",
        "--subject",
        "cli",
        "--predicate",
        "state",
        "--value",
        "ready",
        "--confidence",
        "observed",
        "--json",
      ],
      added.io,
      runOptions,
    ),
  ).toBe(0);
  const current = capture(noStdin);
  expect(await run(["current", "--store", store, "--json"], current.io, runOptions)).toBe(0);
  const response = JSON.parse(current.stdout()) as {
    result: { items: Array<Record<string, unknown>> };
  };
  const advisory = response.result.items[1] as {
    claims: Array<{ affordances: Array<{ run: string }> }>;
    details: Record<string, unknown>;
  };
  expect(advisory.claims[0]?.affordances.map(({ run }) => run)).toEqual([
    expect.stringContaining(" show "),
    expect.stringContaining(" history "),
  ]);
  expect(advisory.details).toEqual({
    action: "record.show",
    params: { id: "ent_0000000000000000" },
    rel: "show",
    why: "portable policy data",
  });
});

test("invalid and missing selected stores fail before stdin is read", async () => {
  const root = await mkdtemp(join(tmpdir(), "loredu-cli-unit-"));
  roots.push(root);
  let reads = 0;
  const invoke = async (selector: string) => {
    const invocation = capture(async () => {
      reads += 1;
      return new Uint8Array();
    });
    const exit = await run(
      ["add", "entry", "--store", selector, "--actor", "agent:test", "--body", "-", "--json"],
      invocation.io,
    );
    return { exit, envelope: JSON.parse(invocation.stdout()) as Record<string, unknown> };
  };

  const invalid = await invoke("INVALID");
  expect(invalid.exit).toBe(2);
  expect((invalid.envelope.error as { code: string }).code).toBe("VALIDATION_FAILED");
  expect(reads).toBe(0);

  const missingPath = join(root, "missing");
  const missing = await invoke(missingPath);
  expect(missing.exit).toBe(3);
  expect((missing.envelope.error as { code: string }).code).toBe("STORE_NOT_FOUND");
  expect((missing.envelope.advice as { run: string }[])[0]?.run).toBe(`lor init ${missingPath}`);
  expect(reads).toBe(0);
});
