/**
 * Storefront languages.
 *
 * A store is written in one language — the one its owner types products in —
 * and the storefront's interface (buttons, labels, messages) follows it. Arabic
 * flips the whole layout right-to-left.
 */

export const LANGUAGES = ["en", "fr", "es", "ar"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  ar: "العربية",
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

export function directionOf(language: Language): "ltr" | "rtl" {
  return language === "ar" ? "rtl" : "ltr";
}

/**
 * The BCP-47 tag used for `Intl` formatting. Arabic keeps Latin digits: they
 * are what prices are typed in, and what customers read in WhatsApp.
 */
export function intlLocaleOf(language: Language): string {
  return language === "ar" ? "ar-u-nu-latn" : language;
}
