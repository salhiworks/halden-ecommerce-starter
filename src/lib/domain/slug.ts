/**
 * URL slugs: lowercase ASCII words joined by hyphens ("stoneware-mug-set").
 * A slug is part of every shared link, so once a product is published it
 * should not change — the editor only suggests one for new items.
 */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 80;

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * What a handle field keeps while someone types: like `slugify`, but a
 * trailing hyphen survives so "summer-" can become "summer-sale". Trim the
 * ends (`slugify` does) before saving.
 */
export function slugInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, MAX_SLUG_LENGTH);
}

/**
 * A slug that is not in `taken`. Names in non-Latin scripts slugify to
 * nothing, so they fall back to `fallback` ("product", "category"…).
 */
export function uniqueSlug(name: string, taken: ReadonlySet<string>, fallback = "item"): string {
  const base = slugify(name) || fallback;
  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${base.slice(0, MAX_SLUG_LENGTH - String(suffix).length - 1)}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}
