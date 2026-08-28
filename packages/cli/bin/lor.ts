#!/usr/bin/env bun
import { run } from "../src/index";

const code = await run(process.argv.slice(2), {
  out: (text) => {
    process.stdout.write(text);
  },
  err: (text) => {
    process.stderr.write(text);
  },
  readStdin: async () => new Uint8Array(await Bun.stdin.arrayBuffer()),
});

process.exitCode = code;
