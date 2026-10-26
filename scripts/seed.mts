/**
 * Puts the demo store (30 fictional products, their categories and
 * collections) into your Supabase database — or takes it back out.
 *
 *   npm run db:seed                  add or refresh the demo products
 *   npm run db:seed -- --settings    …and also use the demo store's name,
 *                                    homepage, delivery options and pages
 *   npm run db:seed -- --remove      remove every demo product, category
 *                                    and collection
 *
 * Safe to run any number of times:
 *   • only rows marked as demo content are ever written or removed — never
 *     anything you created, and never an order;
 *   • a demo item whose URL handle you already use gets "-demo" added to its
 *     handle instead of replacing yours;
 *   • running it again restores the demo products as they were (prices,
 *     stock, photos), which is how the public demo is reset.
 *
 * Store settings are only filled in when the store has none yet, unless you
 * pass --settings. Reads SUPABASE_URL and SUPABASE_SECRET_KEY from your
 * environment or .env.local; the secret key is used only on this computer.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { demoCatalog, demoSettings } from "@/lib/demo/seed";
import type { Grouping, Product } from "@/lib/domain/types";
import { fromGrouping, fromProduct } from "@/server/backend/supabase/mappers";
import { env, fail, loadEnv } from "./lib.mjs";

type Table = "categories" | "collections" | "products";
type Existing = { id: string; slug: string; is_demo: boolean };

loadEnv();
const args = new Set(process.argv.slice(2));

const url = env("SUPABASE_URL")?.replace(/\/+$/, "");
const secret = env("SUPABASE_SECRET_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !secret) {
  fail("SUPABASE_URL and SUPABASE_SECRET_KEY must be set (in .env.local). Run `npm run setup` first.");
}

const supabase = createClient(url!, secret!, { auth: { persistSession: false, autoRefreshToken: false } });

async function existing(client: SupabaseClient, table: Table): Promise<Existing[]> {
  const { data, error } = await client.from(table).select("id, slug, is_demo");
  if (error) {
    fail(
      /does not exist|schema cache/i.test(error.message)
        ? "The database tables are missing. Run `npm run db:migrate` (or `npm run setup`) first."
        : `Could not read ${table}: ${error.message}`,
    );
  }
  return (data ?? []) as Existing[];
}

/**
 * Demo rows to write: never one that would replace your own row, and with a
 * "-demo" handle when yours already uses the handle.
 */
function plan<T extends { id: string; slug: string }>(items: T[], current: Existing[]): { rows: T[]; skipped: number } {
  const rows: T[] = [];
  let skipped = 0;
  for (const item of items) {
    const sameId = current.find((row) => row.id === item.id);
    if (sameId && !sameId.is_demo) {
      skipped += 1;
      continue;
    }
    const taken = current.some((row) => row.slug === item.slug && row.id !== item.id);
    rows.push(taken ? { ...item, slug: `${item.slug}-demo`.slice(0, 80) } : item);
  }
  return { rows, skipped };
}

async function upsert(table: Table, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) fail(`Could not write the demo ${table}: ${error.message}`);
}

async function remove() {
  const removed: Record<Table, number> = { products: 0, collections: 0, categories: 0 };
  for (const table of ["products", "collections", "categories"] as const) {
    const { error, count } = await supabase.from(table).delete({ count: "exact" }).eq("is_demo", true);
    if (error) fail(`Could not remove the demo ${table}: ${error.message}`);
    removed[table] = count ?? 0;
  }
  console.log(
    `✓ Removed ${removed.products} demo products, ${removed.categories} categories and ${removed.collections} collections.`,
  );
}

async function seed() {
  const demo = demoCatalog();
  const [categories, collections, products] = await Promise.all([
    existing(supabase, "categories"),
    existing(supabase, "collections"),
    existing(supabase, "products"),
  ]);

  const groupingRow = (item: Grouping) => ({ ...fromGrouping(item), created_at: item.createdAt });
  // Keep each product's age, so "New" badges and "newest first" look right.
  const productRow = (item: Product) => ({ ...fromProduct(item), created_at: item.createdAt });

  const plannedCategories = plan(demo.categories, categories);
  const plannedCollections = plan(demo.collections, collections);
  const plannedProducts = plan(demo.products, products);

  await upsert("categories", plannedCategories.rows.map(groupingRow));
  await upsert("collections", plannedCollections.rows.map(groupingRow));
  await upsert("products", plannedProducts.rows.map(productRow));

  const skipped = plannedCategories.skipped + plannedCollections.skipped + plannedProducts.skipped;
  console.log(
    `✓ Demo store ready: ${plannedProducts.rows.length} products, ${plannedCategories.rows.length} categories, ${plannedCollections.rows.length} collections.`,
  );
  if (skipped > 0) console.log(`  ${skipped} item(s) skipped: their id belongs to something you created.`);

  // Settings: the demo store's only when the store has none yet, or when asked.
  const { data, error } = await supabase.from("store_settings").select("data").eq("id", 1).maybeSingle();
  if (error) fail(`Could not read the store settings: ${error.message}`);
  const blank = !data || Object.keys((data.data as Record<string, unknown>) ?? {}).length === 0;
  if (blank || args.has("--settings")) {
    const { error: writeError } = await supabase
      .from("store_settings")
      .upsert({ id: 1, data: demoSettings() }, { onConflict: "id" });
    if (writeError) fail(`Could not write the store settings: ${writeError.message}`);
    console.log("✓ Store settings set to the demo store's (name, homepage, delivery, pages).");
  } else {
    console.log("  Store settings left as they are (pass --settings to use the demo store's).");
  }
}

if (args.has("--remove")) await remove();
else await seed();
