import { z } from "zod";
import { MAX_CART_LINES, MAX_LINE_QUANTITY, type CartQuote } from "./cart";
import { foldDigits } from "./phone";
import { enabledCheckoutMethods, type CheckoutMethod, type StoreSettings } from "./settings";
import type { Order, OrderEvent, OrderItem } from "./types";

/**
 * ===========================================================================
 *  CHECKOUT
 * ===========================================================================
 *
 *  What a shopper submits, how it is validated, and how it becomes an order.
 *
 *  Validation messages are *codes* ("phone_invalid"), not sentences: the
 *  storefront translates them into the store's language, and the server never
 *  has to know which language that is.
 *
 *  Data minimisation: only what the seller needs to deliver is asked for.
 *  Email is optional, the address is only requested for delivery methods that
 *  need one, and a WhatsApp order does not require a phone number (the chat
 *  already carries it).
 */

export const CHECKOUT_METHODS = ["cod", "bank_transfer", "whatsapp"] as const;

const field = (max: number) => z.string().trim().max(max, "too_long").default("");

export const checkoutSchema = z.object({
  method: z.enum(CHECKOUT_METHODS, { message: "method_invalid" }),
  shippingMethodId: z.string().trim().max(40).default(""),
  name: z.string().trim().min(2, "name_required").max(80, "too_long"),
  phone: field(30),
  email: field(120).refine(
    (value) => value === "" || z.email().safeParse(value).success,
    "email_invalid",
  ),
  line1: field(160),
  city: field(80),
  region: field(80),
  postalCode: field(20),
  country: field(60),
  note: field(500),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        variantId: z.string().min(1).max(64),
        quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
      }),
    )
    .min(1, "cart_empty")
    .max(MAX_CART_LINES, "cart_too_large"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export type CheckoutErrorCode =
  | "method_invalid"
  | "method_disabled"
  | "shipping_required"
  | "name_required"
  | "phone_required"
  | "phone_invalid"
  | "email_invalid"
  | "address_required"
  | "city_required"
  | "too_long"
  | "cart_empty"
  | "cart_too_large"
  | "cart_changed";

export type CheckoutErrors = Partial<Record<keyof CheckoutInput | "form", CheckoutErrorCode>>;

const PHONE_SHAPE = /^[+]?[\d\s().-]{6,30}$/;

export function isPlausiblePhone(value: string): boolean {
  const folded = foldDigits(value);
  const digits = folded.replace(/\D/g, "");
  return PHONE_SHAPE.test(folded) && digits.length >= 6 && digits.length <= 15;
}

/**
 * Rules that depend on the store's configuration and the live quote — the
 * parts a schema alone cannot express.
 */
export function checkoutErrors(
  input: CheckoutInput,
  settings: StoreSettings,
  quote: CartQuote,
): CheckoutErrors {
  const errors: CheckoutErrors = {};

  if (!enabledCheckoutMethods(settings).includes(input.method as CheckoutMethod)) {
    errors.method = "method_disabled";
  }

  const shipping = settings.shipping.methods.find((method) => method.id === input.shippingMethodId);
  if (!shipping) errors.shippingMethodId = "shipping_required";

  if (input.method !== "whatsapp" && input.phone === "") {
    errors.phone = "phone_required";
  } else if (input.phone !== "" && !isPlausiblePhone(input.phone)) {
    errors.phone = "phone_invalid";
  }

  if (shipping?.requiresAddress) {
    if (input.line1 === "") errors.line1 = "address_required";
    if (input.city === "") errors.city = "city_required";
  }

  if (!quote.orderable) errors.form = "cart_empty";
  else if (quote.hasIssues) errors.form = "cart_changed";

  return errors;
}

/* -------------------------------------------------------------- the order */

export type NewOrder = Omit<Order, "id" | "number" | "createdAt" | "updatedAt">;

export function buildOrder(
  input: CheckoutInput,
  quote: CartQuote,
  settings: StoreSettings,
  now: Date,
  options: { whatsappConfigured: boolean },
): NewOrder {
  const shipping = quote.shipping;
  const isWhatsApp = input.method === "whatsapp";

  const items: OrderItem[] = quote.lines
    .filter((line) => line.status !== "unavailable" && line.quantity > 0)
    .map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      name: line.name,
      variantLabel: line.variantLabel,
      sku: "",
      imageUrl: line.imageUrl,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
    }));

  const created: OrderEvent = {
    at: now.toISOString(),
    kind: "created",
    by: "customer",
    to: isWhatsApp ? "prepared" : "received",
    note: isWhatsApp
      ? options.whatsappConfigured
        ? "WhatsApp order message prepared for the shopper."
        : "WhatsApp order message prepared as a preview only — no WhatsApp number is configured, so it could not be sent."
      : "Order submitted on the website.",
  };

  return {
    channel: isWhatsApp ? "whatsapp" : "web",
    status: isWhatsApp ? "prepared" : "received",
    paymentMethod: isWhatsApp ? "whatsapp" : input.method === "bank_transfer" ? "bank_transfer" : "cod",
    paymentStatus: "unpaid",
    currency: settings.store.currency,
    items,
    subtotal: quote.subtotal,
    shippingFee: shipping?.fee ?? 0,
    total: quote.total,
    shippingMethod: shipping ? { id: shipping.method.id, name: shipping.method.name } : null,
    customer: { name: input.name, phone: input.phone, email: input.email },
    address: shipping?.method.requiresAddress
      ? {
          line1: input.line1,
          city: input.city,
          region: input.region,
          postalCode: input.postalCode,
          country: input.country,
        }
      : null,
    customerNote: input.note,
    internalNote: "",
    stockReserved: false,
    events: [created],
  };
}
