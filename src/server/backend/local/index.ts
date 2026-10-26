import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { canTransition, ORDER_STATUSES } from "@/lib/domain/orders";
import { parseSettings, type StoreSettings } from "@/lib/domain/settings";
import { applyStockDelta } from "@/lib/domain/stock";
import type { Grouping, Order, OrderStatus, Product } from "@/lib/domain/types";
import { hashPassword, randomToken, safeEqual, sign, verifyPassword } from "@/server/crypto";
import { adminSetupToken, isProduction, localDataDir, sessionSecretSetting } from "@/server/env";
import {
  ConflictError,
  NotFoundError,
  type AdminApi,
  type AdminUser,
  type AuthApi,
  type Backend,
  type GroupingKind,
  type PublicApi,
  type StoredOrder,
} from "../types";
import { readData, updateData, type LocalData } from "./db";

/* ------------------------------------------------------------------ media */

/** Uploads are served by `app/media/[...path]/route.ts` from this folder. */
export function uploadsDir(): string {
  return path.join(localDataDir(), "uploads");
}

const MEDIA_PREFIX = "/media/";

/* -------------------------------------------------------------- sessions */

const SESSION_COOKIE = "store_admin";
const SESSION_DAYS = 14;

async function sessionSecret(): Promise<string> {
  const fromEnv = sessionSecretSetting();
  if (fromEnv) return fromEnv;
  const file = path.join(localDataDir(), "session-secret");
  try {
    return (await readFile(file, "utf8")).trim();
  } catch {
    const secret = randomToken(48);
    await mkdir(localDataDir(), { recursive: true });
    await writeFile(file, secret, { mode: 0o600 });
    return secret;
  }
}

type SessionPayload = { sub: string; v: number; exp: number };

