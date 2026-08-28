import { expect, test } from "bun:test";
import { run } from "./index";

test("stdin read failures retain the internal failure exit category", async () => {
  let stdout = "";
  let stderr = "";
  const exit = await run(["add", "entry", "--actor", "agent:test", "--body", "-", "--json"], {
    out: (text) => {
      stdout += text;
    },
    err: (text) => {
      stderr += text;
    },
    readStdin: async () => {
      throw new Error("stdin read failed");
    },
  });

  expect(exit).toBe(6);
  expect(stderr).toBe("");
  expect(JSON.parse(stdout)).toMatchObject({
    ok: false,
    error: { code: "INTERNAL_ERROR", message: "unexpected internal failure" },
  });
});
