"use client";

import { Banknote, Landmark, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cloneElement, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { WhatsAppIcon } from "@/components/icons/brands";
import { buttonClass } from "@/components/ui/button";
import { clearCart, useCartLines } from "@/lib/cart/store";
import { useCartQuote } from "@/lib/cart/useCartQuote";
import type { CartQuote } from "@/lib/domain/cart";
import type { CheckoutErrors } from "@/lib/domain/checkout";
import type { CheckoutMethod } from "@/lib/domain/settings";
import { placeOrderAction } from "@/server/actions/storefront";
import { CartLines } from "./CartLines";
import { Receipt, ReceiptLine, ReceiptRule } from "./Receipt";
import { useStore } from "./StoreProvider";

/**
 * Checkout: how to order, who you are, where it goes — then one button whose
 * label and the sentence under it say exactly what happens next.
 */

type Fields = {
  name: string;
  phone: string;
  email: string;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  note: string;
};

const EMPTY: Fields = { name: "", phone: "", email: "", line1: "", city: "", region: "", postalCode: "", country: "", note: "" };

/** A little over the server's minimum (src/server/form-token.ts). */
const MIN_FILL_WAIT_MS = 2700;

export function CheckoutForm({ formToken }: { formToken: string }) {
  const { t, money, config } = useStore();
  const router = useRouter();
  const { lines, hydrated } = useCartLines();
  const methods = config.checkoutMethods;
  const [method, setMethod] = useState<CheckoutMethod | null>(methods[0] ?? null);
  const [shippingId, setShippingId] = useState<string | null>(config.shippingMethods[0]?.id ?? null);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { quote: liveQuote, loading } = useCartQuote(lines, hydrated, shippingId);
  // The quote a refused order came back with, until a fresh quote replaces it.
  const [serverQuote, setServerQuote] = useState<{ quote: CartQuote; over: CartQuote | null } | null>(null);
  const quote = serverQuote && serverQuote.over === liveQuote ? serverQuote.quote : liveQuote;
  const mountedAt = useRef(0);
  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);

  const shipping = config.shippingMethods.find((candidate) => candidate.id === shippingId) ?? null;
  const set = (key: keyof Fields) => (event: { target: { value: string } }) => {
    setFields((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  if (!hydrated || (lines.length > 0 && !quote)) {
    return <p className="py-24 text-center text-sm text-ink-3">{t.common.loading}</p>;
  }

  if (lines.length === 0 || !quote) {
    return (
      <div className="py-24 text-center">
        <h2 className="text-xl font-semibold">{t.checkout.emptyTitle}</h2>
        <Link href="/shop" className={buttonClass({ variant: "dark", className: "mt-6" })}>
          {t.common.continueShopping}
        </Link>
      </div>
    );
  }

  if (!method) {
    return <p className="py-24 text-center text-ink-2">{t.checkout.noMethods}</p>;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setNotice(null);
    const form = new FormData(event.currentTarget);
    try {
      // The server turns away orders sent within seconds of the page loading
      // (a bot's pace). Someone quick with autofill just waits out the rest.
      const wait = MIN_FILL_WAIT_MS - (performance.now() - mountedAt.current);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      const result = await placeOrderAction({
        ...fields,
        method,
        shippingMethodId: shippingId ?? "",
        lines,
        formToken,
        company: String(form.get("company") ?? ""),
      });
      if (result.ok) {
        clearCart();
        router.push(result.orderUrl);
        return;
      }
      setErrors(result.errors);
      if (result.quote) setServerQuote({ quote: result.quote, over: liveQuote });
      setNotice(
        result.message === "rate_limited"
          ? t.checkout.rateLimited
          : result.message === "cart_changed"
            ? t.checkout.cartChanged
            : result.message === "failed"
              ? t.checkout.failed
              : null,
      );
      setSubmitting(false);
      const first = document.querySelector<HTMLElement>("[aria-invalid='true']");
      first?.focus();
    } catch {
      setNotice(t.checkout.failed);
      setSubmitting(false);
    }
  }

  const methodIcon: Record<CheckoutMethod, ReactNode> = {
    cod: <Banknote size={20} strokeWidth={1.6} />,
    bank_transfer: <Landmark size={20} strokeWidth={1.6} />,
    whatsapp: <WhatsAppIcon size={19} />,
  };
  const phoneOptional = method === "whatsapp";

  return (
    <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-14">
      <div className="space-y-10">
        {notice && (
          <p role="alert" className="rounded-[var(--radius-control)] bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
            {notice}
          </p>
        )}

        <Step number={1} title={t.checkout.howToOrder}>
          <div className="grid gap-3">
            {methods.map((option) => (
              <label
                key={option}
                className={`flex cursor-pointer gap-4 rounded-card border p-4 transition-colors ${
                  method === option ? "border-ink bg-canvas" : "border-line hover:border-ink-3"
                }`}
              >
                <input
                  type="radio"
                  name="method"
                  value={option}
                  checked={method === option}
                  onChange={() => setMethod(option)}
                  className="mt-1 size-4 accent-[var(--accent)]"
                />
                <span className="mt-0.5 text-ink">{methodIcon[option]}</span>
                <span>
                  <span className="block font-semibold">{t.checkout.methods[option].title}</span>
                  <span className="block text-sm text-ink-2">{t.checkout.methods[option].text}</span>
                  {option === "whatsapp" && !config.whatsapp.configured && method === "whatsapp" && (
                    <span className="mt-2 block text-xs font-medium text-warning">{t.checkout.whatsappDemo}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
          {errors.method && <FieldError message={t.errors[errors.method]} />}
        </Step>

        <Step number={2} title={t.checkout.contact}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.checkout.name} error={errors.name && t.errors[errors.name]} className="sm:col-span-2">
              <input name="name" autoComplete="name" value={fields.name} onChange={set("name")} required />
            </Field>
            <Field
              label={t.checkout.phone}
              hint={phoneOptional ? t.checkout.phoneHelpWhatsApp : undefined}
              optional={phoneOptional ? t.common.optional : undefined}
              error={errors.phone && t.errors[errors.phone]}
            >
              <input name="phone" type="tel" autoComplete="tel" inputMode="tel" dir="ltr" value={fields.phone} onChange={set("phone")} />
            </Field>
            <Field label={t.checkout.email} optional={t.common.optional} error={errors.email && t.errors[errors.email]}>
              <input name="email" type="email" autoComplete="email" dir="ltr" value={fields.email} onChange={set("email")} />
            </Field>
          </div>
        </Step>

        <Step number={3} title={t.checkout.delivery}>
          <div className="grid gap-3">
            {config.shippingMethods.map((option) => {
              const waived =
                option.price > 0 &&
                config.freeShippingThreshold !== null &&
                quote.subtotal >= config.freeShippingThreshold;
              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-start gap-4 rounded-card border p-4 transition-colors ${
                    shippingId === option.id ? "border-ink bg-canvas" : "border-line hover:border-ink-3"
                  }`}
                >
                  <input
                    type="radio"
                    name="shipping"
                    value={option.id}
                    checked={shippingId === option.id}
                    onChange={() => setShippingId(option.id)}
                    className="mt-1 size-4 accent-[var(--accent)]"
                  />
                  <span className="flex-1">
                    <span className="block font-semibold">{option.name}</span>
                    {option.description && <span className="block text-sm text-ink-2">{option.description}</span>}
                  </span>
                  <span className="price text-sm font-semibold">
                    {option.price === 0 || waived ? t.checkout.free : money(option.price)}
                    {waived && <s className="ms-2 font-normal text-ink-3">{money(option.price)}</s>}
                  </span>
                </label>
              );
            })}
          </div>
          {errors.shippingMethodId && <FieldError message={t.errors[errors.shippingMethodId]} />}

          {shipping?.requiresAddress && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label={t.checkout.line1} error={errors.line1 && t.errors[errors.line1]} className="sm:col-span-2">
                <input name="line1" autoComplete="street-address" value={fields.line1} onChange={set("line1")} />
              </Field>
              <Field label={t.checkout.city} error={errors.city && t.errors[errors.city]}>
                <input name="city" autoComplete="address-level2" value={fields.city} onChange={set("city")} />
              </Field>
              <Field label={t.checkout.region} optional={t.common.optional} error={errors.region && t.errors[errors.region]}>
                <input name="region" autoComplete="address-level1" value={fields.region} onChange={set("region")} />
              </Field>
              <Field label={t.checkout.postalCode} optional={t.common.optional} error={errors.postalCode && t.errors[errors.postalCode]}>
                <input name="postalCode" autoComplete="postal-code" value={fields.postalCode} onChange={set("postalCode")} />
              </Field>
              <Field label={t.checkout.country} optional={t.common.optional} error={errors.country && t.errors[errors.country]}>
                <input name="country" autoComplete="country-name" value={fields.country} onChange={set("country")} />
              </Field>
            </div>
          )}

          <Field label={t.checkout.note} optional={t.common.optional} error={errors.note && t.errors[errors.note]} className="mt-6">
            <textarea name="note" rows={3} placeholder={t.checkout.notePlaceholder} value={fields.note} onChange={set("note")} />
          </Field>

          {/* Left empty by people; bots that fill every field give themselves away. */}
          {/* Visually hidden in place: an off-screen offset would scroll sideways in right-to-left languages. */}
          <div aria-hidden="true" className="sr-only">
            <label>
              Company
              <input name="company" tabIndex={-1} autoComplete="off" defaultValue="" />
            </label>
          </div>
        </Step>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <Receipt title={t.checkout.summary}>
          <div className={`transition-opacity ${loading ? "opacity-60" : ""}`}>
            {quote.hasIssues && <CartLines quote={quote} compact />}
            {!quote.hasIssues &&
              quote.lines.map((line) => (
                <div key={line.key} className="flex items-center gap-3 py-2">
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-tile">
                    {line.imageUrl && <Image src={line.imageUrl} alt="" fill sizes="48px" className="object-cover" />}
                    <span className="price absolute -end-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-ink px-1 text-[0.65rem] leading-5 text-paper">
                      {line.quantity}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate font-medium">{line.name}</span>
                    {line.variantLabel && <span className="block text-xs text-ink-3">{line.variantLabel}</span>}
                  </span>
                  <span className="font-mono text-sm tabular-nums">{money(line.lineTotal, "full")}</span>
                </div>
              ))}
            <ReceiptRule />
            <ReceiptLine label={t.cart.subtotal} amount={money(quote.subtotal, "full")} />
            <ReceiptLine
              label={shipping ? `${t.cart.shipping} · ${shipping.name}` : t.cart.shipping}
              amount={quote.shipping ? (quote.shipping.fee > 0 ? money(quote.shipping.fee, "full") : t.checkout.free) : "—"}
            />
            <ReceiptRule />
            <ReceiptLine label={t.cart.total} amount={money(quote.total, "full")} strong />
          </div>
        </Receipt>

        <input type="hidden" name="formToken" value={formToken} />
        <button
          type="submit"
          disabled={submitting || !quote.orderable}
          className={buttonClass({
            variant: method === "whatsapp" ? "whatsapp" : "primary",
            size: "lg",
            full: true,
            className: "mt-5",
          })}
          data-testid="place-order"
        >
          {method === "whatsapp" && <WhatsAppIcon size={19} />}
          {submitting ? t.checkout.submitting : t.checkout.submit[method]}
        </button>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">{t.checkout.nextStep[method]}</p>
        <p className="mt-3 flex items-start gap-2 text-xs text-ink-3">
          <Lock size={13} className="mt-0.5 shrink-0" />
          {t.checkout.privacy}
        </p>
      </div>
    </form>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-5 flex items-center gap-3 text-lg font-semibold">
        <span className="price grid size-7 place-items-center rounded-full bg-ink text-xs text-paper" aria-hidden="true">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  optional,
  error,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  optional?: string;
  error?: string;
  className?: string;
  children: React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>>;
}) {
  // Not derived from the label: in Arabic every label would map to the same id.
  const id = useId();
  const control = cloneElement(children, {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
    className: `w-full rounded-[var(--radius-control)] border bg-paper px-3.5 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-3 focus:border-ink ${
      error ? "border-danger" : "border-line-strong"
    }`,
  });
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-sm font-medium">
        {label}
        {optional && <span className="text-xs font-normal text-ink-3">{optional}</span>}
      </label>
      {control}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-3">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`} message={error} />}
    </div>
  );
}

function FieldError({ message, id }: { message: string; id?: string }) {
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-danger">
      {message}
    </p>
  );
}
