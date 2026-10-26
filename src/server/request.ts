import "server-only";
import { headers } from "next/headers";
import type { StoreSettings } from "@/lib/domain/settings";

/**
 * The address the store is being visited at. Used for absolute links: share
 * cards, the sitemap, and product links inside WhatsApp messages. An owner
 * can pin a canonical address in Settings; otherwise the request's own host
 * is used, which is right on localhost, a temporary Hostinger domain and the
 * final domain alike.
 */
export async function siteOrigin(settings: StoreSettings): Promise<string> {
  if (settings.store.siteUrl) return settings.store.siteUrl.replace(/\/+$/, "");
  const list = await headers();
  const host = list.get("x-forwarded-host")?.split(",")[0]?.trim() || list.get("host") || "localhost:3000";
  const forwarded = list.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwarded || (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https");
  return `${protocol}://${host}`;
}

/** Best-effort client address for rate limiting. Never stored. */
export async function clientAddress(): Promise<string> {
  const list = await headers();
  return (
    list.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    list.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
