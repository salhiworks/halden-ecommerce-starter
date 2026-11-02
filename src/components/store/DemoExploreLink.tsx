"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useFramed } from "@/lib/framed";

/**
 * The demo band's "Explore the dashboard". The dashboard is never shown inside
 * another site's frame (next.config.mjs), and its guest preview keeps a cookie a
 * browser will not store for a framed page — so from inside the Profit Studio
 * showcase it opens in a new tab, where it works exactly as on the demo itself.
 */
export function DemoExploreLink({ className, children }: { className?: string; children: ReactNode }) {
  const framed = useFramed();
  return framed ? (
    <a href="/admin/login" target="_blank" rel="noopener" className={className}>
      {children}
    </a>
  ) : (
    <Link href="/admin/login" className={className}>
      {children}
    </Link>
  );
}
