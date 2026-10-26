"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useCartLines } from "@/lib/cart/store";
import { useCartQuote } from "@/lib/cart/useCartQuote";
import { buttonClass } from "@/components/ui/button";
import { CartLines, FreeShippingMeter } from "./CartLines";
import { Receipt, ReceiptLine, ReceiptRule } from "./Receipt";
import { useStore } from "./StoreProvider";

export function CartPage() {
  const { t, money } = useStore();
  const { lines, hydrated } = useCartLines();
  const { quote, loading, failed } = useCartQuote(lines, hydrated);

  if (!hydrated || (lines.length > 0 && !quote && !failed)) {
    return <p className="py-24 text-center text-sm text-ink-3">{t.common.loading}</p>;
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-canvas">
          <ShoppingBag size={24} className="text-ink-2" />
        </span>
        <h2 className="text-xl font-semibold">{t.cart.empty}</h2>
        <p className="text-ink-2">{t.cart.emptyText}</p>
        <Link href="/shop" className={buttonClass({ variant: "dark", className: "mt-2" })}>
          {t.common.continueShopping}
        </Link>
      </div>
    );
  }

  if (!quote) return <p className="py-24 text-center text-sm text-danger">{t.cart.quoteFailed}</p>;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
      <div className={`transition-opacity ${loading ? "opacity-60" : ""}`}>
        <FreeShippingMeter quote={quote} />
        <CartLines quote={quote} />
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Receipt title={t.checkout.summary}>
          <ReceiptLine label={t.cart.subtotal} amount={money(quote.subtotal, "full")} strong />
          <ReceiptRule />
          <ReceiptLine label={t.cart.shipping} amount={t.cart.shippingAtCheckout} muted />
        </Receipt>
        <Link
          href="/checkout"
          aria-disabled={!quote.orderable}
          className={buttonClass({
            size: "lg",
            full: true,
            className: `mt-5 ${quote.orderable ? "" : "pointer-events-none opacity-50"}`,
          })}
        >
          {t.cart.checkout}
        </Link>
        <Link href="/shop" className="mt-4 block text-center text-sm font-medium underline-offset-4 hover:underline">
          {t.common.continueShopping}
        </Link>
      </div>
    </div>
  );
}
