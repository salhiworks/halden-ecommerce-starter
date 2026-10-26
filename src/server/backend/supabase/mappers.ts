import "server-only";
import type { NewOrder } from "@/lib/domain/checkout";
import type { Grouping, Order, Product } from "@/lib/domain/types";

/**
 * Database rows (snake_case) ⇄ domain objects (camelCase). Kept dumb on
 * purpose: one field per line, so a column added in a migration is a one-line
 * change here.
 */

type Row = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" ? value : "");
const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const num = (value: unknown) => (value === null || value === undefined ? 0 : Number(value));

export const PRODUCT_COLUMNS =
  "id, slug, name, summary, description, status, category_id, collection_ids, tags, images, options, variants, track_inventory, specs, featured, seo_title, seo_description, is_demo, created_at, updated_at";

export function toProduct(row: Row): Product {
  return {
    id: text(row.id),
    slug: text(row.slug),
    name: text(row.name),
    summary: text(row.summary),
    description: text(row.description),
    status: row.status as Product["status"],
    categoryId: (row.category_id as string | null) ?? null,
    collectionIds: list<string>(row.collection_ids),
    tags: list<string>(row.tags),
    images: list(row.images),
    options: list(row.options),
    variants: list<Product["variants"][number]>(row.variants).map((variant) => ({
      ...variant,
      price: num(variant.price),
      compareAtPrice: variant.compareAtPrice === null ? null : num(variant.compareAtPrice),
      stock: num(variant.stock),
    })),
    trackInventory: Boolean(row.track_inventory),
    specs: list(row.specs),
    featured: Boolean(row.featured),
    seoTitle: text(row.seo_title),
    seoDescription: text(row.seo_description),
    isDemo: Boolean(row.is_demo),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

export function fromProduct(product: Product): Row {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    summary: product.summary,
    description: product.description,
    status: product.status,
    category_id: product.categoryId,
    collection_ids: product.collectionIds,
    tags: product.tags,
    images: product.images,
    options: product.options,
    variants: product.variants,
    track_inventory: product.trackInventory,
    specs: product.specs,
    featured: product.featured,
    seo_title: product.seoTitle,
    seo_description: product.seoDescription,
    is_demo: product.isDemo,
  };
}

export const GROUPING_COLUMNS =
  "id, slug, name, description, image_url, sort_order, visible, is_demo, created_at, updated_at";

export function toGrouping(row: Row): Grouping {
  return {
    id: text(row.id),
    slug: text(row.slug),
    name: text(row.name),
    description: text(row.description),
    imageUrl: (row.image_url as string | null) || null,
    sortOrder: num(row.sort_order),
    visible: Boolean(row.visible),
    isDemo: Boolean(row.is_demo),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

export function fromGrouping(grouping: Grouping): Row {
  return {
    id: grouping.id,
    slug: grouping.slug,
    name: grouping.name,
    description: grouping.description,
    image_url: grouping.imageUrl,
    sort_order: grouping.sortOrder,
    visible: grouping.visible,
    is_demo: grouping.isDemo,
  };
}

export const ORDER_COLUMNS =
  "id, number, channel, status, payment_method, payment_status, currency, items, subtotal, shipping_fee, total, shipping_method, customer, address, customer_note, internal_note, stock_reserved, events, created_at, updated_at";

export function toOrder(row: Row): Order {
  const customer = (row.customer ?? {}) as Partial<Order["customer"]>;
  return {
    id: text(row.id),
    number: num(row.number),
    channel: row.channel as Order["channel"],
    status: row.status as Order["status"],
    paymentMethod: row.payment_method as Order["paymentMethod"],
    paymentStatus: row.payment_status as Order["paymentStatus"],
    currency: text(row.currency),
    items: list<Order["items"][number]>(row.items).map((item) => ({
      ...item,
      unitPrice: num(item.unitPrice),
      quantity: num(item.quantity),
      lineTotal: num(item.lineTotal),
    })),
    subtotal: num(row.subtotal),
    shippingFee: num(row.shipping_fee),
    total: num(row.total),
    shippingMethod: (row.shipping_method as Order["shippingMethod"]) ?? null,
    customer: { name: text(customer.name), phone: text(customer.phone), email: text(customer.email) },
    address: (row.address as Order["address"]) ?? null,
    customerNote: text(row.customer_note),
    internalNote: text(row.internal_note),
    stockReserved: Boolean(row.stock_reserved),
    events: list(row.events),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

export function fromNewOrder(order: NewOrder, accessTokenHash: string): Row {
  return {
    channel: order.channel,
    status: order.status,
    payment_method: order.paymentMethod,
    payment_status: order.paymentStatus,
    currency: order.currency,
    items: order.items,
    subtotal: order.subtotal,
    shipping_fee: order.shippingFee,
    total: order.total,
    shipping_method: order.shippingMethod,
    customer: order.customer,
    address: order.address,
    customer_note: order.customerNote,
    internal_note: order.internalNote,
    stock_reserved: order.stockReserved,
    events: order.events,
    access_token_hash: accessTokenHash,
  };
}
