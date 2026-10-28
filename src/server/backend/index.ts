import "server-only";
import { demoLocalData } from "@/lib/demo/seed";
import { withDemoOrders } from "@/server/demo/orders";
import { backendKind, backendProblem, publicDemoMode } from "@/server/env";
import { registerSeed } from "./local/db";
import { createLocalBackend } from "./local";
import { createSupabaseBackend } from "./supabase";
import type { Backend } from "./types";

/**
 * The one place that decides which backend is in use. Everything else asks
 * for `getBackend()` and never cares which it got.
 */

type Holder = { backend?: Backend; kind?: string };
const globalKey = Symbol.for("storefront.backend");
const holder: Holder = ((globalThis as Record<symbol, unknown>)[globalKey] as Holder) ?? {};
(globalThis as Record<symbol, unknown>)[globalKey] = holder;

export function getBackend(): Backend {
  const problem = backendProblem();
  if (problem) throw new Error(problem);
  const kind = backendKind();
  const demo = publicDemoMode();
  const key = `${kind}${demo ? ":public-demo" : ""}`;
  if (!holder.backend || holder.kind !== key) {
    let backend: Backend;
    if (kind === "supabase") {
      backend = createSupabaseBackend();
    } else {
      // A brand-new local store starts as the demo store, so `npm run dev`
      // opens onto a real-looking shop. "Remove demo content" empties it.
      registerSeed(demoLocalData);
      backend = createLocalBackend();
    }
    // Public demo: shop orders stay in the shopper's browser and never reach the database.
    holder.backend = demo ? { ...backend, public: withDemoOrders(backend.public) } : backend;
    holder.kind = key;
  }
  return holder.backend;
}

export type { Backend } from "./types";
