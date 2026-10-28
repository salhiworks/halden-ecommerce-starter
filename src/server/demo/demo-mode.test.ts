import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoCatalog, demoSettings } from "@/lib/demo/seed";
import type { NewOrder } from "@/lib/domain/checkout";
import type { PublicApi } from "@/server/backend/types";

/**
 * Public demo mode: orders stay in the visitor's browser, and the dashboard preview can read
 * but never write. The server-only guard and Next's cookie store are stubbed.
 */

vi.mock("server-only", () => ({}));

const jar = new Map<string, string>();
const cookieOptions = new Map<string, Record<string, unknown>>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string, options: Record<string, unknown> = {}) => {
      jar.set(name, value);
      cookieOptions.set(name, options);
    },
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
  cookieOptions.clear();
});
afterEach(() => {
  delete process.env.PUBLIC_DEMO_MODE;
  vi.useRealTimers();
});

/** A fresh copy of the module, as a different serverless instance would load it. */
async function freshInstance() {
  vi.resetModules();
  const { withDemoOrders } = await import("./orders");
  return withDemoOrders(shop);
}

describe("orders in public demo mode", () => {
  it("are kept in the visitor's browser and never reach the database", async () => {
    const { withDemoOrders } = await import("./orders");
    const api = withDemoOrders(shop);
    const { id, number } = await api.createOrder(newOrder, "hash-1");
    expect(shop.createOrder).not.toHaveBeenCalled();
    expect(number).toBeGreaterThanOrEqual(100_000);

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

  it("open on any server instance, on every reload and under concurrent requests", async () => {
    const { id } = await (await freshInstance()).createOrder(newOrder, "hash-1");
    const other = await freshInstance();
    const reads = await Promise.all(Array.from({ length: 20 }, () => other.findCustomerOrder(id, "hash-1")));
    expect(reads.every((order) => order?.id === id)).toBe(true);
    expect((await (await freshInstance()).findCustomerOrder(id, "hash-1"))?.customer.name).toBe("Visitor");
  });

  it("keep the receipt in an HttpOnly cookie for that order's page only, unreadable and for an hour", async () => {
    const api = await freshInstance();
    const { id } = await api.createOrder({ ...newOrder, customer: { name: "Private Person", phone: "+15550101", email: "" } }, "hash-1");
    const name = `demo-order-${id}`;
    expect(cookieOptions.get(name)).toMatchObject({ httpOnly: true, sameSite: "lax", path: `/orders/${id}`, maxAge: 3600 });
    const value = jar.get(name)!;
    expect(value).not.toMatch(/Private|Person|15550101|hash-1/);
    expect(Buffer.from(value, "base64url").toString("latin1")).not.toMatch(/Private|15550101/);
  });

  it("give each visitor their own order and number", async () => {
    const api = await freshInstance();
    const first = await api.createOrder(newOrder, "hash-a");
    const firstCookie = jar.get(`demo-order-${first.id}`)!;
    jar.clear(); // a second visitor's browser
    const second = await api.createOrder({ ...newOrder, customer: { name: "Other", phone: "", email: "" } }, "hash-b");
    expect(second.id).not.toBe(first.id);
    expect(second.number).not.toBe(first.number);

    // Without the first visitor's browser, their link opens nothing.
    expect(await api.findCustomerOrder(first.id, "hash-a")).toBeNull();
    expect((await api.findCustomerOrder(second.id, "hash-b"))?.customer.name).toBe("Other");
    // Their receipt can't be passed off as another order, or opened with another link.
    jar.set(`demo-order-${second.id}`, firstCookie);
    expect(await api.findCustomerOrder(second.id, "hash-a")).toBeNull();
    jar.set(`demo-order-${first.id}`, firstCookie);
    expect(await api.findCustomerOrder(first.id, "hash-b")).toBeNull();
    expect((await api.findCustomerOrder(first.id, "hash-a"))?.id).toBe(first.id);
  });

  it("refuse expired, altered or missing receipts", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-28T12:00:00Z"), toFake: ["Date"] });
    const api = await freshInstance();
    const { id } = await api.createOrder(newOrder, "hash-1");
    const name = `demo-order-${id}`;
    const value = jar.get(name)!;

    vi.setSystemTime(new Date("2026-10-28T12:59:00Z"));
    expect(await api.findCustomerOrder(id, "hash-1")).not.toBeNull();
    vi.setSystemTime(new Date("2026-10-28T13:00:01Z"));
    expect(await api.findCustomerOrder(id, "hash-1")).toBeNull();
    vi.setSystemTime(new Date("2026-10-28T12:30:00Z"));

    const flipped = Buffer.from(value, "base64url");
    flipped[flipped.length - 1] ^= 1;
    jar.set(name, flipped.toString("base64url"));
    expect(await api.findCustomerOrder(id, "hash-1")).toBeNull();
    jar.set(name, "not-a-receipt");
    expect(await api.findCustomerOrder(id, "hash-1")).toBeNull();
    jar.delete(name);
    expect(await api.findCustomerOrder(id, "hash-1")).toBeNull();

    // Signed with another store's secret.
    jar.set(name, value);
    process.env.SESSION_SECRET = "y".repeat(40);
    expect(await (await freshInstance()).findCustomerOrder(id, "hash-1")).toBeNull();
  });

  it("record Open WhatsApp only for the visitor's own link", async () => {
    const api = await freshInstance();
    const { id } = await api.createOrder(newOrder, "hash-1");
    expect(await api.markWhatsAppOpened(id, "hash-wrong")).toBe(true);
    expect((await api.findCustomerOrder(id, "hash-1"))?.status).toBe("prepared");
    await api.markWhatsAppOpened(id, "hash-1");
    expect(cookieOptions.get(`demo-order-opened-${id}`)).toMatchObject({ httpOnly: true, path: `/orders/${id}` });
    expect((await (await freshInstance()).findCustomerOrder(id, "hash-1"))?.status).toBe("opened");
  });

  it("fit the largest bag checkout accepts into one cookie", async () => {
    const items = Array.from({ length: 50 }, (_, index) => ({
      ...newOrder.items[0],
      productId: crypto.randomUUID(),
      variantId: crypto.randomUUID(),
      sku: `SKU-${index}-${crypto.randomUUID()}`,
      name: `Product with a fairly long descriptive name ${index}`,
      variantLabel: "Large / Forest green",
      imageUrl: `https://example.supabase.co/storage/v1/object/public/media/${crypto.randomUUID()}.jpg`,
    }));
    const api = await freshInstance();
    const { id } = await api.createOrder({ ...newOrder, items, customerNote: "n".repeat(500) }, "hash-1");
    expect(jar.get(`demo-order-${id}`)!.length).toBeLessThanOrEqual(3800);
    const order = await api.findCustomerOrder(id, "hash-1");
    expect(order?.items).toHaveLength(50);
    expect(order?.items[49].name).toBe("Product with a fairly long descriptive name 49");
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
