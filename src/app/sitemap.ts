import type { MetadataRoute } from "next";
import { storefrontProducts, visibleCategories, visibleCollections } from "@/lib/domain/catalog-query";
import { siteOrigin } from "@/server/request";
import { getStorefront } from "@/server/storefront";

/** Built from the live catalog, so new products appear without a rebuild. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { settings, catalog } = await getStorefront();
  const origin = await siteOrigin(settings);
  const latest = catalog.products.reduce((max, product) => (product.updatedAt > max ? product.updatedAt : max), "");

  return [
    { url: `${origin}/`, lastModified: latest || undefined, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/shop`, lastModified: latest || undefined, changeFrequency: "daily", priority: 0.9 },
    ...visibleCategories(catalog).map((category) => ({
      url: `${origin}/categories/${category.slug}`,
      lastModified: category.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...visibleCollections(catalog).map((collection) => ({
      url: `${origin}/collections/${collection.slug}`,
      lastModified: collection.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...storefrontProducts(catalog).map((product) => ({
      url: `${origin}/products/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      images: product.images.slice(0, 1).map((image) => new URL(image.url, origin).toString()),
    })),
    ...["about", "shipping", "returns", "privacy", "contact"].map((page) => ({
      url: `${origin}/pages/${page}`,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];
}
