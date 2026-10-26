#!/usr/bin/env node
/**
 * Connects this store to your Supabase project, step by step.
 *
 *   npx supabase login           once: sign the Supabase CLI in to your account
 *   npm run setup                then this
 *
 * It asks which project to use, then:
 *   1. creates the database: tables, security rules, the photo bucket
 *   2. writes the project's address and keys to .env.local
 *   3. adds the 30 demo products (optional)
 *   4. creates your admin account
 *   5. turns off public sign-ups (the shop has no customer accounts)
 *
 * Every step is safe to run again. Keys are written to .env.local and never
 * shown on screen. Options (for scripting):
 *   --project-ref <ref>   the project to use       --yes        no questions
 *   --no-demo             skip the demo products   --no-admin   skip the admin account
 *   --force               allow .env.local to switch to a different project
 */

import { applyMigrations, ask, env, fail, loadEnv, runNode, supabase, writeEnvLocal } from "./lib.mjs";

loadEnv();

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};
const auto = flag("--yes") || !process.stdin.isTTY;

const step = (number, text) => console.log(`\n${number}. ${text}`);
async function confirm(question, fallback = true) {
  if (auto) return fallback;
  const answer = (await ask(`${question} ${fallback ? "[Y/n]" : "[y/N]"} `)).trim().toLowerCase();
  return answer === "" ? fallback : answer === "y" || answer === "yes";
}

console.log("Connect your store to Supabase\n──────────────────────────────");

/* ------------------------------------------------- signed in, and which project */

step(0, "Checking the Supabase CLI and your sign-in…");
let projects = await supabase(["projects", "list", "-o", "json"], { capture: true });
if (projects.code !== 0) {
  if (auto) fail("The Supabase CLI is not signed in. Run `npx supabase login`, then `npm run setup` again.");
  console.log("   You're not signed in to the Supabase CLI yet. Opening the sign-in…");
  if ((await supabase(["login"])).code !== 0) fail("Sign-in did not complete. Run `npx supabase login`, then `npm run setup` again.");
  projects = await supabase(["projects", "list", "-o", "json"], { capture: true });
  if (projects.code !== 0) fail("Could not list your Supabase projects. Check your sign-in with `npx supabase projects list`.");
}

let list = [];
try {
  list = JSON.parse(projects.stdout);
} catch {
  fail("Could not read the list of your Supabase projects.");
}
const refOf = (project) => project.ref ?? project.id;
if (list.length === 0) fail("Your Supabase account has no project yet. Create one at https://supabase.com/dashboard, then run this again.");

let ref = option("--project-ref");
if (!ref) {
  if (auto) fail("Pass the project with --project-ref <ref> (it is in the project's URL: https://<ref>.supabase.co).");
  console.log("\n   Your projects:");
  list.forEach((project, index) => console.log(`   ${index + 1}. ${project.name}  (${refOf(project)}, ${project.region})`));
  const answer = (await ask("\n   Which one should this store use? Type its number or its ref: ")).trim();
  ref = /^\d+$/.test(answer) ? refOf(list[Number(answer) - 1] ?? {}) : answer;
}
const project = list.find((candidate) => refOf(candidate) === ref);
if (!project) fail(`No project with the ref “${ref}” in your account. Check the ref and try again.`);
console.log(`   Project: ${project.name} (${ref})`);
if (!(await confirm("   Use this project?", true))) fail("Stopped. Nothing was changed.");

const url = `https://${ref}.supabase.co`;
const current = env("SUPABASE_URL");
if (current && current.replace(/\/+$/, "") !== url && !flag("--force")) {
  fail(
    `.env.local is set up for a different Supabase project (${current}).\n  ` +
      "Run again with --force to switch this store to the new one.",
  );
}

/* ------------------------------------------------------------------ 1. schema */

step(1, "Creating the database (tables, security rules, photo bucket)…");
await applyMigrations(ref);

/* -------------------------------------------------------------------- 2. keys */

step(2, "Saving the project's address and keys to .env.local…");
const keys = await supabase(["projects", "api-keys", "--project-ref", ref, "--reveal", "-o", "json"], { capture: true });
if (keys.code !== 0) fail("Could not read the project's API keys. Check that your account can manage this project.");
let entries = [];
try {
  entries = JSON.parse(keys.stdout);
} catch {
  fail("Could not read the project's API keys.");
}
const keyOf = (...names) =>
  entries.find((entry) => names.includes(entry.type) || names.includes(entry.name))?.api_key ?? null;
const publishable = keyOf("publishable") ?? keyOf("anon");
const secret = keyOf("secret") ?? keyOf("service_role");
if (!publishable || !secret || /·|\*/.test(secret)) {
  fail("The project's publishable and secret keys could not be read. Copy them from Supabase → Project Settings → API keys into .env.local.");
}
writeEnvLocal({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: publishable, SUPABASE_SECRET_KEY: secret });
console.log("   ✓ SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY are in .env.local (never commit this file).");

/* -------------------------------------------------------------------- 3. demo */

step(3, "The 30 demo products (you can remove them later in one click).");
if (!flag("--no-demo") && (await confirm("   Add them?", true))) {
  const code = await runNode(["--conditions=react-server", "--import", "tsx", "scripts/seed.mts"]);
  if (code !== 0) fail("The demo products could not be added (see the message above).");
} else {
  console.log("   Skipped. Add them any time with `npm run db:seed`.");
}

/* ------------------------------------------------------------------- 4. admin */

const adminEmail = option("--admin-email") ?? env("ADMIN_EMAIL");
if (flag("--no-admin")) {
  step(4, "Admin account: skipped. Create it any time with `npm run admin:create -- you@example.com`.");
} else if (adminEmail || !auto) {
  step(4, "Your admin account — the login for the dashboard at /admin.");
  const email = adminEmail ?? (await ask("   Your email: ")).trim();
  const code = await runNode(["scripts/create-admin.mjs", email]);
  if (code !== 0) fail("The admin account was not created (see the message above). Fix it and run `npm run setup` again.");
} else {
  step(4, "Admin account: run `npm run admin:create -- you@example.com` to create it.");
}

/* --------------------------------------------------------------- 5. sign-ups */

step(5, "Public sign-ups (the shop has no customer accounts; only admins you create can sign in).");
if (await confirm("   Turn them off? (recommended)", true)) {
  const result = await supabase(["config", "push", "--project-ref", ref, "--yes"], { capture: true });
  if (result.code === 0) console.log("   ✓ Public sign-ups are off.");
  else console.log("   ! Could not change it automatically. In Supabase → Authentication → Sign In / Providers, turn off “Allow new users to sign up”.");
}

console.log(`
Done. Start the store with:

   npm run dev

then open http://localhost:3000 — and http://localhost:3000/admin to sign in.
When you deploy, copy SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY
from .env.local into your host's environment variables.
`);
