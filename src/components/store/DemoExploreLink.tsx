"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useFramed } from "@/lib/framed";

/**
 * Runs where the server HTML puts it — right after the link, while the page is
 * still loading — so a framed page opens the dashboard in a new tab from the first
 * moment the link can be clicked, before React has hydrated. Outside a frame it
 * does nothing. Same test as useFramed (src/lib/framed.ts).
 */
const NEW_TAB_WHEN_FRAMED = `(function(){var f;try{f=window.self!==window.top}catch(e){f=true}if(!f)return;var a=document.querySelectorAll("a[data-demo-explore]");for(var i=0;i<a.length;i++){a[i].target="_blank";a[i].rel="noopener"}})()`;

/**
 * The demo band's "Explore the dashboard". The dashboard is never shown inside
 * another site's frame (next.config.mjs), and its guest preview keeps a cookie a
 * browser will not store for a framed page — so from inside the Profit Studio
 * showcase it opens in a new tab, where it works exactly as on the demo itself.
 */
export function DemoExploreLink({ className, children }: { className?: string; children: ReactNode }) {
  const framed = useFramed();
  return (
    <>
      {framed ? (
        <a href="/admin/login" target="_blank" rel="noopener" className={className} data-demo-explore="">
          {children}
        </a>
      ) : (
        // The script below may already have given this link its new-tab target.
        <Link href="/admin/login" className={className} data-demo-explore="" suppressHydrationWarning>
          {children}
        </Link>
      )}
      <script dangerouslySetInnerHTML={{ __html: NEW_TAB_WHEN_FRAMED }} />
    </>
  );
}
