import type { MetadataRoute } from "next";
import { siteOrigin } from "@/server/request";
import { getStorefront } from "@/server/storefront";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { settings } = await getStorefront();
  const origin = await siteOrigin(settings);
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/cart", "/checkout", "/orders"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
