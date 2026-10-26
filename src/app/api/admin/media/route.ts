import { adminOrThrow, UnauthorizedError } from "@/server/admin";
import { ReadOnlyPreviewError } from "@/server/demo/preview";
import { MAX_UPLOAD_BYTES, sniffImage } from "@/server/media";
import { rateLimit } from "@/server/rate-limit";
import { clientAddress } from "@/server/request";

/**
 * Photo uploads from the dashboard. Admin only. The file's real type is read
 * from its bytes; the declared type and name are ignored. Storage is the
 * backend's: Supabase Storage in production, `.data/uploads` locally.
 */
export async function POST(request: Request) {
  let admin;
  try {
    admin = await adminOrThrow();
  } catch (error) {
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return Response.json({ error: "Sign in again to upload photos." }, { status });
  }

  // The public demo's dashboard preview can look, not upload.
  if (admin.preview) return Response.json({ error: new ReadOnlyPreviewError().message }, { status: 403 });

  if (!rateLimit(`upload:${await clientAddress()}`, 120, 10 * 60 * 1000).ok) {
    return Response.json({ error: "Too many uploads at once. Wait a minute and try again." }, { status: 429 });
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) {
    return Response.json({ error: "That photo is too large (8 MB maximum)." }, { status: 413 });
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("file");
    file = entry instanceof File ? entry : null;
  } catch {
    return Response.json({ error: "The upload could not be read." }, { status: 400 });
  }
  if (!file) return Response.json({ error: "No photo was attached." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "That photo is too large (8 MB maximum)." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) {
    return Response.json({ error: "Use a JPG, PNG, WebP or AVIF image." }, { status: 415 });
  }

  try {
    const { url } = await admin.uploadMedia({ bytes, ...kind });
    return Response.json({ url });
  } catch (error) {
    console.error("[upload] failed:", error);
    return Response.json({ error: "The photo could not be saved. Please try again." }, { status: 500 });
  }
}
