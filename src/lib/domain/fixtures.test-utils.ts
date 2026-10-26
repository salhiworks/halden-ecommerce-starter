import type { Category, Collection, Product, ProductVariant } from "./types";

/** Test builders. Kept beside the domain so every suite shares one vocabulary. */

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

export function variant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: nextId("var"),
    optionValues: [],
    price: 20,
    compareAtPrice: null,
    sku: "",
    stock: 0,
    available: true,
    imageId: null,
    ...overrides,
  };
}

export function product(overrides: Partial<Product> = {}): Product {
  const id = overrides.id ?? nextId("prd");
  return {
    id,
    slug: overrides.slug ?? id,
    name: "Plain Product",
    summary: "",
    description: "",
    status: "active",
    categoryId: null,
    collectionIds: [],
    tags: [],
    images: [{ id: "img-1", url: "/demo/a.jpg", alt: "", width: 1200, height: 1500 }],
    options: [],
    variants: [variant()],
    trackInventory: false,
    specs: [],
    featured: false,
    seoTitle: "",
    seoDescription: "",
    isDemo: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A T-shirt in two colours and three sizes, with tracked stock. */
export function tee(overrides: Partial<Product> = {}): Product {
  const colours = ["Black", "White"];
  const sizes = ["S", "M", "L"];
  return product({
    name: "Organic Tee",
    slug: "organic-tee",
    trackInventory: true,
    options: [
      {
        name: "Colour",
        values: [
          { label: "Black", swatch: "#111111" },
          { label: "White", swatch: "#f5f5f5" },
        ],
      },
      { name: "Size", values: sizes.map((label) => ({ label, swatch: null })) },
    ],
    variants: colours.flatMap((colour) =>
      sizes.map((size) =>
        variant({
          id: `tee-${colour}-${size}`.toLowerCase(),
          optionValues: [colour, size],
          price: 32,
          stock: colour === "White" && size === "L" ? 0 : 5,
        }),
      ),
    ),
    ...overrides,
  });
}

export function grouping(overrides: Partial<Category> = {}): Category | Collection {
  const id = overrides.id ?? nextId("grp");
  return {
    id,
    slug: overrides.slug ?? id,
    name: "Group",
    description: "",
    imageUrl: null,
    sortOrder: 0,
    visible: true,
    isDemo: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
