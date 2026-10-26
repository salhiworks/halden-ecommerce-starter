import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WhatsAppIcon } from "@/components/icons/brands";
import { Container } from "@/components/store/HomeSections";
import { RichText } from "@/components/store/RichText";
import { formatInternational } from "@/lib/domain/phone";
import { isWhatsAppConfigured } from "@/lib/domain/settings";
import { getDictionary } from "@/lib/i18n";
import { getStorefront } from "@/server/storefront";

/**
 * About, delivery, returns, privacy and contact — written by the owner in
 * Settings → Policies, so none of them needs a code change.
 */

const PAGES = ["about", "shipping", "returns", "privacy", "contact"] as const;
type PageSlug = (typeof PAGES)[number];

type Props = { params: Promise<{ slug: string }> };

function isPage(slug: string): slug is PageSlug {
  return (PAGES as readonly string[]).includes(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isPage(slug)) return {};
  const { settings } = await getStorefront();
  return { title: getDictionary(settings.store.language).pages[slug] };
}

export default async function InfoPage({ params }: Props) {
  const { slug } = await params;
  if (!isPage(slug)) notFound();
  const { settings } = await getStorefront();
  const t = getDictionary(settings.store.language);
  const { contact } = settings;

  if (slug === "contact") {
    const rows = [
      isWhatsAppConfigured(settings) && {
        icon: <WhatsAppIcon size={18} />,
        label: t.pages.whatsapp,
        value: (
          <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline" dir="ltr">
            {formatInternational(contact.whatsapp)}
          </a>
        ),
      },
      contact.phone && {
        icon: <Phone size={18} />,
        label: t.pages.phone,
        value: (
          <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="underline-offset-4 hover:underline" dir="ltr">
            {contact.phone}
          </a>
        ),
      },
      contact.email && {
        icon: <Mail size={18} />,
        label: t.pages.email,
        value: (
          <a href={`mailto:${contact.email}`} className="underline-offset-4 hover:underline">
            {contact.email}
          </a>
        ),
      },
      contact.address && { icon: <MapPin size={18} />, label: t.pages.address, value: contact.address },
      contact.hours && { icon: <Clock size={18} />, label: t.pages.hours, value: contact.hours },
    ].filter(Boolean) as { icon: React.ReactNode; label: string; value: React.ReactNode }[];

    return (
      <Container className="max-w-3xl pt-10 sm:pt-16">
        <h1 className="display text-[clamp(2rem,5vw,3.4rem)]">{t.pages.contact}</h1>
        <p className="mt-4 text-ink-2 sm:text-lg">{t.pages.contactIntro}</p>
        <dl className="mt-10 divide-y divide-line border-y border-line">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start gap-4 py-5">
              <span className="mt-0.5 text-ink-2">{row.icon}</span>
              <div>
                <dt className="eyebrow">{row.label}</dt>
                <dd className="mt-1 text-lg">{row.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Container>
    );
  }

  const text = settings.policies[slug];
  return (
    <Container className="max-w-3xl pt-10 sm:pt-16">
      <h1 className="display text-[clamp(2rem,5vw,3.4rem)]">{t.pages[slug]}</h1>
      <div className="mt-8 text-[1.05rem]">
        {text ? <RichText text={text} /> : <p className="text-ink-3">{t.pages.emptyPolicy}</p>}
      </div>
    </Container>
  );
}
