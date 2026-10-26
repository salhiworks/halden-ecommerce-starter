#!/usr/bin/env node
/**
 * Creates the dashboard account — or resets its password.
 *
 *   npm run admin:create -- owner@example.com
 *   npm run admin:create -- owner@example.com --replace     (local store: new owner / forgotten password)
 *
 * The password is asked for on the terminal (nothing is shown while you
 * type). For automation, pass it in ADMIN_PASSWORD instead.
 *
 * Supabase store (SUPABASE_URL is set): creates the user in Supabase Auth —
 * or sets a new password if it exists — and makes it a store admin. Needs
 * SUPABASE_SECRET_KEY, read from your environment or .env.local; the key is
 * only used here, on your computer.
 *
 * Local store: writes the owner into .data/store.json (or STORE_DATA_DIR).
 */

import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { ask, backendKind, env, fail, loadEnv, localDataDir } from "./lib.mjs";

loadEnv();

const args = process.argv.slice(2);
const replace = args.includes("--replace");
const email = args.find((arg) => !arg.startsWith("--"))?.trim().toLowerCase();

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail("Give the account's email address: npm run admin:create -- owner@example.com");
}

const password = env("ADMIN_PASSWORD") ?? (await ask(`Password for ${email} (at least 10 characters): `, { hidden: true }));
if (password.length < 10) fail("Use at least 10 characters for the password.");
if (!env("ADMIN_PASSWORD")) {
  const again = await ask("Repeat the password: ", { hidden: true });
  if (again !== password) fail("The passwords don't match.");
}

if (backendKind() === "supabase") await supabaseAdmin();
else await localOwner();

/* ------------------------------------------------------------- supabase */

async function supabaseAdmin() {
  const url = env("SUPABASE_URL")?.replace(/\/+$/, "");
  const secret = env("SUPABASE_SECRET_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url) fail("SUPABASE_URL is not set.");
  if (!secret) {
    fail(
      "SUPABASE_SECRET_KEY is not set. Add it to .env.local (Supabase → Project Settings → API keys), " +
        "or create the user in the Supabase dashboard and run: select public.grant_admin('you@example.com');",
    );
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) {
    const exists = created.error.status === 422 || /already|exists|registered/i.test(created.error.message);
    if (!exists) fail(`Supabase refused to create the user: ${created.error.message}`);
    const user = await findUser(supabase, email);
    if (!user) fail("The user exists but could not be found to update.");
    const updated = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    if (updated.error) fail(`Could not set the new password: ${updated.error.message}`);
    console.log(`• ${email} already existed — its password was changed.`);
  } else {
    console.log(`• Created ${email} in Supabase Auth.`);
  }

  const granted = await supabase.rpc("grant_admin", { p_email: email });
  if (granted.error) {
    fail(
      `Could not make ${email} an admin: ${granted.error.message}\n  ` +
        "Has the database been set up? Run `npm run db:migrate` (or `npm run setup`).",
    );
  }
  console.log(`✓ ${email} can now sign in at /admin.`);
}

async function findUser(supabase, address) {
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Could not list users: ${error.message}`);
    const match = data.users.find((user) => user.email?.toLowerCase() === address);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

/* ---------------------------------------------------------------- local */

/** Same format as src/server/crypto.ts: scrypt$N$r$p$salt$hash. */
function hashPassword(value) {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(value, salt, 64, { N, r, p }, (error, key) =>
      error ? reject(error) : resolve(["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join("$")),
    ),
  );
}

async function localOwner() {
  const file = path.join(localDataDir(), "store.json");
  if (!existsSync(file)) {
    fail(
      `No local store at ${path.relative(process.cwd(), file) || file} yet.\n  ` +
        "Start the app once (npm run dev), then either open /admin/setup in the browser or run this again.",
    );
  }
  const data = JSON.parse(await readFile(file, "utf8"));
  if (data.owner && !replace) {
    fail(
      `This store already has an owner (${data.owner.email}).\n  ` +
        "To replace it — for example after a forgotten password — run again with --replace.",
    );
  }
  data.owner = {
    id: data.owner?.id ?? randomUUID(),
    email,
    passwordHash: await hashPassword(password),
    // A new number signs out every session of the previous password.
    sessionVersion: (data.owner?.sessionVersion ?? 0) + 1,
  };
  // Write next to the file, then swap: a running app never reads half a file.
  const temp = `${file}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(temp, file);
  console.log(`✓ ${email} can now sign in at /admin.`);
}
