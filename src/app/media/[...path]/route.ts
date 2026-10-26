import { readFile } from "node:fs/promises";
import path from "node:path";
import { uploadsDir } from "@/server/backend/local";

/**
 * Serves photos uploaded while running the local backend. (With Supabase,
 * uploads are served by Supabase Storage and this route is unused.)
 *
 * File names are random UUIDs, so a URL never changes meaning and can be
 * cached forever. Paths are confined to the uploads folder.
 */

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const parts = (await context.params).path;
  if (parts.some((part) => !/^[A-Za-z0-9._-]+$/.test(part) || part.startsWith("."))) {
    return new Response("Not found", { status: 404 });
  }
  const root = uploadsDir();
  const file = path.resolve(root, ...parts);
  const type = TYPES[path.extname(file).slice(1).toLowerCase()];
  if (!file.startsWith(root + path.sep) || !type) return new Response("Not found", { status: 404 });

  try {
    const bytes = await readFile(file);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
