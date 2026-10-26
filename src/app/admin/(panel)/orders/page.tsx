import { ReceiptText, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChannelBadge, formatRelative, OrderStatusPill, PaymentPill } from "@/components/admin/OrderBits";
import { DiscardStaleButton } from "@/components/admin/OrderListActions";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/admin/ui";
import { formatMoney } from "@/lib/domain/money";
import { isStaleHandoff } from "@/lib/domain/orders";
import type { OrderStatus } from "@/lib/domain/types";
import { requireAdmin } from "@/server/admin";

export const metadata: Metadata = { title: "Orders" };

const VIEWS: { key: string; label: string; statuses?: OrderStatus[] }[] = [
  { key: "new", label: "To confirm", statuses: ["received"] },
  { key: "whatsapp", label: "WhatsApp handoffs", statuses: ["prepared", "opened"] },
  { key: "confirmed", label: "To send", statuses: ["confirmed"] },
  { key: "fulfilled", label: "Sent", statuses: ["fulfilled"] },
  { key: "completed", label: "Completed", statuses: ["completed"] },
  { key: "closed", label: "Cancelled", statuses: ["cancelled", "discarded"] },
  { key: "all", label: "All" },
];

const PAGE_SIZE = 25;

type Props = { searchParams: Promise<{ view?: string; q?: string; page?: string }> };

export default async function OrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const admin = await requireAdmin();
  const view = VIEWS.find((candidate) => candidate.key === params.view) ?? VIEWS[0];
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q?.trim().slice(0, 80) ?? "";

  const [settings, counts, list] = await Promise.all([
    admin.loadSettings(),
    admin.orderStatusCounts(),
    admin.listOrders({ statuses: view.statuses, search, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
  ]);
  const money = { currency: settings.store.currency, locale: "en" };
  const now = new Date();
  const countFor = (statuses?: OrderStatus[]) =>
    statuses ? statuses.reduce((total, status) => total + counts[status], 0) : Object.values(counts).reduce((a, b) => a + b, 0);
  const staleCount =
    view.key === "whatsapp"
      ? (await admin.listOrders({ statuses: ["prepared", "opened"], limit: 1000, offset: 0 })).orders.filter((order) =>
          isStaleHandoff(order, now),
        ).length
      : 0;
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const href = (next: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    const merged = { view: view.key, q: search || undefined, ...next };
    for (const [key, value] of Object.entries(merged)) if (value !== undefined && value !== "") query.set(key, String(value));
    return `/admin/orders?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Orders"
        description="Website orders arrive here as soon as they're placed. WhatsApp orders appear first as unverified handoffs."
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0" aria-label="Order views">
          {VIEWS.map((candidate) => {
            const active = candidate.key === view.key;
            const count = countFor(candidate.statuses);
            return (
              <Link
                key={candidate.key}
                href={href({ view: candidate.key, page: undefined })}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper"
                }`}
              >
                {candidate.label}
                <span className={`price text-xs ${active ? "text-paper/80" : "text-ink-3"}`}>{count}</span>
              </Link>
            );
          })}
        </nav>
        <form className="relative" role="search">
          <input type="hidden" name="view" value={view.key} />
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            name="q"
            defaultValue={search}
            placeholder="Order #, name, phone or email"
            aria-label="Search orders"
            className="h-10 w-full rounded-full border border-line-strong bg-paper pe-4 ps-9 text-sm outline-none focus:border-ink lg:w-72"
          />
        </form>
      </div>

      {view.key === "whatsapp" && (
        <div className="mb-4">
          <Notice
            tone="warning"
            title="Unverified until you see the message"
            action={<DiscardStaleButton count={staleCount} />}
          >
            These shoppers were shown their order as a WhatsApp message. Opening WhatsApp doesn&apos;t prove they sent
            it. When the message arrives in your chats (it starts with the order number), open the order and mark it as
            received.
          </Notice>
        </div>
      )}

      <Panel padded={false}>
        {list.orders.length === 0 ? (
          <EmptyState icon={<ReceiptText size={20} />} title={search ? "No orders match that search" : "Nothing here right now"}>
            {search ? "Try the order number on its own, or part of the customer's name." : "Orders in this state will appear here."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="border-b border-line text-start text-xs text-ink-3">
                <tr>
                  <th scope="col" className="px-5 py-3 text-start font-medium">Order</th>
                  <th scope="col" className="px-3 py-3 text-start font-medium">Customer</th>
                  <th scope="col" className="px-3 py-3 text-start font-medium">Status</th>
                  <th scope="col" className="px-3 py-3 text-start font-medium">Payment</th>
                  <th scope="col" className="px-5 py-3 text-end font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.orders.map((order) => (
                  <tr key={order.id} className="group relative hover:bg-canvas">
                    <td className="px-5 py-3.5 align-top">
                      <Link href={`/admin/orders/${order.id}`} className="font-mono font-semibold after:absolute after:inset-0">
                        #{order.number}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-3">{formatRelative(order.createdAt, now.getTime())}</p>
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <p className="font-medium">{order.customer.name}</p>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-ink-3">
                        <ChannelBadge channel={order.channel} />
                        {order.customer.phone && <span dir="ltr">{order.customer.phone}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <OrderStatusPill status={order.status} />
                      {isStaleHandoff(order, now) && <p className="mt-1 text-xs text-ink-3">Over a week old</p>}
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <PaymentPill order={order} />
                    </td>
                    <td className="px-5 py-3.5 text-end align-top font-mono">{formatMoney(order.total, money, "full")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-ink-3">
            Page {page} of {pages} · {list.total} orders
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={href({ page: page - 1 })} className="rounded-full border border-line-strong bg-paper px-4 py-2 font-medium">
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={href({ page: page + 1 })} className="rounded-full border border-line-strong bg-paper px-4 py-2 font-medium">
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
