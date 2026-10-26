"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GalleryHorizontalEnd,
  LayoutGrid,
  Megaphone,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
} from "lucide-react";
import Image from "next/image";
import { useState, type CSSProperties, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import {
  CORNER_STYLES,
  FONT_PAIRINGS,
  type HomepageSection,
  type HomepageSectionType,
  type StoreSettings,
} from "@/lib/domain/settings";
import { ACCENT_PRESETS, accentText, readableOn, themeStyle } from "@/lib/theme";
import { uid } from "@/lib/uid";
import { ImagePicker } from "./ImagePicker";
import { errorsUnder, SettingsPanel, useSettingsDraft } from "./settings-kit";
import { Notice, Pill, SelectField, TextAreaField, TextField, Toggle } from "./ui";

type Theme = StoreSettings["theme"];
type GroupingRef = { id: string; name: string; slug: string };

/** Links offered while typing a button's destination. */
export type LinkSuggestion = { href: string; label: string };

function LinkSuggestions({ id, links }: { id: string; links: LinkSuggestion[] }) {
  return (
    <datalist id={id}>
      {links.map((link) => (
        <option key={link.href} value={link.href}>
          {link.label}
        </option>
      ))}
    </datalist>
  );
}

/* ------------------------------------------------------------------ theme */

const PAIRINGS: Record<Theme["fontPairing"], { name: string; text: string }> = {
  signage: { name: "Signage", text: "Wide capitals, like the sign above a shop." },
  editorial: { name: "Editorial", text: "A high-contrast serif for fashion, beauty and home." },
  friendly: { name: "Friendly", text: "A warm grotesque for everyday goods." },
};

const CORNERS: Record<Theme["corners"], string> = { sharp: "Sharp", soft: "Soft", round: "Round" };

const isHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

/** A real product of the store, shown in the theme preview. */
export type PreviewProduct = { name: string; price: string; imageUrl: string; discount: number | null };

export function ThemePanel({ storeName, sample }: { storeName: string; sample: PreviewProduct | null }) {
  const form = useSettingsDraft({
    read: (settings) => settings.theme,
    write: (draft) => ({ section: "theme", value: draft }),
    validate: (draft) => (isHex(draft.accent) ? {} : { accent: "Use a 6-digit hex colour like #0F4C5C" }),
    saved: "Theme saved",
  });
  const { draft, patch, errors } = form;
  const [hexText, setHexText] = useState(draft.accent);
  const [lastAccent, setLastAccent] = useState(draft.accent);
  if (draft.accent !== lastAccent) {
    setLastAccent(draft.accent);
    setHexText(draft.accent);
  }
  const preset = ACCENT_PRESETS.find((candidate) => candidate.value.toLowerCase() === draft.accent.toLowerCase());
  const previewTheme = isHex(draft.accent) ? draft : { ...draft, accent: "#0F4C5C" };

  return (
    <SettingsPanel
      id="theme"
      title="Look"
      description="Colour, type and corners for the whole shop. The dashboard keeps its own type, so it stays familiar."
      dirty={form.dirty}
      busy={form.busy}
      onSave={form.save}
      onReset={form.reset}
      testId="storefront-theme"
    >
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-7">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Accent colour</legend>
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Accent colour">
              {ACCENT_PRESETS.map((option) => {
                const selected = option.value === preset?.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={option.name}
                    title={option.name}
                    onClick={() => patch({ accent: option.value })}
                    className={`grid size-10 place-items-center rounded-full border-2 transition-colors ${
                      selected ? "border-ink" : "border-transparent hover:border-line-strong"
                    }`}
                  >
                    <span className="size-7 rounded-full" style={{ background: option.value }} />
                  </button>
                );
              })}
              <label
                className={`flex h-10 items-center gap-2 rounded-full border-2 ps-1.5 pe-3 text-sm ${
                  preset ? "border-transparent" : "border-ink"
                }`}
              >
                <input
                  type="color"
                  value={isHex(draft.accent) ? draft.accent : "#0F4C5C"}
                  onChange={(event) => patch({ accent: event.target.value.toUpperCase() })}
                  className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                  aria-label="Pick a custom colour"
                />
                Custom
              </label>
            </div>
            <TextField
              label="Hex code"
              className="mt-4 max-w-40"
              value={hexText}
              maxLength={7}
              error={errors.accent}
              onChange={(event) => {
                const value = event.target.value.trim();
                setHexText(value);
                const normalised = value.startsWith("#") ? value : `#${value}`;
                if (isHex(normalised)) patch({ accent: normalised.toUpperCase() });
              }}
              spellCheck={false}
            />
            {isHex(draft.accent) && accentText(draft.accent) !== draft.accent && (
              <p className="mt-2 text-xs text-ink-3">
                A light colour: it fills buttons and badges, while links and small text use dark ink so they stay readable.
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Type</legend>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Type">
              {FONT_PAIRINGS.map((pairing) => {
                const selected = draft.fontPairing === pairing;
                return (
                  <button
                    key={pairing}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => patch({ fontPairing: pairing })}
                    data-pairing={pairing}
                    style={themeStyle({ ...previewTheme, fontPairing: pairing }) as CSSProperties}
                    className={`rounded-[12px] border-2 p-4 text-start transition-colors ${
                      selected ? "border-ink bg-canvas" : "border-line hover:border-line-strong"
                    }`}
                  >
                    <span className="display block text-2xl">New in</span>
                    <span className="mt-3 block text-sm font-semibold">{PAIRINGS[pairing].name}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">{PAIRINGS[pairing].text}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Corners</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Corners">
              {CORNER_STYLES.map((corners) => {
                const selected = draft.corners === corners;
                const radius = corners === "sharp" ? "0" : corners === "soft" ? "8px" : "16px";
                return (
                  <button
                    key={corners}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => patch({ corners })}
                    className={`flex items-center gap-3 rounded-[12px] border-2 py-2.5 ps-3 pe-4 text-sm font-medium transition-colors ${
                      selected ? "border-ink bg-canvas" : "border-line hover:border-line-strong"
                    }`}
                  >
                    <span
                      className="size-8 border-2 border-ink-2 bg-paper"
                      style={{ borderRadius: radius, borderEndEndRadius: radius }}
                      aria-hidden
                    />
                    {CORNERS[corners]}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <ThemePreview theme={previewTheme} storeName={storeName} sample={sample} />
      </div>
    </SettingsPanel>
  );
}

function ThemePreview({ theme, storeName, sample }: { theme: Theme; storeName: string; sample: PreviewProduct | null }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">Preview</p>
      <div
        data-pairing={theme.fontPairing}
        style={themeStyle(theme) as CSSProperties}
        className="overflow-hidden rounded-[14px] border border-line bg-paper"
        aria-hidden
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="display truncate text-base">{storeName}</span>
          <ShoppingBag size={16} />
        </div>
        <div className="p-4">
          <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-tile">
            {sample ? (
              <Image src={sample.imageUrl} alt="" fill sizes="320px" className="object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-xs text-ink-3">Product photo</span>
            )}
            {sample?.discount != null && (
              <span
                className="price absolute start-2.5 top-2.5 rounded-pill px-2.5 py-1 text-[0.7rem] font-bold"
                style={{ background: theme.accent, color: readableOn(theme.accent) }}
              >
                Save {sample.discount}%
              </span>
            )}
          </div>
          <p className="mt-3 text-sm font-medium">{sample?.name ?? "Product name"}</p>
          <p className="price text-sm text-ink-2">{sample?.price ?? "Price"}</p>
          <span className={buttonClass({ full: true, className: "mt-3" })}>Add to bag</span>
          <p className="mt-3 text-xs">
            <span className="font-semibold underline underline-offset-4" style={{ color: accentText(theme.accent) }}>
              Delivery and returns
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- announcement */

export function AnnouncementPanel({ links }: { links: LinkSuggestion[] }) {
  const form = useSettingsDraft({
    read: (settings) => settings.homepage.announcement,
    write: (draft, settings) => ({ section: "homepage", value: { ...settings.homepage, announcement: draft } }),
    validate: (draft) => (draft.enabled && !draft.text.trim() ? { text: "Write the message, or switch the bar off." } : {}),
    saved: "Announcement saved",
  });
  const { draft, patch } = form;
  const errors = { ...errorsUnder(form.errors, "announcement"), ...form.errors };

  return (
    <SettingsPanel
      id="announcement"
      title="Announcement bar"
      description="A thin strip above the header on every page — a delivery promise, a sale, opening hours."
      dirty={form.dirty}
      busy={form.busy}
      onSave={form.save}
      onReset={form.reset}
    >
      <div className="space-y-5">
        <Toggle checked={draft.enabled} onChange={(value) => patch({ enabled: value })} label="Show the announcement bar" />
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            label="Message"
            value={draft.text}
            maxLength={140}
            error={errors.text}
            placeholder="Free delivery on orders over $75"
            onChange={(event) => patch({ text: event.target.value })}
          />
          <TextField
            label="Link"
            optional
            list="announcement-links"
            value={draft.href}
            error={errors.href}
            placeholder="/collections/gift-guide"
            onChange={(event) => patch({ href: event.target.value })}
            hint="Makes the whole bar a link. A page of your shop, or a full https:// address."
          />
          <LinkSuggestions id="announcement-links" links={links} />
        </div>
      </div>
    </SettingsPanel>
  );
}

/* ------------------------------------------------------------------ hero */

export function HeroPanel({ links }: { links: LinkSuggestion[] }) {
  const form = useSettingsDraft({
    read: (settings) => settings.homepage.hero,
    write: (draft, settings) => ({ section: "homepage", value: { ...settings.homepage, hero: draft } }),
    saved: "Homepage banner saved",
  });
  const { draft, patch } = form;
  const errors = errorsUnder(form.errors, "hero");

  return (
    <SettingsPanel
      id="hero"
      title="Top of the homepage"
      description="The first thing shoppers see: a photo, a headline and up to two buttons."
      dirty={form.dirty}
      busy={form.busy}
      onSave={form.save}
      onReset={form.reset}
      testId="storefront-hero"
    >
      <div className="space-y-5">
        <Toggle
          checked={draft.enabled}
          onChange={(value) => patch({ enabled: value })}
          label="Show the photo and headline"
          description="When off, the homepage starts with your sections."
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <TextField
              label="Small line above the headline"
              optional
              value={draft.eyebrow}
              maxLength={60}
              error={errors.eyebrow}
              placeholder="New this season"
              onChange={(event) => patch({ eyebrow: event.target.value })}
            />
            <TextField
              label="Headline"
              value={draft.heading}
              maxLength={100}
              error={errors.heading}
              onChange={(event) => patch({ heading: event.target.value })}
              data-testid="hero-heading"
            />
            <TextAreaField
              label="Text"
              optional
              rows={3}
              maxLength={240}
              value={draft.text}
              error={errors.text}
              onChange={(event) => patch({ text: event.target.value })}
            />
          </div>
          <ImagePicker
            label="Photo"
            value={draft.imageUrl}
            onChange={(url) => patch({ imageUrl: url })}
            aspect="aspect-[16/9]"
            hint="Landscape, at least 2000 px wide. Without one, the headline stands on its own in large type."
          />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            label="Main button"
            optional
            value={draft.primaryLabel}
            maxLength={40}
            placeholder="Shop now"
            error={errors.primaryLabel}
            onChange={(event) => patch({ primaryLabel: event.target.value })}
          />
          <TextField
            label="Main button goes to"
            optional
            list="hero-links"
            value={draft.primaryHref}
            placeholder="/shop"
            error={errors.primaryHref}
            onChange={(event) => patch({ primaryHref: event.target.value })}
          />
          <TextField
            label="Second button"
            optional
            value={draft.secondaryLabel}
            maxLength={40}
            placeholder="Gift guide"
            error={errors.secondaryLabel}
            onChange={(event) => patch({ secondaryLabel: event.target.value })}
          />
          <TextField
            label="Second button goes to"
            optional
            list="hero-links"
            value={draft.secondaryHref}
            placeholder="/collections/gift-guide"
            error={errors.secondaryHref}
            onChange={(event) => patch({ secondaryHref: event.target.value })}
          />
          <LinkSuggestions id="hero-links" links={links} />
        </div>
      </div>
    </SettingsPanel>
  );
}

/* -------------------------------------------------------------- sections */

const SECTION_TYPES: Record<HomepageSectionType, { name: string; icon: ReactNode; text: string; single: boolean }> = {
  categories: {
    name: "Categories",
    icon: <LayoutGrid size={17} />,
    text: "Your visible categories as a store directory.",
    single: true,
  },
  products: {
    name: "Product row",
    icon: <GalleryHorizontalEnd size={17} />,
    text: "A row of featured, new, on-sale or collection products.",
    single: false,
  },
  banner: {
    name: "Banner",
    icon: <Megaphone size={17} />,
    text: "A wide photo with a message and a button.",
    single: false,
  },
  collections: {
    name: "Collections",
    icon: <Sparkles size={17} />,
    text: "Cards for your visible collections.",
    single: true,
  },
  highlights: {
    name: "Delivery and payment",
    icon: <Truck size={17} />,
    text: "Your delivery, free-delivery and payment promises, taken from Settings.",
    single: true,
  },
};

const SOURCE_LABELS = {
  featured: "Featured products",
  new: "Newest products",
  sale: "On sale",
  collection: "From a collection",
} as const;

function newSection(type: HomepageSectionType, collections: GroupingRef[]): HomepageSection {
  const id = `${type}-${uid().slice(0, 6)}`;
  switch (type) {
    case "categories":
      return { id, type, enabled: true, title: "Shop by category" };
    case "collections":
      return { id, type, enabled: true, title: "Collections" };
    case "highlights":
      return { id, type, enabled: true };
    case "banner":
      return {
        id,
        type,
        enabled: true,
        eyebrow: "",
        heading: "",
        text: "",
        imageUrl: "",
        linkLabel: "",
        linkHref: "",
        align: "start",
      };
    case "products":
      return {
        id,
        type,
        enabled: true,
        title: collections[0] ? collections[0].name : "Featured",
        source: collections[0] ? "collection" : "featured",
        collectionId: collections[0]?.id ?? null,
        limit: 4,
      };
  }
}

function summary(section: HomepageSection, collections: GroupingRef[]): string {
  switch (section.type) {
    case "products": {
      const source =
        section.source === "collection"
          ? `From “${collections.find((collection) => collection.id === section.collectionId)?.name ?? "a deleted collection"}”`
          : SOURCE_LABELS[section.source];
      return `${source} · up to ${section.limit}`;
    }
    case "banner":
      return section.heading || "No headline yet";
    default:
      return SECTION_TYPES[section.type].text;
  }
}

export function SectionsPanel({ collections, links }: { collections: GroupingRef[]; links: LinkSuggestion[] }) {
  const form = useSettingsDraft({
    read: (settings) => settings.homepage.sections,
    write: (draft, settings) => ({ section: "homepage", value: { ...settings.homepage, sections: draft } }),
    validate: (draft) => {
      const problems: Record<string, string> = {};
      draft.forEach((section, index) => {
        if (section.type === "products" && section.source === "collection" && !section.collectionId) {
          problems[`sections.${index}.collectionId`] = "Choose a collection";
        }
        if (section.type === "banner" && !section.heading.trim() && !section.imageUrl) {
          problems[`sections.${index}.heading`] = "Add a headline or a photo";
        }
      });
      return problems;
    },
    saved: "Homepage sections saved",
  });
  const { draft: sections, setDraft } = form;
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const update = (index: number, changes: Partial<HomepageSection>) =>
    setDraft((current) =>
      current.map((section, position) => (position === index ? ({ ...section, ...changes } as HomepageSection) : section)),
    );
  const move = (index: number, delta: number) =>
    setDraft((current) => {
      const next = [...current];
      const [section] = next.splice(index, 1);
      next.splice(index + delta, 0, section);
      return next;
    });

  const available = (Object.keys(SECTION_TYPES) as HomepageSectionType[]).filter(
    (type) => !SECTION_TYPES[type].single || !sections.some((section) => section.type === type),
  );

  return (
    <SettingsPanel
      id="sections"
      title="Homepage sections"
      description="Everything below the top of the homepage, in this order. A section with nothing to show — no products on sale, say — stays hidden."
      dirty={form.dirty}
      busy={form.busy}
      onSave={form.save}
      onReset={form.reset}
      testId="storefront-sections"
    >
      <ol className="space-y-2">
        {sections.map((section, index) => {
          const meta = SECTION_TYPES[section.type];
          const expanded = open === section.id;
          const sectionErrors = errorsUnder(form.errors, `sections.${index}`);
          const title = "title" in section && section.title ? section.title : meta.name;
          return (
            <li
              key={section.id}
              className={`rounded-[12px] border ${Object.keys(sectionErrors).length > 0 ? "border-danger" : "border-line"} ${
                section.enabled ? "" : "bg-canvas/60"
              }`}
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="grid size-6 place-items-center rounded text-ink-3 hover:bg-canvas hover:text-ink disabled:opacity-30"
                    aria-label={`Move ${title} up`}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === sections.length - 1}
                    className="grid size-6 place-items-center rounded text-ink-3 hover:bg-canvas hover:text-ink disabled:opacity-30"
                    aria-label={`Move ${title} down`}
                  >
                    <ArrowDown size={14} />
                  </button>
                </span>
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-canvas text-ink-2">{meta.icon}</span>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : section.id)}
                  className="min-w-0 flex-1 text-start"
                  aria-expanded={expanded}
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{title}</span>
                    {!section.enabled && <Pill tone="muted">Hidden</Pill>}
                  </span>
                  <span className="block truncate text-xs text-ink-3">{summary(section, collections)}</span>
                </button>
                <label className="hidden items-center gap-2 text-xs text-ink-3 sm:flex">
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    onChange={(event) => update(index, { enabled: event.target.checked })}
                    className="size-4 accent-[var(--accent)]"
                  />
                  Show
                </label>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : section.id)}
                  className="grid size-8 place-items-center rounded-[8px] text-ink-2 hover:bg-canvas"
                  aria-label={expanded ? `Close ${title}` : `Edit ${title}`}
                >
                  <ChevronDown size={16} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
              </div>
              {expanded && (
                <div className="space-y-4 border-t border-line px-4 py-4">
                  <label className="flex items-center gap-2 text-sm sm:hidden">
                    <input
                      type="checkbox"
                      checked={section.enabled}
                      onChange={(event) => update(index, { enabled: event.target.checked })}
                      className="size-4 accent-[var(--accent)]"
                    />
                    Show this section
                  </label>
                  <SectionFields
                    section={section}
                    errors={sectionErrors}
                    collections={collections}
                    links={links}
                    onChange={(changes) => update(index, changes)}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setDraft((current) => current.filter((_, position) => position !== index))}
                      className="inline-flex h-8 items-center gap-1 rounded-[8px] px-2 text-sm text-ink-3 hover:bg-canvas hover:text-danger"
                    >
                      <Trash2 size={14} /> Remove section
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {sections.length === 0 && (
        <Notice tone="info">No sections: the homepage shows only its top banner. Add one below.</Notice>
      )}

      {sections.length < 16 &&
        (adding ? (
          <div className="mt-4 rounded-[12px] border border-dashed border-line-strong p-3">
            <p className="mb-2 px-1 text-sm font-medium">Add a section</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {available.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    const section = newSection(type, collections);
                    setDraft((current) => [...current, section]);
                    setOpen(section.id);
                    setAdding(false);
                  }}
                  className="flex items-start gap-3 rounded-[10px] p-3 text-start hover:bg-canvas"
                >
                  <span className="mt-0.5 text-ink-2">{SECTION_TYPES[type].icon}</span>
                  <span>
                    <span className="block text-sm font-medium">{SECTION_TYPES[type].name}</span>
                    <span className="block text-xs text-ink-3">{SECTION_TYPES[type].text}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={() => setAdding(false)} className={buttonClass({ variant: "ghost", size: "sm" })}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={buttonClass({ variant: "outline", size: "sm", className: "mt-4" })}
            data-testid="add-section"
          >
            <Plus size={15} /> Add section
          </button>
        ))}
    </SettingsPanel>
  );
}

function SectionFields({
  section,
  errors,
  collections,
  links,
  onChange,
}: {
  section: HomepageSection;
  errors: Record<string, string>;
  collections: GroupingRef[];
  links: LinkSuggestion[];
  onChange: (changes: Partial<HomepageSection>) => void;
}) {
  const listId = `links-${section.id}`;
  switch (section.type) {
    case "categories":
    case "collections":
      return (
        <TextField
          label="Heading"
          optional
          value={section.title}
          maxLength={80}
          error={errors.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      );
    case "highlights":
      return (
        <p className="text-sm text-ink-2">
          Nothing to write here: this section reads your delivery options, free-delivery amount and payment methods from
          Settings, so it is always accurate.
        </p>
      );
    case "products":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Heading"
            optional
            value={section.title}
            maxLength={80}
            error={errors.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
          <SelectField
            label="Show"
            value={section.source}
            onChange={(event) => {
              const source = event.target.value as (typeof section)["source"];
              onChange({
                source,
                collectionId: source === "collection" ? (section.collectionId ?? collections[0]?.id ?? null) : section.collectionId,
              });
            }}
          >
            {(Object.keys(SOURCE_LABELS) as (keyof typeof SOURCE_LABELS)[]).map((source) => (
              <option key={source} value={source} disabled={source === "collection" && collections.length === 0}>
                {SOURCE_LABELS[source]}
              </option>
            ))}
          </SelectField>
          {section.source === "collection" && (
            <SelectField
              label="Collection"
              value={section.collectionId ?? ""}
              error={errors.collectionId}
              onChange={(event) => onChange({ collectionId: event.target.value || null })}
            >
              <option value="">Choose…</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </SelectField>
          )}
          <SelectField
            label="How many"
            value={String(section.limit)}
            onChange={(event) => onChange({ limit: Number(event.target.value) })}
          >
            {[2, 3, 4, 6, 8, 10, 12].map((count) => (
              <option key={count} value={count}>
                Up to {count}
              </option>
            ))}
          </SelectField>
          {section.source === "featured" && (
            <p className="text-xs text-ink-3 md:col-span-2">
              Mark products as featured in their editor. Until you do, this row picks from across the shop, newest first.
            </p>
          )}
        </div>
      );
    case "banner":
      return (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <TextField
              label="Small line"
              optional
              value={section.eyebrow}
              maxLength={60}
              onChange={(event) => onChange({ eyebrow: event.target.value })}
            />
            <TextField
              label="Headline"
              value={section.heading}
              maxLength={100}
              error={errors.heading}
              onChange={(event) => onChange({ heading: event.target.value })}
            />
            <TextAreaField
              label="Text"
              optional
              rows={2}
              maxLength={240}
              value={section.text}
              onChange={(event) => onChange({ text: event.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Button"
                optional
                value={section.linkLabel}
                maxLength={40}
                onChange={(event) => onChange({ linkLabel: event.target.value })}
              />
              <TextField
                label="Button goes to"
                optional
                list={listId}
                value={section.linkHref}
                error={errors.linkHref}
                placeholder="/collections/…"
                onChange={(event) => onChange({ linkHref: event.target.value })}
              />
              <LinkSuggestions id={listId} links={links} />
            </div>
          </div>
          <div className="space-y-4">
            <ImagePicker
              label="Photo"
              value={section.imageUrl}
              onChange={(url) => onChange({ imageUrl: url })}
              aspect="aspect-[2/1]"
              hint="Wide, at least 2000 px."
            />
            <SelectField
              label="Text card"
              value={section.align}
              onChange={(event) => onChange({ align: event.target.value as "start" | "end" })}
            >
              <option value="start">On the left</option>
              <option value="end">On the right</option>
            </SelectField>
          </div>
        </div>
      );
  }
}
