"use client";

import { useEffect } from "react";
import { adoptCart } from "@/lib/cart/store";
import { decodeCartHandoff } from "@/lib/domain/cart";

/**
 * Public demo only: when checkout was opened from the framed showcase (see
 * CheckoutLink), the bag arrives in `?bag=`. It replaces this tab's bag once,
 * and the parameter leaves the address bar so a reload or a shared link does not
 * repeat it.
 */
export function AdoptHandedOffCart() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("bag")) return;
    adoptCart(decodeCartHandoff(url.searchParams.get("bag")));
    url.searchParams.delete("bag");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
}
