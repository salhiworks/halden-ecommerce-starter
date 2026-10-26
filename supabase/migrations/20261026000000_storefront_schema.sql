-- =============================================================================
--  HALDEN E-COMMERCE STARTER — database schema
-- =============================================================================
--
--  Applied by `npm run setup` (or `npm run db:migrate`) through the Supabase
--  CLI. Without the CLI: Supabase dashboard → SQL Editor → New query → paste
--  this whole file → Run.
--
--  It is idempotent: running it again upgrades an existing install in place
--  and never deletes data. Every later migration in this folder follows the
--  same rule, so the setup script can simply apply them all, in order.
--
--  What it creates
--    • tables: store_settings, categories, collections, products, orders,
--      admin_users
--    • row-level security on every table:
--        - shoppers (anon) can read published products, visible categories
--          and collections, and the store settings — nothing else
--        - orders are invisible to the public API entirely; the website
--          creates them server-side with the secret key
--        - only users listed in admin_users can change anything
--    • a public storage bucket "store-media" that only admins can write to
--    • a few functions that must be atomic (order status + stock together)
--
--  Then create your admin login: `npm run admin:create -- you@example.com`
--  (see README → "Create your admin account").
-- =============================================================================

-- ----------------------------------------------------------------- helpers

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------------------ admins

create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Security definer so policies can call it without being able to read the
-- table themselves. Stable + (select auth.uid()) lets Postgres cache it per
-- statement instead of re-running it for every row.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

drop policy if exists "admins can see admins" on public.admin_users;
create policy "admins can see admins" on public.admin_users
  for select to authenticated using (public.is_admin());
-- No insert/update/delete policy: admins are added with grant_admin() from
-- the SQL editor, or by `npm run admin:create` with the secret key.

create or replace function public.grant_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No user with email %. Create it first: Authentication → Users → Add user.', p_email;
  end if;
  insert into public.admin_users (user_id, email)
  values (v_user, lower(trim(p_email)))
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.grant_admin(text) from public, anon, authenticated;
grant execute on function public.grant_admin(text) to service_role;

-- ---------------------------------------------------------------- settings

create table if not exists public.store_settings (
  id         smallint primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id) values (1) on conflict (id) do nothing;

alter table public.store_settings enable row level security;

drop trigger if exists store_settings_updated_at on public.store_settings;
create trigger store_settings_updated_at before update on public.store_settings
  for each row execute function public.set_updated_at();

drop policy if exists "settings are public" on public.store_settings;
create policy "settings are public" on public.store_settings
  for select to anon, authenticated using (true);

drop policy if exists "admins update settings" on public.store_settings;
create policy "admins update settings" on public.store_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------- categories and collections

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique
              check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  name        text not null check (length(name) between 1 and 60),
  description text not null default '' check (length(description) <= 500),
  image_url   text check (image_url is null or length(image_url) <= 1000),
  sort_order  integer not null default 0,
  visible     boolean not null default true,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.collections (like public.categories including all);

alter table public.categories enable row level security;
alter table public.collections enable row level security;

drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
drop trigger if exists collections_updated_at on public.collections;
create trigger collections_updated_at before update on public.collections
  for each row execute function public.set_updated_at();

drop policy if exists "visible categories are public" on public.categories;
create policy "visible categories are public" on public.categories
  for select to anon, authenticated using (visible or public.is_admin());
drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "visible collections are public" on public.collections;
create policy "visible collections are public" on public.collections
  for select to anon, authenticated using (visible or public.is_admin());
drop policy if exists "admins manage collections" on public.collections;
create policy "admins manage collections" on public.collections
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- products

