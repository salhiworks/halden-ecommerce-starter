import { z } from "zod";
import { LANGUAGES, intlLocaleOf } from "@/lib/i18n/languages";
import { isSupportedCurrency, type MoneyFormat } from "./money";
import { isValidWhatsAppNumber, normalizePhone } from "./phone";

/**
 * ===========================================================================
 *  STORE SETTINGS
 * ===========================================================================
 *
 *  Everything an owner configures from the dashboard — name, logo, currency,
 *  contact details, checkout methods, delivery, theme and homepage — lives in
 *  one validated document. Every field has a default, so a brand-new store
 *  renders correctly before its owner has touched anything, and a document
 *  saved by an older version is upgraded on read instead of breaking.
 */

const text = (max: number, fallback = "") => z.string().trim().max(max).default(fallback);

const money = z.coerce
  .number()
  .finite()
  .min(0)
  .max(10_000_000)
  .transform((value) => Math.round(value * 100) / 100);

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour like #1F4D3A");

/**
 * A link an owner can type: a path on this store ("/collections/sale") or a
 * full http(s) URL. Anything else — notably `javascript:` — is rejected.
 */
export const hrefSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || isSafeHref(value), "Use a path like /shop or a full https:// link");

export function isSafeHref(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** An http(s) URL or nothing — used for social profiles. */
const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((value) => {
    if (value === "") return true;
    try {
      return ["https:", "http:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Use a full link starting with https://")
  .default("");

/** Image references are either uploads, bundled demo files or absolute URLs. */
export const imageUrlSchema = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (value) => value === "" || value.startsWith("/") || /^https:\/\//.test(value),
    "Invalid image address",
  );

export const shippingMethodSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1, "Name the delivery option").max(60),
  description: text(160),
  price: money,
  /** Pickup needs no address; a courier does. */
  requiresAddress: z.boolean().default(true),
});

export type ShippingMethod = z.infer<typeof shippingMethodSchema>;

/* ------------------------------------------------------- homepage sections */

const sectionBase = {
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,40}$/),
  enabled: z.boolean().default(true),
};

export const PRODUCT_SOURCES = ["featured", "new", "sale", "collection"] as const;

export const homepageSectionSchema = z.discriminatedUnion("type", [
  z.object({
    ...sectionBase,
    type: z.literal("categories"),
    title: text(80),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("products"),
    title: text(80),
    source: z.enum(PRODUCT_SOURCES).default("featured"),
    collectionId: z.string().max(64).nullable().default(null),
    limit: z.coerce.number().int().min(2).max(12).default(4),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("banner"),
    eyebrow: text(60),
    heading: text(100),
    text: text(240),
    imageUrl: imageUrlSchema.default(""),
    linkLabel: text(40),
    linkHref: hrefSchema.default(""),
    align: z.enum(["start", "end"]).default("start"),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("collections"),
    title: text(80),
  }),
  z.object({
    ...sectionBase,
    /** Delivery and payment promises, derived from the settings themselves. */
    type: z.literal("highlights"),
  }),
]);

export type HomepageSection = z.infer<typeof homepageSectionSchema>;
export type HomepageSectionType = HomepageSection["type"];

const DEFAULT_SECTIONS: HomepageSection[] = [
  { id: "categories", type: "categories", enabled: true, title: "Shop by category" },
  {
    id: "featured",
    type: "products",
    enabled: true,
    title: "Featured",
    source: "featured",
    collectionId: null,
    limit: 8,
  },
  { id: "highlights", type: "highlights", enabled: true },
  {
    id: "new",
    type: "products",
    enabled: true,
    title: "New arrivals",
    source: "new",
    collectionId: null,
    limit: 4,
  },
];

/* --------------------------------------------------------------- settings */

export const FONT_PAIRINGS = ["signage", "editorial", "friendly"] as const;
export const CORNER_STYLES = ["sharp", "soft", "round"] as const;

