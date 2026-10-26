import { ArrowLeft, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WhatsAppIcon } from "@/components/icons/brands";
import { DeleteOrderButton, InternalNote, OrderStatusActions, PaymentStatusControl } from "@/components/admin/OrderActions";
import { ChannelBadge, formatDateTime, OrderStatusPill, PaymentPill } from "@/components/admin/OrderBits";
import { Notice, PageHeader, Panel } from "@/components/admin/ui";
import { formatMoney } from "@/lib/domain/money";
import { ORDER_STATUS_META, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/domain/orders";
import { normalizePhone } from "@/lib/domain/phone";
import type { OrderEvent } from "@/lib/domain/types";
import { whatsappUrl } from "@/lib/domain/whatsapp";
import { requireAdmin } from "@/server/admin";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Order ${(await params).id.slice(0, 8)}` };
}

function describe(event: OrderEvent): string {
  switch (event.kind) {
    case "created":
      return event.note ?? "Order created";
    case "status":
      return `${event.from ? `${ORDER_STATUS_META[event.from as keyof typeof ORDER_STATUS_META]?.label ?? event.from} → ` : ""}${
        ORDER_STATUS_META[event.to as keyof typeof ORDER_STATUS_META]?.label ?? event.to
      }`;
    case "payment":
      return `Payment: ${PAYMENT_STATUS_LABELS[event.to as keyof typeof PAYMENT_STATUS_LABELS] ?? event.to}`;
    case "stock":
      return event.note ?? "Stock updated";
    default:
      return event.note ?? event.kind;
  }
}

export default async function OrderDetailPage({ params }: Props) {
  const admin = await requireAdmin();
  const [order, settings] = await Promise.all([admin.getOrder((await params).id), admin.loadSettings()]);
  if (!order) notFound();
  const money = { currency: order.currency, locale: "en" };
  const meta = ORDER_STATUS_META[order.status];
  const phoneDigits = normalizePhone(order.customer.phone);
  const chatUrl =
    phoneDigits.length >= 8
      ? whatsappUrl(phoneDigits, `Hello ${order.customer.name.split(" ")[0]}, this is ${settings.store.name} about your order #${order.number}.`)
      : null;

  return (
    <>
      <PageHeader
        back={
          <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
            <ArrowLeft size={15} /> Orders
          </Link>
        }
        title={`Order #${order.number}`}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <OrderStatusPill status={order.status} />
            <ChannelBadge channel={order.channel} />
            <span>{formatDateTime(order.createdAt)}</span>
          </span>
        }
      />

      <Panel className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-semibold">{meta.label}</p>
            <p className="mt-1 max-w-2xl text-sm text-ink-2">{meta.description}</p>
          </div>
          <OrderStatusActions order={order} />
        </div>
        {(order.status === "prepared" || order.status === "opened") && (
          <div className="mt-4">
            <Notice tone="warning">
              Look in your WhatsApp chats for a message starting with “<strong>Order #{order.number}</strong>”. Mark it as
              received only once you have it. If it never arrives, discard the handoff.
            </Notice>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel title="Items" padded={false}>
            <ul className="divide-y divide-line">
              {order.items.map((item, index) => (
                <li key={`${item.variantId}-${index}`} className="flex items-center gap-4 px-5 py-4">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-[10px] bg-tile">
                    {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    {item.productId ? (
                      <Link href={`/admin/products/${item.productId}`} className="block truncate font-medium hover:underline">
                        {item.name}
                      </Link>
                    ) : (
                      <span className="block truncate font-medium">{item.name}</span>
                    )}
                    <span className="block text-sm text-ink-3">
                      {[item.variantLabel, `${formatMoney(item.unitPrice, money, "full")} × ${item.quantity}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="font-mono text-sm">{formatMoney(item.lineTotal, money, "full")}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line px-5 py-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-2">Subtotal</dt>
                <dd className="font-mono">{formatMoney(order.subtotal, money, "full")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Delivery{order.shippingMethod ? ` · ${order.shippingMethod.name}` : ""}</dt>
                <dd className="font-mono">{order.shippingFee > 0 ? formatMoney(order.shippingFee, money, "full") : "Free"}</dd>
              </div>
              <div className="flex justify-between pt-1 text-base font-semibold">
                <dt>Total</dt>
                <dd className="font-mono">{formatMoney(order.total, money, "full")}</dd>
              </div>
            </dl>
          </Panel>

          {order.customerNote && (
            <Panel title="Note from the customer">
              <p className="whitespace-pre-wrap text-sm">{order.customerNote}</p>
            </Panel>
          )}

          <Panel title="History">
            <ol className="relative space-y-4 border-s border-line ps-5">
              {[...order.events].reverse().map((event, index) => (
                <li key={`${event.at}-${index}`} className="relative">
                  <span className="absolute -start-[1.6rem] top-1.5 size-2.5 rounded-full border-2 border-paper bg-ink-3" />
                  <p className="text-sm font-medium">{describe(event)}</p>
                  {event.kind === "status" && event.note && <p className="text-sm text-ink-2">“{event.note}”</p>}
                  <p className="text-xs text-ink-3">
                    {formatDateTime(event.at)} · {event.by === "customer" ? "Customer" : event.by}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Customer">
            <p className="font-medium">{order.customer.name}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {order.customer.phone && (
                <li className="flex items-center gap-2">
                  <Phone size={15} className="text-ink-3" />
                  <a href={`tel:${order.customer.phone.replace(/[^\d+]/g, "")}`} className="hover:underline" dir="ltr">
                    {order.customer.phone}
                  </a>
                </li>
              )}
              {order.customer.email && (
                <li className="flex items-center gap-2">
                  <Mail size={15} className="text-ink-3" />
                  <a href={`mailto:${order.customer.email}`} className="truncate hover:underline">
                    {order.customer.email}
                  </a>
                </li>
              )}
            </ul>
            {chatUrl && (
              <a
                href={chatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#127C45] hover:underline"
              >
                <WhatsAppIcon size={16} /> Message on WhatsApp
              </a>
            )}
          </Panel>

          <Panel title="Delivery">
            <p className="text-sm font-medium">{order.shippingMethod?.name ?? "—"}</p>
            {order.address ? (
              <address className="mt-2 text-sm not-italic leading-relaxed text-ink-2">
                {order.address.line1}
                <br />
                {[order.address.postalCode, order.address.city].filter(Boolean).join(" ")}
                {order.address.region && (
                  <>
                    <br />
                    {order.address.region}
                  </>
                )}
                {order.address.country && (
                  <>
                    <br />
                    {order.address.country}
                  </>
                )}
              </address>
            ) : (
              <p className="mt-1 text-sm text-ink-2">No address needed (pickup).</p>
            )}
          </Panel>

          <Panel title="Payment">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
              <PaymentPill order={order} />
            </div>
            <div className="mt-4">
              <PaymentStatusControl order={order} />
            </div>
          </Panel>

          <Panel>
            <InternalNote order={order} />
          </Panel>

          <div className="flex justify-end">
            <DeleteOrderButton order={order} />
          </div>
        </div>
      </div>
    </>
  );
}
