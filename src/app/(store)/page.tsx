import Link from "next/link";
import { Directory } from "@/components/store/Directory";
import {
  Banner,
  CollectionCards,
  Container,
  Hero,
  Highlights,
  ProductRow,
} from "@/components/store/HomeSections";
import { buttonClass } from "@/components/ui/button";
import {
  sortProducts,
  storefrontProducts,
  visibleCategories,
  visibleCollections,
} from "@/lib/domain/catalog-query";
import { isOnSale } from "@/lib/domain/product";
import { moneyFormatOf, type HomepageSection } from "@/lib/domain/settings";
import type { Product } from "@/lib/domain/types";
import { getDictionary } from "@/lib/i18n";
import { getStorefront } from "@/server/storefront";

/**
 * The homepage is assembled from the sections the owner arranged in
 * Dashboard → Storefront. Each section quietly disappears when it has
 * nothing to show (a collection that was deleted, no products on sale…),
 * so a half-configured store never shows an empty frame.
 */
export default async function HomePage() {
  const { settings, catalog } = await getStorefront();
  const t = getDictionary(settings.store.language);
  const money = moneyFormatOf(settings);
  const products = storefrontProducts(catalog);
  const categories = visibleCategories(catalog);
  const collections = visibleCollections(catalog);

  if (products.length === 0) {
    return (
      <>
        <Hero settings={settings} />
        <Container className="py-24">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="display text-3xl">{t.home.emptyStoreTitle}</h2>
            <p className="mt-4 text-ink-2">{t.home.emptyStoreText}</p>
            <Link href="/pages/contact" className={buttonClass({ variant: "outline", className: "mt-8" })}>
              {t.nav.contact}
            </Link>
          </div>
        </Container>
      </>
    );
  }

  const countFor = (predicate: (product: Product) => boolean) => products.filter(predicate).length;

  function productsFor(section: Extract<HomepageSection, { type: "products" }>): {
    list: Product[];
    href: string;
  } {
    switch (section.source) {
      case "new":
        return { list: sortProducts(products, "newest").slice(0, section.limit), href: "/shop?sort=newest" };
      case "sale":
        return { list: sortProducts(products.filter(isOnSale)).slice(0, section.limit), href: "/shop?sale=1" };
      case "collection": {
        const collection = collections.find((candidate) => candidate.id === section.collectionId);
        if (!collection) return { list: [], href: "/shop" };
        return {
          list: sortProducts(products.filter((product) => product.collectionIds.includes(collection.id))).slice(
            0,
            section.limit,
          ),
          href: `/collections/${collection.slug}`,
        };
      }
      case "featured":
      default: {
        const featured = products.filter((product) => product.featured);
        const list = sortProducts(featured.length > 0 ? featured : products).slice(0, section.limit);
        return { list, href: "/shop" };
      }
    }
  }

  return (
    <>
      <Hero settings={settings} />
      {settings.homepage.sections
        .filter((section) => section.enabled)
        .map((section) => {
          switch (section.type) {
            case "categories":
              return categories.length > 0 ? (
                <section key={section.id} className="mt-20 sm:mt-28">
                  <Container>
                    <div className="mb-6 flex items-end justify-between gap-6">
                      <h2 className="eyebrow">{section.title || t.home.directoryTitle}</h2>
                      <Link href="/shop" className="text-sm font-semibold underline-offset-4 hover:underline">
                        {t.nav.allProducts}
                      </Link>
                    </div>
                    <Directory
                      entries={categories.map((category) => ({
                        href: `/categories/${category.slug}`,
                        name: category.name,
                        countLabel: t.common.products(countFor((product) => product.categoryId === category.id)),
                        imageUrl: category.imageUrl,
                      }))}
                    />
                  </Container>
                </section>
              ) : null;
            case "products": {
              const { list, href } = productsFor(section);
              return (
                <ProductRow
                  key={section.id}
                  title={section.title}
                  products={list}
                  money={money}
                  t={t}
                  action={{ href, label: t.common.viewAll }}
                />
              );
            }
            case "banner":
              return <Banner key={section.id} section={section} />;
            case "collections":
              return (
                <CollectionCards
                  key={section.id}
                  title={section.title}
                  collections={collections}
                  counts={
                    new Map(
                      collections.map((collection) => [
                        collection.id,
                        countFor((product) => product.collectionIds.includes(collection.id)),
                      ]),
                    )
                  }
                  t={t}
                />
              );
            case "highlights":
              return <Highlights key={section.id} settings={settings} t={t} />;
            default:
              return null;
          }
        })}
    </>
  );
}
