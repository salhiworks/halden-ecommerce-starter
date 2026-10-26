import Link from "next/link";
import { Container } from "@/components/store/HomeSections";
import { buttonClass } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";
import { getStorefront } from "@/server/storefront";

/** A wrong, old or mistyped order link: said plainly, with a 404 status. */
export default async function OrderNotFound() {
  const { settings } = await getStorefront();
  const t = getDictionary(settings.store.language);
  return (
    <Container className="py-24 text-center">
      <h1 className="display text-3xl">{t.order.notFoundTitle}</h1>
      <p className="mt-4 text-ink-2">{t.order.notFoundText}</p>
      <Link href="/shop" className={buttonClass({ variant: "dark", className: "mt-8" })}>
        {t.common.continueShopping}
      </Link>
    </Container>
  );
}