create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique
                   check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  name             text not null check (length(name) between 1 and 120),
  summary          text not null default '' check (length(summary) <= 160),
  description      text not null default '' check (length(description) <= 5000),
  status           text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  category_id      uuid references public.categories (id) on delete set null,
  collection_ids   uuid[] not null default '{}',
  tags             text[] not null default '{}',
  -- Photos, options and variants are stored with the product so that saving
  -- a product is one atomic write. Shapes: see src/lib/domain/types.ts.
  images           jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),
  options          jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  variants         jsonb not null
                   check (jsonb_typeof(variants) = 'array' and jsonb_array_length(variants) between 1 and 100),
  track_inventory  boolean not null default false,
  specs            jsonb not null default '[]'::jsonb check (jsonb_typeof(specs) = 'array'),
  featured         boolean not null default false,
  seo_title        text not null default '' check (length(seo_title) <= 70),
  seo_description  text not null default '' check (length(seo_description) <= 160),
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists products_status_idx on public.products (status);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_collections_idx on public.products using gin (collection_ids);

alter table public.products enable row level security;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Archived products stay readable so old links can say "no longer available"
-- instead of a dead end; drafts never leave the dashboard.
drop policy if exists "published products are public" on public.products;
create policy "published products are public" on public.products
  for select to anon, authenticated using (status in ('active', 'archived') or public.is_admin());
drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- A deleted collection disappears from every product that listed it.
create or replace function public.forget_collection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.products
     set collection_ids = array_remove(collection_ids, old.id)
   where old.id = any (collection_ids);
  return old;
end;
$$;

drop trigger if exists collections_forget on public.collections;
create trigger collections_forget after delete on public.collections
  for each row execute function public.forget_collection();

-- ------------------------------------------------------------------ orders

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  number            bigint generated always as identity (start with 1001) unique,
  channel           text not null check (channel in ('web', 'whatsapp')),
  status            text not null check (status in (
                      'prepared', 'opened', 'received', 'confirmed',
                      'fulfilled', 'completed', 'cancelled', 'discarded')),
  payment_method    text not null check (payment_method in ('cod', 'bank_transfer', 'whatsapp')),
  payment_status    text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  currency          text not null check (currency ~ '^[A-Z]{3}$'),
  items             jsonb not null
                    check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50),
  subtotal          numeric(12, 2) not null check (subtotal >= 0),
  shipping_fee      numeric(12, 2) not null default 0 check (shipping_fee >= 0),
  total             numeric(12, 2) not null check (total >= 0),
  shipping_method   jsonb,
  customer          jsonb not null check (jsonb_typeof(customer) = 'object'),
  address           jsonb,
  customer_note     text not null default '' check (length(customer_note) <= 500),
  internal_note     text not null default '' check (length(internal_note) <= 2000),
  stock_reserved    boolean not null default false,
  events            jsonb not null default '[]'::jsonb check (jsonb_typeof(events) = 'array'),
  -- SHA-256 of the secret in the shopper's confirmation link.
  access_token_hash text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists orders_created_idx on public.orders (created_at desc);

alter table public.orders enable row level security;

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- No policy for anon at all: shoppers never query orders directly. The
-- website inserts them with the secret key after validating and pricing
-- every line itself.
drop policy if exists "admins read orders" on public.orders;
create policy "admins read orders" on public.orders
  for select to authenticated using (public.is_admin());
drop policy if exists "admins update orders" on public.orders;
drop policy if exists "admins delete closed orders" on public.orders;
create policy "admins delete closed orders" on public.orders
  for delete to authenticated
  using (public.is_admin() and status in ('prepared', 'opened', 'cancelled', 'discarded'));

-- Every change to an order goes through the two functions below, so status,
-- stock and the order's history can never disagree.
revoke insert, update on public.orders from anon, authenticated;

-- ------------------------------------------------------- order functions

