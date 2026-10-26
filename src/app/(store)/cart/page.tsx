import type { Metadata } from "next";
import { CartPage } from "@/components/store/CartPage";
import { Container } from "@/components/store/HomeSections";
import { getDictionary } from "@/lib/i18n";
import { getStorefront } from "@/server/storefront";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getStorefront();
  return { title: getDictionary(settings.store.language).cart.title, robots: { index: false } };
}

export default async function BagPage() {
  const { settings } = await getStorefront();
  const t = getDictionary(settings.store.language);
  return (
    <Container className="pt-8 sm:pt-12">
      <h1 className="display mb-8 text-[clamp(2rem,5vw,3.4rem)]">{t.cart.title}</h1>
      <CartPage />
    </Container>
  );
}
