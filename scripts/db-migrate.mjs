#!/usr/bin/env node
/**
 * Applies the database migrations to the project in .env.local — after
 * updating the starter, for example. `npm run setup` does this too.
 *
 *   npm run db:migrate
 */

import { applyMigrations, env, fail, loadEnv, projectRefOf } from "./lib.mjs";

loadEnv();
const ref = projectRefOf(env("SUPABASE_URL")?.replace(/\/+$/, ""));
if (!ref) fail("SUPABASE_URL in .env.local is not a Supabase project address. Run `npm run setup` first.");
console.log(`Applying migrations to ${ref}…`);
await applyMigrations(ref);
console.log("✓ The database is up to date.");
