"use server";

import { parseCartLines, quoteCart, type CartQuote } from "@/lib/domain/cart";
import { searchProducts, storefrontProducts, visibleCategories } from "@/lib/domain/catalog-query";
import { primaryImage, priceSummary } from "@/lib/domain/product";
import {
  buildOrder,
  checkoutErrors,
  checkoutSchema,
  type CheckoutErrorCode,
  type CheckoutErrors,
} from "@/lib/domain/checkout";
import { isWhatsAppConfigured } from "@/lib/domain/settings";
import { getBackend } from "@/server/backend";
import { randomToken, sha256 } from "@/server/crypto";
import { checkFormToken } from "@/server/form-token";
import { rateLimit } from "@/server/rate-limit";
import { clientAddress } from "@/server/request";
import { getStorefront, getStorefrontFresh } from "@/server/storefront";

/**
 * Storefront actions. Nothing here trusts the browser: quantities are
 * re-parsed, prices and stock come from the catalog, and the checkout is
 * validated in full before an order exists.
 */

export async function quoteCartAction(rawLines: unknown, shippingMethodId: string | null = null): Promise<CartQuote> {
  const { settings, catalog } = await getStorefront();
  const methodId = typeof shippingMethodId === "string" ? shippingMethodId.slice(0, 40) : null;
  return quoteCart(parseCartLines(rawLines), catalog.products, settings, methodId);
}

export type SearchHit = {
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number;
  compareAt: number | null;
  varies: boolean;
};

/** Instant results for the search panel: the first few matches. */
export async function searchAction(query: unknown): Promise<SearchHit[]> {
  if (typeof query !== "string" || query.trim().length < 2) return [];
  const { catalog } = await getStorefront();
  return searchProducts(storefrontProducts(catalog), query.slice(0, 100), visibleCategories(catalog))
    .slice(0, 6)
    .map((product) => {
      const price = priceSummary(product);
      return {
        slug: product.slug,
        name: product.name,
        imageUrl: primaryImage(product)?.url ?? null,
        price: price.min,
        compareAt: price.compareAt,
        varies: price.varies,
      };
    });
}

export type PlaceOrderResult =
  | { ok: true; orderUrl: string }
  | { ok: false; errors: CheckoutErrors; message?: "rate_limited" | "failed" | "cart_changed"; quote?: CartQuote };

export async function placeOrderAction(raw: Record<string, unknown>): Promise<PlaceOrderResult> {
  // Honeypot: a field people never see. Bots fill it; reply like a failure.
  if (typeof raw.company === "string" && raw.company.trim() !== "") {
    return { ok: false, errors: {}, message: "failed" };
  }
  if (!(await checkFormToken(raw.formToken))) {
    return { ok: false, errors: {}, message: "failed" };
  }
  const limit = rateLimit(`order:${await clientAddress()}`, 6, 10 * 60 * 1000);
  if (!limit.ok) return { ok: false, errors: {}, message: "rate_limited" };

  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: CheckoutErrors = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form") as keyof CheckoutErrors;
      errors[field] ??= issue.message as CheckoutErrorCode;
    }
    return { ok: false, errors };
  }

  const input = parsed.data;
  // Fresh data, not the storefront cache: an order must use current prices.
  const { settings, catalog } = await getStorefrontFresh();
  const quote = quoteCart(input.lines, catalog.products, settings, input.shippingMethodId);
  const errors = checkoutErrors(input, settings, quote);
  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      message: errors.form === "cart_changed" ? "cart_changed" : undefined,
      quote,
    };
  }

  const order = buildOrder(input, quote, settings, new Date(), {
    whatsappConfigured: isWhatsAppConfigured(settings),
  });

  const token = randomToken();
  try {
    const created = await getBackend().public.createOrder(order, sha256(token));
    return { ok: true, orderUrl: `/orders/${created.id}?key=${token}` };
  } catch (error) {
    console.error("[checkout] order could not be saved:", error);
    return { ok: false, errors: {}, message: "failed" };
  }
}
