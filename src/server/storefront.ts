import "server-only";
import { cache } from "react";
import type { StoreSettings } from "@/lib/domain/settings";
import type { CatalogData } from "@/lib/domain/types";
import { getBackend } from "@/server/backend";
import { catalogCacheSeconds } from "@/server/env";

/**
 * ===========================================================================
 *  STOREFRONT DATA
 * ===========================================================================
 *
 *  Pages are rendered on every request, so a dashboard change is live on the
 *  very next page view — no rebuild, no redeploy. To keep that cheap, the
 *  catalog and settings are loaded once and reused for a short time
 *  (CATALOG_CACHE_SECONDS, 30 by default). Every dashboard save calls
 *  `invalidateStorefront()`, so the server that handled the edit shows it
 *  immediately; any other server process catches up within the cache window.
 */

export type StorefrontData = { settings: StoreSettings; catalog: CatalogData };

type Entry = { at: number; value: Promise<StorefrontData> };
type CacheState = { entry: Entry | null; generation: number };

const globalKey = Symbol.for("storefront.catalogCache");
const state: CacheState = ((globalThis as Record<symbol, unknown>)[globalKey] as CacheState) ?? {
  entry: null,
  generation: 0,
};
(globalThis as Record<symbol, unknown>)[globalKey] = state;

async function loadFresh(): Promise<StorefrontData> {
  const backend = getBackend();
  const [settings, catalog] = await Promise.all([
    backend.public.loadSettings(),
    backend.public.loadCatalog(),
  ]);
  return { settings, catalog };
}

async function loadShared(): Promise<StorefrontData> {
  const ttl = catalogCacheSeconds() * 1000;
  const current = state.entry;
  if (current && Date.now() - current.at < ttl) return current.value;

  const generation = state.generation;
  const value = loadFresh();
  const entry: Entry = { at: Date.now(), value };
  state.entry = entry;
  value.catch(() => {
    // Never cache a failure: the next request tries again.
    if (state.entry === entry) state.entry = null;
  });
  // If the data was invalidated while loading, do not keep a stale result.
  value.then(() => {
    if (state.generation !== generation && state.entry === entry) state.entry = null;
  });
  return value;
}

/** Deduplicated per request, shared across requests for the cache window. */
export const getStorefront = cache(loadShared);

/** Fresh from the backend, bypassing the cache — used when placing orders. */
export const getStorefrontFresh = loadFresh;

export function invalidateStorefront(): void {
  state.generation += 1;
  state.entry = null;
}
