import { ArrowRight, Banknote, Landmark, Store, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { WhatsAppIcon } from "@/components/icons/brands";
import { buttonClass } from "@/components/ui/button";
import { formatMoney, type MoneyFormat } from "@/lib/domain/money";
import { enabledCheckoutMethods, type HomepageSection, type StoreSettings } from "@/lib/domain/settings";
import type { Collection, Product } from "@/lib/domain/types";
import type { Dictionary } from "@/lib/i18n";
import { ProductCard } from "./ProductCard";

/* -------------------------------------------------------------- frames */

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-7 flex items-end justify-between gap-6">
      <h2 className="display text-[clamp(1.5rem,3vw,2.25rem)]">{title}</h2>
      {action && (
        <Link href={action.href} className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold">
          {action.label}
          <ArrowRight size={16} className="flip-rtl transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- hero */

export function Hero({ settings }: { settings: StoreSettings }) {
  const hero = settings.homepage.hero;
  if (!hero.enabled) return null;
  const hasImage = Boolean(hero.imageUrl);
  return (
    <section className="pt-4 sm:pt-6">
      <Container>
        <div className={`grid items-stretch gap-6 lg:gap-10 ${hasImage ? "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : ""}`}>
          <div className={`flex flex-col justify-center py-6 lg:py-14 ${hasImage ? "order-2 lg:order-1" : "max-w-4xl py-16"}`}>
            {hero.eyebrow && <p className="eyebrow mb-5">{hero.eyebrow}</p>}
            <h1 className="display text-[clamp(2.3rem,5vw,4.6rem)] text-balance">{hero.heading}</h1>
            {hero.text && <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-2 sm:text-lg">{hero.text}</p>}
            {(hero.primaryLabel || hero.secondaryLabel) && (
              <div className="mt-9 flex flex-wrap items-center gap-3">
                {hero.primaryLabel && hero.primaryHref && (
                  <Link href={hero.primaryHref} className={buttonClass({ size: "lg" })}>
                    {hero.primaryLabel}
                  </Link>
                )}
                {hero.secondaryLabel && hero.secondaryHref && (
                  <Link href={hero.secondaryHref} className={buttonClass({ size: "lg", variant: "outline" })}>
                    {hero.secondaryLabel}
                  </Link>
                )}
              </div>
            )}
          </div>
          {hasImage && (
            <div className="relative order-1 aspect-[4/3] overflow-hidden rounded-card bg-tile sm:aspect-[16/10] lg:order-2 lg:aspect-auto lg:min-h-[34rem]">
              <Image
                src={hero.imageUrl}
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="object-cover"
              />
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}

/* --------------------------------------------------------- product rows */

export function ProductRow({
  title,
  products,
  money,
  t,
  action,
}: {
  title: string;
  products: Product[];
  money: MoneyFormat;
  t: Dictionary;
  action?: { href: string; label: string };
}) {
  if (products.length === 0) return null;
  return (
    <section className="mt-20 sm:mt-24">
      <Container>
        <SectionHeader title={title} action={action} />
      </Container>
      {/* A swipeable rail on phones, a grid from tablets up. */}
      <ul className="scrollbar-none relative flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-6 lg:mx-auto lg:max-w-[90rem] lg:grid-cols-4 lg:px-8">
        {products.map((product) => (
          <li key={product.id} className="w-[68vw] max-w-72 shrink-0 snap-start sm:w-auto sm:max-w-none">
            <ProductCard product={product} money={money} t={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------------- banner */

export function Banner({ section }: { section: Extract<HomepageSection, { type: "banner" }> }) {
  if (!section.heading && !section.imageUrl) return null;
  const end = section.align === "end";
  return (
    <section className="mt-20 sm:mt-24">
      <Container>
        <div className="relative overflow-hidden rounded-card bg-ink">
          {section.imageUrl && (
            <div className="relative aspect-[4/3] sm:aspect-[2/1] lg:aspect-[2.4/1]">
              <Image src={section.imageUrl} alt="" fill sizes="(min-width: 1440px) 1376px, 100vw" className="object-cover" />
            </div>
          )}
          <div
            className={`bg-paper p-6 sm:absolute sm:bottom-6 sm:max-w-md sm:rounded-[calc(var(--radius-card)*0.8)] sm:p-8 ${
              end ? "sm:end-6" : "sm:start-6"
            } ${section.imageUrl ? "" : "sm:static sm:max-w-none"}`}
          >
            {section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}
            {section.heading && <h2 className="display mt-3 text-[clamp(1.6rem,3vw,2.4rem)]">{section.heading}</h2>}
            {section.text && <p className="mt-3 text-sm leading-relaxed text-ink-2 sm:text-base">{section.text}</p>}
            {section.linkLabel && section.linkHref && (
              <Link href={section.linkHref} className={buttonClass({ variant: "dark", className: "mt-6" })}>
                {section.linkLabel}
                <ArrowRight size={16} className="flip-rtl" />
              </Link>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------- collections */

export function CollectionCards({
  title,
  collections,
  counts,
  t,
}: {
  title: string;
  collections: Collection[];
  counts: Map<string, number>;
  t: Dictionary;
}) {
  if (collections.length === 0) return null;
  return (
    <section className="mt-20 sm:mt-24">
      <Container>
        <SectionHeader title={title || t.home.collectionsTitle} />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
          {collections.map((collection) => (
            <li key={collection.id}>
              <Link href={`/collections/${collection.slug}`} className="group block">
                <div className="relative aspect-[3/2] overflow-hidden rounded-card bg-tile">
                  {collection.imageUrl && (
                    <Image
                      src={collection.imageUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  )}
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-4">
                  <h3 className="font-semibold group-hover:underline">{collection.name}</h3>
                  <span className="price text-sm text-ink-3">{t.common.products(counts.get(collection.id) ?? 0)}</span>
                </div>
                {collection.description && <p className="mt-1 text-sm text-ink-2">{collection.description}</p>}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------- highlights */

/**
 * Promises the store actually keeps, derived from its settings — change the
 * delivery threshold or switch off cash on delivery and this follows.
 */
export function Highlights({ settings, t }: { settings: StoreSettings; t: Dictionary }) {
  const money: MoneyFormat = { currency: settings.store.currency, locale: settings.store.language === "ar" ? "ar-u-nu-latn" : settings.store.language };
  const items: { icon: ReactNode; title: string; text: string }[] = [];
  const { freeShippingThreshold, methods, areas } = settings.shipping;
  const paid = methods.filter((method) => method.price > 0);

  if (freeShippingThreshold) {
    items.push({
      icon: <Truck size={22} strokeWidth={1.6} />,
      title: t.highlights.freeShippingOver(formatMoney(freeShippingThreshold, money)),
      text: t.highlights.freeShippingOverText,
    });
  } else if (paid.length > 0) {
    items.push({
      icon: <Truck size={22} strokeWidth={1.6} />,
      title: t.highlights.deliveryFrom(formatMoney(Math.min(...paid.map((method) => method.price)), money)),
      text: t.highlights.deliveryText(areas),
    });
  }
  if (methods.some((method) => !method.requiresAddress && method.price === 0)) {
    items.push({ icon: <Store size={22} strokeWidth={1.6} />, title: t.highlights.pickup, text: t.highlights.pickupText });
  }
  for (const method of enabledCheckoutMethods(settings)) {
    if (method === "cod") items.push({ icon: <Banknote size={22} strokeWidth={1.6} />, title: t.highlights.cod, text: t.highlights.codText });
    if (method === "bank_transfer") items.push({ icon: <Landmark size={22} strokeWidth={1.6} />, title: t.highlights.bank, text: t.highlights.bankText });
    if (method === "whatsapp") items.push({ icon: <WhatsAppIcon size={21} />, title: t.highlights.whatsapp, text: t.highlights.whatsappText });
  }
  if (items.length === 0) return null;

  return (
    <section className="mt-20 sm:mt-24">
      <Container>
        <ul className="grid overflow-hidden rounded-card border border-line sm:grid-cols-2 lg:grid-cols-4">
          {items.slice(0, 4).map((item) => (
            <li
              key={item.title}
              className="flex gap-4 border-b border-line bg-canvas p-6 last:border-b-0 sm:[&:nth-child(odd)]:border-e lg:border-b-0 lg:border-e lg:last:border-e-0"
            >
              <span className="mt-0.5 text-ink">{item.icon}</span>
              <div>
                <p className="font-semibold leading-snug">{item.title}</p>
                <p className="mt-1 text-sm text-ink-2">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
