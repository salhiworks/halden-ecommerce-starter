import "server-only";
import { randomUUID } from "node:crypto";
import type { ProductInput } from "@/lib/domain/admin-schemas";
import type { CatalogData, Product } from "@/lib/domain/types";

/**
 * Turns validated editor input into the product that gets stored: keeps what
 * the editor does not own (id, creation date, demo flag), checks references
 * against the live catalog, and drops collections that no longer exist.
 */

export class ProductInputError extends Error {
  constructor(
    message: string,
    readonly field: string,
  ) {
    super(message);
    this.name = "ProductInputError";
  }
}

export function prepareProduct(input: ProductInput, catalog: CatalogData, now = new Date()): Product {
  const existing = input.id ? catalog.products.find((product) => product.id === input.id) : undefined;
  if (input.id && !existing) throw new ProductInputError("This product no longer exists.", "form");

  if (catalog.products.some((product) => product.slug === input.slug && product.id !== input.id)) {
    throw new ProductInputError(`Another product already uses the URL handle "${input.slug}".`, "slug");
  }
  if (input.categoryId && !catalog.categories.some((category) => category.id === input.categoryId)) {
    throw new ProductInputError("That category was deleted. Choose another one.", "categoryId");
  }

  const collections = new Set(catalog.collections.map((collection) => collection.id));
  const stamp = now.toISOString();

  return {
    id: existing?.id ?? randomUUID(),
    slug: input.slug,
    name: input.name,
    summary: input.summary,
    description: input.description,
    status: input.status,
    categoryId: input.categoryId,
    collectionIds: [...new Set(input.collectionIds)].filter((id) => collections.has(id)),
    tags: [...new Set(input.tags.map((tag) => tag.toLowerCase()))],
    images: input.images,
    options: input.options,
    variants: input.variants.map((variant) => ({
      ...variant,
      optionValues: input.options.length === 0 ? [] : variant.optionValues,
      stock: input.trackInventory ? variant.stock : 0,
    })),
    trackInventory: input.trackInventory,
    specs: input.specs,
    featured: input.featured,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    isDemo: existing?.isDemo ?? false,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  };
}

/** A copy saved as a draft, with a fresh handle and fresh variant ids. */
export function duplicateProduct(product: Product, catalog: CatalogData, now = new Date()): Product {
  const taken = new Set(catalog.products.map((candidate) => candidate.slug));
  let slug = `${product.slug}-copy`.slice(0, 80);
  for (let n = 2; taken.has(slug); n += 1) slug = `${product.slug}-copy-${n}`.slice(0, 80);
  const stamp = now.toISOString();
  return {
    ...structuredClone(product),
    id: randomUUID(),
    slug,
    name: `${product.name} (copy)`.slice(0, 120),
    status: "draft",
    isDemo: false,
    variants: product.variants.map((variant) => ({ ...variant, id: randomUUID(), sku: "" })),
    createdAt: stamp,
    updatedAt: stamp,
  };
}
