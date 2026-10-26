/**
 * ===========================================================================
 *  STORE DOMAIN MODEL
 * ===========================================================================
 *
 *  The shapes every part of the platform agrees on: the storefront renders
 *  them, the dashboard edits them, and both backends (Supabase and the local
 *  file store) persist them. Nothing here knows about React, Next.js or a
 *  database.
 *
 *  Products are deliberately industry-neutral. A T-shirt, a laptop SSD and a
 *  candle are the same structure: a product has *options* (Size, Colour,
 *  Capacity, Scent… or none at all) and one *variant* per combination of
 *  option values. A product without options has exactly one variant, so
 *  price, stock and SKU always live in one place.
 */

export type ProductStatus = "draft" | "active" | "archived";

export type ProductImage = {
  id: string;
  url: string;
  alt: string;
  /** Intrinsic size when known — lets the browser reserve space. */
  width: number | null;
  height: number | null;
};

export type OptionValue = {
  label: string;
  /** Hex colour for a swatch (`#1f2937`). `null` renders a text button. */
  swatch: string | null;
};

export type ProductOption = {
  /** What the shopper chooses: "Size", "Colour", "Storage", "Scent"… */
  name: string;
  values: OptionValue[];
};

export type ProductVariant = {
  id: string;
  /** One value per product option, in the same order as `product.options`. */
  optionValues: string[];
  price: number;
  /** The "was" price. Only shown when it is genuinely higher than `price`. */
  compareAtPrice: number | null;
  sku: string;
  /** Units on hand. Only meaningful when the product tracks inventory. */
  stock: number;
  /** The owner's manual switch: `false` means sold out whatever the stock. */
  available: boolean;
  /** Photo to show when this variant is selected (a `ProductImage.id`). */
  imageId: string | null;
};

export type ProductSpec = { label: string; value: string };

export type Product = {
  id: string;
  slug: string;
  name: string;
  /** One short line under the name, e.g. "Wireless · 40-hour battery". */
  summary: string;
  description: string;
  status: ProductStatus;
  categoryId: string | null;
  collectionIds: string[];
  /** Extra search keywords that do not belong in the copy. */
  tags: string[];
  images: ProductImage[];
  options: ProductOption[];
  /** Always at least one. */
  variants: ProductVariant[];
  trackInventory: boolean;
  /** Free-form attributes: material, dimensions, battery life… */
  specs: ProductSpec[];
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  /** Created by "Load demo content" — removable in one click. */
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Categories and collections share a shape; they differ in meaning only. */
export type Grouping = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  sortOrder: number;
  visible: boolean;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Every product belongs to at most one category (navigation)… */
export type Category = Grouping;
/** …and to any number of collections (curation: "Gift guide", "Sale"). */
export type Collection = Grouping;

/* ------------------------------------------------------------------ orders */

export type OrderChannel = "web" | "whatsapp";

/**
 * The life of an order, from the shopper's click to the hand-over.
 *
 * The first two exist only for WhatsApp, and they are the reason this enum is
 * so explicit: a WhatsApp checkout hands the shopper a pre-written message,
 * but *opening WhatsApp proves nothing* — the message may never be sent. So:
 *
 *   prepared   the message was composed and shown to the shopper
 *   opened     the shopper tapped through to WhatsApp (still unverified)
 *   received   the seller has the order request in hand — a website order on
 *              submission, a WhatsApp order once the seller confirms the
 *              message arrived
 *   confirmed  the seller agreed the order with the customer (stock is
 *              reserved here)
 *   fulfilled  shipped, delivered or collected
 *   completed  closed — nothing left to do
 *   cancelled  a real order that will not go ahead
 *   discarded  a WhatsApp handoff that never turned into a message
 *
 * Only `confirmed`, `fulfilled` and `completed` ever count as sales.
 */
export type OrderStatus =
  | "prepared"
  | "opened"
  | "received"
  | "confirmed"
  | "fulfilled"
  | "completed"
  | "cancelled"
  | "discarded";

export type PaymentMethod = "cod" | "bank_transfer" | "whatsapp";
export type PaymentStatus = "unpaid" | "paid" | "refunded";

export type OrderItem = {
  productId: string | null;
  variantId: string | null;
  name: string;
  /** "Sand / M", or "" for a product without options. */
  variantLabel: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type OrderAddress = {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export type OrderCustomer = {
  name: string;
  phone: string;
  email: string;
};

export type OrderEvent = {
  at: string;
  kind: "created" | "status" | "payment" | "note" | "stock";
  from?: string;
  to?: string;
  note?: string;
  /** Email of the admin who acted, or "customer" / "system". */
  by: string;
};

export type Order = {
  id: string;
  /** Short and human: "#1042". Quoted in WhatsApp messages and on calls. */
  number: number;
  channel: OrderChannel;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  currency: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  shippingMethod: { id: string; name: string } | null;
  customer: OrderCustomer;
  address: OrderAddress | null;
  customerNote: string;
  internalNote: string;
  /** Whether confirming this order took units out of stock. */
  stockReserved: boolean;
  events: OrderEvent[];
  createdAt: string;
  updatedAt: string;
};

/* ----------------------------------------------------------------- catalog */

/**
 * Everything the storefront needs to render, loaded in one go. Small-business
 * catalogs (up to a few thousand products) fit comfortably in memory, which
 * keeps search and filtering simple, fast and identical on every backend.
 */
export type CatalogData = {
  products: Product[];
  categories: Category[];
  collections: Collection[];
};
