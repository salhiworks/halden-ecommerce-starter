import "server-only";
import { randomUUID } from "node:crypto";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ORDER_STATUSES } from "@/lib/domain/orders";
import { parseSettings } from "@/lib/domain/settings";
import type { Grouping, OrderStatus, Product } from "@/lib/domain/types";
import { supabaseConfig, type SupabaseConfig } from "@/server/env";
import {
  ConflictError,
  NotFoundError,
  type AdminApi,
  type AdminUser,
  type AuthApi,
  type Backend,
  type GroupingKind,
  type PublicApi,
} from "../types";
import { anonClient, isolatedClient, serviceClient, sessionClient } from "./clients";
import {
  fromGrouping,
  fromNewOrder,
  fromProduct,
  GROUPING_COLUMNS,
  ORDER_COLUMNS,
  PRODUCT_COLUMNS,
  toGrouping,
  toOrder,
  toProduct,
} from "./mappers";

export const MEDIA_BUCKET = "store-media";

/* ------------------------------------------------------------- errors */

function fail(error: PostgrestError | { message: string; code?: string } | null, context: string): never {
  const code = error && "code" in error ? error.code : undefined;
  const message = error?.message ?? "Unknown error";
  if (code === "23505") {
    throw new ConflictError(
      message.includes("slug")
        ? "That URL handle is already used by another item."
        : "That value is already in use.",
    );
  }
  if (code === "P0002") throw new NotFoundError(message);
  if (/conflict/i.test(message)) {
    throw new ConflictError("Someone else updated this order a moment ago. Reload to continue.");
  }
  if (code === "P0001") throw new ConflictError(message);
  if (code === "42501" || /row-level security|permission denied/i.test(message)) {
    throw new Error("Your account is not allowed to do that.");
  }
  throw new Error(`${context}: ${message}`);
}

async function fetchAllRows(
  query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: PostgrestError | null }>,
): Promise<Record<string, unknown>[]> {
  const page = 1000; // PostgREST's default max rows per request
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await query(from, from + page - 1);
    if (error) fail(error, "Loading data");
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < page) return rows;
  }
}

function table(kind: GroupingKind) {
  return kind === "category" ? "categories" : "collections";
}

/* ------------------------------------------------------------- public */

function publicApi(config: SupabaseConfig): PublicApi {
  return {
    async loadSettings() {
      const { data, error } = await anonClient(config)
        .from("store_settings")
        .select("data")
        .eq("id", 1)
        .maybeSingle();
      if (error) fail(error, "Loading settings");
      return parseSettings(data?.data);
    },

    async loadCatalog() {
      const client = anonClient(config);
      const [products, categories, collections] = await Promise.all([
        fetchAllRows((from, to) =>
          client.from("products").select(PRODUCT_COLUMNS).neq("status", "draft").order("created_at").range(from, to),
        ),
        fetchAllRows((from, to) => client.from("categories").select(GROUPING_COLUMNS).order("sort_order").range(from, to)),
        fetchAllRows((from, to) => client.from("collections").select(GROUPING_COLUMNS).order("sort_order").range(from, to)),
      ]);
      return {
        products: products.map(toProduct),
        categories: categories.map(toGrouping),
        collections: collections.map(toGrouping),
      };
    },

    async createOrder(order, accessTokenHash) {
      const { data, error } = await serviceClient(config)
        .from("orders")
        .insert(fromNewOrder(order, accessTokenHash))
        .select("id, number")
        .single();
      if (error) fail(error, "Saving the order");
      return { id: data.id as string, number: Number(data.number) };
    },

    async findCustomerOrder(id, accessTokenHash) {
      const { data, error } = await serviceClient(config)
        .from("orders")
        .select(ORDER_COLUMNS)
        .eq("id", id)
        .eq("access_token_hash", accessTokenHash)
        .maybeSingle();
      if (error) fail(error, "Loading the order");
      return data ? toOrder(data) : null;
    },

    async markWhatsAppOpened(id, accessTokenHash) {
      const { data, error } = await serviceClient(config).rpc("mark_whatsapp_opened", {
        p_order_id: id,
        p_token_hash: accessTokenHash,
      });
      if (error) fail(error, "Updating the order");
      return Boolean(data);
    },
  };
}

/* -------------------------------------------------------------- admin */

function storagePathOf(config: SupabaseConfig, url: string): string | null {
  const prefix = `${config.url}/storage/v1/object/public/${MEDIA_BUCKET}/`;
  return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
}

