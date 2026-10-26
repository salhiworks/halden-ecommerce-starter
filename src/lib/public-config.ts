import type { CheckoutMethod, ShippingMethod, StoreSettings } from "@/lib/domain/settings";
import { enabledCheckoutMethods, isWhatsAppConfigured, moneyFormatOf } from "@/lib/domain/settings";
import type { MoneyFormat } from "@/lib/domain/money";
import type { Language } from "@/lib/i18n/languages";

/**
 * The slice of the settings that browser code needs. Built on the server and
 * passed to client components, so private settings never travel further than
 * they must.
 */
export type PublicConfig = {
  storeName: string;
  language: Language;
  money: MoneyFormat;
  whatsapp: { configured: boolean; number: string };
  checkoutMethods: CheckoutMethod[];
  shippingMethods: ShippingMethod[];
  freeShippingThreshold: number | null;
};

export function publicConfigOf(settings: StoreSettings): PublicConfig {
  return {
    storeName: settings.store.name,
    language: settings.store.language,
    money: moneyFormatOf(settings),
    whatsapp: {
      configured: isWhatsAppConfigured(settings),
      number: isWhatsAppConfigured(settings) ? settings.contact.whatsapp : "",
    },
    checkoutMethods: enabledCheckoutMethods(settings),
    shippingMethods: settings.shipping.methods,
    freeShippingThreshold: settings.shipping.freeShippingThreshold,
  };
}
