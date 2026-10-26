# Advanced configuration

**You don't need anything on this page to run your store.** A store needs exactly three settings — `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` — and everything a store owner changes (name, logo, currency, WhatsApp number, checkout methods, delivery, theme, homepage) lives in the dashboard.

This page lists the optional settings that exist for special cases, so you know what they are if you ever see them. If a host suggests any of these names, you can leave them out.

All settings are read in one place: [`src/server/env.ts`](../src/server/env.ts). None is `NEXT_PUBLIC_`, so no value ever reaches a visitor's browser.

---

## Optional settings

| Name | Default | When to set it |
| --- | --- | --- |
| `SUPABASE_ANON_KEY` | — | The older name for `SUPABASE_PUBLISHABLE_KEY`; either works. Hostinger's Supabase database wizard sets this one (with `SUPABASE_URL`), so with that wizard you only add `SUPABASE_SECRET_KEY` yourself. |
| `SUPABASE_SERVICE_ROLE_KEY` | — | The older name for `SUPABASE_SECRET_KEY`; either works. |
| `SESSION_SECRET` | built in | A fixed secret (32+ random characters) for signing checkout forms and local dashboard sessions. Without it, one is derived from the Supabase secret key — or, on the local store, created in its data folder. Changing it invalidates open checkout forms and signs local dashboard users out. |
| `CATALOG_CACHE_SECONDS` | `30` | How long each server reuses the loaded catalog. Saving in the dashboard refreshes it immediately on that server; `0` always reads fresh (the tests use this). |
| `STORE_BACKEND` | automatic | `supabase` or `local`. Automatic means Supabase as soon as any Supabase setting is present, otherwise the local store in development. Set `local` to run the local store in production on purpose (see below). |
| `STORE_DATA_DIR` | `./.data` | Local store only: the folder for its data file and uploads. |
| `ADMIN_SETUP_TOKEN` | — | Local store only: the one-time code `/admin/setup` asks for in production before it creates the owner account. In development, setting it makes the setup screen ask for it too. |
| `PUBLIC_DEMO_MODE` | off | `true` only for a public demo of a store — see below. Never on a real store. |

---

## Public demo mode

For a store anyone on the internet can try — like the hosted Halden demo — set `PUBLIC_DEMO_MODE=true` on that deployment:

- A band above the shop says it is a demo, with a link to explore the dashboard.
- Visitors open the dashboard as a **guest**: every page and control is there, but nothing is saved. They see sample orders made up for the preview, never real ones, and no account details.
- Orders placed in the shop reach the confirmation page but are kept in the server's memory for an hour and never saved. Nothing is sent to anyone.
- The owner still signs in with their admin account. `npm run db:seed -- --settings` puts the demo products and settings back as they were.

Never turn it on for a real store: its orders would not be saved.

---

## The local store in production

The local store (a data file plus an uploads folder) is meant for trying things out. A production server that has no database settings shows a setup message instead of quietly running on local files. To run the local store in production on purpose — a short-lived demo, say — set:

- `STORE_BACKEND=local`
- `STORE_DATA_DIR` to a folder **outside** the app folder, or the next deploy replaces it
- `ADMIN_SETUP_TOKEN` to create the owner account at `/admin/setup`
- `SESSION_SECRET`, so sessions survive a redeploy

---

## Settings used only by the scripts and tests

These are read by commands you run on your own computer, never by the store on a server.

| Name | Used by | Purpose |
| --- | --- | --- |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `npm run setup`, `npm run admin:create` | Create the admin account without being asked (automation). |
| `PRIVACY_BLOCKLIST` | `npm run privacy:check` | Path to a blocklist file other than `.privacy/blocklist`. |
| `PLAYWRIGHT_CHANNEL` | `npm run test:e2e` | `chrome` to use an installed Chrome instead of Playwright's browser. |
| `E2E_BACKEND`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | `npx playwright test` | Run the browser tests against a real Supabase project instead of throwaway local stores. |
| `E2E_PORT`, `E2E_SETUP_TOKEN`, `CI` | the browser tests | Ports and settings of the test servers. |

### Running the browser tests against a Supabase project

With the project's keys in `.env.local` and a temporary admin account (`npm run admin:create -- qa@example.com`):

```bash
npm run build
E2E_BACKEND=supabase E2E_ADMIN_EMAIL=qa@example.com E2E_ADMIN_PASSWORD=… npx playwright test
```

The tests put back what they change and delete their test orders. Delete the temporary admin afterwards (Supabase → Authentication → Users).
