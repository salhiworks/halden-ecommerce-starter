"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CartQuote, QuoteLine } from "@/lib/domain/cart";
import { removeLine, setCartDrawer, setLineQuantity } from "@/lib/cart/store";
import { useStore } from "./StoreProvider";

/** The lines of a quoted bag, with quantity controls and honest notices. */
export function CartLines({ quote, compact = false }: { quote: CartQuote; compact?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {quote.lines.map((line) => (
        <CartLineRow key={line.key} line={line} compact={compact} />
      ))}
    </ul>
  );
}

function CartLineRow({ line, compact }: { line: QuoteLine; compact: boolean }) {
  const { t, money } = useStore();
  const unavailable = line.status === "unavailable";
  const notice =
    line.reason === "gone"
      ? t.cart.lineGone
      : line.reason === "variant-gone"
        ? t.cart.lineVariantGone
        : line.reason === "sold-out"
          ? t.cart.lineSoldOut
          : line.reason === "limited"
            ? t.cart.lineLimited(line.quantity)
            : null;
  const max = line.maxQuantity ?? 99;

  return (
    <li className={`flex gap-4 ${compact ? "py-4" : "py-5"}`}>
      <Link
        href={line.slug ? `/products/${line.slug}` : "#"}
        onClick={() => setCartDrawer(false)}
        className={`relative shrink-0 overflow-hidden rounded-[calc(var(--radius-card)*0.6)] bg-tile ${
          compact ? "h-24 w-20" : "h-32 w-26"
        } ${unavailable ? "opacity-50" : ""}`}
      >
        {line.imageUrl && <Image src={line.imageUrl} alt="" fill sizes="104px" className="object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={line.slug ? `/products/${line.slug}` : "#"}
              onClick={() => setCartDrawer(false)}
              className="block text-sm font-medium leading-snug hover:underline"
            >
              {line.name || "—"}
            </Link>
            {line.variantLabel && <p className="mt-0.5 text-sm text-ink-3">{line.variantLabel}</p>}
          </div>
          <p className="price shrink-0 text-sm font-semibold">
            {unavailable ? "—" : money(line.lineTotal, "full")}
          </p>
        </div>
        {notice && (
          <p className={`mt-2 text-xs font-medium ${unavailable ? "text-danger" : "text-warning"}`}>{notice}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          {unavailable ? (
            <span />
          ) : (
            <div className="flex h-9 items-center rounded-[var(--radius-control)] border border-line">
              <button
                type="button"
                className="grid h-full w-9 place-items-center text-ink-2 hover:text-ink disabled:opacity-30"
                onClick={() => setLineQuantity(line.key, line.quantity - 1)}
                disabled={line.quantity <= 1}
                aria-label={t.product.decrease}
              >
                <Minus size={15} />
              </button>
              <span className="price w-7 text-center text-sm" aria-live="polite">
                {line.quantity}
              </span>
              <button
                type="button"
                className="grid h-full w-9 place-items-center text-ink-2 hover:text-ink disabled:opacity-30"
                onClick={() => setLineQuantity(line.key, line.quantity + 1)}
                disabled={line.quantity >= max}
                aria-label={t.product.increase}
              >
                <Plus size={15} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => removeLine(line.key)}
            className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-danger"
            aria-label={t.cart.removeItem(line.name)}
          >
            <Trash2 size={14} />
            {t.common.remove}
          </button>
        </div>
      </div>
    </li>
  );
}

/** "You're $12 away from free delivery", with a progress bar. */
export function FreeShippingMeter({ quote }: { quote: CartQuote }) {
  const { t, money, config } = useStore();
  const threshold = config.freeShippingThreshold;
  if (!threshold || quote.subtotal <= 0) return null;
  const remaining = quote.freeShippingRemaining;
  const progress = Math.min(100, (quote.subtotal / threshold) * 100);
  return (
    <div className="rounded-[var(--radius-control)] bg-canvas px-4 py-3">
      <p className="text-sm font-medium">
        {remaining ? t.cart.freeShippingRemaining(money(remaining, "full")) : t.cart.freeShippingUnlocked}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
