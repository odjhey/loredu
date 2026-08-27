import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

/** Directory under a Loredu home that holds named stores. */
export const STORES_DIRNAME = "stores";

/** Store name used when the caller names none. */
export const DEFAULT_STORE_NAME = "default";

export type StoreRootSelection =
  | { readonly kind: "path"; readonly path: string }
  | { readonly kind: "name"; readonly name: string }
  | { readonly kind: "default" };

export type ResolvedStoreRoot =
  | { readonly kind: "path"; readonly path: string }
  | {
      readonly kind: "name" | "default";
      readonly path: string;
      readonly home: string;
      readonly name: string;
    };

export interface StoreRootContext {
  readonly loreduHome?: string;
  readonly osHome: string;
  readonly cwd: string;
}

function nonempty(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a nonempty string`);
  }
}

export function validateStoreName(name: string): void {
  nonempty(name, "store name");
  if (
    name.length > 128 ||
    name === "." ||
    name === ".." ||
    !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(name)
  ) {
    throw new TypeError(
      "store name must be 1-128 lowercase ASCII letters, digits, dots, underscores, or hyphens and begin and end alphanumeric",
    );
  }
}

/** The Loredu home: nonempty `LOREDU_HOME`, otherwise `<osHome>/.loredu`. */
export function defaultLoreduHome(
  env: Readonly<Record<string, string | undefined>> = process.env,
  osHome: string = homedir(),
): string {
  nonempty(osHome, "OS home");
  const configured = env.LOREDU_HOME;
  return configured !== undefined && configured !== "" ? configured : join(osHome, ".loredu");
}

function resolvedNamedRoot(kind: "name" | "default", name: string, home: string): ResolvedStoreRoot {
  validateStoreName(name);
  nonempty(home, "Loredu home");
  const physicalHomeCandidate = resolve(home);
  return Object.freeze({
    kind,
    name,
    home: physicalHomeCandidate,
    path: join(physicalHomeCandidate, STORES_DIRNAME, name),
  });
}

/** Where a validated named store lives: `<home>/stores/<name>`. */
export function storeRootForName(name: string, home: string = defaultLoreduHome()): ResolvedStoreRoot {
  return resolvedNamedRoot("name", name, home);
}

/** Resolve one already-classified path/name/default selection without discovery or creation. */
export function resolveStoreRoot(
  selection: StoreRootSelection,
  context: StoreRootContext,
): ResolvedStoreRoot {
  if (typeof selection !== "object" || selection === null) {
    throw new TypeError("store root selection must be an object");
  }
  nonempty(context.osHome, "OS home");
  nonempty(context.cwd, "cwd");

  if (selection.kind === "path") {
    nonempty(selection.path, "store path");
    return Object.freeze({
      kind: "path",
      path: isAbsolute(selection.path) ? resolve(selection.path) : resolve(context.cwd, selection.path),
    });
  }

  const home = defaultLoreduHome({ LOREDU_HOME: context.loreduHome }, context.osHome);
  if (selection.kind === "name") return resolvedNamedRoot("name", selection.name, home);
  if (selection.kind === "default") return resolvedNamedRoot("default", DEFAULT_STORE_NAME, home);
  throw new TypeError("store root selection kind is invalid");
}
