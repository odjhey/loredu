#!/usr/bin/env bun

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanKernelProduction } from "./kernel-capability-guard";

function usage(): never {
  console.error("usage: check-kernel-capabilities.ts [--root PATH] [--json]");
  process.exit(2);
}

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let root = defaultRoot;
let json = false;
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index];
  if (argument === "--json") {
    json = true;
  } else if (argument === "--root") {
    const value = process.argv[++index];
    if (!value) usage();
    root = resolve(value);
  } else {
    usage();
  }
}

const problems = scanKernelProduction(root);
if (json) {
  console.log(JSON.stringify({ problems }, null, 2));
} else if (problems.length === 0) {
  console.log("kernel capability boundary: clean");
} else {
  for (const problem of problems) {
    console.error(
      `${problem.file}:${problem.line}:${problem.column} [${problem.capability}] ${problem.message}`,
    );
  }
  console.error(`kernel capability boundary: ${problems.length} problem(s)`);
}
process.exit(problems.length === 0 ? 0 : 1);
