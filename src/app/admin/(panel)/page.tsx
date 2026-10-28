import { ArrowRight, Check, CircleDashed, PackageX, ReceiptText, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/icons/brands";
import { ChannelBadge, formatRelative, OrderStatusPill } from "@/components/admin/OrderBits";
import { SalesChart } from "@/components/admin/SalesChart";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { formatMoney, type MoneyFormat } from "@/lib/domain/money";
import { orderMetrics } from "@/lib/domain/orders";
import { stockIssue } from "@/lib/domain/product";
import { DEFAULT_SETTINGS, isWhatsAppConfigured } from "@/lib/domain/settings";
import { requireAdmin } from "@/server/admin";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const admin = await requireAdmin();
  const now = new Date();
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 30);

  const [settings, catalog, recentWindow, recent] = await Promise.all([
    admin.loadSettings(),
    admin.loadCatalog(),
    admin.ordersSince(since.toISOString()),
    admin.listOrders({ limit: 6, offset: 0 }),
  ]);
  // Handoffs and unconfirmed orders older than 30 days still need attention.
  const open = await admin.listOrders({ statuses: ["received", "confirmed", "prepared", "opened"], limit: 500, offset: 0 });
  const metrics = orderMetrics([...recentWindow, ...open.orders.filter((order) => order.createdAt < since.toISOString())], now);
  const money: MoneyFormat = { currency: settings.store.currency, locale: "en" };

  const active = catalog.products.filter((product) => product.status === "active");
  const drafts = catalog.products.filter((product) => product.status === "draft").length;
  const soldOut = active.filter((product) => stockIssue(product) === "sold-out");
  const low = active.filter((product) => stockIssue(product) === "low");
  const demoProducts = catalog.products.filter((product) => product.isDemo).length;
  const ownProducts = catalog.products.length - demoProducts;

  const checklist = [
    { done: settings.store.name !== DEFAULT_SETTINGS.store.name, label: "Name your store and add a logo", href: "/admin/settings#store" },
    {
      done: isWhatsAppConfigured(settings) || Boolean(settings.contact.email || settings.contact.phone),
      label: "Add your WhatsApp number or contact email",
      href: "/admin/settings#contact",
    },
    {
      done: JSON.stringify(settings.shipping.methods) !== JSON.stringify(DEFAULT_SETTINGS.shipping.methods),
      label: "Set your delivery options and prices",
      href: "/admin/settings#delivery",
    },
    { done: ownProducts > 0, label: "Add your first product", href: "/admin/products/new" },
    { done: demoProducts === 0, label: "Remove the demo products when you're ready", href: "/admin/settings#demo" },
  ];
  const remaining = checklist.filter((item) => !item.done).length;

  const attention = [
    {
      count: metrics.toConfirm,
      label: metrics.toConfirm === 1 ? "order to confirm" : "orders to confirm",
      hint: "Website orders and verified WhatsApp orders waiting for you.",
      href: "/admin/orders?view=new",
      icon: <ReceiptText size={20} />,
    },
    {
      count: metrics.handoffsToVerify,
      label: metrics.handoffsToVerify === 1 ? "WhatsApp handoff to check" : "WhatsApp handoffs to check",
      hint: "Shoppers who opened WhatsApp. Match them with your chats.",
      href: "/admin/orders?view=whatsapp",
      icon: <WhatsAppIcon size={19} />,
    },
    {
      count: metrics.toFulfill,
      label: metrics.toFulfill === 1 ? "order to send" : "orders to send",
      hint: "Confirmed and waiting to be shipped or collected.",
      href: "/admin/orders?view=confirmed",
      icon: <Truck size={20} />,
    },
    {
      count: soldOut.length + low.length,
      label: "products low or out of stock",
      hint: soldOut.length > 0 ? `${soldOut.length} sold out, ${low.length} running low.` : `${low.length} running low.`,
      href: "/admin/products?view=stock",
      icon: <PackageX size={20} />,
    },
  ];

  return (
    <>
      <PageHeader
        title={`Hello, ${settings.store.name}`}
        description="What needs doing in your store today."
        actions={
          <Link href="/admin/products/new" className={buttonClass()}>
            Add product
          </Link>
        }
      />

      {demoProducts > 0 && (
        <div className="mb-6">
          <Notice
            tone="info"
            title={`Your store is showing ${demoProducts} demo products`}
            action={
              <Link href="/admin/settings#demo" className="text-sm font-semibold underline underline-offset-4">
                Manage
              </Link>
            }
          >
            They&apos;re here so the shop looks complete while you set up. Remove them all in one click once your own
            products are in.
          </Notice>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {attention.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`group rounded-[14px] border p-5 transition-colors ${
              item.count > 0 ? "border-ink bg-paper" : "border-line bg-paper/60 text-ink-3"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={item.count > 0 ? "text-ink" : "text-ink-3"}>{item.icon}</span>
              <ArrowRight size={16} className="opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="price mt-4 text-3xl font-semibold">{item.count}</p>
            <p className="mt-1 text-sm font-medium">{item.label}</p>
            <p className="mt-1 text-xs text-ink-3">{item.hint}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel
          title="Confirmed sales · last 30 days"
          description="Only orders you confirmed count. WhatsApp handoffs and unconfirmed orders never do."
        >
          <div className="mb-5 flex flex-wrap gap-x-10 gap-y-3">
            <div>
              <p className="price text-3xl font-semibold">{formatMoney(metrics.salesTotal, money, "full")}</p>
              <p className="text-xs text-ink-3">
                {metrics.salesCount} {metrics.salesCount === 1 ? "order" : "orders"}
              </p>
            </div>
            <div>
              <p className="price text-3xl font-semibold text-ink-2">{formatMoney(metrics.paidTotal, money, "full")}</p>
              <p className="text-xs text-ink-3">marked as paid</p>
            </div>
          </div>
          {metrics.salesCount > 0 ? (
            <SalesChart daily={metrics.daily} money={money} />
          ) : (
            <p className="rounded-[10px] bg-canvas px-4 py-6 text-center text-sm text-ink-3">
              No confirmed orders yet. When you confirm an order, it shows up here.
            </p>
          )}
        </Panel>

        {remaining > 0 ? (
          <Panel title="Set up your store" description={`${checklist.length - remaining} of ${checklist.length} done`}>
            <ul className="space-y-1">
              {checklist.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-[10px] px-2 py-2 text-sm hover:bg-canvas"
                  >
                    {item.done ? (
                      <span className="grid size-5 place-items-center rounded-full bg-success text-white">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    ) : (
                      <CircleDashed size={20} className="text-ink-3" />
                    )}
                    <span className={item.done ? "text-ink-3 line-through" : "font-medium"}>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <Panel title="Catalog">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-ink-3">Live products</dt>
                <dd className="price text-2xl font-semibold">{active.length}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Drafts</dt>
                <dd className="price text-2xl font-semibold">{drafts}</dd>
              </div>
            </dl>
          </Panel>
        )}
      </div>

      <Panel
        className="mt-6"
        padded={false}
        title="Latest orders"
        actions={
          <Link href="/admin/orders" className="text-sm font-semibold underline-offset-4 hover:underline">
            All orders
          </Link>
        }
      >
        {recent.orders.length === 0 ? (
          <EmptyState icon={<ReceiptText size={20} />} title="No orders yet">
            Orders placed on your website, and WhatsApp orders customers start, will appear here.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {recent.orders.map((order) => (
              <li key={order.id}>
                <Link href={`/admin/orders/${order.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3.5 hover:bg-canvas sm:grid-cols-[5rem_1fr_auto_auto]">
                  <span className="font-mono text-sm font-semibold">#{order.number}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{order.customer.name}</span>
                    <span className="flex items-center gap-3 text-xs text-ink-3">
                      <ChannelBadge channel={order.channel} /> {formatRelative(order.createdAt, now.getTime())}
                    </span>
                  </span>
                  <span className="hidden sm:block">
                    <OrderStatusPill status={order.status} />
                  </span>
                  <span className="font-mono text-sm">{formatMoney(order.total, money, "full")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
