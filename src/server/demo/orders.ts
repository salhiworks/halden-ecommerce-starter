import "server-only";
import { randomUUID } from "node:crypto";
import type { Order } from "@/lib/domain/types";
import type { PublicApi } from "@/server/backend/types";
import { safeEqual } from "@/server/crypto";

/**
 * Orders in public demo mode. A visitor goes through the real checkout and
 * sees a real confirmation page, but the order lives only in this server's
 * memory, for an hour, reachable only through the private link given to
 * that visitor. It is never written to the database, never appears in the
 * dashboard, and nothing is sent to anyone.
 */

const TTL_MS = 60 * 60 * 1000;
const MAX_ORDERS = 500;

type Entry = { order: Order; accessTokenHash: string; expires: number };
type Store = { orders: Map<string, Entry>; next: number };

const globalKey = Symbol.for("storefront.demoOrders");
const store: Store = ((globalThis as Record<symbol, unknown>)[globalKey] as Store) ?? { orders: new Map(), next: 1001 };
(globalThis as Record<symbol, unknown>)[globalKey] = store;

function prune(now: number) {
  for (const [id, entry] of store.orders) if (entry.expires <= now) store.orders.delete(id);
  // Oldest first: a Map keeps insertion order.
  for (const id of store.orders.keys()) {
    if (store.orders.size <= MAX_ORDERS) break;
    store.orders.delete(id);
  }
}

function find(id: string, accessTokenHash: string): Entry | null {
  prune(Date.now());
  const entry = store.orders.get(id);
  return entry && safeEqual(entry.accessTokenHash, accessTokenHash) ? entry : null;
}

export function withDemoOrders(api: PublicApi): PublicApi {
  return {
    ...api,

    async createOrder(order, accessTokenHash) {
      const now = Date.now();
      prune(now);
      const stamp = new Date(now).toISOString();
      const id = randomUUID();
      const number = store.next;
      store.next = store.next >= 9999 ? 1001 : store.next + 1;
      store.orders.set(id, {
        order: {
          ...order,
          id,
          number,
          events: [
            ...order.events,
            { at: stamp, kind: "note", note: "Public demo: not saved, deleted within an hour.", by: "system" },
          ],
          createdAt: stamp,
          updatedAt: stamp,
        },
        accessTokenHash,
        expires: now + TTL_MS,
      });
      return { id, number };
    },

    async findCustomerOrder(id, accessTokenHash) {
      return find(id, accessTokenHash)?.order ?? null;
    },

    async markWhatsAppOpened(id, accessTokenHash) {
      const entry = find(id, accessTokenHash);
      if (!entry) return false;
      if (entry.order.status === "prepared") {
        const stamp = new Date().toISOString();
        entry.order = {
          ...entry.order,
          status: "opened",
          updatedAt: stamp,
          events: [...entry.order.events, { at: stamp, kind: "status", from: "prepared", to: "opened", by: "customer" }],
        };
      }
      return true;
    },
  };
}
