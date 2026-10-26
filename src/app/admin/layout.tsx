import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../globals.css";
import { fontVariables } from "../fonts";
import { ToastProvider } from "@/components/admin/ui";
import { DEFAULT_SETTINGS } from "@/lib/domain/settings";
import { themeStyle } from "@/lib/theme";
import { getBackend } from "@/server/backend";

/**
 * The dashboard has its own root layout: it is always English and
 * left-to-right, whatever language the storefront is in, and it borrows only
 * the store's accent colour and corner style.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f4f4f1" };

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  let theme = DEFAULT_SETTINGS.theme;
  try {
    theme = (await getBackend().public.loadSettings()).theme;
  } catch {
    // An unreachable database is explained on the sign-in screen.
  }
  return (
    <html
      lang="en"
      dir="ltr"
      className={fontVariables}
      data-pairing="signage"
      style={themeStyle({ ...theme, fontPairing: "signage" }) as React.CSSProperties}
    >
      <body className="min-h-dvh bg-canvas text-ink">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
