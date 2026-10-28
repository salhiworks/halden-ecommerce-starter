import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { cookies } from "next/headers";
import type { Order } from "@/lib/domain/types";
import type { PublicApi } from "@/server/backend/types";
import { safeEqual, sign } from "@/server/crypto";
import { isProduction } from "@/server/env";
import { appSecret } from "@/server/secret";

/**
 * Orders in public demo mode. A visitor goes through the real checkout and
 * sees a real confirmation page, but the order is never written to the
 * database, never appears in the dashboard, and nothing is sent to anyone.
 *
 * The order travels as an encrypted receipt in the visitor's own browser: an
 * HttpOnly cookie scoped to that order's page, expiring after an hour. Every
 * server instance can open it, so reloads work on serverless hosts where
 * instances share no memory. Opening it still takes the order's private link.
 */

const TTL_MS = 60 * 60 * 1000;
/** Browsers drop cookies over 4096 bytes, name and attributes included. */
const MAX_COOKIE_VALUE = 3800;

type Receipt = { order: Order; accessTokenHash: string; expires: number };

const receiptCookie = (id: string) => `demo-order-${id}`;
const openedCookie = (id: string) => `demo-order-opened-${id}`;
const orderPath = (id: string) => `/orders/${id}`;

async function key(): Promise<Buffer> {
  return createHash("sha256").update(`storefront-demo-orders:${await appSecret()}`).digest();
}

async function seal(receipt: Receipt): Promise<string> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", await key(), iv);
  cipher.setAAD(Buffer.from(receipt.order.id));
  const body = Buffer.concat([cipher.update(deflateRawSync(JSON.stringify(receipt))), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

async function open(id: string, value: string): Promise<Receipt | null> {
  try {
    const raw = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", await key(), raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(id));
    decipher.setAuthTag(raw.subarray(12, 28));
    const json = inflateRawSync(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]));
    const receipt = JSON.parse(json.toString("utf8")) as Receipt;
    return receipt.order.id === id ? receipt : null;
  } catch {
    return null;
  }
}

/** Fields the confirmation page never shows, dropped only when a large bag would not fit. */
function compact(order: Order): Order {
  return { ...order, items: order.items.map((item) => ({ ...item, productId: "", variantId: "", sku: "", imageUrl: null })) };
}

async function find(id: string, accessTokenHash: string): Promise<Receipt | null> {
  const jar = await cookies();
  const value = jar.get(receiptCookie(id))?.value;
  const receipt = value ? await open(id, value) : null;
  if (!receipt || receipt.expires <= Date.now() || !safeEqual(receipt.accessTokenHash, accessTokenHash)) return null;

  // "Open WhatsApp" is recorded on another path, as a signed flag beside the receipt.
  const opened = jar.get(openedCookie(id))?.value;
  if (receipt.order.status === "prepared" && opened && safeEqual(opened, sign(`opened:${id}:${accessTokenHash}`, await appSecret()))) {
    const stamp = receipt.order.updatedAt;
    receipt.order = {
      ...receipt.order,
      status: "opened",
      events: [...receipt.order.events, { at: stamp, kind: "status", from: "prepared", to: "opened", by: "customer" }],
    };
  }
  return receipt;
}

export function withDemoOrders(api: PublicApi): PublicApi {
  return {
    ...api,

    async createOrder(order, accessTokenHash) {
      const now = Date.now();
      const stamp = new Date(now).toISOString();
      const id = randomUUID();
      // Random rather than counted: instances share no counter, and visitors shouldn't share numbers.
      const number = randomInt(100_000, 1_000_000);
      const full: Order = {
        ...order,
        id,
        number,
        events: [
          ...order.events,
          { at: stamp, kind: "note", note: "Public demo: not saved, deleted within an hour.", by: "system" },
        ],
        createdAt: stamp,
        updatedAt: stamp,
      };
      const receipt: Receipt = { order: full, accessTokenHash, expires: now + TTL_MS };
      let value = await seal(receipt);
      if (value.length > MAX_COOKIE_VALUE) value = await seal({ ...receipt, order: compact(full) });
      if (value.length > MAX_COOKIE_VALUE) throw new Error("Demo order is too large to keep in the browser.");

      (await cookies()).set(receiptCookie(id), value, {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction(),
        path: orderPath(id),
        maxAge: TTL_MS / 1000,
      });
      return { id, number };
    },

    async findCustomerOrder(id, accessTokenHash) {
      return (await find(id, accessTokenHash))?.order ?? null;
    },

    async markWhatsAppOpened(id, accessTokenHash) {
      // The receipt cookie isn't sent to this API path; the page applies the flag when it opens the receipt.
      (await cookies()).set(openedCookie(id), sign(`opened:${id}:${accessTokenHash}`, await appSecret()), {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction(),
        path: orderPath(id),
        maxAge: TTL_MS / 1000,
      });
      return true;
    },
  };
}
