/**
 * Test support, published only as `@loredu/kernel/testing`.
 *
 * This subpath exists so the store contract's guarantees can become an
 * executable conformance suite that every adapter runs, and so kernel/application
 * tests can use an in-memory reference store (ADR 0011). Both land with M1
 * alongside the store itself; this file declares the seam they plug into and
 * contains no test doubles yet — an `InMemoryStore` that did not honour
 * append-is-commit would be worse than none.
 *
 * Production code must never import this subpath.
 */
import type { RecordStore } from "../src/ports/record-store";

/**
 * How a store adapter offers itself to the conformance suite: a name for test
 * output, and a factory returning a fresh, empty store per case.
 */
export interface StoreUnderTest {
  readonly name: string;
  create(): Promise<RecordStore>;
}
