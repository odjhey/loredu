import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Store-root resolution, transcribed from the store contract's "Store roots"
 * section. Path arithmetic only — deliberately *not* the full resolution rule
 * from catalog T17, which also owns the "resolved store does not exist" error
 * and the `--store` precedence order. Those belong to the store and CLI as M1
 * lands; nothing here touches the filesystem.
 */

/** Directory under a Loredu home that holds named stores. */
export const STORES_DIRNAME = "stores";

/** Store name used when the caller names none. */
export const DEFAULT_STORE_NAME = "default";

/**
 * The Loredu home: `$LOREDU_HOME` when set, otherwise `~/.loredu`.
 *
 * Unlike `@loredu/kernel`, this package is an adapter and may read the
 * environment (ADR 0011).
 */
export function defaultLoreduHome(env: Record<string, string | undefined> = process.env): string {
  const configured = env.LOREDU_HOME;
  return configured !== undefined && configured !== "" ? configured : join(homedir(), ".loredu");
}

/** Where a named store lives under a Loredu home: `<home>/stores/<name>`. */
export function storeRootForName(name: string, home: string = defaultLoreduHome()): string {
  return join(home, STORES_DIRNAME, name);
}
