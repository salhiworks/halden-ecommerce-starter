"use client";

/**
 * Uploading a photo from the dashboard. Phone photos are often 5–12 MB; the
 * browser shrinks them to at most 2000 px and re-encodes them (WebP where
 * supported, JPEG otherwise) before anything is sent, so uploads are quick on
 * mobile data and the store never serves a 10 MB image.
 */

export type UploadedImage = { url: string; width: number; height: number };

const MAX_EDGE = 2000;

async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!jpeg) throw new Error("This photo could not be processed.");
  return jpeg;
}

export async function shrinkImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`“${file.name}” isn't a photo this browser can read. Use JPG, PNG or WebP.`);
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This photo could not be processed.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { blob: await encode(canvas), width, height };
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  const { blob, width, height } = await shrinkImage(file);
  const form = new FormData();
  form.append("file", blob, blob.type === "image/webp" ? "photo.webp" : "photo.jpg");
  const response = await fetch("/api/admin/media", { method: "POST", body: form });
  const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !body.url) throw new Error(body.error ?? "The upload failed. Please try again.");
  return { url: body.url, width, height };
}
