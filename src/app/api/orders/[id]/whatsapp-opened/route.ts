import { getBackend } from "@/server/backend";
import { sha256 } from "@/server/crypto";
import { rateLimit } from "@/server/rate-limit";
import { clientAddress } from "@/server/request";

/**
 * Called (via sendBeacon) when a shopper taps "Open WhatsApp". It moves the
 * order from "prepared" to "opened" — and never further: opening WhatsApp
 * does not prove a message was sent, so only the seller can mark an order as
 * received.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  if (!rateLimit(`opened:${await clientAddress()}`, 30, 10 * 60 * 1000).ok) {
    return new Response(null, { status: 429 });
  }

  let key: unknown;
  try {
    key = ((await request.json()) as { key?: unknown }).key;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{20,128}$/.test(key)) {
    return new Response(null, { status: 400 });
  }

  const found = await getBackend().public.markWhatsAppOpened(id, sha256(key));
  return new Response(null, { status: found ? 204 : 404 });
}
