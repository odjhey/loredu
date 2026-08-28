import { expect, test } from "bun:test";
import { permutationDigest } from "../../packages/kernel/src/sha256";

test("pure SHA-256 permutation digest matches ADR 0030 vectors", () => {
  expect(permutationDigest([])).toBe("T1PNoYwrqgwDVLtfmj7L5e0Sq02OEbqHPC8RFhICuUU");
  expect(permutationDigest([0])).toBe("0LyhEfhigTetxMFvEjSW3N0dWQ0Gy12azWizn-ZW-5c");
  expect(permutationDigest([1, 0])).toBe("Wq8eGD8frxLDJ9wvuMIjAi8EaExh_DRTO_9i5-Vyx3Y");
  expect(permutationDigest([0, 2, 1])).toBe("F-xKZQnI4WgcP4GTnO6egQd0keFR1WmtDMbwMZYgGBg");
});
