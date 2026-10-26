import { notFound } from "next/navigation";

/**
 * Any address the storefront does not know renders the styled 404 inside the
 * store's own layout (header, footer, language), instead of a bare page.
 */
export default function Missing() {
  notFound();
}
