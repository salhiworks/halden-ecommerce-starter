import { CircleAlert, CircleCheck, Clock, PackageCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WhatsAppIcon } from "@/components/icons/brands";
import { DemoNotice } from "@/components/store/Demo";
import { Container } from "@/components/store/HomeSections";
import { Receipt, ReceiptLine, ReceiptRule } from "@/components/store/Receipt";
import { RichText } from "@/components/store/RichText";
import { WhatsAppHandoff } from "@/components/store/WhatsAppHandoff";
import { formatMoney } from "@/lib/domain/money";
import { isWhatsAppHandoff } from "@/lib/domain/orders";
import { isWhatsAppConfigured, moneyFormatOf } from "@/lib/domain/settings";
import type { Order } from "@/lib/domain/types";
import { buildOrderMessage, whatsappUrl } from "@/lib/domain/whatsapp";
import { getDictionary, intlLocaleOf } from "@/lib/i18n";
import { getBackend } from "@/server/backend";
import { sha256 } from "@/server/crypto";
import { publicDemoMode } from "@/server/env";
import { getStorefront } from "@/server/storefront";

/**
 * A shopper's own order, reachable only through the secret link they were
 * given at checkout (the store keeps just a hash of it). No account needed —
 * bookmark the page to follow the order.
 */

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string | string[] }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[A-Za-z0-9_-]{20,128}$/;

async function findOrder(id: string, key: string | undefined): Promise<Order | null> {
  if (!UUID.test(id) || !key || !KEY.test(key)) return null;
  try {
    return await getBackend().public.findCustomerOrder(id, sha256(key));
  } catch {
    return null;
  }
}

const STEPS = ["received", "confirmed", "fulfilled", "completed"] as const;

