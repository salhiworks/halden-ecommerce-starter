import type { OrderItem, Product } from "./types";

/**
 * Applies an order's items to a product's stock: `delta` +1 takes units out
 * (the order was confirmed), -1 puts them back (a confirmed order was
 * cancelled). Only tracked products move, and stock never goes below zero.
 *
 * The Supabase backend does the same in SQL (`admin_transition_order`), inside
 * the transaction that changes the order's status.
 */
export function applyStockDelta(
  product: Product,
  items: readonly OrderItem[],
  delta: -1 | 0 | 1,
): Product | null {
  if (delta === 0 || !product.trackInventory) return null;
  let changed = false;
  const variants = product.variants.map((variant) => {
    const units = items
      .filter((item) => item.productId === product.id && item.variantId === variant.id)
      .reduce((total, item) => total + item.quantity, 0);
    if (units === 0) return variant;
    changed = true;
    return { ...variant, stock: Math.max(0, variant.stock - delta * units) };
  });
  return changed ? { ...product, variants } : null;
}
