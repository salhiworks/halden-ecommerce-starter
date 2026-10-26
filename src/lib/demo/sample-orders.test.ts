import { describe, expect, it } from "vitest";
import { sumMoney } from "@/lib/domain/money";
import { demoCatalog, demoSettings } from "./seed";
import { sampleOrders } from "./sample-orders";

const now = new Date("2026-10-26T12:00:00Z");

describe("sample orders for the dashboard preview", () => {
  const orders = sampleOrders(demoCatalog(now), demoSettings(), now);

  it("covers every stage an owner deals with", () => {
    const statuses = new Set(orders.map((order) => order.status));
    for (const status of ["received", "prepared", "opened", "confirmed", "fulfilled", "completed", "cancelled"]) {
      expect(statuses).toContain(status);
    }
  });

  it("are priced by the store's own checkout, so totals add up", () => {
    for (const order of orders) {
      expect(order.items.length).toBeGreaterThan(0);
      expect(order.subtotal).toBe(sumMoney(order.items.map((item) => item.lineTotal)));
      expect(order.total).toBe(sumMoney([order.subtotal, order.shippingFee]));
    }
  });

  it("use only fictional people: reserved phone numbers and example.com emails", () => {
    for (const order of orders) {
      expect(order.customer.phone.replace(/\D/g, "")).toMatch(/^447700900\d{3}$/);
      expect(order.customer.email).toMatch(/@example\.com$/);
      expect(order.internalNote).toMatch(/sample/i);
    }
  });

  it("are unique and dated in the past", () => {
    expect(new Set(orders.map((order) => order.id)).size).toBe(orders.length);
    expect(new Set(orders.map((order) => order.number)).size).toBe(orders.length);
    for (const order of orders) expect(order.createdAt <= now.toISOString()).toBe(true);
  });

  it("are empty for a store without products", () => {
    expect(sampleOrders({ products: [], categories: [], collections: [] }, demoSettings(), now)).toEqual([]);
  });
});
