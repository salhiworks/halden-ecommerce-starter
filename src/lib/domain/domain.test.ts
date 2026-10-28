import { describe, expect, it } from "vitest";
import { productInputSchema } from "./admin-schemas";
import { facetsFor, filterProducts, parseProductQuery, searchProducts, sortProducts, storefrontProducts } from "./catalog-query";
import { grouping, product, tee, variant } from "./fixtures.test-utils";
import { discountPercent, formatMoney, isSupportedCurrency, multiplyMoney, sumMoney } from "./money";
import { isValidWhatsAppNumber, normalizePhone } from "./phone";
import {
  defaultVariant,
  findVariant,
  isPurchasable,
  lowStockCount,
  optionValueState,
  priceSummary,
  stockIssue,
  variantLabel,
} from "./product";
import { DEFAULT_SETTINGS, isSafeHref, parseSettings, settingsSchema } from "./settings";
import { slugify, uniqueSlug } from "./slug";
import { combinations, optionProblems, renameOptionValue, syncVariants } from "./variants";

describe("money", () => {
  it("adds and multiplies without floating point drift", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(multiplyMoney(19.99, 3)).toBe(59.97);
    expect(sumMoney([10, -2.5])).toBe(7.5);
  });

  it("only reports genuine discounts", () => {
    expect(discountPercent(80, 100)).toBe(20);
    expect(discountPercent(100, 100)).toBeNull();
    expect(discountPercent(100, 90)).toBeNull();
    expect(discountPercent(100, null)).toBeNull();
    expect(discountPercent(99.6, 100)).toBeNull(); // rounds to 0%
  });

  it("formats in the store currency and drops .00 on shelf prices only", () => {
    const usd = { currency: "USD", locale: "en" };
    expect(formatMoney(49, usd)).toBe("$49");
    expect(formatMoney(49.5, usd)).toBe("$49.50");
    expect(formatMoney(49, usd, "full")).toBe("$49.00");
    expect(formatMoney(1299, { currency: "EUR", locale: "fr" })).toMatch(/1\s?299\s?€/);
    // Arabic storefronts keep Latin digits.
    expect(formatMoney(120, { currency: "MAD", locale: "ar-u-nu-latn" })).toMatch(/120/);
  });

  it("never throws on an unknown currency", () => {
    expect(() => formatMoney(5, { currency: "ZZZ", locale: "en" })).not.toThrow();
    expect(isSupportedCurrency("USD")).toBe(true);
    expect(isSupportedCurrency("usd")).toBe(false);
    expect(isSupportedCurrency("ZZZ")).toBe(false);
  });
});

describe("phone numbers", () => {
  it("normalises every way an owner might type a number", () => {
    expect(normalizePhone("+44 7700 900123")).toBe("447700900123");
    expect(normalizePhone("0044 (7700) 900-123")).toBe("447700900123");
    expect(normalizePhone("+٤٤٧٧٠٠٩٠٠١٢٣")).toBe("447700900123");
    expect(normalizePhone("")).toBe("");
  });

  it("accepts only full international numbers", () => {
    expect(isValidWhatsAppNumber("447700900123")).toBe(true);
    expect(isValidWhatsAppNumber("07700900123")).toBe(false); // national format
    expect(isValidWhatsAppNumber("12345")).toBe(false);
    expect(isValidWhatsAppNumber("")).toBe(false);
  });
});

describe("settings", () => {
  it("gives a brand-new store complete, working defaults", () => {
    expect(DEFAULT_SETTINGS.store.name).toBe("My Store");
    expect(DEFAULT_SETTINGS.store.currency).toBe("USD");
    expect(DEFAULT_SETTINGS.shipping.methods.length).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.homepage.sections.length).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.contact.whatsapp).toBe("");
  });

  it("normalises the WhatsApp number on save and rejects national formats", () => {
    const ok = settingsSchema.safeParse({ contact: { whatsapp: "+44 (7700) 900-123" } });
    expect(ok.success && ok.data.contact.whatsapp).toBe("447700900123");
    expect(settingsSchema.safeParse({ contact: { whatsapp: "0612" } }).success).toBe(false);
  });

  it("repairs a damaged document section by section instead of failing", () => {
    const repaired = parseSettings({
      store: { name: "Corner Shop", currency: "NOPE" },
      theme: { accent: "#123456" },
    });
    expect(repaired.theme.accent).toBe("#123456");
    // The broken section falls back to defaults rather than taking the store down.
    expect(repaired.store.currency).toBe("USD");
  });

  it("only accepts safe links", () => {
    expect(isSafeHref("/collections/sale")).toBe(true);
    expect(isSafeHref("https://example.com")).toBe(true);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("//evil.example")).toBe(false);
    expect(settingsSchema.safeParse({ homepage: { hero: { primaryHref: "javascript:x" } } }).success).toBe(false);
  });
});

