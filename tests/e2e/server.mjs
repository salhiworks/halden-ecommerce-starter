/**
 * Starts the production build for the end-to-end tests. Run `npm run build`
 * first — `npm run test:e2e` does both.
 *
 *   node tests/e2e/server.mjs                  the store, on a brand-new local
 *                                              data folder (the demo store)
 *   node tests/e2e/server.mjs --public-demo    the same in public demo mode
 *
 * With E2E_BACKEND=supabase it uses the Supabase project from the
 * environment or .env.local instead of a local folder — that is how the
 * suite is run against a real project.
 */

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../../scripts/lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const port = process.env.E2E_PORT ?? "3311";
const supabase = process.env.E2E_BACKEND === "supabase";

if (!existsSync(path.join(root, ".next", "BUILD_ID"))) {
  console.error("No production build found. Run `npm run build` first (npm run test:e2e does).");
  process.exit(1);
}

let dataDir = null;
let env;
if (supabase) {
  loadEnv();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    console.error("E2E_BACKEND=supabase needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY.");
    process.exit(1);
  }
  env = { ...process.env, NODE_ENV: "production", STORE_BACKEND: "supabase", CATALOG_CACHE_SECONDS: "0" };
} else {
  dataDir = mkdtempSync(path.join(os.tmpdir(), "storefront-e2e-"));
  env = {
    ...process.env,
    NODE_ENV: "production",
    STORE_BACKEND: "local",
    STORE_DATA_DIR: dataDir,
    ADMIN_SETUP_TOKEN: process.env.E2E_SETUP_TOKEN ?? "e2e-setup-token",
    SESSION_SECRET: randomBytes(32).toString("base64url"),
    CATALOG_CACHE_SECONDS: "0",
    // Make sure nothing in a developer's .env.local points the tests at a real project.
    SUPABASE_URL: "",
    SUPABASE_PUBLISHABLE_KEY: "",
    SUPABASE_ANON_KEY: "",
    SUPABASE_SECRET_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
  };
}
env.PUBLIC_DEMO_MODE = process.argv.includes("--public-demo") ? "true" : "";

const next = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", port], {
  cwd: root,
  env,
  stdio: "inherit",
});

const stop = () => next.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
next.on("exit", (code) => {
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
