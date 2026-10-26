import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Listing } from "@/components/store/Listing";
import { visibleCollections } from "@/lib/domain/catalog-query";
import { getDictionary } from "@/lib/i18n";
import { getStorefront } from "@/server/storefront";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function findCollection(slug: string) {
  const { catalog } = await getStorefront();
  return visibleCollections(catalog).find((collection) => collection.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const collection = await findCollection((await params).slug);
  if (!collection) return {};
  return {
    title: collection.name,
    description: collection.description || undefined,
    alternates: { canonical: `/collections/${collection.slug}` },
    openGraph: collection.imageUrl ? { images: [{ url: collection.imageUrl }] } : undefined,
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const collection = await findCollection((await params).slug);
  if (!collection) notFound();
  const { settings } = await getStorefront();
  const t = getDictionary(settings.store.language);
  return (
    <Listing
      basePath={`/collections/${collection.slug}`}
      searchParams={await searchParams}
      title={collection.name}
      description={collection.description}
      eyebrow={t.nav.collections}
      scope={{ collection }}
    />
  );
}
