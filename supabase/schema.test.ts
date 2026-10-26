import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs every migration in supabase/migrations against a real Postgres (PGlite, in-process) with
 * the parts of Supabase it relies on stubbed in: the anon / authenticated /
 * service_role roles, auth.uid() and auth.jwt() reading the request claims,
 * auth.users, and the storage tables. Then it checks every row-level security
 * rule and function from the point of view of each kind of caller.
 */

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key, email text not null);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant select on auth.users to service_role;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id), name text
  );
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.objects to anon, authenticated, service_role;

  -- Supabase's default grants on the public schema; RLS does the restricting.
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

const migrations = path.join(__dirname, "migrations");
const schema = readdirSync(migrations)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(path.join(migrations, file), "utf8"))
  .join("\n");

const ADMIN = "00000000-0000-4000-8000-00000000a001";
const SHOPPER = "00000000-0000-4000-8000-00000000b001";
const CATEGORY = "00000000-0000-4000-8000-0000000c0001";
const HIDDEN_CATEGORY = "00000000-0000-4000-8000-0000000c0002";
const COLLECTION = "00000000-0000-4000-8000-0000000d0001";
const PRODUCT = "00000000-0000-4000-8000-0000000e0001";
const DRAFT = "00000000-0000-4000-8000-0000000e0002";

type Role = "anon" | "authenticated" | "service_role";

let db: PGlite;

async function as<T>(
  role: Role,
  userId: string | null,
  run: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(userId ? { sub: userId, email: userId === ADMIN ? "owner@shop.example" : "x@y.example" } : {}),
    ]);
    return run(tx);
  });
}

/** Resolves to the error message, or "" when the statement succeeded. */
async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "";
  } catch (error) {
    return (error as Error).message;
  }
}

const variants = (stock: number) =>
  JSON.stringify([
    { id: "v-black", optionValues: ["Black"], price: 30, compareAtPrice: null, sku: "", stock, available: true, imageId: null },
    { id: "v-sand", optionValues: ["Sand"], price: 30, compareAtPrice: null, sku: "", stock, available: true, imageId: null },
  ]);

