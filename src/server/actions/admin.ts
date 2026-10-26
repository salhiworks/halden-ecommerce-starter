"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { demoCatalog, demoSettings } from "@/lib/demo/seed";
import {
  groupingInputSchema,
  issuesByPath,
  productInputSchema,
  type GroupingInput,
  type ProductFormValues,
} from "@/lib/domain/admin-schemas";
import { canTransition, isStaleHandoff, stockEffect } from "@/lib/domain/orders";
import { settingsSchema, type StoreSettings } from "@/lib/domain/settings";
import type { Grouping, Order, OrderStatus, PaymentStatus, Product } from "@/lib/domain/types";
import { adminOrThrow, UnauthorizedError } from "@/server/admin";
import { getBackend } from "@/server/backend";
import { ConflictError, NotFoundError, type AdminApi, type GroupingKind } from "@/server/backend/types";
import { adminSetupToken, isProduction } from "@/server/env";
import { orphanedMedia } from "@/server/media";
import { duplicateProduct, prepareProduct, ProductInputError } from "@/server/products";
import { rateLimit } from "@/server/rate-limit";
import { clientAddress } from "@/server/request";
import { invalidateStorefront } from "@/server/storefront";
import { safeEqual } from "@/server/crypto";
import { endPreview, ReadOnlyPreviewError, startPreview } from "@/server/demo/preview";

/**
 * ===========================================================================
 *  DASHBOARD ACTIONS
 * ===========================================================================
 *
 *  Each action authenticates on its own (`adminOrThrow`), validates its input
 *  with the shared schemas, writes through the backend and then refreshes the
 *  storefront, so a saved change is live on the shop's next page view.
 */

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function failure(error: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (error instanceof UnauthorizedError || error instanceof ReadOnlyPreviewError) return { ok: false, error: error.message };
  if (error instanceof ConflictError || error instanceof NotFoundError) return { ok: false, error: error.message };
  if (error instanceof ProductInputError) {
    return { ok: false, error: error.message, fieldErrors: { [error.field]: error.message } };
  }
  if (error instanceof Error && /not allowed/i.test(error.message)) return { ok: false, error: error.message };
  console.error("[dashboard] action failed:", error);
  return { ok: false, error: "Something went wrong while saving. Please try again." };
}

function refresh() {
  invalidateStorefront();
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
}

async function cleanUpMedia(admin: AdminApi, candidates: string[]) {
  if (candidates.length === 0) return;
  try {
    const [catalog, settings] = await Promise.all([admin.loadCatalog(), admin.loadSettings()]);
    await admin.deleteMedia(orphanedMedia(candidates, catalog, settings));
  } catch (error) {
    // Never fail a save because an old photo could not be removed.
    console.warn("[dashboard] could not remove unused photos:", error);
  }
}

/* ------------------------------------------------------------------ auth */

const credentialsSchema = z.object({
  email: z.email("Enter the email address of your account").max(200),
  password: z.string().min(1, "Enter your password").max(200),
});

export async function signInAction(_previous: unknown, form: FormData): Promise<{ error?: string }> {
  const parsed = credentialsSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const limit = rateLimit(`signin:${await clientAddress()}`, 10, 15 * 60 * 1000);
  if (!limit.ok) return { error: "Too many attempts. Wait a few minutes and try again." };

  const result = await getBackend().auth.signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return {
      error:
        result.reason === "not-admin"
          ? "This account doesn't have access to the dashboard."
          : result.reason === "unavailable"
            ? "The sign-in service is not reachable right now. Try again shortly."
            : "That email and password don't match.",
    };
  }
  redirect("/admin");
}

export async function signOutAction(): Promise<void> {
  await getBackend().auth.signOut();
  await endPreview();
  redirect("/admin/login");
}

/* ------------------------------------------- public demo: dashboard preview */

/** Opens the read-only dashboard preview. Does nothing unless PUBLIC_DEMO_MODE is on. */
export async function startPreviewAction(): Promise<void> {
  if (await startPreview()) redirect("/admin");
  redirect("/admin/login");
}

export async function endPreviewAction(): Promise<void> {
  await endPreview();
  redirect("/admin/login");
}

