import { Archivo, Bodoni_Moda, Bricolage_Grotesque, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";

/**
 * Self-hosted at build time by next/font — no request to Google from the
 * shopper's browser. Only Archivo is preloaded: it is the body face for every
 * theme. The others download only when a theme actually uses them.
 */

export const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni",
  display: "swap",
  preload: false,
});

export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  preload: false,
});

export const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
  preload: false,
});

export const fontVariables = [archivo, bodoni, bricolage, geistMono, plexArabic]
  .map((font) => font.variable)
  .join(" ");
