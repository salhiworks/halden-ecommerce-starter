"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { formatMoney, type MoneyStyle } from "@/lib/domain/money";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import type { PublicConfig } from "@/lib/public-config";

/**
 * Store-wide context for client components: the public settings, the
 * dictionary for the store's language, and a money formatter. Only the
 * serialisable config crosses from the server; the dictionary (which
 * contains plural functions) is resolved here in the browser.
 */

type StoreContextValue = {
  config: PublicConfig;
  t: Dictionary;
  money: (amount: number, style?: MoneyStyle) => string;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ config, children }: { config: PublicConfig; children: ReactNode }) {
  const value = useMemo<StoreContextValue>(
    () => ({
      config,
      t: getDictionary(config.language),
      money: (amount, style = "auto") => formatMoney(amount, config.money, style),
    }),
    [config],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside <StoreProvider>");
  return value;
}
