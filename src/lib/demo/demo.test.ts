import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { productInputSchema } from "@/lib/domain/admin-schemas";
import { storefrontProducts } from "@/lib/domain/catalog-query";
import { settingsSchema } from "@/lib/domain/settings";
import { demoCatalog, demoLocalData } from "./seed";
import { DEMO_SETTINGS } from "./settings";

/**
 * The demo store is what people see first, so it is held to the same rules
 * as anything an owner creates in the dashboard — plus a few of its own.
 */

const catalog = demoCatalog(new Date("2026-06-01T00:00:00Z"));
const publicDir = path.join(process.cwd(), "public");

describe("demo catalog", () => {
  it("has a believable store's worth of products across every department", () => {
    expect(catalog.products.length).toBeGreaterThanOrEqual(25);
    expect(catalog.categories).toHaveLength(5);
    for (const category of catalog.categories) {
      expect(catalog.products.filter((product) => product.categoryId === category.id).length).toBeGreaterThanOrEqual(4);
    }
    expect(storefrontProducts(catalog)).toHaveLength(catalog.products.length);
  });

  it("passes the same validation as a product saved from the dashboard", () => {
    for (const product of catalog.products) {
      const result = productInputSchema.safeParse({ ...product, expectedUpdatedAt: null });
      expect(result.success, `${product.slug}: ${result.success ? "" : result.error.issues[0]?.message}`).toBe(true);
    }
  });

  it("uses unique ids, slugs and SKUs, and valid Postgres UUIDs", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const all = [...catalog.products, ...catalog.categories, ...catalog.collections];
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
    for (const item of all) expect(item.id).toMatch(uuid);
    expect(new Set(catalog.products.map((product) => product.slug)).size).toBe(catalog.products.length);
    const skus = catalog.products.flatMap((product) => product.variants.map((variant) => variant.sku)).filter(Boolean);
    expect(new Set(skus).size).toBe(skus.length);
    const variantIds = catalog.products.flatMap((product) => product.variants.map((variant) => variant.id));
    expect(new Set(variantIds).size).toBe(variantIds.length);
  });

  it("points every product, category and collection at a photo that exists", () => {
    const urls = [
      ...catalog.products.flatMap((product) => product.images.map((image) => image.url)),
      ...catalog.categories.map((category) => category.imageUrl),
      ...catalog.collections.map((collection) => collection.imageUrl),
    ].filter((url): url is string => Boolean(url));
    for (const url of urls) {
      expect(existsSync(path.join(publicDir, url)), url).toBe(true);
    }
  });

  it("credits every bundled photograph", () => {
    const credits = readFileSync(path.join(publicDir, "demo/CREDITS.md"), "utf8");
    const urls = catalog.products.flatMap((product) => product.images.map((image) => image.url));
    for (const url of urls) expect(credits, url).toContain(url.replace("/demo/", ""));
  });

  it("flags everything as demo content so it can be removed in one click", () => {
    for (const item of [...catalog.products, ...catalog.categories, ...catalog.collections]) {
      expect(item.isDemo).toBe(true);
    }
  });

  it("includes the cases the storefront must handle", () => {
    const tracked = catalog.products.filter((product) => product.trackInventory);
    expect(tracked.some((product) => product.variants.some((variant) => variant.stock === 0))).toBe(true);
    expect(catalog.products.some((product) => product.options.length === 0)).toBe(true);
    expect(catalog.products.some((product) => product.options.length === 2)).toBe(true);
    expect(catalog.products.some((product) => product.variants.some((variant) => variant.imageId))).toBe(true);
    expect(catalog.products.some((product) => product.variants.some((variant) => variant.compareAtPrice))).toBe(true);
    expect(catalog.products.some((product) => new Set(product.variants.map((variant) => variant.price)).size > 1)).toBe(true);
  });
});

describe("demo settings", () => {
  it("are valid and contain no real contact details", () => {
    const settings = settingsSchema.parse(DEMO_SETTINGS);
    expect(settings.contact.whatsapp).toBe("");
    expect(settings.contact.phone).toBe("");
    expect(settings.contact.email.endsWith(".example")).toBe(true);
    expect(Object.values(settings.social).every((url) => url === "")).toBe(true);
  });

  it("only link to pages and collections that exist", () => {
    const settings = settingsSchema.parse(DEMO_SETTINGS);
    const slugs = new Set(catalog.collections.map((collection) => collection.slug));
    const links = [
      settings.homepage.hero.primaryHref,
      settings.homepage.hero.secondaryHref,
      settings.homepage.announcement.href,
      ...settings.homepage.sections.flatMap((section) => (section.type === "banner" ? [section.linkHref] : [])),
    ].filter(Boolean);
    for (const link of links) {
      const collection = link.match(/^\/collections\/(.+)$/)?.[1];
      if (collection) expect(slugs.has(collection), link).toBe(true);
      else expect(link).toMatch(/^\/(shop)?$/);
    }
    for (const section of settings.homepage.sections) {
      if (section.type === "products" && section.source === "collection") {
        expect(catalog.collections.some((collection) => collection.id === section.collectionId)).toBe(true);
      }
      if (section.type === "banner") expect(existsSync(path.join(publicDir, section.imageUrl))).toBe(true);
    }
    expect(existsSync(path.join(publicDir, settings.homepage.hero.imageUrl))).toBe(true);
  });

  it("seeds a fresh local store with no owner and no orders", () => {
    const data = demoLocalData();
    expect(data.owner).toBeNull();
    expect(data.orders).toEqual([]);
    expect(data.nextOrderNumber).toBe(1001);
  });
});