describe("products and variants", () => {
  it("labels variants by their values", () => {
    expect(variantLabel({ optionValues: ["Sand", "M"] })).toBe("Sand / M");
    expect(variantLabel({ optionValues: [] })).toBe("");
  });

  it("knows which combinations can still be bought", () => {
    const shirt = tee();
    expect(isPurchasable(shirt)).toBe(true);
    expect(findVariant(shirt, ["White", "L"])?.stock).toBe(0);
    expect(optionValueState(shirt, 1, "L", ["White", null])).toBe("sold-out");
    expect(optionValueState(shirt, 1, "L", ["Black", null])).toBe("available");
    expect(optionValueState(shirt, 1, "XL", [null, null])).toBe("missing");
  });

  it("treats untracked stock as unlimited and the manual switch as final", () => {
    const candle = product({ variants: [variant({ stock: 0 })] });
    expect(isPurchasable(candle)).toBe(true);
    const soldOut = product({ variants: [variant({ stock: 50, available: false })] });
    expect(isPurchasable(soldOut)).toBe(false);
    const draft = product({ status: "draft" });
    expect(isPurchasable(draft)).toBe(false);
  });

  it("opens the product page on a buyable variant", () => {
    const shirt = tee({
      variants: tee().variants.map((v, i) => ({ ...v, stock: i === 0 ? 0 : 3 })),
    });
    expect(defaultVariant(shirt)?.optionValues).toEqual(["Black", "M"]);
  });

  it("summarises prices as 'from' the cheapest buyable variant", () => {
    const ssd = product({
      options: [{ name: "Capacity", values: [{ label: "1 TB", swatch: null }, { label: "2 TB", swatch: null }] }],
      variants: [
        variant({ optionValues: ["1 TB"], price: 119, compareAtPrice: 139 }),
        variant({ optionValues: ["2 TB"], price: 179 }),
      ],
    });
    expect(priceSummary(ssd)).toMatchObject({ min: 119, max: 179, varies: true, discount: 14 });
  });

  it("states low stock only from real tracked numbers", () => {
    const tracked = { trackInventory: true };
    expect(lowStockCount(tracked, { stock: 2, available: true })).toBe(2);
    expect(lowStockCount(tracked, { stock: 10, available: true })).toBeNull();
    expect(lowStockCount({ trackInventory: false }, { stock: 1, available: true })).toBeNull();
  });

  it("gives each product one stock alert, matching the dashboard and the stock filter", () => {
    // The Overview once missed a tracked product with one variant sold out and another in stock.
    const tracked = (...stocks: number[]) =>
      product({ trackInventory: true, variants: stocks.map((stock) => variant({ stock })) });
    expect(stockIssue(tracked(8, 0))).toBe("low");
    expect(stockIssue(tracked(8, 2))).toBe("low");
    expect(stockIssue(tracked(0, 0))).toBe("sold-out");
    expect(stockIssue(tracked(8, 9))).toBeNull();
    // An unavailable variant is switched off, not sold out.
    expect(stockIssue(product({ trackInventory: true, variants: [variant({ stock: 8 }), variant({ stock: 0, available: false })] }))).toBeNull();
    expect(stockIssue(product({ trackInventory: true, variants: [variant({ stock: 5, available: false })] }))).toBe("sold-out");
    // Untracked stock only runs out when every variant is switched off.
    expect(stockIssue(product({ variants: [variant({ available: true }), variant({ available: false })] }))).toBeNull();
    expect(stockIssue(product({ variants: [variant({ available: false })] }))).toBe("sold-out");
  });
});

describe("variant generation", () => {
  const sizes = { name: "Size", values: ["S", "M"].map((label) => ({ label, swatch: null })) };
  const colours = { name: "Colour", values: ["Black", "Sand"].map((label) => ({ label, swatch: null })) };

  it("builds every combination", () => {
    expect(combinations([])).toEqual([[]]);
    expect(combinations([sizes, colours])).toHaveLength(4);
  });

  it("keeps existing prices and stock when options change", () => {
    let n = 0;
    const id = () => `new-${++n}`;
    const first = syncVariants([sizes], [], { price: 30, compareAtPrice: null, stock: 4 }, id);
    first[1] = { ...first[1], price: 35, stock: 9, sku: "TEE-M" };

    const second = syncVariants([sizes, colours], first, { price: 30, compareAtPrice: null, stock: 4 }, id);
    expect(second).toHaveLength(4);
    const mediumBlack = second.find((v) => v.optionValues.join() === "M,Black")!;
    expect(mediumBlack.price).toBe(35); // inherited from "M"
    expect(mediumBlack.stock).toBe(0); // stock is never duplicated into new combinations

    const unchanged = syncVariants([sizes], first, { price: 1, compareAtPrice: null, stock: 0 }, id);
    expect(unchanged[1]).toMatchObject({ price: 35, stock: 9, sku: "TEE-M" });
  });

  it("carries stock across a value rename", () => {
    const variants = [variant({ optionValues: ["Grey"], stock: 7 })];
    expect(renameOptionValue(variants, 0, "Grey", "Stone")[0]).toMatchObject({
      optionValues: ["Stone"],
      stock: 7,
    });
  });

  it("explains option problems in plain words", () => {
    expect(optionProblems([{ name: "Size", values: [] }])).toContain('Add at least one value to "Size".');
    expect(optionProblems([sizes, { ...sizes }]).some((p) => p.includes("used twice"))).toBe(true);
  });
});