-- Moves an order along and applies its stock effect in one transaction.
-- p_stock_delta: 1 = take the items out of stock, -1 = put them back.
create or replace function public.admin_transition_order(
  p_order_id uuid,
  p_from text,
  p_to text,
  p_stock_delta integer default 0,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_item  jsonb;
  v_delta integer := coalesce(p_stock_delta, 0);
  v_actor text := coalesce((select auth.jwt()) ->> 'email', 'admin');
  v_now   text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_events jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if (p_from, p_to) not in (
    ('prepared', 'received'), ('prepared', 'discarded'),
    ('opened', 'received'), ('opened', 'discarded'),
    ('received', 'confirmed'), ('received', 'cancelled'),
    ('confirmed', 'fulfilled'), ('confirmed', 'cancelled'),
    ('fulfilled', 'completed'),
    ('cancelled', 'received'), ('discarded', 'received')
  ) then
    raise exception 'That step is not possible from here.' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> p_from then
    raise exception 'conflict: order is now %', v_order.status using errcode = 'P0001';
  end if;

  -- Never reserve twice, never return what was not taken.
  if v_delta = 1 and v_order.stock_reserved then v_delta := 0; end if;
  if v_delta = -1 and not v_order.stock_reserved then v_delta := 0; end if;
  if v_delta not in (-1, 0, 1) then v_delta := 0; end if;

  if v_delta <> 0 then
    for v_item in select value from jsonb_array_elements(v_order.items) loop
      continue when coalesce(v_item ->> 'productId', '') !~ '^[0-9a-fA-F-]{36}$';
      update public.products p
         set variants = (
           select jsonb_agg(
                    case when v ->> 'id' = v_item ->> 'variantId'
                      then jsonb_set(v, '{stock}', to_jsonb(greatest(0,
                             coalesce((v ->> 'stock')::integer, 0) - v_delta * (v_item ->> 'quantity')::integer)))
                      else v
                    end
                    order by ordinality)
             from jsonb_array_elements(p.variants) with ordinality as t (v, ordinality)
         )
       where p.id = (v_item ->> 'productId')::uuid
         and p.track_inventory;
    end loop;
    v_events := v_events || jsonb_build_array(jsonb_build_object(
      'at', v_now, 'kind', 'stock', 'by', v_actor,
      'note', case when v_delta = 1 then 'Stock reserved for this order.' else 'Reserved stock returned.' end));
  end if;

  v_events := v_events || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'at', v_now, 'kind', 'status', 'from', p_from, 'to', p_to, 'by', v_actor,
    'note', nullif(trim(coalesce(p_note, '')), ''))));

  update public.orders
     set status = p_to,
         stock_reserved = case v_delta when 1 then true when -1 then false else stock_reserved end,
         events = events || v_events
   where id = p_order_id
  returning * into v_order;

  return to_jsonb(v_order) - 'access_token_hash';
end;
$$;

revoke all on function public.admin_transition_order(uuid, text, text, integer, text) from public, anon;
grant execute on function public.admin_transition_order(uuid, text, text, integer, text) to authenticated;

