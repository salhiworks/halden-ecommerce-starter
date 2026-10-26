import { quoteCart, type CartLine } from "@/lib/domain/cart";
import { buildOrder, type CheckoutInput } from "@/lib/domain/checkout";
import { storefrontProducts } from "@/lib/domain/catalog-query";
import { defaultVariant } from "@/lib/domain/product";
import { isWhatsAppConfigured, type StoreSettings } from "@/lib/domain/settings";
import type { CatalogData, Order, OrderEvent, OrderStatus, PaymentStatus } from "@/lib/domain/types";

/**
 * Sample orders for the read-only dashboard preview of a public demo, so a
 * visitor can see how orders are handled without seeing anyone's real order.
 *
 * Built with the store's own checkout code from its current catalog, so
 * prices and totals are always consistent. The people are fictional, their
 * phone numbers are in a range reserved for fiction, and these orders exist
 * only in the preview: they are never saved and never shown to the owner.
 */

type Spec = {
  daysAgo: number;
  method: CheckoutInput["method"];
  shipping: "first" | "pickup";
  picks: [index: number, quantity: number][];
  /** Statuses the order went through after it was created, in order. */
  path: OrderStatus[];
  payment?: PaymentStatus;
  name: string;
};

const SPECS: Spec[] = [
  { daysAgo: 0.1, method: "cod", shipping: "first", picks: [[0, 1], [5, 2]], path: [], name: "Alex Sample" },
  { daysAgo: 0.4, method: "whatsapp", shipping: "first", picks: [[3, 1]], path: ["opened"], name: "Sam Example" },
  { daysAgo: 0.9, method: "whatsapp", shipping: "pickup", picks: [[8, 1]], path: [], name: "Riley Placeholder" },
  { daysAgo: 2, method: "bank_transfer", shipping: "first", picks: [[1, 1]], path: ["confirmed"], payment: "paid", name: "Jordan Demo" },
  { daysAgo: 4, method: "cod", shipping: "first", picks: [[6, 1], [2, 1]], path: ["confirmed", "fulfilled"], name: "Casey Fiction" },
  { daysAgo: 7, method: "whatsapp", shipping: "first", picks: [[4, 2]], path: ["opened", "received", "confirmed", "fulfilled", "completed"], payment: "paid", name: "Morgan Sample" },
  { daysAgo: 11, method: "cod", shipping: "first", picks: [[7, 1]], path: ["confirmed", "fulfilled", "completed"], payment: "paid", name: "Taylor Example" },
  { daysAgo: 16, method: "bank_transfer", shipping: "first", picks: [[9, 1]], path: ["cancelled"], name: "Jamie Placeholder" },
  { daysAgo: 23, method: "cod", shipping: "pickup", picks: [[10, 1], [11, 1]], path: ["confirmed", "fulfilled", "completed"], payment: "paid", name: "Drew Demo" },
];

const OWNER = "Store owner";

export function sampleOrders(catalog: CatalogData, settings: StoreSettings, now: Date): Order[] {
  const products = storefrontProducts(catalog).filter((product) => defaultVariant(product));
  if (products.length === 0) return [];
  const methods = settings.shipping.methods;
  const pickup = methods.find((method) => !method.requiresAddress);

  return SPECS.map((spec, index) => {
    const created = new Date(now.getTime() - spec.daysAgo * 86_400_000);
    const lines: CartLine[] = spec.picks.map(([pick, quantity]) => {
      const product = products[pick % products.length];
      return { productId: product.id, variantId: defaultVariant(product)!.id, quantity };
    });
    const shipping = spec.shipping === "pickup" && pickup ? pickup : methods[0];
    const quote = quoteCart(lines, catalog.products, settings, shipping?.id ?? null);
    const phone = `+44 7700 900${String(101 + index).padStart(3, "0")}`;
    const input: CheckoutInput = {
      method: spec.method,
      shippingMethodId: shipping?.id ?? "",
      name: spec.name,
      phone,
      email: `${spec.name.split(" ")[0].toLowerCase()}@example.com`,
      line1: `${10 + index} Example Street`,
      city: "Sampletown",
      region: "",
      postalCode: "",
      country: "",
      note: "",
      lines,
    };
    const order = buildOrder(input, quote, settings, created, { whatsappConfigured: isWhatsAppConfigured(settings) });

    // Walk the order through its statuses, an hour apart; paid on confirmation.
    let status = order.status;
    const events: OrderEvent[] = [...order.events];
    spec.path.forEach((next, step) => {
      const at = new Date(created.getTime() + (step + 1) * 3_600_000).toISOString();
      events.push({ at, kind: "status", from: status, to: next, by: next === "opened" ? "customer" : OWNER });
      status = next;
      if (next === "confirmed" && spec.payment === "paid") events.push({ at, kind: "payment", to: "paid", by: OWNER });
    });
    const paymentStatus: PaymentStatus = spec.payment ?? "unpaid";

    const updatedAt = events[events.length - 1]?.at ?? created.toISOString();
    return {
      ...order,
      id: `00000000-0000-4000-a000-${String(index + 1).padStart(12, "0")}`,
      number: 1001 + (SPECS.length - 1 - index),
      status,
      paymentStatus,
      stockReserved: ["confirmed", "fulfilled", "completed"].includes(status),
      events,
      internalNote: "Sample order for the dashboard preview.",
      createdAt: created.toISOString(),
      updatedAt,
    };
  });
}
