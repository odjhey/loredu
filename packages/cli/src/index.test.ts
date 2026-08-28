import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
