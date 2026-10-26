/**
 * A random id for things created in the browser (photos, variants, rows).
 * `crypto.randomUUID` only exists in secure contexts, so a dashboard opened
 * over plain http on a local network falls back to a time-and-random id.
 */
export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`;
}
