import { foldDigits } from "./phone";

/**
 * Text folding for search.
 *
 * Shoppers type "creme" for "Crème", "cafe" for "Café", and in Arabic drop
 * the hamza or write "ه" for "ة". Folding both sides the same way makes search
 * feel forgiving in every storefront language without a search service.
 *
 * Character classes use escapes so the source stays safe to edit in editors
 * that reorder bidirectional text.
 */

/** Latin combining accents, Arabic harakat and Quranic annotation marks. */
const COMBINING_MARKS = /[̀-ͯؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const ALEF_VARIANTS = /[آأإ]/g; // آ أ إ
const ALEF_MAQSURA = /ى/g; // ى
const TA_MARBUTA = /ة/g; // ة
const WAW_HAMZA = /ؤ/g; // ؤ
const YA_HAMZA = /ئ/g; // ئ

export function normalizeText(input: string): string {
  return foldDigits(input)
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(TATWEEL, "")
    .replace(ALEF_VARIANTS, "ا")
    .replace(ALEF_MAQSURA, "ي")
    .replace(TA_MARBUTA, "ه")
    .replace(WAW_HAMZA, "و")
    .replace(YA_HAMZA, "ي")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(query: string): string[] {
  return normalizeText(query)
    .split(/[\s،,._/()+-]+/)
    .filter((token) => token.length > 0);
}
