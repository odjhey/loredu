import { type Clock, createInstant, type Instant, type RandomSource } from "@loredu/kernel";

/** Host wall clock used only at the CLI composition root. */
export class SystemClock implements Clock {
  now(): Instant {
    return createInstant(Date.now());
  }
}

/** Host cryptographic entropy used only at the CLI composition root. */
export class CryptographicRandomSource implements RandomSource {
  nextBytes(count: number): Uint8Array {
    const bytes = new Uint8Array(count);
    crypto.getRandomValues(bytes);
    return bytes;
  }
}
