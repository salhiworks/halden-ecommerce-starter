import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { SupabaseConfig } from "@/server/env";

/**
 * The three ways the server talks to Supabase. None of them ever reaches the
 * browser — there is no Supabase client in client-side code at all.
 *
 *   anon     publishable key, no session: storefront reads. Row-level
 *            security limits it to published products and visible groupings.
 *   session  publishable key + the admin's auth cookies: every dashboard
 *            action runs as that user, so the database checks is_admin()
 *            itself on every row.
 *   service  secret key, bypasses RLS: only for writing a validated order and
 *            reading a shopper's own order back by its secret link.
 */

// Next.js may cache `fetch`; store data must always be live.
const noStore: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

const shared = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: noStore },
} as const;

type Clients = { anon?: SupabaseClient; service?: SupabaseClient; key?: string };
const globalKey = Symbol.for("storefront.supabaseClients");
const cache: Clients = ((globalThis as Record<symbol, unknown>)[globalKey] as Clients) ?? {};
(globalThis as Record<symbol, unknown>)[globalKey] = cache;

function resetIfConfigChanged(config: SupabaseConfig) {
  const key = `${config.url}|${config.publishableKey}|${config.secretKey ?? ""}`;
  if (cache.key !== key) {
    cache.anon = undefined;
    cache.service = undefined;
    cache.key = key;
  }
}

export function anonClient(config: SupabaseConfig): SupabaseClient {
  resetIfConfigChanged(config);
  cache.anon ??= createClient(config.url, config.publishableKey, shared);
  return cache.anon;
}

export function serviceClient(config: SupabaseConfig): SupabaseClient {
  if (!config.secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set. The website needs it (server-side only) to save orders.",
    );
  }
  resetIfConfigChanged(config);
  cache.service ??= createClient(config.url, config.secretKey, shared);
  return cache.service;
}

/**
 * A client bound to this request's auth cookies. Server Components cannot
 * write cookies, so refreshed tokens are persisted by `src/proxy.ts`, which
 * runs before every dashboard request.
 */
export async function sessionClient(config: SupabaseConfig): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    global: { fetch: noStore },
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy refreshes the session.
        }
      },
    },
  });
}

/**
 * A throwaway client for checking a password without touching the current
 * browser session (used by "change password").
 */
export function isolatedClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.publishableKey, shared);
}
