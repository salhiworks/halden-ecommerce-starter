import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Listing } from "@/components/store/Listing";
import { visibleCategories } from "@/lib/domain/catalog-query";
import { getDictionary } from "@/lib/i18n";
import { getStorefront } from "@/server/storefront";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function findCategory(slug: string) {
  const { catalog } = await getStorefront();
  return visibleCategories(catalog).find((category) => category.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await findCategory((await params).slug);
  if (!category) return {};
  return {
    title: category.name,
    description: category.description || undefined,
    alternates: { canonical: `/categories/${category.slug}` },
    openGraph: category.imageUrl ? { images: [{ url: category.imageUrl }] } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const category = await findCategory((await params).slug);
  if (!category) notFound();
  const { settings } = await getStorefront();
  const t = getDictionary(settings.store.language);
  return (
    <Listing
      basePath={`/categories/${category.slug}`}
      searchParams={await searchParams}
      title={category.name}
      description={category.description}
      eyebrow={t.nav.categories}
      scope={{ category }}
    />
  );
}
