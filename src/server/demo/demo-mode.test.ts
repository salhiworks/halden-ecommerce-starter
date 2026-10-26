import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoCatalog, demoSettings } from "@/lib/demo/seed";
import type { NewOrder } from "@/lib/domain/checkout";
import type { PublicApi } from "@/server/backend/types";

/**
 * Public demo mode: orders stay in memory, and the dashboard preview can read
 * but never write. The server-only guard and Next's cookie store are stubbed.
 */

vi.mock("server-only", () => ({}));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

const shop: PublicApi = {
  loadSettings: vi.fn(async () => demoSettings()),
  loadCatalog: vi.fn(async () => demoCatalog()),
  createOrder: vi.fn(async () => ({ id: "real", number: 1 })),
  findCustomerOrder: vi.fn(async () => null),
  markWhatsAppOpened: vi.fn(async () => false),
};
vi.mock("@/server/backend", () => ({ getBackend: () => ({ public: shop }) }));

const newOrder: NewOrder = {
  channel: "whatsapp",
  status: "prepared",
  paymentMethod: "whatsapp",
  paymentStatus: "unpaid",
  currency: "USD",
  items: [{ productId: "p", variantId: "v", name: "Mug", variantLabel: "", sku: "", imageUrl: null, unitPrice: 10, quantity: 1, lineTotal: 10 }],
  subtotal: 10,
  shippingFee: 0,
  total: 10,
  shippingMethod: null,
  customer: { name: "Visitor", phone: "", email: "" },
  address: null,
  customerNote: "",
  internalNote: "",
  stockReserved: false,
  events: [],
};

beforeEach(() => {
  process.env.PUBLIC_DEMO_MODE = "true";
  process.env.SESSION_SECRET = "x".repeat(40);
  jar.clear();
});
afterEach(() => {
  delete process.env.PUBLIC_DEMO_MODE;
});

describe("orders in public demo mode", () => {
  it("are kept in memory and never reach the database", async () => {
    const { withDemoOrders } = await import("./orders");
    const api = withDemoOrders(shop);
    const { id, number } = await api.createOrder(newOrder, "hash-1");
    expect(shop.createOrder).not.toHaveBeenCalled();
    expect(number).toBeGreaterThanOrEqual(1001);

    expect(await api.findCustomerOrder(id, "wrong")).toBeNull();
    const order = await api.findCustomerOrder(id, "hash-1");
    expect(order?.customer.name).toBe("Visitor");
    expect(order?.events.at(-1)?.note).toMatch(/not saved/);

    expect(await api.markWhatsAppOpened(id, "hash-1")).toBe(true);
    expect((await api.findCustomerOrder(id, "hash-1"))?.status).toBe("opened");
    expect(shop.markWhatsAppOpened).not.toHaveBeenCalled();
  });

  it("still read the catalog from the real store", async () => {
    const { withDemoOrders } = await import("./orders");
    await withDemoOrders(shop).loadCatalog();
    expect(shop.loadCatalog).toHaveBeenCalled();
  });
});

describe("the dashboard preview", () => {
  it("opens only in public demo mode, with a signed cookie", async () => {
    const { isPreviewSession, startPreview } = await import("./preview");
    expect(await isPreviewSession()).toBe(false);
    expect(await startPreview()).toBe(true);
    expect(await isPreviewSession()).toBe(true);

    // A forged or altered cookie is not a session.
    const [name, value] = [...jar.entries()][0];
    jar.set(name, value.replace(/^preview\.\d+/, `preview.${Math.floor(Date.now() / 1000) + 99_999}`));
    expect(await isPreviewSession()).toBe(false);

    delete process.env.PUBLIC_DEMO_MODE;
    expect(await startPreview()).toBe(false);
  });

  it("reads like the shop and refuses every change", async () => {
    const { previewAdminApi, ReadOnlyPreviewError } = await import("./preview");
    const admin = previewAdminApi();
    expect(admin.preview).toBe(true);
    expect((await admin.loadCatalog()).products.length).toBeGreaterThan(0);

    const { orders, total } = await admin.listOrders({ limit: 50, offset: 0 });
    expect(total).toBeGreaterThan(0);
    expect(orders.every((order) => order.customer.email.endsWith("@example.com"))).toBe(true);

    const writes = [
      () => admin.saveSettings(demoSettings()),
      () => admin.deleteProduct("x"),
      () => admin.writeGrouping("category", { name: "X", slug: "x", description: "", imageUrl: "", visible: true }),
      () => admin.transitionOrder({ id: orders[0].id, from: orders[0].status, to: "cancelled", stockDelta: 0, note: "" }),
      () => admin.uploadMedia({ bytes: new Uint8Array(), contentType: "image/png", extension: "png" }),
      () => admin.removeDemoContent(),
      () => admin.changePassword("a", "b"),
    ];
    for (const write of writes) await expect(write()).rejects.toBeInstanceOf(ReadOnlyPreviewError);
  });
});