-- Payment status and the private note, with the payment change logged.
create or replace function public.admin_update_order(
  p_order_id uuid,
  p_payment_status text default null,
  p_internal_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_actor text := coalesce((select auth.jwt()) ->> 'email', 'admin');
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_payment_status is not null and p_payment_status not in ('unpaid', 'paid', 'refunded') then
    raise exception 'invalid payment status' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  update public.orders
     set payment_status = coalesce(p_payment_status, payment_status),
         internal_note = coalesce(left(p_internal_note, 2000), internal_note),
         events = case
           when p_payment_status is not null and p_payment_status <> v_order.payment_status
           then events || jsonb_build_array(jsonb_build_object(
                  'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                  'kind', 'payment', 'from', v_order.payment_status, 'to', p_payment_status,
                  'by', v_actor))
           else events
         end
   where id = p_order_id
  returning * into v_order;

  return to_jsonb(v_order) - 'access_token_hash';
end;
$$;

revoke all on function public.admin_update_order(uuid, text, text) from public, anon;
grant execute on function public.admin_update_order(uuid, text, text) to authenticated;

-- The shopper tapped "Open WhatsApp". Only ever moves prepared → opened, and
-- only with the secret from their own confirmation link.
create or replace function public.mark_whatsapp_opened(p_order_id uuid, p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_found boolean;
begin
  update public.orders
     set status = 'opened',
         events = events || jsonb_build_array(jsonb_build_object(
           'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'kind', 'status', 'from', 'prepared', 'to', 'opened', 'by', 'customer'))
   where id = p_order_id and access_token_hash = p_token_hash and status = 'prepared';
  select exists (
    select 1 from public.orders where id = p_order_id and access_token_hash = p_token_hash
  ) into v_found;
  return v_found;
end;
$$;

revoke all on function public.mark_whatsapp_opened(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_whatsapp_opened(uuid, text) to service_role;

-- --------------------------------------------------- catalog maintenance

create or replace function public.admin_set_collection_products(p_collection_id uuid, p_product_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.products
     set collection_ids = array_remove(collection_ids, p_collection_id)
   where p_collection_id = any (collection_ids)
     and not (id = any (coalesce(p_product_ids, '{}')));
  update public.products
     set collection_ids = array_append(collection_ids, p_collection_id)
   where id = any (coalesce(p_product_ids, '{}'))
     and not (p_collection_id = any (collection_ids));
end;
$$;

revoke all on function public.admin_set_collection_products(uuid, uuid[]) from public, anon;
grant execute on function public.admin_set_collection_products(uuid, uuid[]) to authenticated;

create or replace function public.admin_reorder(p_kind text, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_kind = 'category' then
    update public.categories c set sort_order = o.position - 1
      from unnest(p_ids) with ordinality as o (id, position) where c.id = o.id;
  elsif p_kind = 'collection' then
    update public.collections c set sort_order = o.position - 1
      from unnest(p_ids) with ordinality as o (id, position) where c.id = o.id;
  else
    raise exception 'unknown kind %', p_kind;
  end if;
end;
$$;

revoke all on function public.admin_reorder(text, uuid[]) from public, anon;
grant execute on function public.admin_reorder(text, uuid[]) to authenticated;

-- ----------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-media', 'store-media', true, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public bucket: anyone can *view* a file by its URL. Only admins can add,
-- replace or delete files.
drop policy if exists "admins upload store media" on storage.objects;
create policy "admins upload store media" on storage.objects
  for insert to authenticated with check (bucket_id = 'store-media' and public.is_admin());
drop policy if exists "admins update store media" on storage.objects;
create policy "admins update store media" on storage.objects
  for update to authenticated using (bucket_id = 'store-media' and public.is_admin());
drop policy if exists "admins delete store media" on storage.objects;
create policy "admins delete store media" on storage.objects
  for delete to authenticated using (bucket_id = 'store-media' and public.is_admin());
drop policy if exists "admins list store media" on storage.objects;
create policy "admins list store media" on storage.objects
  for select to authenticated using (bucket_id = 'store-media' and public.is_admin());

-- ------------------------------------------------------------------ access

-- Supabase usually grants these to its API roles by default. Stating them
-- keeps the store working on projects where new tables are not exposed to the
-- API automatically. Row-level security (above) still decides which rows each
-- caller can see or change.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.store_settings, public.categories, public.collections, public.products
  to anon, authenticated;
grant update on public.store_settings to authenticated;
grant insert, update, delete on public.categories, public.collections, public.products to authenticated;
grant select on public.admin_users to authenticated;
grant select, delete on public.orders to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- And what the public must never have, whatever the project's defaults.
revoke all on public.orders from anon;
revoke all on public.admin_users from anon;
revoke insert, update, delete, truncate on public.store_settings, public.categories, public.collections, public.products
  from anon;
revoke insert, update, truncate on public.orders from authenticated;
-- TRUNCATE skips row-level security; nobody but the database owner needs it.
revoke truncate on public.store_settings, public.categories, public.collections, public.products, public.admin_users
  from authenticated;
