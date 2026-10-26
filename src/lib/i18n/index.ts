import { ar } from "./ar";
import { en, type Dictionary } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import type { Language } from "./languages";

export type { Dictionary } from "./en";
export * from "./languages";

const dictionaries: Record<Language, Dictionary> = { en, fr, es, ar };

export function getDictionary(language: Language): Dictionary {
  return dictionaries[language] ?? en;
}
