import { expect, test } from "bun:test";
import { join } from "node:path";

interface FaultOutcome {
  readonly fault: string;
  readonly events: readonly string[];
  readonly appendCode?: string;
  readonly returnedPosition?: number;
  readonly head: number;
  readonly ids: readonly string[];
  readonly attemptedVisible: boolean;
  readonly retryCode?: string;
}

// @covers T18
test("durable commit faults expose only the old prefix or one uncertain whole next record", async () => {
  const probe = join(import.meta.dir, "plain-file-fault-probe.ts");
  const child = Bun.spawn([process.execPath, probe], {
    cwd: join(import.meta.dir, "../.."),
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect(exitCode, stderr).toBe(0);
  const outcomes = JSON.parse(stdout) as FaultOutcome[];
  const byFault = new Map(outcomes.map((outcome) => [outcome.fault, outcome]));

  const success = byFault.get("none");
  expect(success).toBeDefined();
  expect(success).toMatchObject({ returnedPosition: 1, head: 1, attemptedVisible: true });
  expect(success?.appendCode).toBeUndefined();
  expect(success?.events).toEqual([
    "temp-open",
    "temp-write",
    "temp-file-sync",
    "temp-close",
    "rename",
    "records-dir-open",
    "records-dir-sync",
    "tmp-dir-open",
    "tmp-dir-sync",
    "lock-release",
  ]);

  for (const fault of ["temp-open", "temp-write", "temp-file-sync", "temp-close", "rename"]) {
    expect(byFault.get(fault), fault).toMatchObject({
      appendCode: "STORE_IO_FAILED",
      head: 0,
      ids: [],
      attemptedVisible: false,
    });
  }

  for (const fault of ["records-dir-sync", "tmp-dir-sync", "lock-release"]) {
    const outcome = byFault.get(fault);
    expect(outcome, fault).toMatchObject({
      appendCode: "STORE_IO_FAILED",
      head: 1,
      attemptedVisible: true,
    });
    expect(outcome?.ids).toHaveLength(1);
  }
  expect(byFault.get("records-dir-sync")?.retryCode).toBe("DUPLICATE_RECORD_ID");
  expect(byFault.get("tmp-dir-sync")?.retryCode).toBe("DUPLICATE_RECORD_ID");
  expect(byFault.get("lock-release")?.retryCode).toBe("STORE_LOCKED");

  expect(byFault.get("records-dir-sync")?.events).toEqual([
    "temp-open",
    "temp-write",
    "temp-file-sync",
    "temp-close",
    "rename",
    "records-dir-open",
    "records-dir-sync",
    "lock-release",
  ]);
  expect(byFault.get("tmp-dir-sync")?.events).toEqual([
    "temp-open",
    "temp-write",
    "temp-file-sync",
    "temp-close",
    "rename",
    "records-dir-open",
    "records-dir-sync",
    "tmp-dir-open",
    "tmp-dir-sync",
    "lock-release",
  ]);
});
