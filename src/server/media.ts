import "server-only";
import type { StoreSettings } from "@/lib/domain/settings";
import type { CatalogData } from "@/lib/domain/types";
import type { MediaUpload } from "@/server/backend/types";

/**
 * Upload checks. The browser already shrinks photos before sending them, but
 * the server trusts nothing: it reads the file's first bytes to confirm it
 * really is an image of an allowed type, whatever its name or Content-Type
 * header claim.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export function sniffImage(bytes: Uint8Array): Pick<MediaUpload, "contentType" | "extension"> | null {
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (starts(0xff, 0xd8, 0xff)) return { contentType: "image/jpeg", extension: "jpg" };
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { contentType: "image/png", extension: "png" };
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { contentType: "image/webp", extension: "webp" };
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) {
    return { contentType: "image/avif", extension: "avif" };
  }
  return null;
}

/** Every image URL the store still refers to anywhere. */
export function referencedMedia(catalog: CatalogData, settings: StoreSettings): Set<string> {
  const urls = new Set<string>();
  for (const product of catalog.products) for (const image of product.images) urls.add(image.url);
  for (const group of [...catalog.categories, ...catalog.collections]) if (group.imageUrl) urls.add(group.imageUrl);
  if (settings.store.logoUrl) urls.add(settings.store.logoUrl);
  if (settings.homepage.hero.imageUrl) urls.add(settings.homepage.hero.imageUrl);
  for (const section of settings.homepage.sections) {
    if (section.type === "banner" && section.imageUrl) urls.add(section.imageUrl);
  }
  return urls;
}

/** Of `candidates`, the uploads nothing refers to any more. */
export function orphanedMedia(candidates: string[], catalog: CatalogData, settings: StoreSettings): string[] {
  const used = referencedMedia(catalog, settings);
  return [...new Set(candidates)].filter((url) => !used.has(url) && !url.startsWith("/demo/"));
}
