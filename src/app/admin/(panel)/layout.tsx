import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { isStaleHandoff } from "@/lib/domain/orders";
import { requireAdmin } from "@/server/admin";
import { backendKind } from "@/server/env";

/** Everything inside the dashboard requires a signed-in admin. */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const [settings, counts, handoffs] = await Promise.all([
    admin.loadSettings(),
    admin.orderStatusCounts(),
    admin.listOrders({ statuses: ["prepared", "opened"], limit: 200, offset: 0 }),
  ]);
  const freshHandoffs = handoffs.orders.filter((order) => !isStaleHandoff(order, new Date())).length;

  return (
    <AdminShell
      storeName={settings.store.name}
      userEmail={admin.user.email}
      backendKind={backendKind()}
      ordersNeedingAttention={counts.received + freshHandoffs}
      preview={admin.preview}
    >
      {children}
    </AdminShell>
  );
}
