/**
 * Phone numbers for WhatsApp.
 *
 * wa.me only accepts the full international number as bare digits — no "+",
 * no spaces, no "00" dialling prefix: "+44 7700 900123" becomes "447700900123".
 * Owners type numbers every way imaginable, so the dashboard stores this
 * normalised form and the storefront never has to guess.
 */

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** Folds Arabic-Indic digits to ASCII so "+٤٤…" normalises like "+44…". */
export function foldDigits(input: string): string {
  let out = "";
  for (const char of input) {
    const arabic = ARABIC_INDIC.indexOf(char);
    if (arabic >= 0) {
      out += String(arabic);
      continue;
    }
    const extended = EXTENDED_ARABIC_INDIC.indexOf(char);
    out += extended >= 0 ? String(extended) : char;
  }
  return out;
}

export function normalizePhone(value: string | null | undefined): string {
  if (!value) return "";
  return foldDigits(value).replace(/\D/g, "").replace(/^00/, "");
}

/** E.164: a country code that does not start with 0, 8–15 digits in all. */
export function isValidWhatsAppNumber(digits: string): boolean {
  return /^[1-9]\d{7,14}$/.test(digits);
}

/** "+447700900123" — for display next to a WhatsApp icon. */
export function formatInternational(digits: string): string {
  return digits ? `+${digits}` : "";
}
