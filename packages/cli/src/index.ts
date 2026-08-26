import { RECORD_SCHEMA_ID } from "@loredu/kernel";
import { defaultLoreduHome, STORE_ADAPTER_NAME } from "@loredu/store-plainfile";
import { LOR_VERSION } from "./version";

/**
 * The `lor` entry point. Argv in, rendered output out — the CLI is a rendering
 * adapter over the application API (ADR 0011) and holds no domain logic.
 *
 * No journey commands exist yet: `init`, `add`, `lore`, `status`, `show`,
 * `history`, `resolve`, and `skill` land with M1+ (catalog T50–T58). Until then
 * this binary answers only `--version`, so the compile smoke has something real
 * to run and the package DAG is exercised end to end.
 */

export interface CliIo {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

export const NOT_IMPLEMENTED_MESSAGE =
  "lor has no commands yet: the journey surface lands with M1. See docs/v0.x/execution/first-user-journey.md";

/** Renders the `--version` line: binary version, record schema, active adapter. */
export function versionLine(home: string = defaultLoreduHome()): string {
  return `lor ${LOR_VERSION} (schema ${RECORD_SCHEMA_ID}, store ${STORE_ADAPTER_NAME}, home ${home})`;
}

/** Runs one invocation and returns the process exit code. */
export function run(argv: readonly string[], io: CliIo): number {
  if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "-v")) {
    io.out(versionLine());
    return 0;
  }
  io.err(NOT_IMPLEMENTED_MESSAGE);
  return 1;
}
