import { isOnSale, isPurchasable, priceSummary } from "./product";
import { normalizeText, tokenize } from "./search";
import type { CatalogData, Category, Collection, Product } from "./types";

/**
 * Browsing the catalog: search, filters, facets and sorting.
 *
 * Everything runs over the in-memory catalog, so the storefront, the
 * dashboard and both backends filter exactly the same way.
 */

export const SORT_KEYS = ["featured", "newest", "price-asc", "price-desc", "name"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export type ProductQuery = {
  q?: string;
  /** Category slug. */
  category?: string;
  /** Collection slug. */
  collection?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean;
  /** Option filters by option name: `{ Colour: ["Black", "Sand"] }`. */
  options?: Record<string, string[]>;
  sort?: SortKey;
};

/**
 * What a shopper may see: published products, never drafts or archived ones,
 * and nothing filed under a hidden category. (With Supabase, shoppers cannot
 * even load hidden categories, so "category not found" also means hidden.)
 */
export function storefrontProducts(catalog: CatalogData): Product[] {
  const visible = new Set(
    catalog.categories.filter((category) => category.visible).map((category) => category.id),
  );
  return catalog.products.filter(
    (product) =>
      product.status === "active" && (product.categoryId === null || visible.has(product.categoryId)),
  );
}

export function visibleCategories(catalog: CatalogData): Category[] {
  return catalog.categories
    .filter((category) => category.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function visibleCollections(catalog: CatalogData): Collection[] {
  return catalog.collections
    .filter((collection) => collection.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ search */

type Haystack = { name: string; rest: string };

function haystackOf(product: Product, categoryName: string): Haystack {
  const rest = [
    product.summary,
    product.description,
    categoryName,
    product.tags.join(" "),
    product.options.flatMap((option) => [option.name, ...option.values.map((v) => v.label)]).join(" "),
    product.specs.map((spec) => `${spec.label} ${spec.value}`).join(" "),
    product.variants.map((variant) => variant.sku).join(" "),
  ].join(" ");
  return { name: normalizeText(product.name), rest: normalizeText(rest) };
}

/**
 * Every query word must appear somewhere; matches in the product name rank
 * first. Returns products in relevance order.
 */
export function searchProducts(
  products: readonly Product[],
  query: string,
  categories: readonly Category[] = [],
): Product[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [...products];
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  const scored: { product: Product; score: number }[] = [];
  for (const product of products) {
    const haystack = haystackOf(product, categoryNames.get(product.categoryId ?? "") ?? "");
    let score = 0;
    let matchedAll = true;
    for (const token of tokens) {
      if (haystack.name.includes(token)) {
        score += haystack.name.startsWith(token) || haystack.name.includes(` ${token}`) ? 3 : 2;
      } else if (haystack.rest.includes(token)) {
        score += 1;
      } else {
        matchedAll = false;
        break;
      }
    }
    if (matchedAll) scored.push({ product, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.product);
}

/* ----------------------------------------------------------------- filters */

export function filterProducts(
  products: readonly Product[],
  query: ProductQuery,
  catalog: Pick<CatalogData, "categories" | "collections">,
): Product[] {
  const category = query.category
    ? catalog.categories.find((candidate) => candidate.slug === query.category)
    : null;
  const collection = query.collection
    ? catalog.collections.find((candidate) => candidate.slug === query.collection)
    : null;

  // An unknown slug filters everything out rather than silently showing all.
  if (query.category && !category) return [];
  if (query.collection && !collection) return [];

  const optionFilters = Object.entries(query.options ?? {}).filter(
    ([, values]) => values.length > 0,
  );

  return products.filter((product) => {
    if (category && product.categoryId !== category.id) return false;
    if (collection && !product.collectionIds.includes(collection.id)) return false;
    if (query.inStock && !isPurchasable(product)) return false;
    if (query.onSale && !isOnSale(product)) return false;

    const { min } = priceSummary(product);
    if (query.minPrice != null && min < query.minPrice) return false;
    if (query.maxPrice != null && min > query.maxPrice) return false;

    for (const [name, wanted] of optionFilters) {
      const index = product.options.findIndex(
        (option) => option.name.toLowerCase() === name.toLowerCase(),
      );
      if (index < 0) return false;
      const offered = product.variants
        .filter((variant) => variant.available)
        .map((variant) => variant.optionValues[index]);
      if (!wanted.some((value) => offered.includes(value))) return false;
    }
    return true;
  });
}

/* ------------------------------------------------------------------- sort */

export function sortProducts(products: readonly Product[], sort: SortKey = "featured"): Product[] {
  const list = [...products];
  const byNewest = (a: Product, b: Product) => b.createdAt.localeCompare(a.createdAt);
  switch (sort) {
    case "newest":
      return list.sort(byNewest);
    case "price-asc":
      return list.sort((a, b) => priceSummary(a).min - priceSummary(b).min);
    case "price-desc":
      return list.sort((a, b) => priceSummary(b).min - priceSummary(a).min);
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case "featured":
    default:
      // Featured first, buyable before sold out, then newest.
      return list.sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) ||
          Number(isPurchasable(b)) - Number(isPurchasable(a)) ||
          byNewest(a, b),
      );
  }
}

/* ------------------------------------------------------------------ facets */

export type OptionFacet = {
  name: string;
  values: { label: string; swatch: string | null; count: number }[];
};

export type Facets = {
  priceMin: number;
  priceMax: number;
  options: OptionFacet[];
};

/**
 * Filter choices for a listing. An option becomes a filter only when at least
 * two products share it — a "Scent" filter for one candle is noise.
 */
export function facetsFor(products: readonly Product[]): Facets {
  let priceMin = Number.POSITIVE_INFINITY;
  let priceMax = 0;
  const byName = new Map<
    string,
    { name: string; products: Set<string>; values: Map<string, { swatch: string | null; count: number }> }
  >();

  for (const product of products) {
    const { min } = priceSummary(product);
    priceMin = Math.min(priceMin, min);
    priceMax = Math.max(priceMax, min);

    product.options.forEach((option) => {
      const lower = option.name.trim().toLowerCase();
      if (!lower) return;
      let entry = byName.get(lower);
      if (!entry) {
        entry = { name: option.name.trim(), products: new Set(), values: new Map() };
        byName.set(lower, entry);
      }
      entry.products.add(product.id);
      for (const value of option.values) {
        const existing = entry.values.get(value.label);
        if (existing) {
          existing.count += 1;
          existing.swatch ??= value.swatch;
        } else {
          entry.values.set(value.label, { swatch: value.swatch, count: 1 });
        }
      }
    });
  }

  // A value only becomes a filter when two or more products share it: on a
  // mixed listing, "Size" should offer S–XL, not every shoe size and bottle
  // volume in the store.
  const options = [...byName.values()]
    .map((entry) => ({
      name: entry.name,
      reach: entry.products.size,
      values: [...entry.values.entries()]
        .map(([label, data]) => ({ label, ...data }))
        .filter((value) => value.count >= 2),
    }))
    .filter((entry) => entry.reach >= 2 && entry.values.length >= 2)
    .sort((a, b) => b.reach - a.reach)
    .slice(0, 4)
    .map(({ name, values }) => ({ name, values }));

  return {
    priceMin: Number.isFinite(priceMin) ? priceMin : 0,
    priceMax,
    options,
  };
}

/* ------------------------------------------------------- query parameters */

/** Reads a listing query from URL search params. Unknown values are ignored. */
export function parseProductQuery(
  params: Record<string, string | string[] | undefined>,
): ProductQuery {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const number = (key: string) => {
    const raw = one(key);
    if (raw == null || raw === "") return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  };

  const options: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith("o.") || value == null) continue;
    const name = key.slice(2).slice(0, 40);
    const values = (Array.isArray(value) ? value : [value])
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (name && values.length > 0) options[name] = values;
  }

  const sort = one("sort");
  return {
    q: one("q")?.slice(0, 100) || undefined,
    category: one("category") || undefined,
    collection: one("collection") || undefined,
    minPrice: number("min"),
    maxPrice: number("max"),
    inStock: one("stock") === "1" || undefined,
    onSale: one("sale") === "1" || undefined,
    options,
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : undefined,
  };
}
