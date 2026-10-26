import type { Metadata } from "next";
import {
  AccountPanel,
  CheckoutPanel,
  ContactPanel,
  DeliveryPanel,
  DemoPanel,
  PoliciesPanel,
  SocialPanel,
  StorePanel,
} from "@/components/admin/SettingsForms";
import { SettingsProvider } from "@/components/admin/settings-kit";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/server/admin";
import { getBackend } from "@/server/backend";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  { id: "store", label: "Store" },
  { id: "contact", label: "Contact and WhatsApp" },
  { id: "checkout", label: "Checkout and payment" },
  { id: "delivery", label: "Delivery" },
  { id: "pages", label: "Pages" },
  { id: "social", label: "Social links" },
  { id: "demo", label: "Demo content" },
  { id: "account", label: "Your account" },
];

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const [settings, catalog] = await Promise.all([admin.loadSettings(), admin.loadCatalog()]);
  const counts = {
    products: catalog.products.filter((product) => product.isDemo).length,
    categories: catalog.categories.filter((category) => category.isDemo).length,
    collections: catalog.collections.filter((collection) => collection.isDemo).length,
  };

  return (
    <>
      <PageHeader title="Settings" description="Each panel saves on its own. Changes are live in the shop as soon as you save." />
      <div className="grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-24 space-y-0.5 text-sm">
            {SECTIONS.filter((section) => !admin.preview || section.id !== "account").map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="block rounded-[8px] px-3 py-2 text-ink-2 hover:bg-paper hover:text-ink">
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <SettingsProvider initial={settings}>
          <div className="min-w-0 space-y-6">
            <StorePanel />
            <ContactPanel />
            <CheckoutPanel />
            <DeliveryPanel />
            <PoliciesPanel />
            <SocialPanel />
            <DemoPanel counts={counts} preview={admin.preview} />
            {!admin.preview && <AccountPanel email={admin.user.email} backend={getBackend().kind} />}
          </div>
        </SettingsProvider>
      </div>
    </>
  );
}
