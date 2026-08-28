#!/usr/bin/env bun
import { type ClaimPolicy, createInstant, DEFAULT_CLAIM_POLICY, type RandomSource } from "@loredu/kernel";
import { run } from "../src/index";

const coexistingPolicy: ClaimPolicy = {
  id: "loredu.test.coexisting",
  version: "1",
  validateClaimKey: () => [],
  semantics: () => "coexisting",
};

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined) throw new Error(`${name} is required by the conformance fixture`);
  return value;
}

function entropySource(hex: string): RandomSource {
  if (!/^[0-9a-f]{20}$/u.test(hex)) throw new Error("LOREDU_TEST_ENTROPY must encode exactly 10 bytes");
  const bytes = Uint8Array.from({ length: 10 }, (_, index) =>
    Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
  );
  return {
    nextBytes(count) {
      if (count !== bytes.length) throw new Error("unexpected entropy request length");
      return bytes.slice();
    },
  };
}

const policy = process.env.LOREDU_TEST_POLICY === "coexisting" ? coexistingPolicy : DEFAULT_CLAIM_POLICY;
const clock = {
  now: () => createInstant(Number(requiredEnvironment("LOREDU_TEST_INSTANT"))),
};
const randomSource = entropySource(requiredEnvironment("LOREDU_TEST_ENTROPY"));

const code = await run(
  process.argv.slice(2),
  {
    out: (text) => {
      process.stdout.write(text);
    },
    err: (text) => {
      process.stderr.write(text);
    },
    readStdin: async () => new Uint8Array(await Bun.stdin.arrayBuffer()),
  },
  { claimPolicy: policy, clock, randomSource },
);

process.exitCode = code;