function adminApi(config: SupabaseConfig, client: SupabaseClient, user: AdminUser): AdminApi {
  return {
    user,

    async loadSettings() {
      const { data, error } = await client.from("store_settings").select("data").eq("id", 1).maybeSingle();
      if (error) fail(error, "Loading settings");
      return parseSettings(data?.data);
    },

    async saveSettings(settings) {
      const { error, count } = await client
        .from("store_settings")
        .update({ data: settings }, { count: "exact" })
        .eq("id", 1);
      if (error) fail(error, "Saving settings");
      if (count === 0) throw new Error("Your account is not allowed to change settings.");
    },

    async loadCatalog() {
      const [products, categories, collections] = await Promise.all([
        fetchAllRows((from, to) => client.from("products").select(PRODUCT_COLUMNS).order("created_at").range(from, to)),
        fetchAllRows((from, to) => client.from("categories").select(GROUPING_COLUMNS).order("sort_order").range(from, to)),
        fetchAllRows((from, to) => client.from("collections").select(GROUPING_COLUMNS).order("sort_order").range(from, to)),
      ]);
      return {
        products: products.map(toProduct),
        categories: categories.map(toGrouping),
        collections: collections.map(toGrouping),
      };
    },

    async writeProduct(product: Product, expectedUpdatedAt) {
      const row = fromProduct(product);
      const { data: existing, error: lookupError } = await client
        .from("products")
        .select("id, updated_at")
        .eq("id", product.id)
        .maybeSingle();
      if (lookupError) fail(lookupError, "Saving the product");

      if (!existing) {
        const { data, error } = await client.from("products").insert(row).select(PRODUCT_COLUMNS).single();
        if (error) fail(error, "Saving the product");
        return toProduct(data);
      }

      let query = client.from("products").update(row).eq("id", product.id);
      if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
      const { data, error } = await query.select(PRODUCT_COLUMNS);
      if (error) fail(error, "Saving the product");
      if (!data || data.length === 0) {
        throw new ConflictError(
          "This product changed since you opened it (another tab, or an order took stock). Reload to see the latest version.",
        );
      }
      return toProduct(data[0]);
    },

    async deleteProduct(id) {
      const { error } = await client.from("products").delete().eq("id", id);
      if (error) fail(error, "Deleting the product");
    },

    async writeGrouping(kind, input) {
      if (input.id) {
        const { data, error } = await client
          .from(table(kind))
          .update({
            name: input.name,
            slug: input.slug,
            description: input.description,
            image_url: input.imageUrl || null,
            visible: input.visible,
          })
          .eq("id", input.id)
          .select(GROUPING_COLUMNS);
        if (error) fail(error, `Saving the ${kind}`);
        if (!data?.length) throw new NotFoundError();
        return toGrouping(data[0]);
      }
      const { data: last } = await client
        .from(table(kind))
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const stamp = new Date().toISOString();
      const grouping: Grouping = {
        id: randomUUID(),
        name: input.name,
        slug: input.slug,
        description: input.description,
        imageUrl: input.imageUrl || null,
        visible: input.visible,
        sortOrder: (last ? Number(last.sort_order) : -1) + 1,
        isDemo: false,
        createdAt: stamp,
        updatedAt: stamp,
      };
      const { data, error } = await client.from(table(kind)).insert(fromGrouping(grouping)).select(GROUPING_COLUMNS).single();
      if (error) fail(error, `Saving the ${kind}`);
      return toGrouping(data);
    },

    async deleteGrouping(kind, id) {
      const { error } = await client.from(table(kind)).delete().eq("id", id);
      if (error) fail(error, `Deleting the ${kind}`);
    },

    async reorderGroupings(kind, orderedIds) {
      const { error } = await client.rpc("admin_reorder", { p_kind: kind, p_ids: orderedIds });
      if (error) fail(error, "Saving the order");
    },

    async setCollectionProducts(collectionId, productIds) {
      const { error } = await client.rpc("admin_set_collection_products", {
        p_collection_id: collectionId,
        p_product_ids: productIds,
      });
      if (error) fail(error, "Saving the collection");
    },

    async listOrders({ statuses, search, limit, offset }) {
      let query = client
        .from("orders")
        .select(ORDER_COLUMNS, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (statuses) query = query.in("status", statuses);
      const term = search?.trim().replace(/^#/, "") ?? "";
      if (term) {
        if (/^\d+$/.test(term) && term.length <= 9) {
          query = query.or(`number.eq.${term},customer->>phone.ilike.*${term}*`);
        } else {
          const safe = term.replace(/[%*,()"\\]/g, " ").trim();
          query = query.or(
            `customer->>name.ilike.*${safe}*,customer->>email.ilike.*${safe}*,customer->>phone.ilike.*${safe}*`,
          );
        }
      }
      const { data, error, count } = await query;
      if (error) fail(error, "Loading orders");
      return { orders: (data ?? []).map(toOrder), total: count ?? 0 };
    },

    async ordersSince(isoDate) {
      const rows = await fetchAllRows((from, to) =>
        client.from("orders").select(ORDER_COLUMNS).gte("created_at", isoDate).order("created_at").range(from, to),
      );
      return rows.map(toOrder);
    },

    async orderStatusCounts() {
      const entries = await Promise.all(
        ORDER_STATUSES.map(async (status) => {
          const { count, error } = await client
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("status", status);
          if (error) fail(error, "Counting orders");
          return [status, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<OrderStatus, number>;
    },

    async getOrder(id) {
      const { data, error } = await client.from("orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle();
      if (error) fail(error, "Loading the order");
      return data ? toOrder(data) : null;
    },

    async transitionOrder({ id, from, to, stockDelta, note }) {
      const { data, error } = await client.rpc("admin_transition_order", {
        p_order_id: id,
        p_from: from,
        p_to: to,
        p_stock_delta: stockDelta,
        p_note: note,
      });
      if (error) fail(error, "Updating the order");
      return toOrder(data as Record<string, unknown>);
    },

    async updateOrder(id, patch) {
      const { data, error } = await client.rpc("admin_update_order", {
        p_order_id: id,
        p_payment_status: patch.paymentStatus ?? null,
        p_internal_note: patch.internalNote ?? null,
      });
      if (error) fail(error, "Updating the order");
      return toOrder(data as Record<string, unknown>);
    },

    async deleteOrder(id) {
      const { error, count } = await client.from("orders").delete({ count: "exact" }).eq("id", id);
      if (error) fail(error, "Deleting the order");
      if (count === 0) throw new ConflictError("Only cancelled orders and unverified handoffs can be deleted.");
    },

    async uploadMedia(file) {
      const objectPath = `uploads/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${file.extension}`;
      const { error } = await client.storage.from(MEDIA_BUCKET).upload(objectPath, file.bytes, {
        contentType: file.contentType,
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) fail({ message: error.message }, "Uploading the photo");
      return { url: client.storage.from(MEDIA_BUCKET).getPublicUrl(objectPath).data.publicUrl };
    },

    async deleteMedia(urls) {
      const paths = urls.map((url) => storagePathOf(config, url)).filter((value): value is string => Boolean(value));
      if (paths.length === 0) return;
      const { error } = await client.storage.from(MEDIA_BUCKET).remove(paths);
      if (error) fail({ message: error.message }, "Deleting photos");
    },

    async importCatalog(catalog) {
      // Imported items keep their age, so "New" badges and "newest first"
      // look the same as in the local demo store.
      for (const [name, rows] of [
        ["categories", catalog.categories.map((item) => ({ ...fromGrouping(item), created_at: item.createdAt }))],
        ["collections", catalog.collections.map((item) => ({ ...fromGrouping(item), created_at: item.createdAt }))],
        ["products", catalog.products.map((item) => ({ ...fromProduct(item), created_at: item.createdAt }))],
      ] as const) {
        if (rows.length === 0) continue;
        const { error } = await client.from(name).upsert(rows, { onConflict: "id" });
        if (error) fail(error, `Importing ${name}`);
      }
    },

    async removeDemoContent() {
      const removed = { products: 0, categories: 0, collections: 0 };
      for (const name of ["products", "collections", "categories"] as const) {
        const { error, count } = await client.from(name).delete({ count: "exact" }).eq("is_demo", true);
        if (error) fail(error, `Removing demo ${name}`);
        removed[name] = count ?? 0;
      }
      return removed;
    },

    async changePassword(currentPassword, newPassword) {
      // Check the current password on a throwaway client, then end only that
      // check's session ("local": the owner's other devices stay signed in).
      const verifier = isolatedClient(config);
      const check = await verifier.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (check.error) throw new ConflictError("Your current password is not correct.");
      await verifier.auth.signOut({ scope: "local" }).catch(() => undefined);
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
    },
  };
}

/* --------------------------------------------------------------- auth */

function authApi(config: SupabaseConfig): AuthApi {
  async function adminFrom(client: SupabaseClient): Promise<AdminUser | null> {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    const { data: isAdmin, error: roleError } = await client.rpc("is_admin");
    if (roleError || isAdmin !== true) return null;
    return { id: data.user.id, email: data.user.email ?? "" };
  }

  return {
    async currentAdmin() {
      return adminFrom(await sessionClient(config));
    },

    async signIn(email, password) {
      const client = await sessionClient(config);
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        return { ok: false, reason: error.status && error.status >= 500 ? "unavailable" : "invalid" };
      }
      const { data: isAdmin } = await client.rpc("is_admin");
      if (isAdmin !== true) {
        await client.auth.signOut();
        return { ok: false, reason: "not-admin" };
      }
      return { ok: true };
    },

    async signOut() {
      await (await sessionClient(config)).auth.signOut();
    },

    async setupState() {
      const { error } = await anonClient(config).from("store_settings").select("id").limit(1);
      if (error) {
        return {
          kind: "misconfigured",
          reason: /does not exist|schema cache/i.test(error.message)
            ? "The database tables are missing. Run `npm run db:migrate`, or paste the files in supabase/migrations into the Supabase SQL editor."
            : `Supabase could not be reached: ${error.message}`,
        };
      }
      if (!config.secretKey) {
        return {
          kind: "misconfigured",
          reason: "SUPABASE_SECRET_KEY is not set. The store needs it on the server to save orders.",
        };
      }
      return { kind: "ready" };
    },

    async createOwner() {
      throw new Error("With Supabase, create the admin with `npm run admin:create` or the SQL in the README.");
    },
  };
}

export function createSupabaseBackend(): Backend {
  const config = supabaseConfig();
  if (!config) {
    throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must both be set to use Supabase.");
  }
  return {
    kind: "supabase",
    public: publicApi(config),
    auth: authApi(config),
    async admin(user) {
      return adminApi(config, await sessionClient(config), user);
    },
  };
}
