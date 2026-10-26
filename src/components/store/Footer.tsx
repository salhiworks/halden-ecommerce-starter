import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import {
  FacebookIcon,
  InstagramIcon,
  PinterestIcon,
  TikTokIcon,
  WhatsAppIcon,
  XIcon,
  YouTubeIcon,
} from "@/components/icons/brands";
import { formatInternational } from "@/lib/domain/phone";
import { enabledCheckoutMethods, isWhatsAppConfigured, type StoreSettings } from "@/lib/domain/settings";
import type { Category } from "@/lib/domain/types";
import type { Dictionary } from "@/lib/i18n";
import { Wordmark } from "./Header";

const SOCIAL = [
  { key: "instagram", label: "Instagram", Icon: InstagramIcon },
  { key: "facebook", label: "Facebook", Icon: FacebookIcon },
  { key: "tiktok", label: "TikTok", Icon: TikTokIcon },
  { key: "youtube", label: "YouTube", Icon: YouTubeIcon },
  { key: "x", label: "X", Icon: XIcon },
  { key: "pinterest", label: "Pinterest", Icon: PinterestIcon },
] as const;

export function Footer({
  settings,
  categories,
  t,
  hasDemoContent,
}: {
  settings: StoreSettings;
  categories: Category[];
  t: Dictionary;
  hasDemoContent: boolean;
}) {
  const { contact } = settings;
  const socials = SOCIAL.filter((entry) => settings.social[entry.key]);
  const methods = enabledCheckoutMethods(settings).map((method) =>
    method === "cod" ? t.highlights.cod : method === "bank_transfer" ? t.highlights.bank : t.highlights.whatsapp,
  );
  const help = [
    { href: "/pages/about", label: t.footer.about, show: Boolean(settings.policies.about) },
    { href: "/pages/shipping", label: t.footer.shipping, show: true },
    { href: "/pages/returns", label: t.footer.returns, show: true },
    { href: "/pages/privacy", label: t.footer.privacy, show: true },
    { href: "/pages/contact", label: t.footer.contact, show: true },
  ].filter((link) => link.show);

  return (
    <footer className="mt-24 border-t border-line bg-canvas">
      <div className="mx-auto grid max-w-[90rem] gap-12 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:px-8">
        <div className="max-w-sm">
          <Wordmark settings={settings} />
          {(settings.store.tagline || settings.store.description) && (
            <p className="mt-4 text-sm leading-relaxed text-ink-2">
              {settings.store.tagline || settings.store.description}
            </p>
          )}
          {socials.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow">{t.footer.follow}</p>
              <ul className="mt-3 flex gap-2">
                {socials.map(({ key, label, Icon }) => (
                  <li key={key}>
                    <a
                      href={settings.social[key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid size-10 place-items-center rounded-full border border-line-strong bg-paper text-ink-2 hover:border-ink hover:text-ink"
                      aria-label={label}
                    >
                      <Icon size={18} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <nav aria-label={t.footer.shop}>
          <p className="eyebrow">{t.footer.shop}</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link href="/shop" className="text-ink-2 hover:text-ink">
                {t.nav.allProducts}
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <Link href={`/categories/${category.slug}`} className="text-ink-2 hover:text-ink">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t.footer.help}>
          <p className="eyebrow">{t.footer.help}</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {help.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-ink-2 hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="eyebrow">{t.footer.contact}</p>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-2">
            {isWhatsAppConfigured(settings) && (
              <li className="flex items-center gap-2.5">
                <WhatsAppIcon size={16} />
                <a href={`https://wa.me/${contact.whatsapp}`} className="hover:text-ink" dir="ltr">
                  {formatInternational(contact.whatsapp)}
                </a>
              </li>
            )}
            {contact.phone && (
              <li className="flex items-center gap-2.5">
                <Phone size={16} />
                <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hover:text-ink" dir="ltr">
                  {contact.phone}
                </a>
              </li>
            )}
            {contact.email && (
              <li className="flex items-center gap-2.5">
                <Mail size={16} />
                <a href={`mailto:${contact.email}`} className="hover:text-ink">
                  {contact.email}
                </a>
              </li>
            )}
            {contact.address && (
              <li className="flex items-start gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0" />
                <span>{contact.address}</span>
              </li>
            )}
            {contact.hours && <li className="text-ink-3">{contact.hours}</li>}
          </ul>
          {methods.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow">{t.footer.paymentsTitle}</p>
              <p className="mt-2 text-sm text-ink-2">{methods.join(" · ")}</p>
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-2 px-4 py-6 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>{t.footer.rights(new Date().getFullYear(), settings.store.name)}</p>
          {hasDemoContent && (
            <p className="inline-flex items-center gap-2">
              <span className="rounded-[var(--radius-pill)] border border-line-strong px-2 py-0.5 font-medium text-ink-2">
                {t.common.demoStore}
              </span>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
