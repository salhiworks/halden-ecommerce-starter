import { parseSettings } from "@/lib/domain/settings";
import type { CatalogData } from "@/lib/domain/types";
import type { LocalData } from "@/server/backend/local/db";
import { demoCategories, demoCollections, demoProducts } from "./catalog";
import { DEMO_SETTINGS } from "./settings";

/**
 * The demo store, assembled. Used to fill a brand-new local store and by
 * "Load demo content" in the dashboard (on either backend). Every record is
 * flagged `isDemo`, so "Remove demo content" can take it all back out
 * without touching anything the owner created.
 */

export function demoCatalog(now = new Date()): CatalogData {
  return {
    categories: demoCategories(now),
    collections: demoCollections(now),
    products: demoProducts(now),
  };
}

export function demoSettings() {
  return parseSettings(DEMO_SETTINGS);
}

export function demoLocalData(): LocalData {
  return {
    version: 1,
    settings: demoSettings(),
    ...demoCatalog(),
    orders: [],
    nextOrderNumber: 1001,
    owner: null,
  };
}
