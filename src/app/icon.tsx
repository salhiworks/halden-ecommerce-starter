import { ImageResponse } from "next/og";
import { readableOn } from "@/lib/theme";
import { getStorefront } from "@/server/storefront";

/**
 * The browser-tab icon: the store's initial on its accent colour. It follows
 * the store name and theme set in the dashboard, so a new store never shows
 * someone else's logo.
 */

export const dynamic = "force-dynamic";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  let letter = "S";
  let accent = "#0F4C5C";
  try {
    const { settings } = await getStorefront();
    letter = (settings.store.name.trim()[0] ?? "S").toUpperCase();
    accent = settings.theme.accent;
  } catch {
    // Fall back to the defaults if the store cannot be loaded.
  }
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: accent,
          color: readableOn(accent),
          borderRadius: 14,
          fontSize: 40,
          fontWeight: 700,
        }}
      >
        {letter}
      </div>
    ),
    size,
  );
}
