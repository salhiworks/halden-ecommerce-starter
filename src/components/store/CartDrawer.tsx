"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { setCartDrawer, useCartDrawer, useCartLines } from "@/lib/cart/store";
import { useCartQuote } from "@/lib/cart/useCartQuote";
import { buttonClass } from "@/components/ui/button";
import { Drawer } from "@/components/ui/Drawer";
import { CartLines, FreeShippingMeter } from "./CartLines";
import { useStore } from "./StoreProvider";

export function CartDrawer() {
  const open = useCartDrawer();
  const { lines, hydrated } = useCartLines();
  // Only quote while the drawer is open; the bag page quotes for itself.
  const { quote, loading, failed } = useCartQuote(open ? lines : [], hydrated && open);
  const { t, money } = useStore();
  const close = () => setCartDrawer(false);

  const footer =
    lines.length > 0 && quote ? (
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-2">{t.cart.subtotal}</span>
          <span className="price text-lg font-semibold">{money(quote.subtotal, "full")}</span>
        </div>
        <p className="text-xs text-ink-3">
          {t.cart.shipping}: {t.cart.shippingAtCheckout}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/cart" onClick={close} className={buttonClass({ variant: "outline", full: true })}>
            {t.cart.viewCart}
          </Link>
          <Link
            href="/checkout"
            onClick={close}
            aria-disabled={!quote.orderable}
            className={buttonClass({ variant: "primary", full: true, className: !quote.orderable ? "pointer-events-none opacity-50" : "" })}
          >
            {t.cart.checkout}
          </Link>
        </div>
      </div>
    ) : null;

  return (
    <Drawer
      open={open}
      onClose={close}
      title={
        <span className="inline-flex items-center gap-2">
          {t.cart.title}
          {quote && quote.itemCount > 0 && <span className="text-ink-3">({quote.itemCount})</span>}
        </span>
      }
      closeLabel={t.common.close}
      footer={footer}
    >
      <div className="px-5 py-4">
        {!hydrated || (lines.length > 0 && !quote && !failed) ? (
          <p className="py-10 text-center text-sm text-ink-3" role="status">
            {t.common.loading}
          </p>
        ) : lines.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-canvas">
              <ShoppingBag size={22} className="text-ink-2" />
            </span>
            <div>
              <p className="font-semibold">{t.cart.empty}</p>
              <p className="mt-1 text-sm text-ink-3">{t.cart.emptyText}</p>
            </div>
            <Link href="/shop" onClick={close} className={buttonClass({ variant: "dark" })}>
              {t.common.continueShopping}
            </Link>
          </div>
        ) : failed && !quote ? (
          <p className="py-10 text-center text-sm text-danger">{t.cart.quoteFailed}</p>
        ) : quote ? (
          <div className={`space-y-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
            <FreeShippingMeter quote={quote} />
            <CartLines quote={quote} compact />
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
