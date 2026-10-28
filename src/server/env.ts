import "server-only";
import path from "node:path";

/**
 * ===========================================================================
 *  ENVIRONMENT
 * ===========================================================================
 *
 *  The store runs on one of two backends:
 *
 *    supabase  Postgres + Auth + Storage. The production setup: data and
 *              photos live in your Supabase project, so redeploying the site
 *              never touches them. Chosen automatically when SUPABASE_URL is
 *              set.
 *
 *    local     A JSON file and an uploads folder in `.data/`. Zero setup — it
 *              is what `npm run dev` uses out of the box, and what the
 *              automated tests run against. Fine for trying the platform and
 *              for demos; not meant for a public production store.
 *
 *  Every value is read on the server at request time. Nothing here is
 *  `NEXT_PUBLIC_`, so no key is ever compiled into browser JavaScript.
 */

export type BackendKind = "local" | "supabase";

export type SupabaseConfig = {
  url: string;
  /** Publishable (anon) key: storefront reads and the admin session. */
  publishableKey: string;
  /** Secret (service-role) key: placing orders. Server only, never sent out. */
  secretKey: string | null;
};

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function supabaseConfig(): SupabaseConfig | null {
  const url = read("SUPABASE_URL");
  const publishableKey = read("SUPABASE_PUBLISHABLE_KEY") ?? read("SUPABASE_ANON_KEY");
  if (!url || !publishableKey) return null;
  return {
    url: url.replace(/\/+$/, ""),
    publishableKey,
    secretKey: read("SUPABASE_SECRET_KEY") ?? read("SUPABASE_SERVICE_ROLE_KEY") ?? null,
  };
}

const SUPABASE_VARIABLES = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

export function backendKind(): BackendKind {
  const explicit = read("STORE_BACKEND");
  if (explicit === "local" || explicit === "supabase") return explicit;
  // Any Supabase setting means Supabase is intended: a missing piece is then
  // reported as a setup problem, never papered over with local files.
  return SUPABASE_VARIABLES.some((name) => read(name)) ? "supabase" : "local";
}

/**
 * Why the store can't start, or null. A production server with no database
 * configured would otherwise run on local files that the next deploy wipes.
 */
export function backendProblem(): string | null {
  if (isProduction() && backendKind() === "local" && read("STORE_BACKEND") !== "local") {
    return "No database is configured. Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY in the server's environment variables — or STORE_BACKEND=local to use the local file store on purpose.";
  }
  return null;
}

/** Where the local backend keeps its data file and uploads. */
export function localDataDir(): string {
  return path.resolve(read("STORE_DATA_DIR") ?? path.join(process.cwd(), ".data"));
}

/**
 * Local mode in production must be opted into deliberately: on most hosts a
 * redeploy replaces the app folder, and `.data/` with it.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Public demo mode — for a store anyone on the internet can try, like the
 * hosted Halden demo. When on:
 *   • visitors can open a read-only preview of the dashboard (no account);
 *   • orders placed in the shop are kept, encrypted, in the shopper's own
 *     browser for an hour so they see the whole flow, and are never saved
 *     or shown to anyone.
 * Never turn it on for a real store: its orders would not be saved.
 */
export function publicDemoMode(): boolean {
  return /^(1|true|yes|on)$/i.test(read("PUBLIC_DEMO_MODE") ?? "");
}

/** How long the storefront reuses a loaded catalog before asking again. */
export function catalogCacheSeconds(): number {
  const value = Number(read("CATALOG_CACHE_SECONDS") ?? 30);
  return Number.isFinite(value) && value >= 0 ? value : 30;
}

/**
 * A fixed signing secret (32+ characters), or null to use the built-in one:
 * derived from the Supabase secret key, or kept in the local store's folder.
 * Signs checkout form tokens and local dashboard sessions.
 */
export function sessionSecretSetting(): string | null {
  const value = read("SESSION_SECRET");
  return value && value.length >= 32 ? value : null;
}

/**
 * Token that unlocks the first-run owner sign-up of a local store. Required
 * in production. In development the setup screen is open unless a token is
 * set — set one if others share your network, since `next dev` listens on it.
 */
export function adminSetupToken(): string | null {
  return read("ADMIN_SETUP_TOKEN") ?? null;
}
