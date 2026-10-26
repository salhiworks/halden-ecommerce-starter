import "server-only";

/**
 * A small fixed-window rate limiter, in memory. Enough to blunt a script
 * hammering the checkout or the sign-in form on a single-server deployment;
 * behind several servers each one counts on its own.
 */

type Window = { count: number; resetAt: number };
const globalKey = Symbol.for("storefront.rateLimits");
const buckets: Map<string, Window> =
  ((globalThis as Record<symbol, unknown>)[globalKey] as Map<string, Window>) ?? new Map();
(globalThis as Record<symbol, unknown>)[globalKey] = buckets;

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [name, window] of buckets) if (window.resetAt <= now) buckets.delete(name);
  }
  const window = buckets.get(key);
  if (!window || window.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  window.count += 1;
  return window.count <= limit
    ? { ok: true, retryAfterMs: 0 }
    : { ok: false, retryAfterMs: window.resetAt - now };
}
