import { Package, Search } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { searchProducts } from "@/lib/domain/catalog-query";
import { formatMoney } from "@/lib/domain/money";
import { priceSummary, primaryImage, stockIssue, totalStock } from "@/lib/domain/product";
import type { Product } from "@/lib/domain/types";
import { requireAdmin } from "@/server/admin";

export const metadata: Metadata = { title: "Products" };

const VIEWS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Drafts" },
  { key: "archived", label: "Archived" },
  { key: "stock", label: "Low or out of stock" },
] as const;

type Props = { searchParams: Promise<{ view?: string; q?: string }> };

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const admin = await requireAdmin();
  const [catalog, settings] = await Promise.all([admin.loadCatalog(), admin.loadSettings()]);
  const money = { currency: settings.store.currency, locale: "en" };
  const view = VIEWS.find((candidate) => candidate.key === params.view) ?? VIEWS[0];
  const query = params.q?.trim() ?? "";
  const categoryName = new Map(catalog.categories.map((category) => [category.id, category.name]));

  const inView = (product: Product) =>
    view.key === "all" ? true : view.key === "stock" ? product.status === "active" && stockIssue(product) !== null : product.status === view.key;
  const base = catalog.products.filter(inView);
  const products = query
    ? searchProducts(base, query, catalog.categories)
    : [...base].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const counts = Object.fromEntries(
    VIEWS.map((candidate) => [
      candidate.key,
      catalog.products.filter((product) =>
        candidate.key === "all"
          ? true
          : candidate.key === "stock"
            ? product.status === "active" && stockIssue(product) !== null
            : product.status === candidate.key,
      ).length,
    ]),
  );

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you sell. Changes appear in the store as soon as you save."
        actions={
          <Link href="/admin/products/new" className={buttonClass()} data-testid="new-product">
            Add product
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0" aria-label="Product views">
          {VIEWS.map((candidate) => (
            <Link
              key={candidate.key}
              href={`/admin/products?view=${candidate.key}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              aria-current={candidate.key === view.key ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium ${
                candidate.key === view.key ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper"
              }`}
            >
              {candidate.label}
              <span className={`price text-xs ${candidate.key === view.key ? "text-paper/80" : "text-ink-3"}`}>{counts[candidate.key]}</span>
            </Link>
          ))}
        </nav>
        <form className="relative" role="search">
          <input type="hidden" name="view" value={view.key} />
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Name, SKU or keyword"
            aria-label="Search products"
            className="h-10 w-full rounded-full border border-line-strong bg-paper pe-4 ps-9 text-sm outline-none focus:border-ink lg:w-72"
          />
        </form>
      </div>

      <Panel padded={false}>
        {products.length === 0 ? (
          <EmptyState
            icon={<Package size={20} />}
            title={catalog.products.length === 0 ? "Add your first product" : "No products here"}
            action={
              catalog.products.length === 0 ? (
                <Link href="/admin/products/new" className={buttonClass()}>
                  Add product
                </Link>
              ) : undefined
            }
          >
            {catalog.products.length === 0
              ? "Give it a name, a price and a photo — it's live in your store the moment you save."
              : query
                ? "Nothing matches that search."
                : "Products in this state will appear here."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {products.map((product) => {
              const image = primaryImage(product);
              const price = priceSummary(product);
              const stock = totalStock(product);
              return (
                <li key={product.id}>
                  <Link href={`/admin/products/${product.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-canvas">
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-[10px] bg-tile">
                      {image && <Image src={image.url} alt="" fill sizes="56px" className="object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{product.name}</span>
                        {product.isDemo && <Pill tone="muted">Demo</Pill>}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-3">
                        {[
                          categoryName.get(product.categoryId ?? "") ?? "No category",
                          product.variants.length > 1 ? `${product.variants.length} variants` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="hidden w-40 text-sm sm:block">
                      {stock === null ? (
                        <span className="text-ink-3">Stock not tracked</span>
                      ) : stock === 0 ? (
                        <span className="font-medium text-danger">Sold out</span>
                      ) : (
                        <span className={stockIssue(product) !== null ? "font-medium text-warning" : ""}>{stock} in stock</span>
                      )}
                    </span>
                    <span className="hidden w-24 md:block">
                      <Pill tone={product.status === "active" ? "success" : product.status === "draft" ? "neutral" : "muted"}>
                        {product.status === "active" ? "Active" : product.status === "draft" ? "Draft" : "Archived"}
                      </Pill>
                    </span>
                    <span className="w-24 text-end font-mono text-sm">
                      {price.varies ? `from ${formatMoney(price.min, money)}` : formatMoney(price.min, money)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
