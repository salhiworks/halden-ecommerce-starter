import type { GroupingInput } from "@/lib/domain/admin-schemas";
import type { NewOrder } from "@/lib/domain/checkout";
import type { StoreSettings } from "@/lib/domain/settings";
import type {
  CatalogData,
  Grouping,
  Order,
  OrderStatus,
  PaymentStatus,
  Product,
} from "@/lib/domain/types";

/**
 * ===========================================================================
 *  BACKEND CONTRACT
 * ===========================================================================
 *
 *  The two backends (Supabase, local file) implement exactly this. Business
 *  rules — validation, pricing, the order lifecycle, what counts as stock —
 *  live in `src/lib/domain` and are shared; a backend only stores and fetches.
 *
 *  `PublicApi` needs no session and is what the storefront uses. `AdminApi` is
 *  created per request for a signed-in admin; the Supabase implementation
 *  runs every query *as that user*, so database row-level security checks the
 *  admin role a second time, independently of this code.
 */

export type AdminUser = { id: string; email: string };

export type GroupingKind = "category" | "collection";

export type OrderListFilter = {
  statuses?: OrderStatus[];
  /** Matches the order number or the customer's name, phone or email. */
  search?: string;
  limit: number;
  offset: number;
};

export type MediaUpload = {
  bytes: Uint8Array;
  contentType: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  extension: "jpg" | "png" | "webp" | "avif";
};

export type StoredOrder = Order & { accessTokenHash: string };

export interface PublicApi {
  loadSettings(): Promise<StoreSettings>;
  /** Active and archived products, visible and hidden groupings. */
  loadCatalog(): Promise<CatalogData>;
  createOrder(order: NewOrder, accessTokenHash: string): Promise<{ id: string; number: number }>;
  /** A shopper's own order, only with the secret from their confirmation link. */
  findCustomerOrder(id: string, accessTokenHash: string): Promise<Order | null>;
  /** Records the tap on "Open WhatsApp" — never more than "opened". */
  markWhatsAppOpened(id: string, accessTokenHash: string): Promise<boolean>;
}

export interface AdminApi {
  readonly user: AdminUser;
  /** The read-only dashboard preview of a public demo (see src/server/demo). */
  readonly preview?: boolean;

  loadSettings(): Promise<StoreSettings>;
  saveSettings(settings: StoreSettings): Promise<void>;

  /** Everything, including drafts and hidden groupings. */
  loadCatalog(): Promise<CatalogData>;

  /** Insert or replace; the caller has already validated and normalised it. */
  writeProduct(product: Product, expectedUpdatedAt: string | null): Promise<Product>;
  deleteProduct(id: string): Promise<void>;

  writeGrouping(kind: GroupingKind, input: GroupingInput): Promise<Grouping>;
  deleteGrouping(kind: GroupingKind, id: string): Promise<void>;
  reorderGroupings(kind: GroupingKind, orderedIds: string[]): Promise<void>;
  /** Replaces which products belong to a collection. */
  setCollectionProducts(collectionId: string, productIds: string[]): Promise<void>;

  listOrders(filter: OrderListFilter): Promise<{ orders: Order[]; total: number }>;
  ordersSince(isoDate: string): Promise<Order[]>;
  /** Counts per status across all time, for the order tabs. */
  orderStatusCounts(): Promise<Record<OrderStatus, number>>;
  getOrder(id: string): Promise<Order | null>;
  /**
   * Moves an order from `from` to `to` atomically: fails if the order is no
   * longer in `from` (someone else acted), and applies `stockDelta` (+1 take
   * units, -1 return them) to tracked variants in the same step.
   */
  transitionOrder(input: {
    id: string;
    from: OrderStatus;
    to: OrderStatus;
    stockDelta: -1 | 0 | 1;
    note: string;
  }): Promise<Order>;
  updateOrder(
    id: string,
    patch: { paymentStatus?: PaymentStatus; internalNote?: string },
  ): Promise<Order>;
  deleteOrder(id: string): Promise<void>;

  uploadMedia(file: MediaUpload): Promise<{ url: string }>;
  /** Deletes files this store uploaded; other URLs are ignored. */
  deleteMedia(urls: string[]): Promise<void>;

  /** Inserts or refreshes the demo catalog, keyed by stable ids. */
  importCatalog(catalog: CatalogData): Promise<void>;
  /** Removes every record flagged `isDemo`. Orders are never touched. */
  removeDemoContent(): Promise<{ products: number; categories: number; collections: number }>;

  changePassword(currentPassword: string, newPassword: string): Promise<void>;
}

export type SetupState =
  /** Ready: an owner exists and can sign in. */
  | { kind: "ready" }
  /** Local store without an owner yet; `tokenRequired` in production. */
  | { kind: "needs-owner"; tokenRequired: boolean; setupAllowed: boolean }
  /** Supabase is selected but not usable; `reason` says why. */
  | { kind: "misconfigured"; reason: string };

export interface AuthApi {
  currentAdmin(): Promise<AdminUser | null>;
  signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; reason: "invalid" | "not-admin" | "unavailable" }>;
  signOut(): Promise<void>;
  setupState(): Promise<SetupState>;
  /** First-run owner account (local backend only). */
  createOwner(email: string, password: string): Promise<void>;
}

export interface Backend {
  readonly kind: "local" | "supabase";
  readonly public: PublicApi;
  readonly auth: AuthApi;
  admin(user: AdminUser): Promise<AdminApi>;
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}
