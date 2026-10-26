import { z } from "zod";
import { imageUrlSchema } from "./settings";
import { SLUG_PATTERN } from "./slug";
import { combinations, MAX_OPTIONS, MAX_VARIANTS, optionProblems } from "./variants";

/**
 * Validation for everything the dashboard writes. The server re-validates
 * every action with these schemas — the forms are a convenience, not a
 * security boundary.
 */

const money = z.coerce
  .number({ message: "Enter a price" })
  .finite()
  .min(0, "Prices cannot be negative")
  .max(10_000_000, "That price is too high")
  .transform((value) => Math.round(value * 100) / 100);

const id = z.string().trim().min(1).max(64);

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Add a URL handle")
  .max(80)
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers and hyphens");

const imageSchema = z.object({
  id,
  url: imageUrlSchema.refine((value) => value !== "", "Missing image"),
  alt: z.string().trim().max(200).default(""),
  width: z.number().int().positive().max(20_000).nullable().default(null),
  height: z.number().int().positive().max(20_000).nullable().default(null),
});

const optionSchema = z.object({
  name: z.string().trim().min(1, "Name this option").max(30),
  values: z
    .array(
      z.object({
        label: z.string().trim().min(1, "Empty value").max(40),
        swatch: z
          .string()
          .trim()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .nullable()
          .default(null),
      }),
    )
    .min(1, "Add at least one value")
    .max(30),
});

const variantSchema = z.object({
  id,
  optionValues: z.array(z.string().trim().max(40)).max(MAX_OPTIONS),
  price: money,
  compareAtPrice: money.nullable().default(null),
  sku: z.string().trim().max(60).default(""),
  stock: z.coerce.number().int("Stock must be a whole number").min(0).max(1_000_000).default(0),
  available: z.boolean().default(true),
  imageId: z.string().max(64).nullable().default(null),
});

export const productInputSchema = z
  .object({
    id: id.optional(),
    /** The `updatedAt` the editor loaded; a mismatch means someone else saved. */
    expectedUpdatedAt: z.string().max(40).nullable().default(null),
    name: z.string().trim().min(1, "Give the product a name").max(120),
    slug: slugSchema,
    summary: z.string().trim().max(160).default(""),
    description: z.string().trim().max(5000).default(""),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    categoryId: z.string().max(64).nullable().default(null),
    collectionIds: z.array(id).max(20).default([]),
    tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
    images: z.array(imageSchema).max(12, "Up to 12 photos per product").default([]),
    options: z.array(optionSchema).max(MAX_OPTIONS).default([]),
    variants: z.array(variantSchema).min(1).max(MAX_VARIANTS),
    trackInventory: z.boolean().default(false),
    specs: z
      .array(
        z.object({
          label: z.string().trim().min(1, "Add a label").max(40),
          value: z.string().trim().min(1, "Add a value").max(200),
        }),
      )
      .max(20)
      .default([]),
    featured: z.boolean().default(false),
    seoTitle: z.string().trim().max(70).default(""),
    seoDescription: z.string().trim().max(160).default(""),
  })
  .superRefine((product, ctx) => {
    for (const problem of optionProblems(product.options)) {
      ctx.addIssue({ code: "custom", path: ["options"], message: problem });
    }

    // Variants must be exactly the combinations of the options — no more,
    // no fewer, no duplicates — or a shopper could pick something unbuyable.
    const expected = new Set(combinations(product.options).map((values) => JSON.stringify(values)));
    const seen = new Set<string>();
    product.variants.forEach((variant, index) => {
      const key = JSON.stringify(variant.optionValues);
      if (!expected.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index],
          message: "This variant does not match the product's options",
        });
      }
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", path: ["variants", index], message: "Duplicate variant" });
      }
      seen.add(key);
    });
    if (seen.size !== expected.size) {
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "Every combination of options needs a variant",
      });
    }

    const imageIds = new Set(product.images.map((image) => image.id));
    product.variants.forEach((variant, index) => {
      if (variant.imageId && !imageIds.has(variant.imageId)) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "imageId"],
          message: "That photo was removed",
        });
      }
    });
  })
  .transform((product) => ({
    ...product,
    // A "was" price that is not higher than the price is not a discount.
    variants: product.variants.map((variant) => ({
      ...variant,
      compareAtPrice:
        variant.compareAtPrice !== null && variant.compareAtPrice > variant.price
          ? variant.compareAtPrice
          : null,
    })),
  }));

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductFormValues = z.input<typeof productInputSchema>;

export const groupingInputSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, "Add a name").max(60),
  slug: slugSchema,
  description: z.string().trim().max(500).default(""),
  imageUrl: imageUrlSchema.default(""),
  visible: z.boolean().default(true),
});

export type GroupingInput = z.infer<typeof groupingInputSchema>;

/** Turns zod issues into `{ "variants.2.price": "message" }` for forms. */
export function issuesByPath(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    out[path] ??= issue.message;
  }
  return out;
}
