import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Category, Collection, Product } from "@/lib/domain/types";
import { localDataDir } from "@/server/env";
import type { StoredOrder } from "../types";

/**
 * ===========================================================================
 *  LOCAL FILE STORE
 * ===========================================================================
 *
 *  The whole store as one JSON document in `.data/store.json`. Writes are
 *  serialised through a single queue and land atomically (write a temp file,
 *  then rename it over the old one), so a crash mid-write can never leave a
 *  half-written store behind.
 *
 *  State lives on `globalThis` rather than in module scope: Next.js can load a
 *  module more than once (route handlers and server components are bundled
 *  separately), and every copy must share one queue and one cache.
 */

export type OwnerAccount = {
  id: string;
  email: string;
  passwordHash: string;
  /** Bumped on password change, which signs out every other session. */
  sessionVersion: number;
};

export type LocalData = {
  version: 1;
  settings: unknown;
  categories: Category[];
  collections: Collection[];
  products: Product[];
  orders: StoredOrder[];
  nextOrderNumber: number;
  owner: OwnerAccount | null;
};

type DbState = {
  cache: { data: LocalData; mtimeMs: number } | null;
  queue: Promise<unknown>;
  seed: (() => LocalData) | null;
};

const globalKey = Symbol.for("storefront.localDb");
const state: DbState = ((globalThis as Record<symbol, unknown>)[globalKey] as DbState) ?? {
  cache: null,
  queue: Promise.resolve(),
  seed: null,
};
(globalThis as Record<symbol, unknown>)[globalKey] = state;

export function storeFile(): string {
  return path.join(localDataDir(), "store.json");
}

export function emptyData(): LocalData {
  return {
    version: 1,
    settings: {},
    categories: [],
    collections: [],
    products: [],
    orders: [],
    nextOrderNumber: 1001,
    owner: null,
  };
}

/** Registers how a brand-new data file is filled (the demo store). */
export function registerSeed(seed: () => LocalData): void {
  state.seed = seed;
}

async function load(): Promise<LocalData> {
  const file = storeFile();
  let info;
  try {
    info = await stat(file);
  } catch {
    const initial = state.seed ? state.seed() : emptyData();
    await persist(initial);
    return initial;
  }
  // Reuse the parsed copy unless the file changed underneath us (for
  // example `npm run demo:reset` in another terminal).
  if (state.cache && state.cache.mtimeMs === info.mtimeMs) return state.cache.data;
  const data = JSON.parse(await readFile(file, "utf8")) as LocalData;
  state.cache = { data, mtimeMs: info.mtimeMs };
  return data;
}

async function persist(data: LocalData): Promise<void> {
  const file = storeFile();
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(temp, file);
  const info = await stat(file);
  state.cache = { data, mtimeMs: info.mtimeMs };
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = state.queue.then(task, task);
  state.queue = run.catch(() => undefined);
  return run;
}

/** A consistent snapshot. Callers must treat it as read-only. */
export function readData(): Promise<LocalData> {
  return enqueue(load);
}

/**
 * Runs `mutate` on a private copy and saves the result. If `mutate` throws,
 * nothing is written.
 */
export function updateData<T>(mutate: (data: LocalData) => T | Promise<T>): Promise<T> {
  return enqueue(async () => {
    const draft = structuredClone(await load());
    const result = await mutate(draft);
    await persist(draft);
    return result;
  });
}
