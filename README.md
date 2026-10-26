# Halden — e-commerce starter

A complete small-business shop you can make your own: a fast storefront, a real admin dashboard, and checkout by **WhatsApp**, **cash on delivery** or **bank transfer** — for any kind of product. Next.js 16, React 19, Tailwind CSS 4 and Supabase.

Everything an owner changes day to day — products, photos, categories, prices, stock, delivery options, payment methods, the WhatsApp number, colours, fonts and the homepage — is edited in the dashboard. No code changes, no redeploys.

It opens as **Halden**, a fictional demo store with 30 products, so you can try everything before adding your own. One click removes the demo.

---

## Get your store online in three steps

You need [Node.js](https://nodejs.org) 20.9 or newer and a free [Supabase](https://supabase.com) account — plus a Hostinger plan with Node.js hosting for step 3.

### 1. Start it on your computer

```bash
npm install
npm run dev
```

Open <http://localhost:3000> — that's the Halden demo store. Nothing to configure yet: until you connect Supabase, the store saves everything in a `.data/` folder on your computer.

### 2. Connect Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Sign the Supabase CLI in — once per computer. It opens your browser:

   ```bash
   npx supabase login
   ```

3. Run the setup and answer its questions:

   ```bash
   npm run setup
   ```

   It prepares the database, saves your project's three keys in a file called `.env.local`, adds the 30 demo products, creates your admin account and turns off public sign-ups. Keys are never shown on screen, and you can run it again at any time.

4. Stop `npm run dev` (Ctrl+C), start it again, and sign in at <http://localhost:3000/admin>.

### 3. Deploy to Hostinger

1. Put the project on GitHub (or zip it).
2. In hPanel, add a **Node.js** website and connect the repository (or upload the zip). Hostinger recognises Next.js and fills in the build settings — keep them. The build command is `npm run build`.
3. Under **Environment variables**, add these three. Copy each value from your `.env.local` file — it's in the project folder; open it in your code editor, since Finder and Explorer hide files whose name starts with a dot:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | from `.env.local` |
   | `SUPABASE_PUBLISHABLE_KEY` | from `.env.local` |
   | `SUPABASE_SECRET_KEY` | from `.env.local` — keep it secret |

   That's all the store needs. Hostinger may list other names it finds in the code; you don't need them ([what they are](docs/advanced-configuration.md)).

4. Deploy. Open `https://your-domain/admin`, sign in, and set **Settings → Store → Shop address** to your site's address.

Your store is live. Everything else — store name, logo, currency, WhatsApp number, checkout methods, delivery, colours, the homepage — is set in the dashboard.

---

## Contents

1. [Get your store online in three steps](#get-your-store-online-in-three-steps)
2. [What you get](#what-you-get)
3. [Your admin account](#your-admin-account)
4. [How ordering works](#how-ordering-works)
5. [More about Supabase](#more-about-supabase)
6. [More about Hostinger](#more-about-hostinger)
7. [Customize it](#customize-it)
8. [How the code is organized](#how-the-code-is-organized)
9. [Commands](#commands)
10. [Tests](#tests)
11. [Security and privacy](#security-and-privacy)
12. [Troubleshooting](#troubleshooting)
13. [Advanced configuration](docs/advanced-configuration.md)

---

## What you get

**The shop**

- A homepage built from sections you arrange: a headline with photo, a store directory of categories, product rows (featured, newest, on sale, or any collection), banners, collection cards, and a delivery-and-payment strip that always matches your settings.
- Categories, hand-picked collections, search, filters that only offer choices that exist, and sorting.
- Product pages with variants (size, colour with swatches, capacity…), per-variant prices, stock and photos, a hover magnifier and swipeable photos on phones.
- A bag that remembers itself, checks live prices and stock, and shows how far the shopper is from free delivery.
- Checkout in three clear steps, and an order page the shopper can come back to through a private link.
- English, French, Spanish and Arabic. Arabic switches the whole shop to right-to-left.
- Works from a 320 px phone to a wide desktop, with the keyboard, and with screen readers.

**The dashboard** (`/admin`)

- **Overview** — what needs doing today: orders to confirm, WhatsApp handoffs to check, orders to send, products low on stock. Sales of the last 30 days count only orders you confirmed.
- **Orders** — every order with its customer, items, delivery and payment. Move it from received → confirmed → fulfilled → completed (or cancel it), mark it paid, keep notes. Stock follows by itself.
- **Products** — create, edit, duplicate, archive or delete; up to 12 photos each (resized in the browser before upload), options and variants, stock, compare-at prices, search-engine fields.
- **Categories and Collections** — create, edit, hide and reorder; pick a collection's products from any category.
- **Storefront** — accent colour (with automatic contrast), three type pairings, corner style, the announcement bar, the homepage headline and photo, and the homepage sections.
- **Settings** — store name, logo, language, currency, contact details and WhatsApp number, checkout methods and bank details, delivery options and free-delivery amount, policy pages, social links, demo content, password.

**Behind it**

- **Supabase** (Postgres, Auth, Storage, row-level security) for a live store — or a **local** file store that needs no account at all, for trying things out.
- Business rules — prices, stock, the order lifecycle, validation — live in one place (`src/lib/domain`) with unit tests; the database rules are tested on a real Postgres engine.

---

## Your admin account

`npm run setup` creates it. To add another admin, or reset a forgotten password:

```bash
npm run admin:create -- you@example.com
```

It asks for a password (nothing is shown while you type), creates the user in Supabase Auth and makes it an admin.

Or by hand: Supabase → Authentication → Users → Add user (tick "Auto confirm"), then in the SQL Editor:

```sql
select public.grant_admin('you@example.com');
```

**On the local store** (before you connect Supabase), open <http://localhost:3000/admin/setup> once to create the owner account.

---

## How ordering works

Shoppers choose how to order at checkout. You decide which methods are offered (Settings → Checkout and payment).

| Method | What the shopper does | What you see in Orders |
| --- | --- | --- |
| **Pay on delivery** | Places the order on the website. | A new order, **Received**. |
| **Bank transfer** | Places the order, then sees your bank details and the reference to use. | A new order, **Received**, payment pending. |
| **WhatsApp** | Sees the order written out as a message and opens WhatsApp to send it to you. | A **WhatsApp handoff** — not an order yet. |

**The life of an order**

```
Received ──▶ Confirmed ──▶ Fulfilled ──▶ Completed
    │            │
    └──────┬─────┘
           ▼
       Cancelled
```

- **Confirmed** is when stock is set aside (for products that track stock). Cancelling a confirmed order puts it back.
- Only **Confirmed**, **Fulfilled** and **Completed** orders count as sales on the Overview.
- Shoppers follow their order's status on their private order page.

**Why WhatsApp handoffs are separate.** A website can show the shopper the message and open WhatsApp — but it can't know whether the message was sent. So a WhatsApp order starts as *message prepared*, becomes *opened, unverified* if the shopper taps the button, and only becomes **Received** when you mark it so after finding the message in your chats. Unverified handoffs are never counted as orders or sales, and old ones can be discarded in one click.

**No WhatsApp number yet?** WhatsApp checkout runs as a safe demo: the shopper sees the message, but no chat opens and nothing is sent to anyone. Add your number in Settings → Contact and WhatsApp, in full international format, e.g. `+44 7700 900123`.

---

## More about Supabase

- `npm run db:check` checks your project's security from the outside — what a shopper and a signed-in stranger can and can't do. It changes nothing.
- After updating the starter, `npm run db:migrate` applies any new database changes.
- `npm run db:seed` adds or restores the demo products; `npm run db:seed -- --remove` takes them out. You can also do both from **Settings → Demo content** in the dashboard.
- To start over with a fresh demo store on the local store: `npm run demo:reset` (your current data is moved to `.data-backups/`, never deleted).

<details>
<summary><strong>Without the CLI</strong></summary>

1. In Supabase → SQL Editor → New query, paste the whole of [`supabase/migrations/20261026000000_storefront_schema.sql`](supabase/migrations/20261026000000_storefront_schema.sql) and click Run. It is safe to run again.
2. In Supabase → Project Settings → API keys, copy the keys into `.env.local` (see [`.env.example`](.env.example)):

   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   SUPABASE_SECRET_KEY=sb_secret_…
   ```

3. Create your admin account (see [Your admin account](#your-admin-account)), sign in, and use **Settings → Demo content → Add demo content** for the sample products.
4. In Supabase → Authentication → Sign In / Providers, turn off "Allow new users to sign up".

</details>

---

## More about Hostinger

- Hostinger's Node.js web hosting (Business and Cloud plans) runs the store. Choose **Node.js 20 or 22**; the start command is `npm start` if you're asked for one. Menu names in hPanel may differ slightly between plans.
- Connect your domain and turn on SSL in hPanel.
- If you connected Supabase through Hostinger's database wizard, it has already added `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the older name of the publishable key, which also works) — add `SUPABASE_SECRET_KEY` yourself.
- The build uses webpack (`next build --webpack`), which works on build machines where Turbopack's native binary can't load.
- Photos you upload are stored in Supabase Storage. If your Supabase project uses a custom domain, set `SUPABASE_URL` to it **before building** — the image settings read it at build time.
- Run `npm run verify` before every deploy: it type-checks, lints, runs the tests and the privacy check, and builds.

---

## Customize it

**Without code** — the dashboard's Storefront and Settings pages. Changes are live as soon as you save.

To let visitors try a copy of your store and look around its dashboard without changing anything, see *Public demo mode* in [Advanced configuration](docs/advanced-configuration.md).

**With code**

- **Colours and type**: `src/app/globals.css` holds the design tokens. `src/lib/theme.ts` turns the owner's accent, type pairing and corners into CSS variables, and keeps text readable on any accent.
- **Fonts**: `src/app/fonts.ts` (self-hosted by `next/font` — shoppers' browsers never call Google).
- **Words in the shop**: `src/lib/i18n/en.ts`, `fr.ts`, `es.ts`, `ar.ts`. To add a language, copy `en.ts`, translate it, and register it in `src/lib/i18n/languages.ts` and `src/lib/i18n/index.ts`. TypeScript tells you if a translation misses a key.
- **Checkout rules**: `src/lib/domain/checkout.ts`. **The WhatsApp message**: `src/lib/domain/whatsapp.ts`. **Order states**: `src/lib/domain/orders.ts`.
- **The demo store**: `src/lib/demo/` (settings, categories, products) and `public/demo/` (photos — see `public/demo/CREDITS.md`).
- **The database**: `supabase/migrations/`. Add a new file for each change (`<timestamp>_<name>.sql`) and write it so it can safely run more than once, like the first one — `npm run db:migrate` applies them all, in order.

---

## How the code is organized

```
src/
  app/
    (store)/           the shop: home, shop, categories, collections, products,
                       cart, checkout, order pages, info pages
    admin/             the dashboard (its own layout, always English)
    api/               photo uploads, the "WhatsApp opened" beacon
    media/             serves local-store uploads
  components/
    store/             shop components
    admin/             dashboard components
  lib/
    domain/            business rules: money, products, variants, stock, cart,
                       checkout, orders, settings — pure and unit-tested
    i18n/              shop translations
    demo/              the fictional demo store
  server/
    backend/           local/ and supabase/ — one interface, two stores
    actions/           server actions for the shop and the dashboard
    demo/              public demo mode: dashboard preview, in-memory orders
    admin.ts           who is signed in (checked by every dashboard action)
  proxy.ts             keeps Supabase sessions fresh on dashboard requests
supabase/
  migrations/          tables, row-level security, storage, atomic functions
  config.toml          the CLI settings `npm run setup` pushes (sign-ups off)
scripts/               setup, migrations, demo data, admin account, privacy check
tests/e2e/             end-to-end tests (Playwright)
```

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on <http://localhost:3000> |
| `npm run setup` | Connects a Supabase project: database, keys, demo products, admin, sign-ups off |
| `npm run db:migrate` | Applies the database migrations to the project in `.env.local` |
| `npm run db:seed` | Adds or restores the demo products (`-- --settings` also restores the demo settings, `-- --remove` removes them) |
| `npm run db:check` | Checks the project's security from the outside (17 checks; changes nothing) |
| `npm run admin:create -- you@example.com` | Creates an admin account, or resets its password |
| `npm run demo:reset` | Local store: back to a fresh demo store (old data kept in `.data-backups/`) |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit and database tests (Vitest; database tests run Postgres in-process with PGlite) |
| `npm run test:e2e` | Builds, then runs the browser tests (Playwright) |
| `npm run privacy:check` | Scans the project and the build for secrets and blocklisted details |
| `npm run verify` | typecheck → lint → tests → privacy check → build |

---

## Tests

- `npm test` — business rules (pricing, variants, stock, cart, checkout validation, order lifecycle, WhatsApp messages, settings), the demo store and public demo mode, and the database: row-level security, permissions, the admin role and the atomic order functions, run on real Postgres.
- `npm run test:e2e` — a production build in a real browser, on two throwaway local stores (one in public demo mode): owner setup, access control, products with photos and variants, categories, collections, settings reflected in the shop, Arabic right-to-left, every checkout method, the order lifecycle with stock, the guest dashboard preview, and no sideways scrolling from 320 px to 1440 px.

  Playwright needs a browser once: `npx playwright install chromium`. Rerun without rebuilding: `npx playwright test`. Running them against a real Supabase project is described in [Advanced configuration](docs/advanced-configuration.md).

The end-to-end tests never contact WhatsApp or any other service.

---

## Security and privacy

- **Keys**: the Supabase secret key stays on the server. No setting is `NEXT_PUBLIC_`, so nothing reaches a visitor's browser. `.env*` files are ignored by git, except the empty template. Setup never prints a key.
- **Database**: row-level security on every table, and explicit permissions on top. The public key can read published products, visible categories and collections, and the settings — nothing else. Orders and the admin list are closed to it entirely; the server creates orders with the secret key. Only accounts listed in `admin_users` can change anything, and the dashboard queries Supabase *as the signed-in admin*, so the database checks the role a second time.
- **Dashboard**: every page and every action checks the session itself. Never indexed by search engines, never framed.
- **Checkout**: inputs validated on the server, prices and stock re-checked when the order is placed, a hidden field and a minimum fill time against bots, and per-visitor rate limits.
- **Order pages**: reachable only through the private link given to the shopper; only a hash of that link's secret is stored.
- **Photos**: the file type is read from the file's bytes, not its name; size-limited; uploads need an admin session.

**Privacy check.** `npm run privacy:check` scans every file and the build output for secret keys, committed `.env` files, and phone numbers hard-coded into WhatsApp links. It also checks a private blocklist: `npm run privacy:check -- --add` stores a detail that must never appear in your code — a previous client's name or phone number, for example — as a hash in `.privacy/` (ignored by git). Findings show your label, never the value.

---

## Troubleshooting

**"The store can't reach its database" / "No database is configured"** — one of the three Supabase variables is missing or wrong, or the database hasn't been set up. Run `npm run setup` (or `npm run db:migrate`), and check the three variables on your host. The dashboard's sign-in page says which.

**`npm run setup` says you're not signed in** — run `npx supabase login` first.

**Checkout says ordering is unavailable** — every checkout method is switched off in Settings → Checkout and payment.

**WhatsApp shows the message but doesn't open a chat** — no WhatsApp number is set, so WhatsApp checkout is in demo mode. Add it in Settings → Contact and WhatsApp.

**"Use the full international number"** — WhatsApp needs the country code: `+44 7700 900123`, not `07700 900123`.

**Photos from Supabase don't show** — your project uses a custom domain: set `SUPABASE_URL` to it and rebuild.

**Forgot the admin password** — `npm run admin:create -- you@example.com` (add `--replace` on the local store).

**`/admin/setup` says setup is locked** — the store is running in production on the local store. Connect Supabase instead (or see [Advanced configuration](docs/advanced-configuration.md)).

---

## License

The code is MIT-licensed — see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md). Not included in that license: the demo photographs in `public/demo` (stock photos under their own licenses, listed in [public/demo/CREDITS.md](public/demo/CREDITS.md)) and the brand icons, which are trademarks of their owners.
