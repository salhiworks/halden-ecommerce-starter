import { sumMoney } from "./money";
import type { Order, OrderStatus, PaymentMethod, PaymentStatus } from "./types";

/**
 * ===========================================================================
 *  ORDER LIFECYCLE
 * ===========================================================================
 *
 *  The rules for moving an order along, in one place, shared by the dashboard
 *  (which buttons to show) and both backends (what to allow and when to touch
 *  stock). See `OrderStatus` in ./types for what each state means.
 *
 *  Stock is taken when the seller *confirms* an order and put back if a
 *  confirmed order is cancelled. A submitted website order or an unverified
 *  WhatsApp handoff never moves stock: neither is a commitment yet.
 */

export const ORDER_STATUSES: OrderStatus[] = [
  "prepared",
  "opened",
  "received",
  "confirmed",
  "fulfilled",
  "completed",
  "cancelled",
  "discarded",
];

export type StatusMeta = {
  label: string;
  /** One line for the dashboard explaining what this state proves. */
  description: string;
  tone: "neutral" | "info" | "warning" | "success" | "danger" | "muted";
};

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  prepared: {
    label: "WhatsApp: message prepared",
    description:
      "The shopper was shown the order message. They have not opened WhatsApp, and nothing has been sent.",
    tone: "muted",
  },
  opened: {
    label: "WhatsApp: opened, unverified",
    description:
      "The shopper tapped through to WhatsApp. That does not prove the message was sent — check your chats for this order number.",
    tone: "warning",
  },
  received: {
    label: "Received",
    description: "You have this order request. Confirm it with the customer to reserve stock.",
    tone: "info",
  },
  confirmed: {
    label: "Confirmed",
    description: "Agreed with the customer. Stock has been reserved.",
    tone: "success",
  },
  fulfilled: {
    label: "Fulfilled",
    description: "Shipped, delivered or collected.",
    tone: "success",
  },
  completed: {
    label: "Completed",
    description: "Closed — nothing left to do.",
    tone: "neutral",
  },
  cancelled: {
    label: "Cancelled",
    description: "This order will not go ahead. Any reserved stock was returned.",
    tone: "danger",
  },
  discarded: {
    label: "Discarded handoff",
    description: "A WhatsApp handoff that never turned into a message.",
    tone: "muted",
  },
};

/** Moves the seller may make from each state, in the order buttons appear. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  prepared: ["received", "discarded"],
  opened: ["received", "discarded"],
  received: ["confirmed", "cancelled"],
  confirmed: ["fulfilled", "cancelled"],
  fulfilled: ["completed"],
  completed: [],
  cancelled: ["received"],
  discarded: ["received"],
};

export const TRANSITION_LABELS: Partial<Record<OrderStatus, string>> = {
  received: "Mark as received",
  confirmed: "Confirm order",
  fulfilled: "Mark as fulfilled",
  completed: "Mark as completed",
  cancelled: "Cancel order",
  discarded: "Discard handoff",
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/**
 * What a transition does to stock: +1 reserve (take units out), -1 release
 * (put them back), 0 nothing.
 */
export function stockEffect(
  order: Pick<Order, "stockReserved">,
  to: OrderStatus,
): -1 | 0 | 1 {
  if (to === "confirmed" && !order.stockReserved) return 1;
  if ((to === "cancelled" || to === "discarded") && order.stockReserved) return -1;
  return 0;
}

/** Statuses that represent an actual sale. Nothing else counts as revenue. */
export const SALE_STATUSES: OrderStatus[] = ["confirmed", "fulfilled", "completed"];

export function isSale(status: OrderStatus): boolean {
  return SALE_STATUSES.includes(status);
}

export function isWhatsAppHandoff(order: Pick<Order, "status">): boolean {
  return order.status === "prepared" || order.status === "opened";
}

/** Handoffs older than this are almost certainly abandoned. */
export const HANDOFF_STALE_DAYS = 7;

export function isStaleHandoff(order: Pick<Order, "status" | "createdAt">, now: Date): boolean {
  if (!isWhatsAppHandoff(order)) return false;
  const age = now.getTime() - new Date(order.createdAt).getTime();
  return age > HANDOFF_STALE_DAYS * 24 * 60 * 60 * 1000;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on delivery",
  bank_transfer: "Bank transfer",
  whatsapp: "Arranged on WhatsApp",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  refunded: "Refunded",
};

/* ----------------------------------------------------------------- metrics */

export type OrderMetrics = {
  /** Sum of order totals in a sale status, created in the window. */
  salesTotal: number;
  salesCount: number;
  /** Of those, how much has been marked paid. */
  paidTotal: number;
  /** Website orders and verified WhatsApp orders waiting for confirmation. */
  toConfirm: number;
  /** Confirmed orders not yet shipped or handed over. */
  toFulfill: number;
  /** Recent WhatsApp handoffs to check against the chat. */
  handoffsToVerify: number;
  /** Sales per day for the window, oldest first. */
  daily: { date: string; total: number; count: number }[];
};

/**
 * Real numbers only: everything here is derived from stored orders, and
 * unverified handoffs never contribute to sales.
 */
export function orderMetrics(orders: readonly Order[], now: Date, days = 30): OrderMetrics {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), total: 0, count: 0 };
  });
  const byDate = new Map(daily.map((entry) => [entry.date, entry]));

  const sales: Order[] = [];
  let toConfirm = 0;
  let toFulfill = 0;
  let handoffsToVerify = 0;

  for (const order of orders) {
    if (order.status === "received") toConfirm += 1;
    if (order.status === "confirmed") toFulfill += 1;
    if (isWhatsAppHandoff(order) && !isStaleHandoff(order, now)) handoffsToVerify += 1;

    if (!isSale(order.status)) continue;
    if (new Date(order.createdAt) < start) continue;
    sales.push(order);
    const bucket = byDate.get(order.createdAt.slice(0, 10));
    if (bucket) {
      bucket.total = sumMoney([bucket.total, order.total]);
      bucket.count += 1;
    }
  }

  return {
    salesTotal: sumMoney(sales.map((order) => order.total)),
    salesCount: sales.length,
    paidTotal: sumMoney(
      sales.filter((order) => order.paymentStatus === "paid").map((order) => order.total),
    ),
    toConfirm,
    toFulfill,
    handoffsToVerify,
    daily,
  };
}
