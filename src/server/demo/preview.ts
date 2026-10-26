import "server-only";
import { cookies } from "next/headers";
import { sampleOrders } from "@/lib/demo/sample-orders";
import { ORDER_STATUSES } from "@/lib/domain/orders";
import type { Order, OrderStatus } from "@/lib/domain/types";
import { getBackend } from "@/server/backend";
import type { AdminApi, AdminUser } from "@/server/backend/types";
import { safeEqual, sign } from "@/server/crypto";
import { isProduction, publicDemoMode } from "@/server/env";
import { appSecret } from "@/server/secret";

/**
 * ===========================================================================
 *  DASHBOARD PREVIEW (public demo mode only)
 * ===========================================================================
 *
 *  Lets a visitor look around the dashboard of a public demo without an
 *  account. It is read-only by construction rather than by checks: the
 *  preview's AdminApi reads the catalog and settings the way the shop does
 *  (with the public key, so no more than any shopper can see), shows sample
 *  orders built for the preview instead of real ones, and every method that
 *  would change something throws. No Supabase session, no secret key and no
 *  real order is ever involved.
 */

const COOKIE = "store_preview";
const HOURS = 2;

export class ReadOnlyPreviewError extends Error {
  constructor() {
    super("This is a read-only preview of the dashboard — changes aren't saved.");
    this.name = "ReadOnlyPreviewError";
  }
}

export const PREVIEW_USER: AdminUser = { id: "preview", email: "Guest preview" };

export async function startPreview(): Promise<boolean> {
  if (!publicDemoMode()) return false;
  const body = `preview.${Math.floor(Date.now() / 1000) + HOURS * 3600}`;
  (await cookies()).set(COOKIE, `${body}.${sign(body, await appSecret())}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: HOURS * 3600,
  });
  return true;
}

export async function endPreview(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function isPreviewSession(): Promise<boolean> {
  if (!publicDemoMode()) return false;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const cut = raw.lastIndexOf(".");
  const body = raw.slice(0, cut);
  const signature = raw.slice(cut + 1);
  if (!body.startsWith("preview.") || !safeEqual(sign(body, await appSecret()), signature)) return false;
  return Number(body.slice("preview.".length)) * 1000 > Date.now();
}

const denied = async (): Promise<never> => {
  throw new ReadOnlyPreviewError();
};

export function previewAdminApi(): AdminApi {
  const shop = getBackend().public;
  const orders = async (): Promise<Order[]> => {
    const [catalog, settings] = await Promise.all([shop.loadCatalog(), shop.loadSettings()]);
    return sampleOrders(catalog, settings, new Date());
  };

  return {
    user: PREVIEW_USER,
    preview: true,

    loadSettings: () => shop.loadSettings(),
    loadCatalog: () => shop.loadCatalog(),

    async listOrders({ statuses, search, limit, offset }) {
      const term = search?.trim().toLowerCase().replace(/^#/, "") ?? "";
      const matches = (await orders())
        .filter((order) => !statuses || statuses.includes(order.status))
        .filter(
          (order) =>
            !term ||
            String(order.number) === term ||
            order.customer.name.toLowerCase().includes(term) ||
            order.customer.email.toLowerCase().includes(term),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { orders: matches.slice(offset, offset + limit), total: matches.length };
    },
    async ordersSince(isoDate) {
      return (await orders()).filter((order) => order.createdAt >= isoDate);
    },
    async orderStatusCounts() {
      const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<OrderStatus, number>;
      for (const order of await orders()) counts[order.status] += 1;
      return counts;
    },
    async getOrder(id) {
      return (await orders()).find((order) => order.id === id) ?? null;
    },

    saveSettings: denied,
    writeProduct: denied,
    deleteProduct: denied,
    writeGrouping: denied,
    deleteGrouping: denied,
    reorderGroupings: denied,
    setCollectionProducts: denied,
    transitionOrder: denied,
    updateOrder: denied,
    deleteOrder: denied,
    uploadMedia: denied,
    deleteMedia: denied,
    importCatalog: denied,
    removeDemoContent: denied,
    changePassword: denied,
  };
}
