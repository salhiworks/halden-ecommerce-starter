import type { Metadata } from "next";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { requireAdmin } from "@/server/admin";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const admin = await requireAdmin();
  const [catalog, settings] = await Promise.all([admin.loadCatalog(), admin.loadSettings()]);
  return (
    <ProductEditor
      product={null}
      categories={[...catalog.categories].sort((a, b) => a.sortOrder - b.sortOrder)}
      collections={[...catalog.collections].sort((a, b) => a.sortOrder - b.sortOrder)}
      currency={settings.store.currency}
    />
  );
}
