import { lstatSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** Directory under a Loredu home that holds named stores. */
export const STORES_DIRNAME = "stores";

/** Store name used when the caller names none. */
export const DEFAULT_STORE_NAME = "default";

export type StoreRootSelection =
  | { readonly kind: "path"; readonly path: string }
  | { readonly kind: "name"; readonly name: string }
  | { readonly kind: "default" };

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

function isHostError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
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

/** Resolve an existing path, or the nearest existing ancestor plus its missing suffix, physically. */
export function physicalizeStorePath(pathInput: string): string {
  nonempty(pathInput, "store path");
  let candidate = resolve(pathInput);
  const missing: string[] = [];
  while (true) {
    try {
      return resolve(realpathSync(candidate), ...missing);
    } catch (error) {
      if (!isHostError(error, "ENOENT") && !isHostError(error, "ENOTDIR")) throw error;
      const parent = dirname(candidate);
      if (parent === candidate) throw error;
      missing.unshift(basename(candidate));
      candidate = parent;
    }
  }
}

function inspectNamedBoundary(path: string, label: string): void {
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new TypeError(`${label} may not be a symlink: ${path}`);
  } catch (error) {
    if (isHostError(error, "ENOENT")) return;
    throw error;
  }
}

function assertPhysicalDescendant(home: string, path: string, label: string): void {
  let physicalPath: string;
  try {
    physicalPath = realpathSync(path);
  } catch (error) {
    if (isHostError(error, "ENOENT")) return;
    throw error;
  }
  const physicalHome = physicalizeStorePath(home);
  const fromHome = relative(physicalHome, physicalPath);
  if (fromHome === "" || fromHome === ".." || fromHome.startsWith(`..${sep}`) || isAbsolute(fromHome)) {
    throw new TypeError(`${label} escapes the physical Loredu home: ${path}`);
  }
}

function validatedNamedRoot(name: string, home: string): string {
  validateStoreName(name);
  nonempty(home, "Loredu home");
  const root = join(home, STORES_DIRNAME, name);
  const stores = join(home, STORES_DIRNAME);
  inspectNamedBoundary(stores, "named-store directory");
  inspectNamedBoundary(root, "named-store root");
  assertPhysicalDescendant(home, stores, "named-store directory");
  assertPhysicalDescendant(home, root, "named-store root");
  return root;
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

/** Where a validated named store lives: `<home>/stores/<name>`. */
export function storeRootForName(name: string, home: string = defaultLoreduHome()): string {
  return validatedNamedRoot(name, home);
}

/** Resolve one already-classified path/name/default selection without discovery or creation. */
export function resolveStoreRoot(selection: StoreRootSelection, context: StoreRootContext): string {
  if (typeof selection !== "object" || selection === null) {
    throw new TypeError("store root selection must be an object");
  }
  nonempty(context.osHome, "OS home");
  nonempty(context.cwd, "cwd");

  if (selection.kind === "path") {
    nonempty(selection.path, "store path");
    const lexical = isAbsolute(selection.path)
      ? resolve(selection.path)
      : resolve(context.cwd, selection.path);
    return physicalizeStorePath(lexical);
  }

  const home = defaultLoreduHome({ LOREDU_HOME: context.loreduHome }, context.osHome);
  if (selection.kind === "name") return validatedNamedRoot(selection.name, home);
  if (selection.kind === "default") return validatedNamedRoot(DEFAULT_STORE_NAME, home);
  throw new TypeError("store root selection kind is invalid");
}