async function insertOrder(status: string, items: unknown[], hash = "hash-1"): Promise<string> {
  const result = await as("service_role", null, (tx) =>
    tx.query<{ id: string; number: number }>(
      `insert into public.orders (channel, status, payment_method, currency, items, subtotal, total, customer, access_token_hash)
       values ('web', $1, 'cod', 'USD', $2::jsonb, 60, 60, '{"name":"A"}'::jsonb, $3) returning id, number`,
      [status, JSON.stringify(items), hash],
    ),
  );
  return result.rows[0].id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(schema);
  // Idempotent: a second run upgrades in place without errors or data loss.
  await db.exec(schema);

  await db.query("insert into auth.users (id, email) values ($1, 'owner@shop.example'), ($2, 'shopper@mail.example')", [ADMIN, SHOPPER]);
  await db.exec("select public.grant_admin('Owner@Shop.example')");

  await db.query(
    `insert into public.categories (id, slug, name, visible) values ($1, 'audio', 'Audio', true), ($2, 'secret', 'Secret', false)`,
    [CATEGORY, HIDDEN_CATEGORY],
  );
  await db.query(`insert into public.collections (id, slug, name) values ($1, 'gifts', 'Gifts')`, [COLLECTION]);
  await db.query(
    `insert into public.products (id, slug, name, status, category_id, collection_ids, variants, track_inventory)
     values ($1, 'speaker', 'Speaker', 'active', $3, array[$4]::uuid[], $5::jsonb, true),
            ($2, 'draft-lamp', 'Draft Lamp', 'draft', null, '{}', $5::jsonb, false)`,
    [PRODUCT, DRAFT, CATEGORY, COLLECTION, variants(5)],
  );
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("what shoppers (anon) can see", () => {
  it("reads settings, visible groupings and published products only", async () => {
    await as("anon", null, async (tx) => {
      expect((await tx.query("select id from public.store_settings")).rows).toHaveLength(1);
      expect((await tx.query<{ slug: string }>("select slug from public.categories")).rows.map((r) => r.slug)).toEqual(["audio"]);
      expect((await tx.query<{ slug: string }>("select slug from public.products")).rows.map((r) => r.slug)).toEqual(["speaker"]);
    });
    // Not even an empty answer: the table is closed to the public role.
    expect(await failure(as("anon", null, (tx) => tx.query("select user_id from public.admin_users")))).toMatch(
      /permission denied/,
    );
  });

  it("can never read or write orders", async () => {
    await insertOrder("received", [{ productId: PRODUCT, variantId: "v-black", quantity: 1 }]);
    expect(await failure(as("anon", null, (tx) => tx.query("select id from public.orders")))).toMatch(/permission denied/);
    expect(
      await failure(
        as("anon", null, (tx) =>
          tx.query(
            `insert into public.orders (channel, status, payment_method, currency, items, subtotal, total, customer, access_token_hash)
             values ('web','received','cod','USD','[{}]',1,1,'{}','x')`,
          ),
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("cannot change the catalog or the settings", async () => {
    for (const statement of [
      "update public.products set name = 'Hacked' returning id",
      "update public.store_settings set data = '{\"x\":1}' returning id",
      "insert into public.categories (slug, name) values ('x', 'X')",
      "delete from public.collections",
      "truncate public.products",
    ]) {
      expect(await failure(as("anon", null, (tx) => tx.query(statement))), statement).toMatch(/permission denied/);
    }
  });
});

describe("a signed-in user who is not an admin", () => {
  it("has no more power than a shopper", async () => {
    await as("authenticated", SHOPPER, async (tx) => {
      expect((await tx.query("update public.products set name = 'Hacked' returning id")).rows).toHaveLength(0);
      expect((await tx.query("select id from public.orders")).rows).toHaveLength(0);
      expect((await tx.query("select id from public.products where status = 'draft'")).rows).toHaveLength(0);
    });
    expect(
      await failure(as("authenticated", SHOPPER, (tx) => tx.query("select public.grant_admin('shopper@mail.example')"))),
    ).toMatch(/permission denied/);
    expect(
      await failure(
        as("authenticated", SHOPPER, (tx) =>
          tx.query("select public.admin_transition_order($1, 'received', 'confirmed', 1, '')", [PRODUCT]),
        ),
      ),
    ).toMatch(/not allowed/);
  });

  it("cannot upload files", async () => {
    expect(
      await failure(
        as("authenticated", SHOPPER, (tx) =>
          tx.query("insert into storage.objects (bucket_id, name) values ('store-media', 'x.jpg')"),
        ),
      ),
    ).toMatch(/row-level security/);
  });
});

describe("an admin", () => {
  it("sees and edits everything in the catalog", async () => {
    await as("authenticated", ADMIN, async (tx) => {
      expect((await tx.query("select id from public.products")).rows).toHaveLength(2);
      expect((await tx.query("select id from public.categories")).rows).toHaveLength(2);
      const renamed = await tx.query("update public.products set name = 'Speaker Mini' where id = $1 returning updated_at", [PRODUCT]);
      expect(renamed.rows).toHaveLength(1);
      await tx.query("update public.store_settings set data = '{\"store\":{\"name\":\"Halden\"}}' where id = 1");
    });
  });

  it("uploads only into the store bucket", async () => {
    await as("authenticated", ADMIN, (tx) =>
      tx.query("insert into storage.objects (bucket_id, name) values ('store-media', 'products/a.webp')"),
    );
    await db.exec("insert into storage.buckets (id, name, public) values ('other', 'other', false) on conflict do nothing");
    expect(
      await failure(
        as("authenticated", ADMIN, (tx) => tx.query("insert into storage.objects (bucket_id, name) values ('other', 'a.webp')")),
      ),
    ).toMatch(/row-level security/);
  });

  it("cannot rewrite an order directly — only through the functions", async () => {
    const id = await insertOrder("received", [{ productId: PRODUCT, variantId: "v-black", quantity: 1 }]);
    expect(
      await failure(as("authenticated", ADMIN, (tx) => tx.query("update public.orders set total = 0 where id = $1", [id]))),
    ).toMatch(/permission denied/);
  });

  it("confirms an order and takes its stock exactly once, then returns it on cancel", async () => {
    const id = await insertOrder("received", [
      { productId: PRODUCT, variantId: "v-black", quantity: 2 },
      { productId: null, variantId: null, quantity: 1 },
    ]);
    const stockOf = async () =>
      (
        await db.query<{ stock: number }>(
          "select (v ->> 'stock')::int as stock from public.products, jsonb_array_elements(variants) v where id = $1 and v ->> 'id' = 'v-black'",
          [PRODUCT],
        )
      ).rows[0].stock;

    const before = await stockOf();
    const confirmed = await as("authenticated", ADMIN, (tx) =>
      tx.query<{ order: { status: string; stock_reserved: boolean; access_token_hash?: string } }>(
        "select public.admin_transition_order($1, 'received', 'confirmed', 1, 'Called the customer') as order",
        [id],
      ),
    );
    expect(confirmed.rows[0].order).toMatchObject({ status: "confirmed", stock_reserved: true });
    expect(confirmed.rows[0].order.access_token_hash).toBeUndefined();
    expect(await stockOf()).toBe(before - 2);

    // A stale second click is refused instead of reserving again.
    expect(
      await failure(
        as("authenticated", ADMIN, (tx) => tx.query("select public.admin_transition_order($1, 'received', 'confirmed', 1, '')", [id])),
      ),
    ).toMatch(/conflict/);

    await as("authenticated", ADMIN, (tx) =>
      tx.query("select public.admin_transition_order($1, 'confirmed', 'cancelled', -1, '')", [id]),
    );
    expect(await stockOf()).toBe(before);

    const history = await db.query<{ events: { kind: string; by: string }[] }>("select events from public.orders where id = $1", [id]);
    expect(history.rows[0].events.map((event) => event.kind)).toEqual(["stock", "status", "stock", "status"]);
    expect(history.rows[0].events[1].by).toBe("owner@shop.example");
  });

  it("refuses impossible steps, like a handoff straight to confirmed", async () => {
    const id = await insertOrder("opened", [{ productId: PRODUCT, variantId: "v-black", quantity: 1 }]);
    expect(
      await failure(
        as("authenticated", ADMIN, (tx) => tx.query("select public.admin_transition_order($1, 'opened', 'confirmed', 1, '')", [id])),
      ),
    ).toMatch(/not possible/);
  });

  it("records payment changes and keeps the note", async () => {
    const id = await insertOrder("confirmed", [{ productId: PRODUCT, variantId: "v-sand", quantity: 1 }]);
    const result = await as("authenticated", ADMIN, (tx) =>
      tx.query<{ order: { payment_status: string; internal_note: string; events: { kind: string }[] } }>(
        "select public.admin_update_order($1, 'paid', 'Paid in cash') as order",
        [id],
      ),
    );
    expect(result.rows[0].order).toMatchObject({ payment_status: "paid", internal_note: "Paid in cash" });
    expect(result.rows[0].order.events.at(-1)?.kind).toBe("payment");
  });

  it("may delete only orders that never became sales", async () => {
    const open = await insertOrder("confirmed", [{ productId: PRODUCT, variantId: "v-sand", quantity: 1 }]);
    const handoff = await insertOrder("opened", [{ productId: PRODUCT, variantId: "v-sand", quantity: 1 }]);
    await as("authenticated", ADMIN, async (tx) => {
      expect((await tx.query("delete from public.orders where id = $1 returning id", [open])).rows).toHaveLength(0);
      expect((await tx.query("delete from public.orders where id = $1 returning id", [handoff])).rows).toHaveLength(1);
    });
  });

  it("manages collection membership and order atomically", async () => {
    await as("authenticated", ADMIN, async (tx) => {
      await tx.query("select public.admin_set_collection_products($1, array[$2]::uuid[])", [COLLECTION, DRAFT]);
      const rows = await tx.query<{ slug: string }>("select slug from public.products where $1 = any(collection_ids) order by slug", [COLLECTION]);
      expect(rows.rows.map((row) => row.slug)).toEqual(["draft-lamp"]);
      await tx.query("select public.admin_reorder('category', array[$1, $2]::uuid[])", [HIDDEN_CATEGORY, CATEGORY]);
      const order = await tx.query<{ slug: string }>("select slug from public.categories order by sort_order");
      expect(order.rows.map((row) => row.slug)).toEqual(["secret", "audio"]);
    });
  });

  it("removes a deleted collection from every product", async () => {
    await as("authenticated", ADMIN, (tx) => tx.query("delete from public.collections where id = $1", [COLLECTION]));
    const rows = await db.query<{ n: number }>("select count(*)::int as n from public.products where $1 = any(collection_ids)", [COLLECTION]);
    expect(rows.rows[0].n).toBe(0);
  });
});

describe("the website's server (secret key)", () => {
  it("numbers orders from 1001", async () => {
    const rows = await db.query<{ number: number }>("select min(number)::int as number from public.orders");
    expect(rows.rows[0].number).toBe(1001);
  });

  it("marks a WhatsApp handoff as opened only with the right token, and never further", async () => {
    const id = await insertOrder("prepared", [{ productId: PRODUCT, variantId: "v-black", quantity: 1 }], "right-hash");
    const wrong = await as("service_role", null, (tx) =>
      tx.query<{ ok: boolean }>("select public.mark_whatsapp_opened($1, 'wrong') as ok", [id]),
    );
    expect(wrong.rows[0].ok).toBe(false);
    await as("service_role", null, (tx) => tx.query("select public.mark_whatsapp_opened($1, 'right-hash')", [id]));
    await as("service_role", null, (tx) => tx.query("select public.mark_whatsapp_opened($1, 'right-hash')", [id]));
    const status = await db.query<{ status: string; events: unknown[] }>("select status, events from public.orders where id = $1", [id]);
    expect(status.rows[0].status).toBe("opened");
    expect(status.rows[0].events).toHaveLength(1);

    expect(
      await failure(as("anon", null, (tx) => tx.query("select public.mark_whatsapp_opened($1, 'right-hash')", [id]))),
    ).toMatch(/permission denied/);
  });
});
