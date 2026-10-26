import { multiplyMoney, sumMoney } from "./money";
import {
  findVariantById,
  imageForVariant,
  isVariantInStock,
  stockLimit,
  variantLabel,
} from "./product";
import type { ShippingMethod, StoreSettings } from "./settings";
import type { Product } from "./types";

/**
 * ===========================================================================
 *  CART & QUOTE
 * ===========================================================================
 *
 *  The browser keeps only *what* the shopper wants — product, variant,
 *  quantity. Everything with a number on it (price, stock, totals, delivery)
 *  is worked out here from the live catalog, every time the cart is shown and
 *  again when the order is placed. A stale tab or an edited localStorage entry
 *  can therefore never change what an order costs.
 */

export const MAX_LINE_QUANTITY = 99;
export const MAX_CART_LINES = 50;

export type CartLine = {
  productId: string;
  variantId: string;
  quantity: number;
};

export function lineKey(line: Pick<CartLine, "productId" | "variantId">): string {
  return `${line.productId}:${line.variantId}`;
}

export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.trunc(quantity)));
}

/** Parses untrusted cart data (localStorage, a request body) into clean lines. */
export function parseCartLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<string, CartLine>();
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const { productId, variantId, quantity } = entry as Record<string, unknown>;
    if (typeof productId !== "string" || !productId || productId.length > 64) continue;
    if (typeof variantId !== "string" || !variantId || variantId.length > 64) continue;
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 1) continue;
    const key = lineKey({ productId, variantId });
    const previous = merged.get(key);
    merged.set(key, {
      productId,
      variantId,
      quantity: clampQuantity((previous?.quantity ?? 0) + quantity),
    });
    if (merged.size >= MAX_CART_LINES) break;
  }
  return [...merged.values()];
}

/* ------------------------------------------------------------------ quote */

export type QuoteLineStatus = "ok" | "adjusted" | "unavailable";

export type QuoteLine = {
  key: string;
  productId: string;
  variantId: string;
  slug: string | null;
  name: string;
  variantLabel: string;
  imageUrl: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  /** What will actually be ordered (0 for an unavailable line). */
  quantity: number;
  requestedQuantity: number;
  /** Most the shopper can have, or `null` when stock is not tracked. */
  maxQuantity: number | null;
  lineTotal: number;
  status: QuoteLineStatus;
  /** Why a line is not "ok". */
  reason: "gone" | "variant-gone" | "sold-out" | "limited" | null;
};

export type ShippingQuote = {
  method: ShippingMethod;
  fee: number;
  /** The method normally costs money but the free-delivery threshold applies. */
  waived: boolean;
};

export type CartQuote = {
  lines: QuoteLine[];
  itemCount: number;
  subtotal: number;
  shipping: ShippingQuote | null;
  total: number;
  /** Amount still needed for free delivery, or `null` when not applicable. */
  freeShippingRemaining: number | null;
  /** Any line was adjusted or cannot be ordered. */
  hasIssues: boolean;
  /** At least one line can be ordered. */
  orderable: boolean;
};

export function quoteCart(
  lines: readonly CartLine[],
  products: readonly Product[],
  settings: StoreSettings,
  shippingMethodId: string | null = null,
): CartQuote {
  const byId = new Map(products.map((product) => [product.id, product]));

  const quoted: QuoteLine[] = lines.map((line) => {
    const product = byId.get(line.productId);
    const base = {
      key: lineKey(line),
      productId: line.productId,
      variantId: line.variantId,
      requestedQuantity: line.quantity,
    };

    if (!product || product.status !== "active") {
      return {
        ...base,
        slug: product?.slug ?? null,
        name: product?.name ?? "",
        variantLabel: "",
        imageUrl: product ? (imageForVariant(product, null)?.url ?? null) : null,
        unitPrice: 0,
        compareAtPrice: null,
        quantity: 0,
        maxQuantity: 0,
        lineTotal: 0,
        status: "unavailable",
        reason: "gone",
      };
    }

    const variant = findVariantById(product, line.variantId);
    if (!variant) {
      return {
        ...base,
        slug: product.slug,
        name: product.name,
        variantLabel: "",
        imageUrl: imageForVariant(product, null)?.url ?? null,
        unitPrice: 0,
        compareAtPrice: null,
        quantity: 0,
        maxQuantity: 0,
        lineTotal: 0,
        status: "unavailable",
        reason: "variant-gone",
      };
    }

    const limit = stockLimit(product, variant);
    const shared = {
      ...base,
      slug: product.slug,
      name: product.name,
      variantLabel: variantLabel(variant),
      imageUrl: imageForVariant(product, variant)?.url ?? null,
      unitPrice: variant.price,
      compareAtPrice:
        variant.compareAtPrice !== null && variant.compareAtPrice > variant.price
          ? variant.compareAtPrice
          : null,
      maxQuantity: limit === null ? MAX_LINE_QUANTITY : Math.min(limit, MAX_LINE_QUANTITY),
    };

    if (!isVariantInStock(product, variant)) {
      return {
        ...shared,
        maxQuantity: 0,
        quantity: 0,
        lineTotal: 0,
        status: "unavailable",
        reason: "sold-out",
      };
    }

    const quantity = Math.min(clampQuantity(line.quantity), shared.maxQuantity);
    const adjusted = quantity < line.quantity;
    return {
      ...shared,
      maxQuantity: limit === null ? null : shared.maxQuantity,
      quantity,
      lineTotal: multiplyMoney(variant.price, quantity),
      status: adjusted ? "adjusted" : "ok",
      reason: adjusted ? "limited" : null,
    };
  });

  const counted = quoted.filter((line) => line.status !== "unavailable");
  const subtotal = sumMoney(counted.map((line) => line.lineTotal));
  const itemCount = counted.reduce((total, line) => total + line.quantity, 0);
  const shipping = shippingQuote(settings, subtotal, shippingMethodId);
  const threshold = settings.shipping.freeShippingThreshold;

  return {
    lines: quoted,
    itemCount,
    subtotal,
    shipping,
    total: sumMoney([subtotal, shipping?.fee ?? 0]),
    freeShippingRemaining:
      threshold !== null && threshold > 0 && subtotal > 0 && subtotal < threshold
        ? sumMoney([threshold, -subtotal])
        : null,
    hasIssues: quoted.some((line) => line.status !== "ok"),
    orderable: counted.length > 0,
  };
}

export function shippingQuote(
  settings: StoreSettings,
  subtotal: number,
  methodId: string | null,
): ShippingQuote | null {
  if (!methodId) return null;
  const method = settings.shipping.methods.find((candidate) => candidate.id === methodId);
  if (!method) return null;
  const threshold = settings.shipping.freeShippingThreshold;
  const waived = method.price > 0 && threshold !== null && threshold > 0 && subtotal >= threshold;
  return { method, fee: waived ? 0 : method.price, waived };
}