async function readSession(): Promise<SessionPayload | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [body, signature] = raw.split(".");
  if (!body || !signature) return null;
  if (!safeEqual(sign(body, await sessionSecret()), signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function writeSession(payload: SessionPayload): Promise<void> {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  (await cookies()).set(SESSION_COOKIE, `${body}.${sign(body, await sessionSecret())}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

/* ------------------------------------------------------------- helpers */

function now(): string {
  return new Date().toISOString();
}

function publicOrder(order: StoredOrder): Order {
  // Never hand the access hash to anything that renders.
  const { accessTokenHash: _hidden, ...rest } = order;
  void _hidden;
  return rest;
}

function groupingList(data: LocalData, kind: GroupingKind): Grouping[] {
  return kind === "category" ? data.categories : data.collections;
}

function isOwnUpload(url: string): boolean {
  return url.startsWith(MEDIA_PREFIX) && !url.includes("..");
}

/* ---------------------------------------------------------------- public */

const publicApi: PublicApi = {
  async loadSettings() {
    return parseSettings((await readData()).settings);
  },

  async loadCatalog() {
    const data = await readData();
    return {
      products: data.products.filter((product) => product.status !== "draft"),
      categories: data.categories,
      collections: data.collections,
    };
  },

  async createOrder(order, accessTokenHash) {
    return updateData((data) => {
      const stamp = now();
      const stored: StoredOrder = {
        ...order,
        id: randomUUID(),
        number: data.nextOrderNumber,
        createdAt: stamp,
        updatedAt: stamp,
        accessTokenHash,
      };
      data.nextOrderNumber += 1;
      data.orders.push(stored);
      return { id: stored.id, number: stored.number };
    });
  },

  async findCustomerOrder(id, accessTokenHash) {
    const order = (await readData()).orders.find((candidate) => candidate.id === id);
    if (!order || !safeEqual(order.accessTokenHash, accessTokenHash)) return null;
    return publicOrder(order);
  },

  async markWhatsAppOpened(id, accessTokenHash) {
    return updateData((data) => {
      const order = data.orders.find((candidate) => candidate.id === id);
      if (!order || !safeEqual(order.accessTokenHash, accessTokenHash)) return false;
      if (order.status !== "prepared") return true;
      const stamp = now();
      order.status = "opened";
      order.updatedAt = stamp;
      order.events.push({ at: stamp, kind: "status", from: "prepared", to: "opened", by: "customer" });
      return true;
    });
  },
};

/* ----------------------------------------------------------------- admin */

function adminApi(user: AdminUser): AdminApi {
  return {
    user,

    async loadSettings() {
      return parseSettings((await readData()).settings);
    },

    async saveSettings(settings: StoreSettings) {
      await updateData((data) => {
        data.settings = settings;
      });
    },

    async loadCatalog() {
      const data = await readData();
      return { products: data.products, categories: data.categories, collections: data.collections };
    },

    async writeProduct(product: Product, expectedUpdatedAt) {
      return updateData((data) => {
        const index = data.products.findIndex((candidate) => candidate.id === product.id);
        const existing = index >= 0 ? data.products[index] : null;
        if (existing && expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) {
          throw new ConflictError(
            "This product changed since you opened it (another tab, or an order took stock). Reload to see the latest version.",
          );
        }
        if (data.products.some((candidate) => candidate.slug === product.slug && candidate.id !== product.id)) {
          throw new ConflictError(`Another product already uses the URL handle "${product.slug}".`);
        }
        const saved = { ...product, updatedAt: now() };
        if (existing) data.products[index] = saved;
        else data.products.push(saved);
        return saved;
      });
    },

    async deleteProduct(id) {
      await updateData((data) => {
        data.products = data.products.filter((product) => product.id !== id);
      });
    },

    async writeGrouping(kind, input) {
      return updateData((data) => {
        const list = groupingList(data, kind);
        if (list.some((item) => item.slug === input.slug && item.id !== input.id)) {
          throw new ConflictError(`Another ${kind} already uses the URL handle "${input.slug}".`);
        }
        const stamp = now();
        const existing = input.id ? list.find((item) => item.id === input.id) : undefined;
        if (input.id && !existing) throw new NotFoundError();
        const saved: Grouping = existing
          ? {
              ...existing,
              name: input.name,
              slug: input.slug,
              description: input.description,
              imageUrl: input.imageUrl || null,
              visible: input.visible,
              updatedAt: stamp,
            }
          : {
              id: randomUUID(),
              name: input.name,
              slug: input.slug,
              description: input.description,
              imageUrl: input.imageUrl || null,
              visible: input.visible,
              sortOrder: list.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1,
              isDemo: false,
              createdAt: stamp,
              updatedAt: stamp,
            };
        if (existing) list[list.indexOf(existing)] = saved;
        else list.push(saved);
        return saved;
      });
    },

    async deleteGrouping(kind, id) {
      await updateData((data) => {
        if (kind === "category") {
          data.categories = data.categories.filter((item) => item.id !== id);
          for (const product of data.products) {
            if (product.categoryId === id) product.categoryId = null;
          }
        } else {
          data.collections = data.collections.filter((item) => item.id !== id);
          for (const product of data.products) {
            product.collectionIds = product.collectionIds.filter((value) => value !== id);
          }
        }
      });
    },

    async reorderGroupings(kind, orderedIds) {
      await updateData((data) => {
        const list = groupingList(data, kind);
        orderedIds.forEach((id, position) => {
          const item = list.find((candidate) => candidate.id === id);
          if (item) item.sortOrder = position;
        });
      });
    },

    async setCollectionProducts(collectionId, productIds) {
      await updateData((data) => {
        if (!data.collections.some((item) => item.id === collectionId)) throw new NotFoundError();
        const wanted = new Set(productIds);
        const stamp = now();
        for (const product of data.products) {
          const has = product.collectionIds.includes(collectionId);
          if (wanted.has(product.id) && !has) {
            product.collectionIds = [...product.collectionIds, collectionId];
            product.updatedAt = stamp;
          } else if (!wanted.has(product.id) && has) {
            product.collectionIds = product.collectionIds.filter((value) => value !== collectionId);
            product.updatedAt = stamp;
          }
        }
      });
    },

    async listOrders({ statuses, search, limit, offset }) {
      const data = await readData();
      const term = search?.trim().toLowerCase().replace(/^#/, "") ?? "";
      const matches = data.orders
        .filter((order) => !statuses || statuses.includes(order.status))
        .filter((order) => {
          if (!term) return true;
          return (
            String(order.number) === term ||
            order.customer.name.toLowerCase().includes(term) ||
            order.customer.email.toLowerCase().includes(term) ||
            order.customer.phone.replace(/\D/g, "").includes(term.replace(/\D/g, "") || "\u0000")
          );
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        orders: matches.slice(offset, offset + limit).map(publicOrder),
        total: matches.length,
      };
    },

    async ordersSince(isoDate) {
      return (await readData()).orders.filter((order) => order.createdAt >= isoDate).map(publicOrder);
    },

    async orderStatusCounts() {
      const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<OrderStatus, number>;
      for (const order of (await readData()).orders) counts[order.status] += 1;
      return counts;
    },

    async getOrder(id) {
      const order = (await readData()).orders.find((candidate) => candidate.id === id);
      return order ? publicOrder(order) : null;
    },

    async transitionOrder({ id, from, to, stockDelta, note }) {
      return updateData((data) => {
        const order = data.orders.find((candidate) => candidate.id === id);
        if (!order) throw new NotFoundError("Order not found");
        if (order.status !== from) {
          throw new ConflictError(`This order is now "${order.status}" — someone else updated it. Reload to continue.`);
        }
        if (!canTransition(from, to)) throw new ConflictError("That step is not possible from here.");

        const stamp = now();
        if (stockDelta !== 0) {
          data.products = data.products.map(
            (product) => applyStockDelta(product, order.items, stockDelta) ?? product,
          );
          order.stockReserved = stockDelta === 1;
          order.events.push({
            at: stamp,
            kind: "stock",
            note: stockDelta === 1 ? "Stock reserved for this order." : "Reserved stock returned.",
            by: user.email,
          });
        }
        order.status = to;
        order.updatedAt = stamp;
        order.events.push({ at: stamp, kind: "status", from, to, note: note || undefined, by: user.email });
        return publicOrder(order);
      });
    },

    async updateOrder(id, patch) {
      return updateData((data) => {
        const order = data.orders.find((candidate) => candidate.id === id);
        if (!order) throw new NotFoundError("Order not found");
        const stamp = now();
        if (patch.paymentStatus && patch.paymentStatus !== order.paymentStatus) {
          order.events.push({
            at: stamp,
            kind: "payment",
            from: order.paymentStatus,
            to: patch.paymentStatus,
            by: user.email,
          });
          order.paymentStatus = patch.paymentStatus;
        }
        if (patch.internalNote !== undefined) order.internalNote = patch.internalNote;
        order.updatedAt = stamp;
        return publicOrder(order);
      });
    },

    async deleteOrder(id) {
      await updateData((data) => {
        data.orders = data.orders.filter((order) => order.id !== id);
      });
    },

    async uploadMedia(file) {
      const month = new Date().toISOString().slice(0, 7);
      const name = `${randomUUID()}.${file.extension}`;
      const folder = path.join(uploadsDir(), month);
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, name), file.bytes);
      return { url: `${MEDIA_PREFIX}${month}/${name}` };
    },

    async deleteMedia(urls) {
      for (const url of urls) {
        if (!isOwnUpload(url)) continue;
        const relative = url.slice(MEDIA_PREFIX.length);
        const file = path.resolve(uploadsDir(), relative);
        if (!file.startsWith(uploadsDir() + path.sep)) continue;
        await unlink(file).catch(() => undefined);
      }
    },

    async importCatalog(catalog) {
      await updateData((data) => {
        const upsert = <T extends { id: string }>(list: T[], items: T[]) => {
          for (const item of items) {
            const index = list.findIndex((candidate) => candidate.id === item.id);
            if (index >= 0) list[index] = item;
            else list.push(item);
          }
        };
        upsert(data.categories, catalog.categories);
        upsert(data.collections, catalog.collections);
        upsert(data.products, catalog.products);
      });
    },

    async removeDemoContent() {
      return updateData((data) => {
        const removed = {
          products: data.products.filter((item) => item.isDemo).length,
          categories: data.categories.filter((item) => item.isDemo).length,
          collections: data.collections.filter((item) => item.isDemo).length,
        };
        const goneCategories = new Set(data.categories.filter((item) => item.isDemo).map((item) => item.id));
        const goneCollections = new Set(data.collections.filter((item) => item.isDemo).map((item) => item.id));
        data.products = data.products
          .filter((item) => !item.isDemo)
          .map((product) => ({
            ...product,
            categoryId: product.categoryId && goneCategories.has(product.categoryId) ? null : product.categoryId,
            collectionIds: product.collectionIds.filter((id) => !goneCollections.has(id)),
          }));
        data.categories = data.categories.filter((item) => !item.isDemo);
        data.collections = data.collections.filter((item) => !item.isDemo);
        return removed;
      });
    },

    async changePassword(currentPassword, newPassword) {
      const owner = (await readData()).owner;
      if (!owner || owner.id !== user.id) throw new NotFoundError("Account not found");
      if (!(await verifyPassword(currentPassword, owner.passwordHash))) {
        throw new ConflictError("Your current password is not correct.");
      }
      const passwordHash = await hashPassword(newPassword);
      const updated = await updateData((data) => {
        if (!data.owner) throw new NotFoundError("Account not found");
        data.owner.passwordHash = passwordHash;
        data.owner.sessionVersion += 1;
        return data.owner;
      });
      // Keep this browser signed in; every other session is now invalid.
      await writeSession({
        sub: updated.id,
        v: updated.sessionVersion,
        exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60,
      });
    },
  };
}

/* ------------------------------------------------------------------ auth */

const authApi: AuthApi = {
  async currentAdmin() {
    const session = await readSession();
    if (!session) return null;
    const owner = (await readData()).owner;
    if (!owner || owner.id !== session.sub || owner.sessionVersion !== session.v) return null;
    return { id: owner.id, email: owner.email };
  },

  async signIn(email, password) {
    const owner = (await readData()).owner;
    const matches =
      owner !== null &&
      owner.email.toLowerCase() === email.trim().toLowerCase() &&
      (await verifyPassword(password, owner.passwordHash));
    if (!owner || !matches) return { ok: false, reason: "invalid" };
    await writeSession({
      sub: owner.id,
      v: owner.sessionVersion,
      exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60,
    });
    return { ok: true };
  },

  async signOut() {
    (await cookies()).delete(SESSION_COOKIE);
  },

  async setupState() {
    const owner = (await readData()).owner;
    if (owner) return { kind: "ready" };
    const tokenRequired = isProduction() || Boolean(adminSetupToken());
    return {
      kind: "needs-owner",
      tokenRequired,
      setupAllowed: !tokenRequired || Boolean(adminSetupToken()),
    };
  },

  async createOwner(email, password) {
    const passwordHash = await hashPassword(password);
    const owner = await updateData((data) => {
      if (data.owner) throw new ConflictError("This store already has an owner. Sign in instead.");
      data.owner = { id: randomUUID(), email: email.trim().toLowerCase(), passwordHash, sessionVersion: 1 };
      return data.owner;
    });
    await writeSession({
      sub: owner.id,
      v: owner.sessionVersion,
      exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60,
    });
  },
};

export function createLocalBackend(): Backend {
  return {
    kind: "local",
    public: publicApi,
    auth: authApi,
    async admin(user) {
      return adminApi(user);
    },
  };
}
