#!/usr/bin/env bun
import { run } from "../src/index";

// Deliberate runtime break: the bundle compiles fine, the binary does not run.
throw new Error("deliberate runtime failure for the compile-smoke proof");

const code = run(process.argv.slice(2), {
  out: (line) => {
    process.stdout.write(`${line}\n`);
  },
  err: (line) => {
    process.stderr.write(`${line}\n`);
  },
});

process.exit(code);