export const settingsSchema = z.object({
  store: z
    .object({
      name: z.string().trim().min(1, "Your store needs a name").max(60).default("My Store"),
      tagline: text(120),
      description: text(500),
      logoUrl: imageUrlSchema.default(""),
      language: z.enum(LANGUAGES).default("en"),
      currency: z
        .string()
        .trim()
        .toUpperCase()
        .refine(isSupportedCurrency, "Unknown currency code")
        .default("USD"),
      /** Canonical address used in shared links. Blank = the address in use. */
      siteUrl: optionalUrl,
    })
    .prefault({}),

  contact: z
    .object({
      email: z
        .string()
        .trim()
        .max(120)
        .refine((value) => value === "" || z.email().safeParse(value).success, "Invalid email")
        .default(""),
      phone: text(40),
      /** International format, digits only — normalised on save. */
      whatsapp: z
        .string()
        .trim()
        .max(40)
        .transform((value) => normalizePhone(value))
        .refine((value) => value === "" || isValidWhatsAppNumber(value), {
          message: "Use the full international number, e.g. +44 7700 900123",
        })
        .default(""),
      address: text(200),
      hours: text(120),
    })
    .prefault({}),

  social: z
    .object({
      instagram: optionalUrl,
      facebook: optionalUrl,
      tiktok: optionalUrl,
      youtube: optionalUrl,
      x: optionalUrl,
      pinterest: optionalUrl,
    })
    .prefault({}),

  checkout: z
    .object({
      whatsapp: z.boolean().default(true),
      cashOnDelivery: z.boolean().default(true),
      bankTransfer: z.boolean().default(false),
      /** Account name, IBAN, reference to use… shown after the order. */
      bankTransferInstructions: text(1000),
      /** Shown on the confirmation page, e.g. "We call within 24 hours." */
      confirmationNote: text(300),
    })
    .prefault({}),

  shipping: z
    .object({
      methods: z
        .array(shippingMethodSchema)
        .max(8)
        .default([
          {
            id: "delivery",
            name: "Delivery",
            description: "We'll confirm the delivery cost and timing with you.",
            price: 0,
            requiresAddress: true,
          },
        ]),
      /** Order subtotal from which delivery is free. `null` = never. */
      freeShippingThreshold: money.nullable().default(null),
      /** Countries you deliver to, as a sentence: "United States and Canada". */
      areas: text(160),
    })
    .prefault({}),

  theme: z
    .object({
      accent: hexColor.default("#0F4C5C"),
      fontPairing: z.enum(FONT_PAIRINGS).default("signage"),
      corners: z.enum(CORNER_STYLES).default("soft"),
    })
    .prefault({}),

  homepage: z
    .object({
      announcement: z
        .object({
          enabled: z.boolean().default(false),
          text: text(140),
          href: hrefSchema.default(""),
        })
        .prefault({}),
      hero: z
        .object({
          enabled: z.boolean().default(true),
          eyebrow: text(60),
          heading: text(100, "Welcome to our store"),
          text: text(240),
          imageUrl: imageUrlSchema.default(""),
          primaryLabel: text(40, "Shop now"),
          primaryHref: hrefSchema.default("/shop"),
          secondaryLabel: text(40),
          secondaryHref: hrefSchema.default(""),
        })
        .prefault({}),
      sections: z.array(homepageSectionSchema).max(16).default(DEFAULT_SECTIONS),
    })
    .prefault({}),

  policies: z
    .object({
      about: text(5000),
      shipping: text(5000),
      returns: text(5000),
      privacy: text(5000),
    })
    .prefault({}),
});

export type StoreSettings = z.infer<typeof settingsSchema>;
export type SettingsInput = z.input<typeof settingsSchema>;

/**
 * Reads a stored settings document, filling every gap with defaults. Never
 * throws: a field that no longer validates is reset to its default rather
 * than taking the storefront down.
 */
export function parseSettings(raw: unknown): StoreSettings {
  const result = settingsSchema.safeParse(raw ?? {});
  if (result.success) return result.data;

  // Salvage section by section so one bad value only costs that section.
  const source = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const repaired: Record<string, unknown> = {};
  for (const key of Object.keys(settingsSchema.shape) as (keyof StoreSettings)[]) {
    const section = settingsSchema.shape[key].safeParse(source[key]);
    if (section.success) repaired[key] = section.data;
  }
  return settingsSchema.parse(repaired);
}

export const DEFAULT_SETTINGS: StoreSettings = settingsSchema.parse({});

/* ---------------------------------------------------------------- derived */

export function moneyFormatOf(settings: StoreSettings): MoneyFormat {
  return {
    currency: settings.store.currency,
    locale: intlLocaleOf(settings.store.language),
  };
}

export function isWhatsAppConfigured(settings: StoreSettings): boolean {
  return isValidWhatsAppNumber(settings.contact.whatsapp);
}

export type CheckoutMethod = "whatsapp" | "cod" | "bank_transfer";

/** The checkout methods a shopper is offered, in display order. */
export function enabledCheckoutMethods(settings: StoreSettings): CheckoutMethod[] {
  const methods: CheckoutMethod[] = [];
  if (settings.checkout.cashOnDelivery) methods.push("cod");
  if (settings.checkout.bankTransfer) methods.push("bank_transfer");
  if (settings.checkout.whatsapp) methods.push("whatsapp");
  return methods;
}
