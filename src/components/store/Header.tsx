import Image from "next/image";
import Link from "next/link";
import type { StoreSettings } from "@/lib/domain/settings";
import type { Category, Collection } from "@/lib/domain/types";
import type { Dictionary } from "@/lib/i18n";
import { CartButton, MobileMenu, SearchButton } from "./HeaderControls";

/**
 * Announcement band, then the header: menu (mobile), wordmark, the first few
 * categories as signage-style navigation, search and the bag.
 */

export function Wordmark({ settings, className = "" }: { settings: StoreSettings; className?: string }) {
  if (settings.store.logoUrl) {
    return (
      <Image
        src={settings.store.logoUrl}
        alt={settings.store.name}
        width={160}
        height={48}
        className={`h-8 w-auto max-w-40 object-contain sm:h-9 ${className}`}
        priority
      />
    );
  }
  return <span className={`display text-[1.35rem] leading-none sm:text-[1.6rem] ${className}`}>{settings.store.name}</span>;
}

export function AnnouncementBar({ settings }: { settings: StoreSettings }) {
  const { announcement } = settings.homepage;
  if (!announcement.enabled || !announcement.text) return null;
  const content = <span className="truncate">{announcement.text}</span>;
  return (
    <div className="bg-accent text-accent-ink">
      <div className="mx-auto flex h-9 max-w-[90rem] items-center justify-center px-4 text-[0.8rem] font-medium tracking-wide">
        {announcement.href ? (
          <Link href={announcement.href} className="flex min-w-0 items-center gap-2 hover:underline">
            {content}
            <span aria-hidden="true" className="flip-rtl">→</span>
          </Link>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

export function Header({
  settings,
  categories,
  collections,
  t,
}: {
  settings: StoreSettings;
  categories: Category[];
  collections: Collection[];
  t: Dictionary;
}) {
  const navCategories = categories.slice(0, 5);
  const primary = [
    { href: "/shop", label: t.nav.allProducts },
    ...categories.map((category) => ({ href: `/categories/${category.slug}`, label: category.name })),
  ];
  const secondary = [
    ...collections.map((collection) => ({ href: `/collections/${collection.slug}`, label: collection.name })),
    { href: "/pages/shipping", label: t.footer.shipping },
    { href: "/pages/returns", label: t.footer.returns },
    { href: "/pages/contact", label: t.footer.contact },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="mx-auto grid h-16 max-w-[90rem] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6 lg:flex lg:justify-between lg:px-8">
        <div className="flex items-center lg:hidden">
          <MobileMenu storeName={settings.store.name} primary={primary} secondary={secondary} />
        </div>
        <Link href="/" className="justify-self-center lg:justify-self-auto" aria-label={settings.store.name}>
          <Wordmark settings={settings} />
        </Link>
        <nav className="hidden min-w-0 flex-1 justify-center lg:flex" aria-label={t.nav.categories}>
          <ul className="flex items-center gap-1">
            <li>
              <Link href="/shop" className="rounded-[var(--radius-pill)] px-3.5 py-2 text-sm font-medium text-ink-2 hover:bg-canvas hover:text-ink">
                {t.nav.shop}
              </Link>
            </li>
            {navCategories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/categories/${category.slug}`}
                  className="whitespace-nowrap rounded-[var(--radius-pill)] px-3.5 py-2 text-sm font-medium text-ink-2 hover:bg-canvas hover:text-ink"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center justify-end gap-0.5">
          <SearchButton />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