export default async function OrderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const rawKey = (await searchParams).key;
  const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
  const { settings } = await getStorefront();
  const t = getDictionary(settings.store.language);
  const money = moneyFormatOf(settings);
  const order = await findOrder(id, key);

  // A wrong or incomplete link gets the same answer as no order at all.
  if (!order || !key) notFound();

  const demoNotice = publicDemoMode() ? (
    <div className="mb-6">
      <DemoNotice>{t.demo.order}</DemoNotice>
    </div>
  ) : null;
  const configured = isWhatsAppConfigured(settings);
  const handoff = isWhatsAppHandoff(order);
  const placed = new Intl.DateTimeFormat(intlLocaleOf(settings.store.language), {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(order.createdAt));

  const contactUrl = configured
    ? whatsappUrl(settings.contact.whatsapp, `${t.order.number(order.number)} — `)
    : null;

  const receipt = (
    <Receipt title={t.order.itemsTitle}>
      {order.items.map((item, index) => (
        <ReceiptLine
          key={`${item.variantId}-${index}`}
          label={`${item.quantity} × ${item.name}`}
          detail={item.variantLabel || undefined}
          amount={formatMoney(item.lineTotal, money, "full")}
        />
      ))}
      <ReceiptRule />
      <ReceiptLine label={t.cart.subtotal} amount={formatMoney(order.subtotal, money, "full")} />
      <ReceiptLine
        label={order.shippingMethod ? `${t.cart.shipping} · ${order.shippingMethod.name}` : t.cart.shipping}
        amount={order.shippingFee > 0 ? formatMoney(order.shippingFee, money, "full") : t.checkout.free}
      />
      <ReceiptRule />
      <ReceiptLine label={t.cart.total} amount={formatMoney(order.total, money, "full")} strong />
    </Receipt>
  );

  if (handoff) {
    const message = buildOrderMessage(order, { storeName: settings.store.name, money, labels: t.whatsapp });
    return (
      <Container className="pt-8 sm:pt-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
          <div>
            {demoNotice}
            <p className="eyebrow">{t.order.number(order.number)}</p>
            <h1 className="display mt-3 text-[clamp(1.9rem,4.5vw,3rem)]">
              {configured ? t.order.whatsappReadyTitle : t.order.whatsappDemoTitle}
            </h1>
            <p className="mt-4 max-w-2xl text-ink-2">
              {configured ? t.order.whatsappReadyText : t.order.whatsappDemoText}
            </p>
            <div className="mt-8">
              <WhatsAppHandoff
                url={configured ? whatsappUrl(settings.contact.whatsapp, message) : null}
                message={message}
                orderId={order.id}
                accessKey={key}
              />
            </div>
          </div>
          <div className="lg:pt-10">{receipt}</div>
        </div>
      </Container>
    );
  }

  const stepIndex = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  const cancelled = order.status === "cancelled" || order.status === "discarded";

  return (
    <Container className="pt-8 sm:pt-12">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
        <div className="space-y-10">
          <header>
            {demoNotice}
            <p className="eyebrow">
              {t.order.number(order.number)} · {t.order.placedOn(placed)}
            </p>
            <h1 className="display mt-3 text-[clamp(1.9rem,4.5vw,3rem)]">{t.order.thanks}</h1>
            {settings.checkout.confirmationNote && (
              <p className="mt-4 max-w-2xl text-ink-2 sm:text-lg">{settings.checkout.confirmationNote}</p>
            )}
          </header>

          <section>
            <h2 className="eyebrow mb-4">{t.order.statusTitle}</h2>
            {cancelled ? (
              <p className="flex items-center gap-2 rounded-[var(--radius-control)] bg-danger-soft px-4 py-3 font-medium text-danger">
                <CircleAlert size={18} />
                {t.order.customerStatus[order.status]}
              </p>
            ) : (
              <ol className="grid gap-3 sm:grid-cols-4" data-testid="order-status">
                {STEPS.map((step, index) => {
                  const done = index <= stepIndex;
                  return (
                    <li
                      key={step}
                      className={`flex items-start gap-3 rounded-[var(--radius-control)] border p-3 text-sm ${
                        index === stepIndex ? "border-ink bg-canvas font-semibold" : done ? "border-line" : "border-line text-ink-3"
                      }`}
                    >
                      {done ? (
                        index === stepIndex ? (
                          <Clock size={17} className="mt-0.5 shrink-0" />
                        ) : (
                          <CircleCheck size={17} className="mt-0.5 shrink-0 text-success" />
                        )
                      ) : (
                        <PackageCheck size={17} className="mt-0.5 shrink-0" />
                      )}
                      <span>{t.order.customerStatus[step]}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="eyebrow mb-3">{t.order.paymentTitle}</h2>
              <p className="font-medium">
                {order.paymentStatus === "paid" ? t.order.paymentPaid : t.order.paymentUnpaid[order.paymentMethod]}
              </p>
              {order.paymentMethod === "bank_transfer" && order.paymentStatus !== "paid" && !cancelled && (
                <div className="mt-4 rounded-card border border-line p-4 text-sm">
                  <p className="font-semibold">{t.order.bankDetails}</p>
                  {settings.checkout.bankTransferInstructions ? (
                    <RichText text={settings.checkout.bankTransferInstructions} className="mt-2 text-sm" />
                  ) : null}
                  <p className="mt-3 font-medium">{t.order.bankReference(order.number)}</p>
                </div>
              )}
            </div>
            <div>
              <h2 className="eyebrow mb-3">{t.order.deliveryTitle}</h2>
              <p className="font-medium">{order.customer.name}</p>
              {order.shippingMethod && <p className="text-ink-2">{order.shippingMethod.name}</p>}
              {order.address ? (
                <p className="text-ink-2">
                  {[order.address.line1, order.address.city, order.address.region, order.address.postalCode, order.address.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              ) : (
                <p className="text-ink-2">{t.order.pickup}</p>
              )}
            </div>
          </section>

          <section className="rounded-card bg-canvas p-5 text-sm">
            <p className="font-medium">{t.order.keepLink}</p>
            {(contactUrl || settings.contact.email) && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-ink-2">
                <span>{t.order.questions}</span>
                {contactUrl && (
                  <a href={contactUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-ink underline-offset-4 hover:underline">
                    <WhatsAppIcon size={15} /> WhatsApp
                  </a>
                )}
                {settings.contact.email && (
                  <a href={`mailto:${settings.contact.email}?subject=${encodeURIComponent(t.order.number(order.number))}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                    {settings.contact.email}
                  </a>
                )}
              </div>
            )}
          </section>
        </div>
        <div>{receipt}</div>
      </div>
    </Container>
  );
}
