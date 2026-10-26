import Link from "next/link";
import { Container } from "@/components/store/HomeSections";
import { buttonClass } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";
import { getStorefront } from "@/server/storefront";

export default async function NotFound() {
  let language: Parameters<typeof getDictionary>[0] = "en";
  try {
    language = (await getStorefront()).settings.store.language;
  } catch {
    // The layout already handles a store that cannot load.
  }
  const t = getDictionary(language);
  return (
    <Container className="py-24 text-center sm:py-32">
      <p className="price text-6xl font-bold text-line-strong sm:text-8xl">404</p>
      <h1 className="display mt-6 text-[clamp(1.8rem,4vw,2.8rem)]">{t.notFound.title}</h1>
      <p className="mt-4 text-ink-2">{t.notFound.text}</p>
      <Link href="/shop" className={buttonClass({ variant: "dark", className: "mt-8" })}>
        {t.notFound.cta}
      </Link>
    </Container>
  );
}
