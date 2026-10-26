import type { Metadata } from "next";
import { Listing } from "@/components/store/Listing";
import { getDictionary } from "@/lib/i18n";
import { getStorefront } from "@/server/storefront";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { settings } = await getStorefront();
  const t = getDictionary(settings.store.language);
  const { q } = await searchParams;
  const query = Array.isArray(q) ? q[0] : q;
  return {
    title: query ? t.listing.searchTitle(query) : t.listing.allTitle,
    // Search result pages are endless and thin; keep them out of search engines.
    robots: query ? { index: false, follow: true } : undefined,
    alternates: { canonical: "/shop" },
  };
}

export default async function ShopPage({ searchParams }: Props) {
  const params = await searchParams;
  const { settings } = await getStorefront();
  const t = getDictionary(settings.store.language);
  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  return (
    <Listing
      basePath="/shop"
      searchParams={params}
      title={q ? t.listing.searchTitle(q) : t.listing.allTitle}
    />
  );
}
