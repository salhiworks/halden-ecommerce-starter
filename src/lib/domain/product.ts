import { discountPercent } from "./money";
import type { Product, ProductImage, ProductVariant } from "./types";

/**
 * Product questions every surface must answer identically — the card, the
 * product page, the cart, checkout and the dashboard all import these instead
 * of re-deriving "is this in stock?" on their own.
 */

/** "Sand / M". Empty for a product without options. */
export function variantLabel(variant: Pick<ProductVariant, "optionValues">): string {
  return variant.optionValues.filter(Boolean).join(" / ");
}

export function hasOptions(product: Pick<Product, "options">): boolean {
  return product.options.length > 0;
}

/** Units a shopper may still add, or `null` when stock is not tracked. */
export function stockLimit(
  product: Pick<Product, "trackInventory">,
  variant: Pick<ProductVariant, "stock" | "available">,
): number | null {
  if (!variant.available) return 0;
  return product.trackInventory ? Math.max(0, variant.stock) : null;
}

export function isVariantInStock(
  product: Pick<Product, "trackInventory">,
  variant: Pick<ProductVariant, "stock" | "available">,
): boolean {
  const limit = stockLimit(product, variant);
  return limit === null || limit > 0;
}

/** Published, and at least one variant can be bought. */
export function isPurchasable(product: Product): boolean {
  return (
    product.status === "active" &&
    product.variants.some((variant) => isVariantInStock(product, variant))
  );
}

/** Shown on cards and pages so a listing can say "Sold out" plainly. */
export function isSoldOut(product: Product): boolean {
  return !product.variants.some((variant) => isVariantInStock(product, variant));
}

export type PriceSummary = {
  min: number;
  max: number;
  /** The "was" price of the cheapest discounted variant, if any. */
  compareAt: number | null;
  /** Whole percent off for the headline price, or `null`. */
  discount: number | null;
  varies: boolean;
};

/**
 * The headline price for a card: the cheapest *buyable* variant (falling back
 * to all variants for a sold-out product), with "from" when variants differ.
 */
export function priceSummary(product: Product): PriceSummary {
  const buyable = product.variants.filter((variant) => isVariantInStock(product, variant));
  const pool = buyable.length > 0 ? buyable : product.variants;
  if (pool.length === 0) {
    return { min: 0, max: 0, compareAt: null, discount: null, varies: false };
  }
  let cheapest = pool[0];
  let max = pool[0].price;
  for (const variant of pool) {
    if (variant.price < cheapest.price) cheapest = variant;
    if (variant.price > max) max = variant.price;
  }
  const discount = discountPercent(cheapest.price, cheapest.compareAtPrice);
  return {
    min: cheapest.price,
    max,
    compareAt: discount !== null ? cheapest.compareAtPrice : null,
    discount,
    varies: max !== cheapest.price,
  };
}

export function isOnSale(product: Product): boolean {
  return product.variants.some(
    (variant) =>
      isVariantInStock(product, variant) &&
      discountPercent(variant.price, variant.compareAtPrice) !== null,
  );
}

/** Low-stock notice threshold: real numbers only, never invented urgency. */
export const LOW_STOCK_THRESHOLD = 3;

export function lowStockCount(
  product: Pick<Product, "trackInventory">,
  variant: Pick<ProductVariant, "stock" | "available">,
): number | null {
  const limit = stockLimit(product, variant);
  return limit !== null && limit > 0 && limit <= LOW_STOCK_THRESHOLD ? limit : null;
}

/** Sum of tracked stock across variants, or `null` when not tracked. */
export function totalStock(product: Product): number | null {
  if (!product.trackInventory) return null;
  return product.variants.reduce(
    (total, variant) => total + (variant.available ? Math.max(0, variant.stock) : 0),
    0,
  );
}

/* --------------------------------------------------------------- variants */

/** Exact lookup by one value per option. */
export function findVariant(
  product: Pick<Product, "variants">,
  values: readonly (string | null | undefined)[],
): ProductVariant | null {
  return (
    product.variants.find(
      (variant) =>
        variant.optionValues.length === values.length &&
        variant.optionValues.every((value, index) => value === values[index]),
    ) ?? null
  );
}

export function findVariantById(
  product: Pick<Product, "variants">,
  variantId: string,
): ProductVariant | null {
  return product.variants.find((variant) => variant.id === variantId) ?? null;
}

/** The variant a product page opens on: the first one that can be bought. */
export function defaultVariant(product: Product): ProductVariant | null {
  return (
    product.variants.find((variant) => isVariantInStock(product, variant)) ??
    product.variants[0] ??
    null
  );
}

/**
 * Whether choosing `value` for option `index` can lead to a buyable variant,
 * given what is already chosen for the *other* options. Drives the
 * crossed-out state of option buttons.
 */
export function optionValueState(
  product: Product,
  index: number,
  value: string,
  selection: readonly (string | null)[],
): "available" | "sold-out" | "missing" {
  let exists = false;
  for (const variant of product.variants) {
    if (variant.optionValues[index] !== value) continue;
    const compatible = variant.optionValues.every(
      (other, otherIndex) =>
        otherIndex === index || selection[otherIndex] == null || selection[otherIndex] === other,
    );
    if (!compatible) continue;
    exists = true;
    if (isVariantInStock(product, variant)) return "available";
  }
  return exists ? "sold-out" : "missing";
}

/* ----------------------------------------------------------------- images */

export function primaryImage(product: Pick<Product, "images">): ProductImage | null {
  return product.images[0] ?? null;
}

/** The second photo, used as the hover image on cards. */
export function secondaryImage(product: Pick<Product, "images">): ProductImage | null {
  return product.images[1] ?? null;
}

export function imageForVariant(
  product: Pick<Product, "images">,
  variant: Pick<ProductVariant, "imageId"> | null,
): ProductImage | null {
  if (variant?.imageId) {
    const image = product.images.find((candidate) => candidate.id === variant.imageId);
    if (image) return image;
  }
  return primaryImage(product);
}

export function imageAlt(product: Pick<Product, "name">, image: ProductImage, index = 0): string {
  if (image.alt.trim()) return image.alt;
  return index === 0 ? product.name : `${product.name} — ${index + 1}`;
}

/** Products added in the last three weeks wear a "New" badge. */
export const NEW_ARRIVAL_DAYS = 21;

export function isNewArrival(product: Pick<Product, "createdAt">, now: number = Date.now()): boolean {
  return now - new Date(product.createdAt).getTime() < NEW_ARRIVAL_DAYS * 86_400_000;
}
