"use client";

import {
  Brush,
  Eye,
  ExternalLink,
  FolderTree,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { endPreviewAction, signOutAction } from "@/server/actions/admin";
import { PreviewProvider } from "./preview";

type Props = {
  storeName: string;
  userEmail: string;
  backendKind: "local" | "supabase";
  ordersNeedingAttention: number;
  /** The public demo's read-only dashboard preview. */
  preview?: boolean;
  children: ReactNode;
};

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ReceiptText },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/collections", label: "Collections", icon: Layers },
  { href: "/admin/storefront", label: "Storefront", icon: Brush },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ storeName, userEmail, backendKind, ordersNeedingAttention, preview = false, children }: Props) {
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Dashboard">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-ink text-paper" : "text-ink-2 hover:bg-canvas hover:text-ink"
            }`}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span className="flex-1">{label}</span>
            {href === "/admin/orders" && ordersNeedingAttention > 0 && (
              <span
                className={`price grid min-w-5 place-items-center rounded-full px-1.5 text-[0.7rem] font-bold leading-5 ${
                  active ? "bg-paper text-ink" : "bg-accent text-accent-ink"
                }`}
                aria-label={`${ordersNeedingAttention} need attention`}
              >
                {ordersNeedingAttention}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-5 pt-6">
        <p className="display truncate text-lg">{storeName}</p>
        <Link
          href="/"
          target="_blank"
          className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-ink-3 hover:text-ink"
        >
          View store <ExternalLink size={12} />
        </Link>
      </div>
      {nav}
      <div className="border-t border-line p-4">
        {backendKind === "local" && !preview && (
          <p className="mb-3 rounded-[8px] bg-warning-soft px-3 py-2 text-xs leading-snug text-warning">
            <span className="font-semibold">Local mode.</span> Data is saved in this computer&apos;s{" "}
            <code>.data</code> folder. Connect Supabase before going live.
          </p>
        )}
        <p className="truncate text-xs text-ink-3" title={userEmail}>
          {userEmail}
        </p>
        <form action={preview ? endPreviewAction : signOutAction}>
          <button type="submit" className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-ink-2 hover:text-ink">
            <LogOut size={16} /> {preview ? "Leave preview" : "Sign out"}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh border-e border-line bg-paper lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper px-4 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-full hover:bg-canvas" aria-label="Open menu">
          <Menu size={20} />
        </button>
        <p className="display truncate px-3 text-base">{storeName}</p>
        <Link href="/" target="_blank" className="grid size-10 place-items-center rounded-full hover:bg-canvas" aria-label="View store">
          <ExternalLink size={18} />
        </Link>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="absolute inset-y-0 start-0 w-72 bg-paper shadow-xl">
            <button type="button" onClick={() => setOpen(false)} className="absolute end-3 top-4 grid size-9 place-items-center rounded-full hover:bg-canvas" aria-label="Close menu">
              <X size={18} />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 pb-24 pt-6 sm:px-8 sm:pt-10">
        <div className="mx-auto max-w-6xl">
          {preview && (
            <div
              className="mb-6 flex items-start gap-3 rounded-[12px] border border-info/30 bg-info-soft px-4 py-3 text-sm text-info"
              data-testid="preview-banner"
            >
              <Eye size={18} className="mt-0.5 shrink-0" />
              <p>
                <span className="font-semibold">You&apos;re exploring a read-only preview of the dashboard.</span> Look
                around and try the controls — nothing you change is saved. The orders are samples made up for the preview.
              </p>
            </div>
          )}
          <PreviewProvider preview={preview}>{children}</PreviewProvider>
        </div>
      </main>
    </div>
  );
}
