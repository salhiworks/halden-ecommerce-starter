import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Plain ESM rather than TypeScript on purpose: Node loads a `.mjs` config
 * directly, so it is read the same way on every host — including build images
 * where the native SWC binary that compiles `next.config.ts` will not load.
 */

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Supabase Storage serves dashboard uploads from `<project>.supabase.co`. A
 * project on a custom domain is picked up from SUPABASE_URL at build time.
 */
function supabaseImageHosts() {
  const patterns = [
    {
      protocol: "https",
      hostname: "*.supabase.co",
      pathname: "/storage/v1/object/public/**",
    },
  ];
  try {
    const host = new URL(process.env.SUPABASE_URL ?? "").hostname;
    if (host && !host.endsWith(".supabase.co")) {
      patterns.push({
        protocol: "https",
        hostname: host,
        pathname: "/storage/v1/object/public/**",
      });
    }
  } catch {
    // SUPABASE_URL is unset (local mode) or malformed; the wildcard is enough.
  }
  return patterns;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Pin the workspace root so `next dev` never latches onto a lockfile in a
  // parent directory.
  turbopack: { root: projectRoot },

  images: {
    remotePatterns: supabaseImageHosts(),
    // Bundled demo photography and local-mode uploads.
    localPatterns: [{ pathname: "/demo/**" }, { pathname: "/media/**" }],
    deviceSizes: [360, 480, 640, 828, 1080, 1280, 1600, 1920],
    imageSizes: [64, 96, 128, 200, 256, 384],
    formats: ["image/webp"],
    qualities: [75, 85],
  },

  experimental: {
    serverActions: {
      // A product with many variants and long copy is still far below this;
      // photographs never travel through an action (see /api/admin/media).
      bodySizeLimit: "2mb",
    },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      {
        // The dashboard is never indexed and never framed.
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
