import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getBackend } from "@/server/backend";
import type { AdminApi, AdminUser } from "@/server/backend/types";
import { isPreviewSession, PREVIEW_USER, previewAdminApi } from "@/server/demo/preview";

/**
 * Dashboard access. Every dashboard page and every dashboard action calls
 * `requireAdmin()` — the layout's check alone is not enough, because server
 * actions can be invoked directly.
 */

export const currentAdmin = cache(async (): Promise<AdminUser | null> => {
  try {
    return await getBackend().auth.currentAdmin();
  } catch {
    return null;
  }
});

/**
 * Who is looking at the dashboard: a signed-in admin, or — only in public
 * demo mode — a visitor in the read-only preview. A real session always wins.
 */
const currentViewer = cache(async (): Promise<{ user: AdminUser; preview: boolean } | null> => {
  const admin = await currentAdmin();
  if (admin) return { user: admin, preview: false };
  if (await isPreviewSession()) return { user: PREVIEW_USER, preview: true };
  return null;
});

/** For pages: sends anyone who is not an admin to the sign-in screen. */
export async function requireAdmin(): Promise<AdminApi> {
  const viewer = await currentViewer();
  if (!viewer) redirect("/admin/login");
  return viewer.preview ? previewAdminApi() : getBackend().admin(viewer.user);
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Your session has ended. Sign in again to continue.");
    this.name = "UnauthorizedError";
  }
}

/** For actions and route handlers: throws instead of redirecting. */
export async function adminOrThrow(): Promise<AdminApi> {
  const viewer = await currentViewer();
  if (!viewer) throw new UnauthorizedError();
  return viewer.preview ? previewAdminApi() : getBackend().admin(viewer.user);
}
