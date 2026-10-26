"use client";

import { useEffect, useState } from "react";
import type { CartLine, CartQuote } from "@/lib/domain/cart";
import { quoteCartAction } from "@/server/actions/storefront";

/**
 * Asks the server what the bag costs right now. Re-quotes whenever the lines
 * or the chosen delivery change; a slow response for an older bag is ignored
 * so a quick double-tap on "+" never shows a stale total.
 */
export function useCartQuote(lines: CartLine[], hydrated: boolean, shippingMethodId: string | null = null) {
  const key = JSON.stringify([lines, shippingMethodId]);
  // The latest answer, and the bag it answers for.
  const [answer, setAnswer] = useState<{ key: string; quote: CartQuote | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (!hydrated || lines.length === 0) return;
    let current = true;
    quoteCartAction(lines, shippingMethodId)
      .then((quote) => {
        if (current) setAnswer({ key, quote, failed: false });
      })
      .catch(() => {
        if (current) setAnswer((previous) => ({ key, quote: previous?.quote ?? null, failed: true }));
      });
    return () => {
      current = false;
    };
    // `key` captures lines and delivery by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hydrated]);

  if (lines.length === 0) return { quote: null, loading: false, failed: false };
  return {
    // The previous total stays on screen while the new one loads.
    quote: answer?.quote ?? null,
    loading: hydrated && answer?.key !== key,
    failed: answer?.key === key && answer.failed,
  };
}