const ownerSchema = z
  .object({
    email: z.email("Enter a valid email address").max(200),
    password: z.string().min(10, "Use at least 10 characters").max(200),
    confirm: z.string(),
    token: z.string().max(200).optional(),
  })
  .refine((value) => value.password === value.confirm, { message: "The passwords don't match", path: ["confirm"] });

export async function createOwnerAction(_previous: unknown, form: FormData): Promise<{ error?: string }> {
  const backend = getBackend();
  const state = await backend.auth.setupState();
  if (state.kind !== "needs-owner") return { error: "This store already has an owner. Sign in instead." };

  const parsed = ownerSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    confirm: form.get("confirm"),
    token: form.get("token") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  // Always in production; in development too once a token is set (the dev
  // server is reachable from your local network).
  if (isProduction() || adminSetupToken()) {
    const expected = adminSetupToken();
    if (!expected) return { error: "Set ADMIN_SETUP_TOKEN on the server to create the owner account." };
    if (!parsed.data.token || !safeEqual(parsed.data.token, expected)) return { error: "The setup token is not correct." };
  }

  try {
    await backend.auth.createOwner(parsed.data.email, parsed.data.password);
  } catch (error) {
    return { error: failure(error).error };
  }
  redirect("/admin");
}

export async function changePasswordAction(_previous: unknown, form: FormData): Promise<{ error?: string; ok?: boolean }> {
  const parsed = z
    .object({
      current: z.string().min(1, "Enter your current password"),
      next: z.string().min(10, "Use at least 10 characters for the new password").max(200),
      confirm: z.string(),
    })
    .refine((value) => value.next === value.confirm, { message: "The new passwords don't match" })
    .safeParse({ current: form.get("current"), next: form.get("next"), confirm: form.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    const admin = await adminOrThrow();
    await admin.changePassword(parsed.data.current, parsed.data.next);
    return { ok: true };
  } catch (error) {
    return { error: failure(error).error };
  }
}

/* -------------------------------------------------------------- products */

export async function saveProductAction(values: ProductFormValues): Promise<ActionResult<Product>> {
  const parsed = productInputSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Some fields need attention.", fieldErrors: issuesByPath(parsed.error) };
  }
  try {
    const admin = await adminOrThrow();
    const catalog = await admin.loadCatalog();
    const before = parsed.data.id ? catalog.products.find((product) => product.id === parsed.data.id) : undefined;
    const product = prepareProduct(parsed.data, catalog);
    const saved = await admin.writeProduct(product, parsed.data.expectedUpdatedAt);
    const kept = new Set(saved.images.map((image) => image.url));
    await cleanUpMedia(admin, (before?.images ?? []).map((image) => image.url).filter((url) => !kept.has(url)));
    refresh();
    return { ok: true, data: saved };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  try {
    const admin = await adminOrThrow();
    const product = (await admin.loadCatalog()).products.find((candidate) => candidate.id === id);
    if (!product) return { ok: false, error: "This product was already deleted." };
    await admin.deleteProduct(id);
    await cleanUpMedia(admin, product.images.map((image) => image.url));
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function duplicateProductAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await adminOrThrow();
    const catalog = await admin.loadCatalog();
    const product = catalog.products.find((candidate) => candidate.id === id);
    if (!product) return { ok: false, error: "This product no longer exists." };
    const copy = await admin.writeProduct(duplicateProduct(product, catalog), null);
    refresh();
    return { ok: true, data: { id: copy.id } };
  } catch (error) {
    return failure(error);
  }
}

export async function setProductStatusAction(id: string, status: Product["status"]): Promise<ActionResult> {
  if (!["draft", "active", "archived"].includes(status)) return { ok: false, error: "Unknown status." };
  try {
    const admin = await adminOrThrow();
    const product = (await admin.loadCatalog()).products.find((candidate) => candidate.id === id);
    if (!product) return { ok: false, error: "This product no longer exists." };
    await admin.writeProduct({ ...product, status, updatedAt: new Date().toISOString() }, product.updatedAt);
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/* --------------------------------------------- categories and collections */

const kindSchema = z.enum(["category", "collection"]);

export async function saveGroupingAction(kind: GroupingKind, input: GroupingInput): Promise<ActionResult<Grouping>> {
  const parsedKind = kindSchema.safeParse(kind);
  const parsed = groupingInputSchema.safeParse(input);
  if (!parsedKind.success) return { ok: false, error: "Unknown type." };
  if (!parsed.success) return { ok: false, error: "Some fields need attention.", fieldErrors: issuesByPath(parsed.error) };
  try {
    const admin = await adminOrThrow();
    const catalog = await admin.loadCatalog();
    const list = kind === "category" ? catalog.categories : catalog.collections;
    const before = parsed.data.id ? list.find((item) => item.id === parsed.data.id) : undefined;
    const saved = await admin.writeGrouping(kind, parsed.data);
    if (before?.imageUrl && before.imageUrl !== saved.imageUrl) await cleanUpMedia(admin, [before.imageUrl]);
    refresh();
    return { ok: true, data: saved };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteGroupingAction(kind: GroupingKind, id: string): Promise<ActionResult> {
  if (!kindSchema.safeParse(kind).success) return { ok: false, error: "Unknown type." };
  try {
    const admin = await adminOrThrow();
    const catalog = await admin.loadCatalog();
    const item = (kind === "category" ? catalog.categories : catalog.collections).find((candidate) => candidate.id === id);
    await admin.deleteGrouping(kind, id);
    if (item?.imageUrl) await cleanUpMedia(admin, [item.imageUrl]);
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function reorderGroupingsAction(kind: GroupingKind, ids: string[]): Promise<ActionResult> {
  const parsed = z.array(z.string().min(1).max(64)).max(500).safeParse(ids);
  if (!kindSchema.safeParse(kind).success || !parsed.success) return { ok: false, error: "Invalid order." };
  try {
    const admin = await adminOrThrow();
    await admin.reorderGroupings(kind, parsed.data);
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function setCollectionProductsAction(collectionId: string, productIds: string[]): Promise<ActionResult> {
  const parsed = z.array(z.string().min(1).max(64)).max(5000).safeParse(productIds);
  if (!parsed.success) return { ok: false, error: "Invalid product list." };
  try {
    const admin = await adminOrThrow();
    await admin.setCollectionProducts(collectionId, parsed.data);
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/* ---------------------------------------------------------------- orders */

const statusSchema = z.enum(["prepared", "opened", "received", "confirmed", "fulfilled", "completed", "cancelled", "discarded"]);

export async function transitionOrderAction(
  id: string,
  from: OrderStatus,
  to: OrderStatus,
  note = "",
): Promise<ActionResult<Order>> {
  const parsed = z
    .object({ from: statusSchema, to: statusSchema, note: z.string().trim().max(500) })
    .safeParse({ from, to, note });
  if (!parsed.success) return { ok: false, error: "Invalid status change." };
  if (!canTransition(parsed.data.from, parsed.data.to)) return { ok: false, error: "That step is not possible from here." };
  try {
    const admin = await adminOrThrow();
    const order = await admin.getOrder(id);
    if (!order) return { ok: false, error: "Order not found." };
    const updated = await admin.transitionOrder({
      id,
      from: parsed.data.from,
      to: parsed.data.to,
      stockDelta: stockEffect(order, parsed.data.to),
      note: parsed.data.note,
    });
    refresh();
    return { ok: true, data: updated };
  } catch (error) {
    return failure(error);
  }
}

export async function updateOrderAction(
  id: string,
  patch: { paymentStatus?: PaymentStatus; internalNote?: string },
): Promise<ActionResult<Order>> {
  const parsed = z
    .object({
      paymentStatus: z.enum(["unpaid", "paid", "refunded"]).optional(),
      internalNote: z.string().max(2000).optional(),
    })
    .safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Invalid change." };
  try {
    const admin = await adminOrThrow();
    const updated = await admin.updateOrder(id, parsed.data);
    revalidatePath("/admin", "layout");
    return { ok: true, data: updated };
  } catch (error) {
    return failure(error);
  }
}

/** Discards WhatsApp handoffs nobody followed up on within a week. */
export async function discardStaleHandoffsAction(): Promise<ActionResult<{ discarded: number }>> {
  try {
    const admin = await adminOrThrow();
    const { orders } = await admin.listOrders({ statuses: ["prepared", "opened"], limit: 1000, offset: 0 });
    const now = new Date();
    let discarded = 0;
    for (const order of orders.filter((candidate) => isStaleHandoff(candidate, now))) {
      try {
        await admin.transitionOrder({
          id: order.id,
          from: order.status,
          to: "discarded",
          stockDelta: 0,
          note: "No WhatsApp message arrived within a week.",
        });
        discarded += 1;
      } catch {
        // Someone else moved it in the meantime; leave it alone.
      }
    }
    revalidatePath("/admin", "layout");
    return { ok: true, data: { discarded } };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteOrderAction(id: string): Promise<ActionResult> {
  try {
    const admin = await adminOrThrow();
    const order = await admin.getOrder(id);
    if (!order) return { ok: false, error: "This order was already deleted." };
    if (!["prepared", "opened", "cancelled", "discarded"].includes(order.status)) {
      return { ok: false, error: "Only cancelled orders and unverified WhatsApp handoffs can be deleted." };
    }
    await admin.deleteOrder(id);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------- settings */

const sectionSchema = z.enum(["store", "contact", "social", "checkout", "shipping", "theme", "homepage", "policies"]);
type SettingsSection = z.infer<typeof sectionSchema>;

/** Saves one section of the settings, validating the document as a whole. */
export async function saveSettingsAction<K extends SettingsSection>(
  section: K,
  value: unknown,
): Promise<ActionResult<StoreSettings>> {
  if (!sectionSchema.safeParse(section).success) return { ok: false, error: "Unknown settings section." };
  try {
    const admin = await adminOrThrow();
    const current = await admin.loadSettings();
    const parsed = settingsSchema.safeParse({ ...current, [section]: value });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] !== section) continue;
        const key = issue.path.slice(1).join(".") || "form";
        fieldErrors[key] ??= issue.message;
      }
      return { ok: false, error: "Some fields need attention.", fieldErrors };
    }
    await admin.saveSettings(parsed.data);

    // Photos replaced in this section (logo, hero, banners) may now be unused.
    const before = JSON.stringify(current[section]);
    const removed = [...before.matchAll(/"((?:\/media\/|https:\/\/)[^"]+)"/g)].map((match) => match[1]);
    await cleanUpMedia(admin, removed);

    refresh();
    return { ok: true, data: parsed.data };
  } catch (error) {
    return failure(error);
  }
}

/* ---------------------------------------------------------- demo content */

export async function loadDemoAction(options: { includeSettings: boolean }): Promise<ActionResult<{ products: number }>> {
  try {
    const admin = await adminOrThrow();
    const catalog = await admin.loadCatalog();
    const demo = demoCatalog();

    // Never overwrite something the owner made: a demo item whose handle is
    // already taken by a real item gets a "-demo" suffix instead.
    const rename = <T extends { id: string; slug: string }>(items: T[], existing: { id: string; slug: string }[]) =>
      items.map((item) =>
        existing.some((other) => other.slug === item.slug && other.id !== item.id)
          ? { ...item, slug: `${item.slug}-demo`.slice(0, 80) }
          : item,
      );

    await admin.importCatalog({
      categories: rename(demo.categories, catalog.categories),
      collections: rename(demo.collections, catalog.collections),
      products: rename(demo.products, catalog.products),
    });

    if (options.includeSettings) {
      const current = await admin.loadSettings();
      const sample = demoSettings();
      await admin.saveSettings({
        ...current,
        store: { ...sample.store, currency: current.store.currency, language: current.store.language },
        homepage: sample.homepage,
        shipping: sample.shipping,
        policies: sample.policies,
      });
    }
    refresh();
    return { ok: true, data: { products: demo.products.length } };
  } catch (error) {
    return failure(error);
  }
}

export async function removeDemoAction(): Promise<ActionResult<{ products: number; categories: number; collections: number }>> {
  try {
    const admin = await adminOrThrow();
    const removed = await admin.removeDemoContent();
    refresh();
    return { ok: true, data: removed };
  } catch (error) {
    return failure(error);
  }
}
