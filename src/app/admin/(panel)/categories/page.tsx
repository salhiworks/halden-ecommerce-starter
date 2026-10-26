import type { Metadata } from "next";
import { GroupingManager } from "@/components/admin/GroupingManager";
import { PageHeader } from "@/components/admin/ui";
import { primaryImage } from "@/lib/domain/product";
import { requireAdmin } from "@/server/admin";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const admin = await requireAdmin();
  const catalog = await admin.loadCatalog();
  return (
    <>
      <PageHeader
        title="Categories"
        description="The aisles of your store. They appear in the menu and on the homepage, in this order."
      />
      <GroupingManager
        kind="category"
        items={[...catalog.categories].sort((a, b) => a.sortOrder - b.sortOrder)}
        products={catalog.products.map((product) => ({
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