describe("product input validation", () => {
  const base = {
    name: "Mug",
    slug: "mug",
    variants: [{ id: "v1", optionValues: [], price: 12 }],
  };

  it("accepts a simple product and drops fake discounts", () => {
    const parsed = productInputSchema.parse({
      ...base,
      variants: [{ id: "v1", optionValues: [], price: 12, compareAtPrice: 10 }],
    });
    expect(parsed.variants[0].compareAtPrice).toBeNull();
    expect(parsed.status).toBe("draft");
  });

  it("rejects variants that do not match the options", () => {
    const result = productInputSchema.safeParse({
      ...base,
      options: [{ name: "Size", values: [{ label: "S" }, { label: "M" }] }],
      variants: [{ id: "v1", optionValues: ["S"], price: 12 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative prices and bad slugs", () => {
    expect(productInputSchema.safeParse({ ...base, variants: [{ id: "v", optionValues: [], price: -1 }] }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, slug: "Not A Slug" }).success).toBe(false);
  });
});

describe("slugs", () => {
  it("makes readable, unique slugs", () => {
    expect(slugify("Crème Brûlée Candle & Co.")).toBe("creme-brulee-candle-and-co");
    expect(uniqueSlug("Mug", new Set(["mug", "mug-2"]))).toBe("mug-3");
    expect(uniqueSlug("كوب", new Set(), "product")).toBe("product");
  });
});

describe("catalog browsing", () => {
  const audio = grouping({ id: "cat-audio", slug: "audio", name: "Audio" });
  const hidden = grouping({ id: "cat-hidden", slug: "hidden", name: "Hidden", visible: false });
  const sale = grouping({ id: "col-sale", slug: "sale", name: "Sale" });
  const headphones = product({
    name: "Studio Headphones",
    categoryId: "cat-audio",
    collectionIds: ["col-sale"],
    featured: true,
    tags: ["wireless"],
    options: [{ name: "Colour", values: [{ label: "Black", swatch: "#000000" }] }],
    variants: [variant({ optionValues: ["Black"], price: 149, compareAtPrice: 179 })],
    createdAt: "2026-02-01T00:00:00.000Z",
  });
  const crème = product({ name: "Crème Hand Balm", createdAt: "2026-03-01T00:00:00.000Z" });
  const secret = product({ name: "Secret", categoryId: "cat-hidden" });
  const draft = product({ name: "Draft Lamp", status: "draft" });
  const catalog = { products: [headphones, crème, secret, draft], categories: [audio, hidden], collections: [sale] };

  it("shows shoppers only published products in visible categories", () => {
    const names = storefrontProducts(catalog).map((p) => p.name);
    expect(names).toEqual(["Studio Headphones", "Crème Hand Balm"]);
  });

  it("finds products by name, tag, category and accent-free spelling", () => {
    const visible = storefrontProducts(catalog);
    expect(searchProducts(visible, "creme", catalog.categories)[0].name).toBe("Crème Hand Balm");
    expect(searchProducts(visible, "wireless", catalog.categories)).toHaveLength(1);
    expect(searchProducts(visible, "audio studio", catalog.categories)).toHaveLength(1);
    expect(searchProducts(visible, "nothing-like-this", catalog.categories)).toHaveLength(0);
  });

  it("filters by category, collection, sale, price and option", () => {
    const visible = storefrontProducts(catalog);
    expect(filterProducts(visible, { category: "audio" }, catalog)).toHaveLength(1);
    expect(filterProducts(visible, { collection: "sale" }, catalog)).toHaveLength(1);
    expect(filterProducts(visible, { onSale: true }, catalog)).toHaveLength(1);
    expect(filterProducts(visible, { maxPrice: 50 }, catalog).map((p) => p.name)).toEqual(["Crème Hand Balm"]);
    expect(filterProducts(visible, { options: { colour: ["Black"] } }, catalog)).toHaveLength(1);
    expect(filterProducts(visible, { category: "missing" }, catalog)).toHaveLength(0);
  });

  it("sorts featured first, then newest", () => {
    const sorted = sortProducts(storefrontProducts(catalog));
    expect(sorted[0].name).toBe("Studio Headphones");
    expect(sortProducts(storefrontProducts(catalog), "newest")[0].name).toBe("Crème Hand Balm");
    expect(sortProducts(storefrontProducts(catalog), "price-desc")[0].name).toBe("Studio Headphones");
  });

  it("offers an option filter only when products share it", () => {
    expect(facetsFor([headphones, crème]).options).toHaveLength(0);
    expect(facetsFor([tee(), tee({ id: "tee-2" })]).options.map((o) => o.name)).toEqual(["Colour", "Size"]);
  });

  it("reads filters from the URL defensively", () => {
    const query = parseProductQuery({ q: "mug", min: "10", max: "abc", "o.Colour": "Black,Sand", sort: "nope", sale: "1" });
    expect(query).toMatchObject({ q: "mug", minPrice: 10, maxPrice: undefined, onSale: true, sort: undefined });
    expect(query.options).toEqual({ Colour: ["Black", "Sand"] });
  });
});
