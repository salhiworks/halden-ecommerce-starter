import { SearchX } from "lucide-react";
import Link from "next/link";
import {
  facetsFor,
  filterProducts,
  parseProductQuery,
  searchProducts,
  sortProducts,
  storefrontProducts,
  visibleCategories,
  visibleCollections,
} from "@/lib/domain/catalog-query";
import { formatMoney } from "@/lib/domain/money";
import { moneyFormatOf } from "@/lib/domain/settings";
import type { Category, Collection } from "@/lib/domain/types";
import { getDictionary } from "@/lib/i18n";
import { getStorefront } from "@/server/storefront";
import { buttonClass } from "@/components/ui/button";
import { Container } from "./HomeSections";
import { ActiveFilters, ListingControls, SortSelect } from "./ListingControls";
import { ProductGrid } from "./ProductCard";

const PAGE_SIZE = 24;

type SearchParams = Record<string, string | string[] | undefined>;

function hrefWithout(basePath: string, params: SearchParams, remove: (key: string, value: string) => string | null): string {
  const next = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (raw == null || key === "page") continue;
    for (const value of Array.isArray(raw) ? raw : [raw]) {
      const kept = remove(key, value);
      if (kept !== null && kept !== "") next.append(key, kept);
    }
  }
  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export async function Listing({
  basePath,
  searchParams,
  title,
  description,
  eyebrow,
  scope = {},
}: {
  basePath: string;
  searchParams: SearchParams;
  title: string;
  description?: string;
  eyebrow?: string;
  scope?: { category?: Category; collection?: Collection };
}) {
  const { settings, catalog } = await getStorefront();
  const t = getDictionary(settings.store.language);
  const money = moneyFormatOf(settings);
  const query = parseProductQuery(searchParams);
  const categories = visibleCategories(catalog);
  const collections = visibleCollections(catalog);

  if (scope.category) query.category = scope.category.slug;
  if (scope.collection) query.collection = scope.collection.slug;

  // Search first (relevance order), then the scope, then the filters.
  const base = storefrontProducts(catalog);
  const searched = query.q ? searchProducts(base, query.q, categories) : base;
  const scoped = filterProducts(searched, { category: query.category, collection: query.collection }, catalog);
  const facets = facetsFor(scoped);
  const filtered = filterProducts(scoped, { ...query, category: undefined, collection: undefined }, catalog);
  const sorted = query.q && !query.sort ? filtered : sortProducts(filtered, query.sort ?? "featured");

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(pageCount, Math.max(1, Number(searchParams.page) || 1));
  const visible = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* -------------------------------------------------------------- chips */
  const chips: { label: string; href: string }[] = [];
  if (query.q) chips.push({ label: `“${query.q}”`, href: hrefWithout(basePath, searchParams, (key, value) => (key === "q" ? null : value)) });
  if (!scope.category && query.category) {
    const category = catalog.categories.find((candidate) => candidate.slug === query.category);
    chips.push({
      label: category?.name ?? query.category,
      href: hrefWithout(basePath, searchParams, (key, value) => (key === "category" ? null : value)),
    });
  }
  if (query.minPrice != null)
    chips.push({ label: `≥ ${formatMoney(query.minPrice, money)}`, href: hrefWithout(basePath, searchParams, (key, value) => (key === "min" ? null : value)) });
  if (query.maxPrice != null)
    chips.push({ label: `≤ ${formatMoney(query.maxPrice, money)}`, href: hrefWithout(basePath, searchParams, (key, value) => (key === "max" ? null : value)) });
  if (query.inStock)
    chips.push({ label: t.listing.inStockOnly, href: hrefWithout(basePath, searchParams, (key, value) => (key === "stock" ? null : value)) });
  if (query.onSale)
    chips.push({ label: t.listing.onSaleOnly, href: hrefWithout(basePath, searchParams, (key, value) => (key === "sale" ? null : value)) });
  for (const [name, values] of Object.entries(query.options ?? {})) {
    for (const value of values) {
      chips.push({
        label: `${name}: ${value}`,
        href: hrefWithout(basePath, searchParams, (key, raw) =>
          key === `o.${name}`
            ? raw
                .split(",")
                .filter((entry) => entry !== value)
                .join(",")
            : raw,
        ),
      });
    }
  }
  const clearHref = query.q && !scope.category && !scope.collection ? `${basePath}?q=${encodeURIComponent(query.q)}` : basePath;

  /* -------------------------------------------------------- group links */
  const groupLinks = scope.collection
    ? {
        title: t.listing.collection,
        links: collections.map((collection) => ({
          href: `/collections/${collection.slug}`,
          label: collection.name,
          active: collection.id === scope.collection?.id,
        })),
      }
    : {
        title: t.listing.category,
        links: [
          { href: "/shop", label: t.nav.allProducts, active: !scope.category && !query.category },
          ...categories.map((category) => ({
            href: `/categories/${category.slug}`,
            label: category.name,
            active: category.id === scope.category?.id || category.slug === query.category,
          })),
        ],
      };

  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, raw] of Object.entries(searchParams)) {
      if (raw == null || key === "page") continue;
      for (const value of Array.isArray(raw) ? raw : [raw]) next.append(key, value);
    }
    if (target > 1) next.set("page", String(target));
    const text = next.toString();
    return text ? `${basePath}?${text}` : basePath;
  };

  return (
    <Container className="pt-8 sm:pt-12">
      <header className="mb-8 max-w-3xl">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="display text-[clamp(2rem,5vw,3.6rem)]">{title}</h1>
        {description && <p className="mt-4 text-ink-2 sm:text-lg">{description}</p>}
      </header>

      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <ListingControls facets={facets} total={sorted.length} groupLinks={groupLinks} activeCount={chips.length} />

        <div className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-ink-3" aria-live="polite">
              {t.listing.results(sorted.length)}
            </p>
            <div className="hidden lg:block">
              <SortSelect />
            </div>
          </div>
          <div className="mb-6">
            <ActiveFilters chips={chips} clearHref={clearHref} />
          </div>

          {visible.length > 0 ? (
            <ProductGrid products={visible} money={money} t={t} priorityCount={3} columns="wide" />
          ) : (
            <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong px-6 py-16 text-center">
              <SearchX size={28} className="text-ink-3" />
              <p className="mt-4 font-semibold">{t.listing.noResultsTitle}</p>
              <p className="mt-1 text-sm text-ink-2">{t.listing.noResultsText}</p>
              {chips.length > 0 && (
                <Link href={clearHref} className={buttonClass({ variant: "outline", className: "mt-6" })}>
                  {t.listing.clearAll}
                </Link>
              )}
            </div>
          )}

          {pageCount > 1 && (
            <nav className="mt-12 flex items-center justify-center gap-1" aria-label="Pagination">
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((target) => (
                <Link
                  key={target}
                  href={pageHref(target)}
                  aria-current={target === page ? "page" : undefined}
                  className={`price grid size-10 place-items-center rounded-[var(--radius-control)] text-sm ${
                    target === page ? "bg-ink text-paper" : "hover:bg-canvas"
                  }`}
                >
                  {target}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </Container>
  );
}
