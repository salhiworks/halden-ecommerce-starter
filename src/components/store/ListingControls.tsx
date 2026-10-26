"use client";

import { Check, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { Facets, SortKey } from "@/lib/domain/catalog-query";
import { buttonClass } from "@/components/ui/button";
import { Drawer } from "@/components/ui/Drawer";
import { useStore } from "./StoreProvider";

/**
 * Filters and sorting for a product listing. Everything lives in the URL, so
 * a filtered page can be shared, bookmarked and reloaded, and the server
 * renders exactly what the shopper sees.
 */

export type FilterLink = { href: string; label: string; active: boolean };

type Props = {
  facets: Facets;
  total: number;
  /** Category or collection links, when the listing is not already scoped. */
  groupLinks?: { title: string; links: FilterLink[] };
  activeCount: number;
};

function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    change(next);
    next.delete("page");
    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };
  return { params, update, pending, pathname };
}

export function SortSelect() {
  const { t } = useStore();
  const { params, update } = useQueryUpdater();
  const current = (params.get("sort") as SortKey) ?? "featured";
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-ink-3 sm:inline">{t.listing.sortBy}</span>
      <select
        value={current}
        onChange={(event) =>
          update((next) => {
            if (event.target.value === "featured") next.delete("sort");
            else next.set("sort", event.target.value);
          })
        }
        className="h-10 rounded-[var(--radius-control)] border border-line bg-paper pe-8 ps-3 font-medium"
      >
        {(Object.keys(t.listing.sort) as SortKey[]).map((key) => (
          <option key={key} value={key}>
            {t.listing.sort[key]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ListingControls({ facets, total, groupLinks, activeCount }: Props) {
  const { t } = useStore();
  const [open, setOpen] = useState(false);
  const { pending } = useQueryUpdater();

  const panel = <FilterPanel facets={facets} groupLinks={groupLinks} />;

  return (
    <>
      {/* Phones and tablets: one button, a drawer full of filters. */}
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={buttonClass({ variant: "outline", size: "sm" })}
        >
          <SlidersHorizontal size={16} />
          {t.listing.filters}
          {activeCount > 0 && (
            <span className="price grid size-5 place-items-center rounded-full bg-ink text-[0.7rem] text-paper">
              {activeCount}
            </span>
          )}
        </button>
        <SortSelect />
      </div>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={t.listing.filterAndSort}
        side="start"
        closeLabel={t.common.close}
        footer={
          <button type="button" onClick={() => setOpen(false)} className={buttonClass({ full: true })}>
            {pending ? t.common.loading : t.listing.showResults(total)}
          </button>
        }
      >
        <div className="px-5 py-2">{panel}</div>
      </Drawer>

      {/* Desktop: a sidebar. */}
      <aside className={`hidden lg:block ${pending ? "opacity-70" : ""}`} aria-label={t.listing.filters}>
        {panel}
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-b border-line py-5 first:pt-0">
      <legend className="eyebrow mb-3 w-full">{title}</legend>
      {children}
    </fieldset>
  );
}

function FilterPanel({ facets, groupLinks }: Pick<Props, "facets" | "groupLinks">) {
  const { t, money } = useStore();
  const { params, update } = useQueryUpdater();
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");

  const toggle = (key: string) =>
    update((next) => {
      if (next.get(key) === "1") next.delete(key);
      else next.set(key, "1");
    });

  const toggleOption = (name: string, value: string) =>
    update((next) => {
      const key = `o.${name}`;
      const values = new Set((next.get(key) ?? "").split(",").filter(Boolean));
      if (values.has(value)) values.delete(value);
      else values.add(value);
      if (values.size === 0) next.delete(key);
      else next.set(key, [...values].join(","));
    });

  const selectedValues = (name: string) => new Set((params.get(`o.${name}`) ?? "").split(",").filter(Boolean));

  return (
    <div className="text-sm">
      {groupLinks && groupLinks.links.length > 0 && (
        <Section title={groupLinks.title}>
          <ul className="space-y-1">
            {groupLinks.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex items-center justify-between rounded-[var(--radius-control)] px-2 py-1.5 hover:bg-canvas ${
                    link.active ? "font-semibold text-ink" : "text-ink-2"
                  }`}
                  aria-current={link.active ? "page" : undefined}
                >
                  {link.label}
                  {link.active && <Check size={15} />}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t.listing.availability}>
        <label className="flex cursor-pointer items-center gap-3 py-1">
          <input
            type="checkbox"
            checked={params.get("stock") === "1"}
            onChange={() => toggle("stock")}
            className="size-4 accent-[var(--accent)]"
          />
          {t.listing.inStockOnly}
        </label>
        <label className="flex cursor-pointer items-center gap-3 py-1">
          <input
            type="checkbox"
            checked={params.get("sale") === "1"}
            onChange={() => toggle("sale")}
            className="size-4 accent-[var(--accent)]"
          />
          {t.listing.onSaleOnly}
        </label>
      </Section>

      {facets.options.map((facet) => {
        const selected = selectedValues(facet.name);
        const swatches = facet.values.some((value) => value.swatch);
        return (
          <Section key={facet.name} title={facet.name}>
            <ul className="flex flex-wrap gap-2">
              {facet.values.map((value) => {
                const active = selected.has(value.label);
                return (
                  <li key={value.label}>
                    <button
                      type="button"
                      onClick={() => toggleOption(facet.name, value.label)}
                      aria-pressed={active}
                      className={`inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] border px-3 transition-colors ${
                        active ? "border-ink bg-ink text-paper" : "border-line hover:border-ink-3"
                      }`}
                    >
                      {swatches && value.swatch && (
                        <span
                          className="size-3.5 rounded-full ring-1 ring-black/10"
                          style={{ background: value.swatch }}
                          aria-hidden="true"
                        />
                      )}
                      {value.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Section>
        );
      })}

      <Section title={t.listing.price}>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            update((next) => {
              if (min.trim()) next.set("min", min.trim());
              else next.delete("min");
              if (max.trim()) next.set("max", max.trim());
              else next.delete("max");
            });
          }}
        >
          <label className="flex-1">
            <span className="mb-1 block text-xs text-ink-3">{t.listing.min}</span>
            <input
              inputMode="decimal"
              value={min}
              onChange={(event) => setMin(event.target.value.replace(/[^\d.]/g, ""))}
              placeholder={money(Math.floor(facets.priceMin))}
              className="h-10 w-full rounded-[var(--radius-control)] border border-line bg-paper px-3"
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs text-ink-3">{t.listing.max}</span>
            <input
              inputMode="decimal"
              value={max}
              onChange={(event) => setMax(event.target.value.replace(/[^\d.]/g, ""))}
              placeholder={money(Math.ceil(facets.priceMax))}
              className="h-10 w-full rounded-[var(--radius-control)] border border-line bg-paper px-3"
            />
          </label>
          <button type="submit" className={buttonClass({ variant: "dark", size: "sm", className: "h-10" })}>
            {t.listing.apply}
          </button>
        </form>
      </Section>
    </div>
  );
}

/** Removable chips for every active filter, plus "Clear all". */
export function ActiveFilters({ chips, clearHref }: { chips: { label: string; href: string }[]; clearHref: string }) {
  const { t } = useStore();
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.href + chip.label}
          href={chip.href}
          scroll={false}
          className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-pill)] bg-canvas px-3 text-sm hover:bg-line"
          aria-label={t.listing.removeFilter(chip.label)}
        >
          {chip.label}
          <X size={14} />
        </Link>
      ))}
      <Link href={clearHref} scroll={false} className="ms-1 text-sm font-semibold underline underline-offset-4">
        {t.listing.clearAll}
      </Link>
    </div>
  );
}
