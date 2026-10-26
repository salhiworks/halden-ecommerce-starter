/**
 * Money.
 *
 * Amounts are stored as plain numbers in the currency's major unit (19.99),
 * with at most two decimals. Arithmetic goes through integer cents so a cart
 * of three 0.10 items totals 0.30, not 0.30000000000000004.
 */

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Rounds to two decimals — the precision every stored amount has. */
export function roundMoney(amount: number): number {
  return fromCents(toCents(amount));
}

export function multiplyMoney(amount: number, quantity: number): number {
  return fromCents(toCents(amount) * quantity);
}

export function sumMoney(amounts: readonly number[]): number {
  return fromCents(amounts.reduce((total, amount) => total + toCents(amount), 0));
}

/** Whole percent saved, or `null` when there is no genuine discount. */
export function discountPercent(
  price: number,
  compareAtPrice: number | null | undefined,
): number | null {
  if (compareAtPrice == null || compareAtPrice <= price || compareAtPrice <= 0) {
    return null;
  }
  const percent = Math.round((1 - price / compareAtPrice) * 100);
  return percent >= 1 ? percent : null;
}

/* ------------------------------------------------------------- formatting */

export type MoneyFormat = {
  currency: string;
  /** BCP-47 tag used for digits, separators and symbol placement. */
  locale: string;
};

/**
 * - `"auto"` drops a trailing `.00` (shelf prices: "$49", "$49.50")
 * - `"full"` always shows the currency's decimals (receipts and totals)
 */
export type MoneyStyle = "auto" | "full";

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(
  { currency, locale }: MoneyFormat,
  fractionDigits: number | null,
): Intl.NumberFormat {
  const key = `${locale}|${currency}|${fractionDigits ?? "default"}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        ...(fractionDigits === null
          ? {}
          : {
              minimumFractionDigits: fractionDigits,
              maximumFractionDigits: fractionDigits,
            }),
      });
    } catch {
      // An unknown currency code must never take a page down.
      formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: fractionDigits ?? 2,
        maximumFractionDigits: fractionDigits ?? 2,
      });
    }
    formatters.set(key, formatter);
  }
  return formatter;
}

export function formatMoney(
  amount: number,
  format: MoneyFormat,
  style: MoneyStyle = "auto",
): string {
  const whole = Number.isInteger(roundMoney(amount));
  const fractionDigits = style === "auto" && whole ? 0 : null;
  return formatterFor(format, fractionDigits).format(roundMoney(amount));
}

/** ISO 4217 codes this runtime can format. Used to validate settings. */
export function isSupportedCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: code });
    const supported =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("currency")
        : null;
    return supported ? supported.includes(code) : true;
  } catch {
    return false;
  }
}

/** A short list for the settings picker; any valid ISO code is accepted. */
export const COMMON_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "MAD",
  "AED",
  "SAR",
  "EGP",
  "DZD",
  "TND",
  "NGN",
  "KES",
  "ZAR",
  "INR",
  "PKR",
  "TRY",
  "BRL",
  "MXN",
  "JPY",
  "CHF",
  "SEK",
] as const;
