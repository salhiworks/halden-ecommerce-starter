import type { Metadata } from "next";
import { CheckoutForm } from "@/components/store/CheckoutForm";
import { DemoNotice } from "@/components/store/Demo";
import { Container } from "@/components/store/HomeSections";
import { getDictionary } from "@/lib/i18n";
import { publicDemoMode } from "@/server/env";
import { issueFormToken } from "@/server/form-token";
import { getStorefront } from "@/server/storefront";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getStorefront();
  return { title: getDictionary(settings.store.language).checkout.title, robots: { index: false } };
}

export default async function CheckoutPage() {
  const { settings } = await getStorefront();
  const t = getDictionary(settings.store.language);
  return (
    <Container className="pt-8 sm:pt-12">
      <h1 className="display mb-10 text-[clamp(2rem,5vw,3.4rem)]">{t.checkout.title}</h1>
      {publicDemoMode() && (
        <div className="-mt-4 mb-10 max-w-3xl">
          <DemoNotice>{t.demo.checkout}</DemoNotice>
        </div>
      )}
      <CheckoutForm formToken={await issueFormToken()} />
    </Container>
  );
}
