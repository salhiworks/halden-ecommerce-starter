"use client";

import { Menu, Search, ShoppingBag, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { setCartDrawer, useCartLines } from "@/lib/cart/store";
import { formatMoney } from "@/lib/domain/money";
import { searchAction, type SearchHit } from "@/server/actions/storefront";
import { Drawer } from "@/components/ui/Drawer";
import { useStore } from "./StoreProvider";

/* ------------------------------------------------------------------- bag */

export function CartButton() {
  const { lines, hydrated } = useCartLines();
  const { t } = useStore();
  const count = hydrated ? lines.reduce((total, line) => total + line.quantity, 0) : 0;
  return (
    <button
      type="button"
      onClick={() => setCartDrawer(true)}
      className="relative grid size-11 place-items-center rounded-full hover:bg-canvas"
      aria-label={t.nav.openCart(count)}
      data-testid="cart-button"
    >
      <ShoppingBag size={21} strokeWidth={1.8} />
      {count > 0 && (
        <span className="price absolute end-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[0.68rem] font-bold leading-5 text-accent-ink">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

/* ---------------------------------------------------------------- search */

export function SearchButton() {
  const [open, setOpen] = useState(false);
  const { t } = useStore();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-11 place-items-center rounded-full hover:bg-canvas"
        aria-label={t.nav.search}
      >
        <Search size={20} strokeWidth={1.8} />
      </button>
      {open && <SearchPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const { t, config } = useStore();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      startTransition(async () => setHits(await searchAction(term)));
    }, 160);
    return () => clearTimeout(timer);
  }, [query]);
  // Under two letters there is nothing to suggest.
  const shown = query.trim().length < 2 ? [] : hits;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
      className="fixed inset-x-0 top-0 m-0 w-full max-w-none bg-transparent p-0 backdrop:bg-ink/40"
    >
      <div className="bg-paper shadow-xl">
        <form
          role="search"
          className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            const term = query.trim();
            dialog.current?.close();
            router.push(term ? `/shop?q=${encodeURIComponent(term)}` : "/shop");
          }}
        >
          <Search size={20} className="shrink-0 text-ink-3" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.nav.searchPlaceholder}
            aria-label={t.nav.searchPlaceholder}
            className="h-12 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-ink-3"
            enterKeyHint="search"
          />
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-canvas"
            aria-label={t.common.close}
          >
            <X size={20} />
          </button>
        </form>
        {(shown.length > 0 || pending) && (
          <div className="border-t border-line">
            <ul className="mx-auto grid max-w-3xl gap-1 px-3 py-3" aria-busy={pending}>
              {shown.map((hit) => (
                <li key={hit.slug}>
                  <Link
                    href={`/products/${hit.slug}`}
                    onClick={() => dialog.current?.close()}
                    className="flex items-center gap-4 rounded-[var(--radius-control)] px-2 py-2 hover:bg-canvas"
                  >
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-tile">
                      {hit.imageUrl && <Image src={hit.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{hit.name}</span>
                    <span className="price text-sm">
                      {hit.varies
                        ? t.product.from(formatMoney(hit.price, config.money))
                        : formatMoney(hit.price, config.money)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </dialog>
  );
}

/* ------------------------------------------------------------ mobile menu */

export type MenuLink = { href: string; label: string };

export function MobileMenu({
  storeName,
  primary,
  secondary,
}: {
  storeName: string;
  primary: MenuLink[];
  secondary: MenuLink[];
}) {
  const [open, setOpen] = useState(false);
  const { t } = useStore();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-11 place-items-center rounded-full hover:bg-canvas lg:hidden"
        aria-label={t.common.menu}
      >
        <Menu size={21} strokeWidth={1.8} />
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title={storeName} side="start" closeLabel={t.common.close}>
        <nav className="flex flex-col px-5 py-4">
          <ul className="flex flex-col">
            {primary.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="display flex items-center justify-between border-b border-line py-4 text-[1.35rem]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="mt-6 flex flex-col gap-1">
            {secondary.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block py-2 text-sm text-ink-2 hover:text-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Drawer>
    </>
  );
}
