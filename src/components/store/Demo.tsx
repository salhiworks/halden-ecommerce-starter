import { Info } from "lucide-react";
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";

/**
 * Shown only in public demo mode (PUBLIC_DEMO_MODE): a band above the shop
 * that says what it is and opens the dashboard preview, and a note where a
 * shopper might otherwise think an order is real.
 */

export function DemoBar({ storeName, t }: { storeName: string; t: Dictionary }) {
  return (
    <div className="bg-ink text-paper" data-testid="demo-bar">
      <p className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-4 py-2 text-center text-[0.78rem]">
        <span>{t.demo.bar(storeName)}</span>
        <Link href="/admin/login" className="font-semibold underline underline-offset-4">
          {t.demo.explore}
          <span aria-hidden="true" className="flip-rtl ms-1 inline-block">
            →
          </span>
        </Link>
      </p>
    </div>
  );
}

export function DemoNotice({ children }: { children: string }) {
  return (
    <p
      className="flex items-start gap-2.5 rounded-[var(--radius-control)] bg-info-soft px-4 py-3 text-sm font-medium text-info"
      data-testid="demo-notice"
    >
      <Info size={17} className="mt-0.5 shrink-0" />
      {children}
    </p>
  );
}
