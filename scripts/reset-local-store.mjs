#!/usr/bin/env node
/**
 * Puts a LOCAL store back to the fresh demo store — handy between takes of a
 * tutorial, or after experimenting.
 *
 *   npm run demo:reset            asks first
 *   npm run demo:reset -- --yes   no question
 *
 * Nothing is deleted: the current data folder (products, orders, uploads, the
 * owner account) is moved to .data-backups/<date-time>/. The app creates a
 * new demo store on its next request, and /admin/setup asks for an owner.
 *
 * A Supabase store is never touched by this script. Use Settings → Demo
 * content in the dashboard instead.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { ask, backendKind, fail, loadEnv, localDataDir } from "./lib.mjs";

loadEnv();

if (backendKind() === "supabase") {
  fail("This store uses Supabase. To remove or restore the demo products, use Settings → Demo content in the dashboard.");
}

const dataDir = localDataDir();
if (!existsSync(dataDir) || (await readdir(dataDir)).length === 0) {
  console.log("Nothing to reset: there is no local store yet. The app creates the demo store on its first start.");
  process.exit(0);
}

if (!process.argv.includes("--yes")) {
  const answer = await ask(
    `Move the current store in ${path.relative(process.cwd(), dataDir) || dataDir} aside and start a fresh demo store? [y/N] `,
  );
  if (!/^y(es)?$/i.test(answer.trim())) {
    console.log("Nothing changed.");
    process.exit(0);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
// Next to the data folder: .data → .data-backups (ignored by git).
const backups = path.join(path.dirname(dataDir), `${path.basename(dataDir)}-backups`);
const target = path.join(backups, stamp);
await mkdir(backups, { recursive: true });
await rename(dataDir, target);

console.log(`✓ The previous store is in ${path.relative(process.cwd(), target) || target}`);
console.log("  Reload the shop: it starts again as the demo store. Create the owner at /admin/setup.");
