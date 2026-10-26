import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { TEST_CUSTOMER } from "./fixtures";

/** The values of .env.local that the environment doesn't already set. */
function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

/**
 * After a run against a real Supabase project (E2E_BACKEND=supabase): removes
 * the orders the tests placed and any test item a failed test left behind,
 * then re-seeds the demo products so prices and stock are as they were. A
 * local run needs nothing — its data folder is thrown away.
 */
export default async function globalTeardown() {
  if (process.env.E2E_BACKEND !== "supabase") return;
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return;
  const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const orders = await supabase.from("orders").delete({ count: "exact" }).eq("customer->>name", TEST_CUSTOMER);
  if (orders.error) console.warn("[teardown] test orders:", orders.error.message);
  for (const [table, slugs] of [
    ["products", ["trail-water-bottle"]],
    ["categories", ["garden-tools"]],
    ["collections", ["weekend-picks"]],
  ] as const) {
    const removed = await supabase.from(table).delete().in("slug", [...slugs]).eq("is_demo", false);
    if (removed.error) console.warn(`[teardown] test ${table}:`, removed.error.message);
  }

  const seed = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/seed.mts"], {
    stdio: "inherit",
    env: process.env,
  });
  if (seed.status !== 0) console.warn("[teardown] re-seeding the demo products failed");
  console.log(`[teardown] removed ${orders.count ?? 0} test order(s) and restored the demo products.`);
}
