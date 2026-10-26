import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { requireAdmin } from "@/server/admin";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const admin = await requireAdmin();
  const [catalog, settings] = await Promise.all([admin.loadCatalog(), admin.loadSettings()]);
  const product = catalog.products.find((candidate) => candidate.id === id);
  if (!product) notFound();
  return (
    <ProductEditor
      // Remount after a save so the editor starts from the stored version.
      key={product.updatedAt}
      product={product}
      categories={[...catalog.categories].sort((a, b) => a.sortOrder - b.sortOrder)}
      collections={[...catalog.collections].sort((a, b) => a.sortOrder - b.sortOrder)}
      currency={settings.store.currency}
    />
  );
}
