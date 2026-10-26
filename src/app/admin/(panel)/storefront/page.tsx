import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { SettingsProvider } from "@/components/admin/settings-kit";
import {
  AnnouncementPanel,
  HeroPanel,
  SectionsPanel,
  ThemePanel,
  type LinkSuggestion,
  type PreviewProduct,
} from "@/components/admin/StorefrontForms";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { formatMoney } from "@/lib/domain/money";
import { primaryImage, priceSummary } from "@/lib/domain/product";
import { moneyFormatOf } from "@/lib/domain/settings";
import { requireAdmin } from "@/server/admin";

export const metadata: Metadata = { title: "Storefront" };

export default async function StorefrontPage() {
  const admin = await requireAdmin();
  const [settings, catalog] = await Promise.all([admin.loadSettings(), admin.loadCatalog()]);
  const bySort = <T extends { sortOrder: number }>(items: T[]) => [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const categories = bySort(catalog.categories.filter((category) => category.visible));
  const collections = bySort(catalog.collections);

  const links: LinkSuggestion[] = [
    { href: "/shop", label: "All products" },
    { href: "/shop?sort=newest", label: "Newest products" },
    { href: "/shop?sale=1", label: "On sale" },
    ...categories.map((category) => ({ href: `/categories/${category.slug}`, label: `Category: ${category.name}` })),
    ...collections
      .filter((collection) => collection.visible)
      .map((collection) => ({ href: `/collections/${collection.slug}`, label: `Collection: ${collection.name}` })),
    { href: "/pages/about", label: "About us" },
    { href: "/pages/contact", label: "Contact" },
  ];

  // The preview shows one of the store's own products: one on sale if there
  // is one, so the accent's sale badge can be seen too.
  const candidates = catalog.products.filter((product) => product.status === "active" && primaryImage(product));
  const pick = candidates.find((product) => priceSummary(product).discount !== null) ?? candidates[0];
  const sample: PreviewProduct | null = pick
    ? {
        name: pick.name,
        price: formatMoney(priceSummary(pick).min, moneyFormatOf(settings)),
        imageUrl: primaryImage(pick)!.url,
        discount: priceSummary(pick).discount,
      }
    : null;

  return (
    <>
      <PageHeader
        title="Storefront"
        description="How your shop looks and what its homepage shows. Each panel saves on its own."
        actions={
          <a href="/" target="_blank" rel="noopener" className={buttonClass({ variant: "outline", size: "sm" })}>
            View shop <ExternalLink size={14} />
          </a>
        }
      />
      <SettingsProvider initial={settings}>
        <div className="space-y-6">
          <ThemePanel storeName={settings.store.name} sample={sample} />
          <AnnouncementPanel links={links} />
          <HeroPanel links={links} />
          <SectionsPanel
            collections={collections.map((collection) => ({ id: collection.id, name: collection.name, slug: collection.slug }))}
            links={links}
          />
        </div>
      </SettingsProvider>
    </>
  );
}
