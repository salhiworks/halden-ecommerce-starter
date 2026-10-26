import type { Metadata } from "next";
import { GroupingManager } from "@/components/admin/GroupingManager";
import { PageHeader } from "@/components/admin/ui";
import { primaryImage } from "@/lib/domain/product";
import { requireAdmin } from "@/server/admin";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const admin = await requireAdmin();
  const catalog = await admin.loadCatalog();
  return (
    <>
      <PageHeader
        title="Collections"
        description="Hand-picked groups of products from any category — a gift guide, a sale, your best sellers. Add one to the homepage in Storefront."
      />
      <GroupingManager
        kind="collection"
        items={[...catalog.collections].sort((a, b) => a.sortOrder - b.sortOrder)}
        products={catalog.products
          .map((product) => ({
            id: product.id,
            name: product.name,
            imageUrl: primaryImage(product)?.url ?? null,
            status: product.status,
            categoryId: product.categoryId,
            collectionIds: product.collectionIds,
          }))}
      />
    </>
  );
}
