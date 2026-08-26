import { expect, test } from "bun:test";

// Deliberate failure: proves a red test fails the ci-required aggregate.
// Claims no catalog T-number, so catalog accounting stays green.
test("deliberately failing assertion", () => {
  expect(1 + 1).toBe(3);
});
