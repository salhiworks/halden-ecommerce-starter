import type { Category, Collection, Product, ProductOption, ProductVariant } from "@/lib/domain/types";
import { DEMO_PRODUCTS } from "./products";

/**
 * Demo catalog: a general store across five departments, built so one shop
 * shows every kind of product the platform handles — colour and size
 * variants, capacity-priced electronics, scents, sets, and plain products
 * with no options at all.
 *
 * Ids are fixed UUIDs so loading the demo twice updates it instead of
 * duplicating it, and so they are valid ids in Postgres.
 */

export const demoId = (kind: "c" | "a" | "b", n: number) =>
  `de000000-0000-4000-8000-${kind}${String(n).padStart(11, "0")}`;

const CATEGORY_DEFS = [
  {
    n: 1,
    slug: "audio-tech",
    name: "Audio & Tech",
    description: "Headphones, speakers and the small pieces of kit that make a desk work.",
  },
  {
    n: 2,
    slug: "home-kitchen",
    name: "Home & Kitchen",
    description: "Stoneware, glass and wood for the kitchen table, and calm things for every room.",
  },
  {
    n: 3,
    slug: "apparel",
    name: "Apparel",
    description: "Heavyweight cotton, good denim and everyday layers in honest colours.",
  },
  {
    n: 4,
    slug: "bags-accessories",
    name: "Bags & Accessories",
    description: "Bags that go everywhere, and the small things you carry every day.",
  },
  {
    n: 5,
    slug: "beauty-care",
    name: "Beauty & Care",
    description: "Simple, effective care for skin and hands, and a fragrance worth wearing.",
  },
] as const;

const COLLECTION_DEFS = [
  {
    n: 1,
    slug: "gift-guide",
    name: "Gift guide",
    description: "Thoughtful presents across every department, most of them under $60.",
    image: "/demo/banners/gift-guide.jpg",
  },
  {
    n: 2,
    slug: "desk-setup",
    name: "The desk setup",
    description: "Everything for a calmer, better-lit, better-sounding place to work.",
    image: "/demo/banners/desk-setup.jpg",
  },
  {
    n: 3,
    slug: "under-50",
    name: "Under $50",
    description: "Small upgrades and easy gifts, all under fifty dollars.",
    image: null,
  },
] as const;

export type DemoCategorySlug = (typeof CATEGORY_DEFS)[number]["slug"];
export type DemoCollectionSlug = (typeof COLLECTION_DEFS)[number]["slug"];

const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

export function demoCategories(now: Date): Category[] {
  return CATEGORY_DEFS.map((def, index) => ({
    id: demoId("c", def.n),
    slug: def.slug,
    name: def.name,
    description: def.description,
    imageUrl: `/demo/categories/${def.slug}.jpg`,
    sortOrder: index,
    visible: true,
    isDemo: true,
    createdAt: daysAgo(now, 60),
    updatedAt: daysAgo(now, 60),
  }));
}

export function demoCollections(now: Date): Collection[] {
  return COLLECTION_DEFS.map((def, index) => ({
    id: demoId("a", def.n),
    slug: def.slug,
    name: def.name,
    description: def.description,
    imageUrl: def.image,
    sortOrder: index,
    visible: true,
    isDemo: true,
    createdAt: daysAgo(now, 60),
    updatedAt: daysAgo(now, 60),
  }));
}

/* --------------------------------------------------------------- products */

export type DemoProductDef = {
  n: number;
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: DemoCategorySlug;
  collections?: DemoCollectionSlug[];
  tags?: string[];
  featured?: boolean;
  /** How long ago it was added — drives "Just in". */
  addedDaysAgo: number;
  /** Alt text per photo, in order; files are /demo/products/<slug>/<n>.jpg. */
  photos: string[];
  /** For products without options. */
  price?: number;
  compareAt?: number;
  stock?: number;
  sku?: string;
  options?: ProductOption[];
  /** One entry per combination of option values, in option order. */
  variants?: {
    values: string[];
    price: number;
    compareAt?: number;
    stock?: number;
    sku: string;
    available?: boolean;
    /** 1-based photo number shown when this variant is selected. */
    photo?: number;
  }[];
  trackInventory?: boolean;
  specs?: [string, string][];
};

function buildProduct(def: DemoProductDef, now: Date): Product {
  const images = def.photos.map((alt, index) => ({
    id: `${def.slug}-${index + 1}`,
    url: `/demo/products/${def.slug}/${index + 1}.jpg`,
    alt,
    width: 1200,
    height: 1500,
  }));

  const variants: ProductVariant[] = def.variants
    ? def.variants.map((variant) => ({
        id: `${def.slug}--${variant.values.join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        optionValues: variant.values,
        price: variant.price,
        compareAtPrice: variant.compareAt ?? null,
        sku: variant.sku,
        stock: variant.stock ?? 0,
        available: variant.available ?? true,
        imageId: variant.photo ? `${def.slug}-${variant.photo}` : null,
      }))
    : [
        {
          id: `${def.slug}--default`,
          optionValues: [],
          price: def.price ?? 0,
          compareAtPrice: def.compareAt ?? null,
          sku: def.sku ?? "",
          stock: def.stock ?? 0,
          available: true,
          imageId: null,
        },
      ];

  const stamp = daysAgo(now, def.addedDaysAgo);
  return {
    id: demoId("b", def.n),
    slug: def.slug,
    name: def.name,
    summary: def.summary,
    description: def.description,
    status: "active",
    categoryId: demoId("c", CATEGORY_DEFS.find((category) => category.slug === def.category)!.n),
    collectionIds: (def.collections ?? []).map((slug) =>
      demoId("a", COLLECTION_DEFS.find((collection) => collection.slug === slug)!.n),
    ),
    tags: def.tags ?? [],
    images,
    options: def.options ?? [],
    variants,
    trackInventory: def.trackInventory ?? false,
    specs: (def.specs ?? []).map(([label, value]) => ({ label, value })),
    featured: def.featured ?? false,
    seoTitle: "",
    seoDescription: "",
    isDemo: true,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function demoProducts(now: Date): Product[] {
  return DEMO_PRODUCTS.map((def) => buildProduct(def, now));
}
