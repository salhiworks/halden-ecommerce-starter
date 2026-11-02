"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useCartLines } from "@/lib/cart/store";
import { encodeCartHandoff } from "@/lib/domain/cart";
import { useFramed } from "@/lib/framed";

/**
 * The bag's "Checkout" link. Normally an ordinary link to /checkout.
 *
 * IN A FRAME (the public demo inside the Profit Studio showcase) checkout opens in
 * a NEW TAB instead: its confirmation is kept in a cookie a browser will not store
 * for a framed page, and a new tab is the same store opened directly. That tab
 * keeps its own bag, so this one travels in the link — ids and quantities only —
 * and the checkout page adopts it (public demo mode only).
 */
export function CheckoutLink({ onClick, ...props }: Omit<ComponentProps<typeof Link>, "href">) {
  const framed = useFramed();
  const { lines } = useCartLines();
  if (framed) {
    const href = `/checkout?bag=${encodeURIComponent(encodeCartHandoff(lines))}`;
    // The drawer closes on click; closing it a tick later lets the browser follow the
    // link first — removing the link mid-click would cancel the new tab.
    return (
      <a
        {...(props as ComponentProps<"a">)}
        href={href}
        target="_blank"
        rel="noopener"
        onClick={onClick ? (event) => void setTimeout(() => onClick(event)) : undefined}
      />
    );
  }
  return <Link {...props} href="/checkout" onClick={onClick} />;
}
