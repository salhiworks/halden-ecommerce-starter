import type { ProductOption, ProductVariant } from "./types";

/**
 * Variant generation for the product editor.
 *
 * The owner describes options ("Size: S, M, L", "Colour: Black, Sand") and the
 * editor derives one variant per combination. Editing the options must never
 * throw away prices, stock or SKUs the owner already typed, so every
 * regeneration carries existing variants across by matching their values.
 */

export const MAX_OPTIONS = 3;
export const MAX_VALUES_PER_OPTION = 30;
export const MAX_VARIANTS = 100;

/** Every combination of option values, in option order. `[[]]` for none. */
export function combinations(options: readonly ProductOption[]): string[][] {
  return options.reduce<string[][]>(
    (rows, option) =>
      rows.flatMap((row) => option.values.map((value) => [...row, value.label])),
    [[]],
  );
}

export function countCombinations(options: readonly ProductOption[]): number {
  return options.reduce((total, option) => total * option.values.length, 1);
}

type VariantTemplate = Pick<ProductVariant, "price" | "compareAtPrice" | "stock">;

function key(values: readonly string[]): string {
  return JSON.stringify(values);
}

/**
 * Rebuilds the variant list for `options`.
 *
 * - An existing variant with exactly the same values is kept as it is.
 * - A new combination inherits from the existing variant that shares the most
 *   values with it (so adding a "Colour" option keeps each size's price and
 *   SKU stem), and otherwise from `template`.
 * - Stock is only inherited from an exact match: duplicating a size's stock
 *   into every new colour would invent inventory.
 */
export function syncVariants(
  options: readonly ProductOption[],
  existing: readonly ProductVariant[],
  template: VariantTemplate,
  newId: () => string,
): ProductVariant[] {
  const byKey = new Map(existing.map((variant) => [key(variant.optionValues), variant]));

  return combinations(options).map((values) => {
    const exact = byKey.get(key(values));
    if (exact) return { ...exact, optionValues: values };

    const nearest = closestVariant(values, existing);
    return {
      id: newId(),
      optionValues: values,
      price: nearest?.price ?? template.price,
      compareAtPrice: nearest ? nearest.compareAtPrice : template.compareAtPrice,
      sku: "",
      stock: existing.length === 0 ? template.stock : 0,
      available: true,
      imageId: null,
    };
  });
}

function closestVariant(
  values: readonly string[],
  candidates: readonly ProductVariant[],
): ProductVariant | null {
  let best: ProductVariant | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = candidate.optionValues.filter((value) => values.includes(value)).length;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Applies an option value rename to the variants that use it, so renaming
 * "Grey" to "Stone" keeps that colour's stock and prices.
 */
export function renameOptionValue(
  variants: readonly ProductVariant[],
  optionIndex: number,
  from: string,
  to: string,
): ProductVariant[] {
  return variants.map((variant) =>
    variant.optionValues[optionIndex] === from
      ? {
          ...variant,
          optionValues: variant.optionValues.map((value, index) =>
            index === optionIndex ? to : value,
          ),
        }
      : variant,
  );
}

/** Problems that would make a product unsellable or ambiguous. */
export function optionProblems(options: readonly ProductOption[]): string[] {
  const problems: string[] = [];
  if (options.length > MAX_OPTIONS) {
    problems.push(`A product can have at most ${MAX_OPTIONS} options.`);
  }
  const names = new Set<string>();
  options.forEach((option, index) => {
    const name = option.name.trim();
    if (!name) problems.push(`Option ${index + 1} needs a name.`);
    const lower = name.toLowerCase();
    if (name && names.has(lower)) problems.push(`"${name}" is used twice.`);
    names.add(lower);
    if (option.values.length === 0) {
      problems.push(`Add at least one value to "${name || `Option ${index + 1}`}".`);
    }
    if (option.values.length > MAX_VALUES_PER_OPTION) {
      problems.push(`"${name}" has more than ${MAX_VALUES_PER_OPTION} values.`);
    }
    const seen = new Set<string>();
    for (const value of option.values) {
      const label = value.label.trim().toLowerCase();
      if (!label) problems.push(`"${name}" has an empty value.`);
      if (label && seen.has(label)) problems.push(`"${value.label}" appears twice in "${name}".`);
      seen.add(label);
    }
  });
  if (countCombinations(options) > MAX_VARIANTS) {
    problems.push(`These options make more than ${MAX_VARIANTS} combinations.`);
  }
  return problems;
}
