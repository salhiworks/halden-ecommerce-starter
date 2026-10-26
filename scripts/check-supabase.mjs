#!/usr/bin/env node
/**
 * Checks your Supabase project's security from the outside — what a shopper,
 * and a signed-in stranger, can and cannot do — and that the store's data is
 * in place. Changes nothing, apart from a throwaway user it creates and
 * deletes again.
 *
 *   npm run db:check
 *
 * Reads SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY from
 * your environment or .env.local.
 */

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { env, fail, loadEnv } from "./lib.mjs";

loadEnv();
const url = env("SUPABASE_URL")?.replace(/\/+$/, "");
const publishable = env("SUPABASE_PUBLISHABLE_KEY") ?? env("SUPABASE_ANON_KEY");
const secret = env("SUPABASE_SECRET_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !publishable || !secret) fail("Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY first (`npm run setup`).");

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const results = [];
async function check(label, run) {
  try {
    const outcome = await run();
    results.push({ ok: outcome === true, label, detail: outcome === true ? "" : String(outcome) });
  } catch (error) {
    results.push({ ok: false, label, detail: error instanceof Error ? error.message : String(error) });
  }
}
/** A request that must be refused: an error, or nothing touched. */
const refused = async (request) => {
  const { data, error, count } = await request;
  if (error) return true;
  return (Array.isArray(data) && data.length > 0) || (count ?? 0) > 0 ? "allowed" : true;
};

const shopper = createClient(url, publishable, options);
const service = createClient(url, secret, options);

/* --------------------------------------------------------- the store's data */

await check("the database is set up (settings row exists)", async () => {
  const { data, error } = await service.from("store_settings").select("id").eq("id", 1).maybeSingle();
  return error ? error.message : data ? true : "no settings row — run `npm run db:migrate`";
});
await check("the photo bucket exists and is public", async () => {
  const { data, error } = await service.storage.getBucket("store-media");
  return error ? error.message : data.public ? true : "bucket is not public";
});
await check("at least one admin exists", async () => {
  const { count, error } = await service.from("admin_users").select("user_id", { count: "exact", head: true });
  return error ? error.message : (count ?? 0) > 0 ? true : "no admin yet — run `npm run admin:create -- you@example.com`";
});

/* ----------------------------------------------------- what a shopper can do */

await check("shoppers can read the settings and published products", async () => {
  const settings = await shopper.from("store_settings").select("id");
  const products = await shopper.from("products").select("id, status");
  if (settings.error || products.error) return (settings.error ?? products.error).message;
  return products.data.every((product) => product.status !== "draft") ? true : "drafts are visible";
});
await check("shoppers can't read orders", () => refused(shopper.from("orders").select("id").limit(1)));
await check("shoppers can't see who the admins are", () => refused(shopper.from("admin_users").select("user_id").limit(1)));
await check("shoppers can't change products", () =>
  refused(shopper.from("products").update({ name: "x" }, { count: "exact" }).neq("id", "00000000-0000-0000-0000-000000000000")),
);
await check("shoppers can't add categories", () => refused(shopper.from("categories").insert({ slug: "x-check", name: "x" }).select()));
await check("shoppers can't create orders directly", () =>
  refused(
    shopper
      .from("orders")
      .insert({ channel: "web", status: "received", payment_method: "cod", currency: "USD", items: [{}], subtotal: 1, total: 1, customer: {}, access_token_hash: "x" })
      .select(),
  ),
);
await check("shoppers can't upload photos", async () => {
  const { error } = await shopper.storage.from("store-media").upload(`check-${Date.now()}.png`, new Uint8Array([1]), { contentType: "image/png" });
  return error ? true : "upload allowed";
});
await check("shoppers can't make themselves admin", () => refused(shopper.rpc("grant_admin", { p_email: "someone@example.com" })));
await check("public sign-ups are off", async () => {
  const { error } = await shopper.auth.signUp({ email: `signup-check-${Date.now()}@example.com`, password: randomBytes(12).toString("hex") });
  return error ? true : "anyone can create an account (turn off sign-ups: `npm run setup` step 5)";
});

/* ------------------------------------------- what a signed-in stranger can do */

const email = `security-check-${Date.now()}@example.com`;
const password = randomBytes(18).toString("base64url");
const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error) {
  results.push({ ok: false, label: "create a throwaway user for the signed-in checks", detail: created.error.message });
} else {
  const stranger = createClient(url, publishable, options);
  const signedIn = await stranger.auth.signInWithPassword({ email, password });
  if (signedIn.error) {
    results.push({ ok: false, label: "sign in as the throwaway user", detail: signedIn.error.message });
  } else {
    await check("signed-in non-admins can't read orders", () => refused(stranger.from("orders").select("id").limit(1)));
    await check("signed-in non-admins can't change products", () =>
      refused(stranger.from("products").update({ name: "x" }, { count: "exact" }).neq("id", "00000000-0000-0000-0000-000000000000")),
    );
    await check("signed-in non-admins can't change settings", () =>
      refused(stranger.from("store_settings").update({ data: {} }, { count: "exact" }).eq("id", 1)),
    );
    await check("signed-in non-admins can't upload photos", async () => {
      const { error } = await stranger.storage.from("store-media").upload(`check-${Date.now()}.png`, new Uint8Array([1]), { contentType: "image/png" });
      return error ? true : "upload allowed";
    });
    await check("signed-in non-admins are not admins", async () => {
      const { data, error } = await stranger.rpc("is_admin");
      return error ? error.message : data === false ? true : "is_admin() returned true";
    });
  }
  const removed = await service.auth.admin.deleteUser(created.data.user.id);
  if (removed.error) results.push({ ok: false, label: "delete the throwaway user", detail: removed.error.message });
}

/* ------------------------------------------------------------------- report */

for (const result of results) console.log(`${result.ok ? "✓" : "✗"} ${result.label}${result.detail ? ` — ${result.detail}` : ""}`);
const failed = results.filter((result) => !result.ok).length;
console.log(failed === 0 ? `\nAll ${results.length} checks passed.` : `\n${failed} of ${results.length} checks failed.`);
process.exit(failed === 0 ? 0 : 1);
