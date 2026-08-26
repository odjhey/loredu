/** Injected source of canonical record instants. */
export interface Clock {
  now(): string;
}

/** Injected entropy source. Implementations must return exactly `count` bytes or fail. */
export interface RandomSource {
  nextBytes(count: number): Uint8Array;
}
