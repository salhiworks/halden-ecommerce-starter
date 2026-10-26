import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "../globals.css";
import { fontVariables } from "../fonts";
import { CartDrawer } from "@/components/store/CartDrawer";
import { DemoBar } from "@/components/store/Demo";
import { Footer } from "@/components/store/Footer";
import { AnnouncementBar, Header } from "@/components/store/Header";
import { StoreProvider } from "@/components/store/StoreProvider";
import { visibleCategories, visibleCollections } from "@/lib/domain/catalog-query";
import { directionOf, getDictionary } from "@/lib/i18n";
import { publicConfigOf } from "@/lib/public-config";
import { themeStyle } from "@/lib/theme";
import { publicDemoMode } from "@/server/env";
import { siteOrigin } from "@/server/request";
import { getStorefront } from "@/server/storefront";

/**
 * Every storefront page renders at request time from live data, so dashboard
 * changes appear without a rebuild. It also means no HTML page is ever
 * cached by a CDN as a static file — which is what lets a redeploy on hosts
 * whose CDN does not purge (Hostinger among them) never serve a page that
 * points at the previous build's assets.
 */
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { settings } = await getStorefront();
    const origin = await siteOrigin(settings);
    const name = settings.store.name;
    const description = settings.store.description || settings.store.tagline || undefined;
    return {
      metadataBase: new URL(origin),
      title: { default: settings.store.tagline ? `${name} — ${settings.store.tagline}` : name, template: `%s · ${name}` },
      description,
      applicationName: name,
      openGraph: {
        type: "website",
        siteName: name,
        title: name,
        description,
        images: settings.homepage.hero.imageUrl ? [{ url: settings.homepage.hero.imageUrl }] : undefined,
      },
      twitter: { card: "summary_large_image" },
    };
  } catch {
    return { title: "Store" };
  }
}

export default async function StoreLayout({ children }: { children: ReactNode }) {
  let data;
  try {
    data = await getStorefront();
  } catch (error) {
    console.error("[storefront] could not load the store:", error);
    return <SetupNeeded />;
  }

  const { settings, catalog } = data;
  const language = settings.store.language;
  const t = getDictionary(language);
  const categories = visibleCategories(catalog);
  const collections = visibleCollections(catalog);
  const hasDemoContent = catalog.products.some((product) => product.isDemo && product.status === "active");

  return (
    <html
      lang={language}
      dir={directionOf(language)}
      data-pairing={settings.theme.fontPairing}
      className={fontVariables}
      style={themeStyle(settings.theme) as React.CSSProperties}
    >
      <body className="flex min-h-dvh flex-col">
        <StoreProvider config={publicConfigOf(settings)}>
          <a
            href="#main"
            className="sr-only z-50 rounded-[var(--radius-control)] bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
          >
            {t.common.skipToContent}
          </a>
          {publicDemoMode() && <DemoBar storeName={settings.store.name} t={t} />}
          <AnnouncementBar settings={settings} />
          <Header settings={settings} categories={categories} collections={collections} t={t} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer settings={settings} categories={categories} t={t} hasDemoContent={hasDemoContent} />
          <CartDrawer />
        </StoreProvider>
      </body>
    </html>
  );
}

/** Shown instead of a crash when the database cannot be reached. */
function SetupNeeded() {
  return (
    <html lang="en" className={fontVariables}>
      <body className="grid min-h-dvh place-items-center bg-canvas p-6">
        <main className="max-w-md rounded-[14px] border border-line bg-paper p-8">
          <p className="eyebrow">Store not connected</p>
          <h1 className="mt-3 text-2xl font-semibold">The store can&apos;t reach its database</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            If you&apos;re the owner, open the dashboard to see what&apos;s missing — usually a Supabase key in the
            environment variables, or the database setup script that hasn&apos;t been run yet.
          </p>
          <Link href="/admin" className="mt-6 inline-block text-sm font-semibold underline underline-offset-4">
            Open the dashboard
          </Link>
        </main>
      </body>
    </html>
  );
}
