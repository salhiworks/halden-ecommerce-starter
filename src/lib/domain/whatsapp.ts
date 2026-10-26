import { formatMoney, type MoneyFormat } from "./money";
import { normalizePhone } from "./phone";
import type { Order, PaymentMethod } from "./types";

/**
 * ===========================================================================
 *  WHATSAPP MESSAGES
 * ===========================================================================
 *
 *  Every WhatsApp text the storefront produces is composed here — no
 *  component assembles message strings itself. The words come from the
 *  store's language; the layout never changes, so a seller's inbox stays
 *  scannable: order number first, one line per item, totals, then delivery.
 *
 *  The order number is the bridge between a chat and the dashboard: the
 *  seller finds "#1042" in WhatsApp, then marks order #1042 as received.
 */

export type WhatsAppLabels = {
  orderIntro: (storeName: string) => string;
  order: string;
  subtotal: string;
  delivery: string;
  free: string;
  total: string;
  payment: string;
  paymentMethods: Record<PaymentMethod, string>;
  name: string;
  phone: string;
  address: string;
  note: string;
  inquiryIntro: (storeName: string) => string;
  link: string;
};

type OrderForMessage = Pick<
  Order,
  | "number"
  | "items"
  | "subtotal"
  | "shippingFee"
  | "total"
  | "shippingMethod"
  | "paymentMethod"
  | "customer"
  | "address"
  | "customerNote"
>;

export function buildOrderMessage(
  order: OrderForMessage,
  context: { storeName: string; money: MoneyFormat; labels: WhatsAppLabels },
): string {
  const { labels, money } = context;
  const price = (amount: number) => formatMoney(amount, money, "full");

  const items = order.items.map((item) => {
    const variant = item.variantLabel ? ` (${item.variantLabel})` : "";
    return `• ${item.quantity} × ${item.name}${variant} — ${price(item.lineTotal)}`;
  });

  const lines: string[] = [
    labels.orderIntro(context.storeName),
    "",
    `*${labels.order} #${order.number}*`,
    "",
    ...items,
    "",
    `${labels.subtotal}: ${price(order.subtotal)}`,
  ];

  if (order.shippingMethod) {
    const fee = order.shippingFee > 0 ? price(order.shippingFee) : labels.free;
    lines.push(`${labels.delivery} (${order.shippingMethod.name}): ${fee}`);
  }
  lines.push(`*${labels.total}: ${price(order.total)}*`, "");
  lines.push(`${labels.payment}: ${labels.paymentMethods[order.paymentMethod]}`);
  lines.push(`${labels.name}: ${order.customer.name}`);
  if (order.customer.phone) lines.push(`${labels.phone}: ${order.customer.phone}`);

  if (order.address) {
    const parts = [
      order.address.line1,
      order.address.city,
      order.address.region,
      order.address.postalCode,
      order.address.country,
    ].filter((part) => part.trim() !== "");
    if (parts.length > 0) lines.push(`${labels.address}: ${parts.join(", ")}`);
  }
  if (order.customerNote) lines.push(`${labels.note}: ${order.customerNote}`);

  return lines.join("\n");
}

export function buildInquiryMessage(
  product: { name: string; variantLabel: string; url: string },
  context: { storeName: string; labels: WhatsAppLabels },
): string {
  const variant = product.variantLabel ? ` (${product.variantLabel})` : "";
  return [
    context.labels.inquiryIntro(context.storeName),
    "",
    `*${product.name}*${variant}`,
    `${context.labels.link}: ${product.url}`,
  ].join("\n");
}

/**
 * The official click-to-chat link. `encodeURIComponent` is the right encoder
 * for a query value: it escapes the newlines, `&`, `#`, `*` and non-Latin
 * script the messages are full of.
 */
export function whatsappUrl(number: string, message: string): string {
  const digits = normalizePhone(number);
  const text = message.trim();
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
