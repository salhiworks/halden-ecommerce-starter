"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useFramed } from "@/lib/framed";

/**
 * Runs where the server HTML puts it — just BEFORE the link, while the page is
 * still loading — so a framed page opens the dashboard in a new tab from the first
 * moment the link exists, before React has hydrated. It listens for the click (in
 * the capture phase, ahead of React and next/link) and gives the link its new-tab
 * target just in time; the browser then follows it natively. Outside a frame it
 * does nothing. Same test as useFramed (src/lib/framed.ts).
 */
const NEW_TAB_WHEN_FRAMED = `(function(){var f;try{f=window.self!==window.top}catch(e){f=true}if(!f||window.__demoExploreNewTab)return;window.__demoExploreNewTab=1;document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[data-demo-explore]");if(a){a.target="_blank";a.rel="noopener"}},true)})()`;

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
      <script dangerouslySetInnerHTML={{ __html: NEW_TAB_WHEN_FRAMED }} />
      {framed ? (
        <a href="/admin/login" target="_blank" rel="noopener" className={className} data-demo-explore="">
          {children}
        </a>
      ) : (
        // The script above may already have given this link its new-tab target.
        <Link href="/admin/login" className={className} data-demo-explore="" suppressHydrationWarning>
          {children}
        </Link>
      )}
    </>
  );
}
