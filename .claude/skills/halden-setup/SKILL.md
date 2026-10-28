---
name: halden-setup
description: Guided, beginner-friendly setup of this Halden store — checks the computer, makes sure the folder is a clone of the user's own GitHub copy, installs what the project needs, connects the user's own new Supabase project through Halden's own `npm run setup` (which the user runs in Claude Desktop's Terminal), verifies the database, starts a local preview with the admin dashboard, then walks them through deploying their own GitHub copy to Hostinger and checks the live store. Claude does the routine work; the user only signs in, approves and types their own password. Use when the user asks to set up, install, configure or connect Halden or this store, connect Supabase, run or preview it, deploy it, put it online or publish it on Hostinger, or continue an interrupted setup.
---

# Halden setup

You are setting up Halden **for** someone with no technical background. The goal: their own store
online on Hostinger, backed by their own new Supabase project, with an Admin Dashboard they can sign
in to. You do the routine work; they only do what needs their account, their decision, their
password or their approval.

Halden is finished software. During setup, never change the app's code, migrations, security
policies, `supabase/config.toml` or the setup scripts. Halden's `npm run setup` already creates the
database, security rules, photo storage, `.env.local`, demo products, the admin account and turns
off public sign-ups — never redo any of that by hand (no SQL editor, no hand-written `.env.local`).

## How to behave

- **Keep going.** When a step succeeds, start the next one. Don't ask "Shall I continue?".
- **Report briefly, in plain words.** One or two lines per stage: what was done, what was verified.
  No command output or jargon unless something went wrong. Say "the Terminal", "your store's
  database", "your private keys file" — not "TTY", "migrations", "env vars".
- **Stop only at the user moments below.** Each is one message saying exactly where to click and
  what to type, with their real values filled in. When they reply, carry on without re-confirming.
  One approval covers everything it named.
- **Stop on anything unexpected.** Explain it plainly, propose one fix, wait. Never guess, never
  retry a failing database step blindly, never "fix" it in the Supabase SQL editor.
- **The user's terminal is interactive; yours isn't.** Your command tool can't answer prompts, so
  `npm run setup`, `npx supabase login` and `npm run admin:create` are always run **by the user** in
  the Terminal. Claude Desktop may ask before you run a command — tell them once that clicking
  **Allow** is fine for the steps you describe.
- **No homework.** Don't ask them to test products, orders or checkout — Halden's own tests cover
  that. Anything no check proved is "not verified"; never claim it passed.

## Secrets — always

- Never display, print, read into the conversation or commit: the Supabase secret key, the admin
  password, access tokens, or `.env.local`'s contents. Never open `.env.local` with Read/cat, never
  run `env`/`printenv`, never run `supabase projects api-keys` yourself.
- About `.env.local` you may only: check it exists, count which of the three names are filled
  (`grep -cE '^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|SUPABASE_SECRET_KEY)=.+' .env.local`), read
  the `SUPABASE_URL` line (a public address), pipe a value to the clipboard (E's fallback), and open the file in the user's own text editor (E) — without reading it.
- Never ask for a password or key in chat. If one is pasted anyway, don't repeat it; say it's best
  not to share it, and if it was the secret key, suggest creating a new one later in Supabase →
  Project Settings → API Keys and running the setup again.
- Never `git commit`, `git push` or change git remotes during setup. Nothing is ever sent to the
  original Halden repository (`github.com/salhiworks/halden-ecommerce-starter`).
- Never ask for or handle a GitHub password or token: GitHub sign-in happens only in the user's
  Terminal or browser.
- Never set `PUBLIC_DEMO_MODE`, `STORE_BACKEND` or any variable other than the three Supabase ones
  on a user's store.

## One project, always new

- The user creates a **new** Supabase project for this store. Never choose a project for them, even
  though the project list shows all of theirs.
- Halden only goes into a project that is **empty** (or already holds Halden from an earlier,
  interrupted run). A project with anything else in it — another app's tables, users or files — is
  refused: change nothing, explain why, and ask for a new project.
- Every Supabase command uses the ref the user confirmed. Use the same pinned CLI as Halden's
  scripts: `npx --yes supabase@2.120.0 …` (written `SB` below).

## The user moments — the only times you stop

0. **Their own copy** — only if this folder isn't a clone of their own GitHub repository (A2).
1. **Supabase** — create a new project and paste its ID (and sign the Supabase tool in, only if it
   isn't already).
2. **Install approval** — one yes for that exact project.
3. **Run the setup** in the Terminal and answer its questions.
4. **Look at the store** on this computer (optional; they can go straight on).
5. **Hostinger** — one message: create the web app, copy three settings from the local file, deploy, paste the address.
6. **Sign in on the live site** and set the shop address.

---

## Resuming — do this first, every time

Work out where things stand without asking, then say it in one line:

- `node_modules` missing → start at A.
- `.env.local` missing, or fewer than 3 names filled → Supabase isn't connected: A, then B.
- `.env.local` complete → read its `SUPABASE_URL` (the ref is the part before `.supabase.co`) and run
  `npm run db:check`:
  - all checks pass → the database is done; go to D (checks, then preview).
  - some fail → fix only those (see "When db:check fails"), then D.
- If this conversation already reached E or F, continue there. If not and D is done, ask once
  whether the store is already on Hostinger: if yes, ask for its address and go to F; otherwise E.

Never re-run the setup, the database step or the demo products just to be safe.

## A. The computer — automatic

1. `node --version`. Node 20.9 or newer is required; 22 is recommended.
   Missing or older: ask them to install **Node.js LTS** from nodejs.org, then **quit and reopen
   Claude Desktop** and say "continue". That is the only install they ever do.
2. `npm ci` if `node_modules` is missing (a minute or two).
3. Their GitHub copy, read-only: `git remote get-url origin`.
   - A GitHub repository other than `salhiworks/halden-ecommerce-starter` → this folder is a clone
     of their own copy: remember `<owner>/<repo>` for stage E.
   - No git (a ZIP download) or the original starter → go to A2 before B. Nothing is installed
     yet, so nothing is lost by moving.
4. `SB projects list -o json` — read-only, only to learn whether the Supabase tool is signed in
   (exit code 0) and, later, to find their project.

First status line, once: what you checked, and that the journey needs a free **Supabase** account,
their own **GitHub** copy of Halden, and a **Hostinger** plan that runs Node.js web apps (Business or
Cloud) — hosting is only needed at the end. Then go straight to B (or A2).

## A2. Their own copy — only when A3 sends you here

Without it, the store can't be connected to Hostinger and later changes can't be published.

1. **User moment 0 — one message:** this folder isn't connected to their own GitHub copy. If they
   don't have one yet: on github.com/salhiworks/halden-ecommerce-starter, **Use this template →
   Create a new repository**. Public is simplest (no keys or passwords ever go into it); private
   works too. Paste its address (`https://github.com/<name>/<repo>`). If they'd rather keep this
   folder, they can say so: continue at B, and in E they still choose their copy on GitHub.
2. The address must be `https://github.com/<owner>/<repo>` and not the original starter. `../<repo>`
   must not exist yet — if it does, stop and ask; never overwrite a folder.
3. Clone it next to this folder, without prompts:
   `GIT_TERMINAL_PROMPT=0 git clone https://github.com/<owner>/<repo>.git ../<repo>`.
   Git missing: on macOS, `git --version` offers to install the developer tools — they click
   **Install** and say "continue"; on Windows, they install Git from git-scm.com and reopen Claude
   Desktop.
4. It fails with `could not read Username`, `Authentication failed` or `Repository not found` → a
   private repository (or a typo). **One message:** check the address, then paste
   `cd .. ; git clone https://github.com/<owner>/<repo>.git` into the **Terminal** and sign in there:
   - Windows: a GitHub sign-in window opens — choose the browser sign-in.
   - macOS: it asks **Username** (their GitHub username) and **Password**, where GitHub needs a
     token instead of their password: github.com/settings/personal-access-tokens/new → any name →
     **Repository access: Only select repositories** → their copy → **Permissions → Contents: Read
     and write** → **Generate token** → copy it and paste it at the Password prompt (nothing shows).
     The Mac keychain remembers it for later. Never paste it here.
   - Reply when it finishes.
5. Verify, read-only: `git -C ../<repo> remote get-url origin` is their address,
   `git -C ../<repo> rev-parse --abbrev-ref HEAD` is `main`, and
   `../<repo>/.claude/skills/halden-setup/SKILL.md` exists. (Apple's bundled Git can be old: don't
   use `git branch --show-current`, `git switch` or `git init -b`.)
6. If `.env.local` exists here, `cp .env.local ../<repo>/.env.local` (never read it) and check
   `git -C ../<repo> check-ignore -q .env.local` succeeds.
7. **One message:** in Claude Desktop, open the new folder in a new session (**Local** → the folder
   button → **Open folder…** → `<full path of ../<repo>>`) and say "Set up Halden for me" — setup
   continues there. This old folder is no longer needed. Stop.

## B. Their Supabase project

1. **User moment 1 — one message:**
   - Create a **new** project at supabase.com/dashboard → **New project** (the Free plan is fine).
     Any name and region; let Supabase generate the database password — Halden never needs it.
   - If Supabase says the free project limit is reached: pause an old project or upgrade — never
     reuse or delete a project that has data.
   - Only if the Supabase tool is **not** signed in: open the **Terminal** (the **Terminal** button
     at the top of this Claude session, or Ctrl+`), paste `npx --yes supabase login`, press Enter,
     and finish signing in in the browser (if a code appears, type it into the Terminal). This lets
     you check the project before anything is installed.
   - Paste the project's ID here: it's in the browser address bar
     (`supabase.com/dashboard/project/<ID>`) or in Project Settings → General.
2. Accept a bare ID, a `https://<ID>.supabase.co` address or a dashboard link; the ID is 20
   lowercase letters. Find it in `SB projects list -o json`:
   - not found → they're signed in to a different Supabase account, or it's a typo: say so, stop.
   - status not `ACTIVE_HEALTHY` → it's still being created; ask them to reply in a minute.
3. Read-only check of what's inside:

   ```
   SB db query --linked --project-ref <ref> "select (select count(*) from information_schema.tables where table_schema = 'public') as public_tables, (select count(*) from information_schema.tables where table_schema = 'public' and table_name not in ('admin_users','store_settings','categories','collections','products','orders')) as other_tables, (select count(*) from auth.users) as users, (select count(*) from storage.buckets where id <> 'store-media') as other_buckets, (select count(*) from storage.objects where bucket_id <> 'store-media') as other_files, to_regclass('public.store_settings') is not null as halden_installed"
   ```

   - all zero, `halden_installed` false → **new and empty**: continue.
   - `halden_installed` true, `other_tables`, `other_buckets`, `other_files` all 0 → **an earlier
     Halden setup** stopped part-way: say so and continue. Also run
     `SB db query --linked --project-ref <ref> "select (select count(*) from public.products) as products, (select count(*) from public.admin_users) as admins"`
     so the command in C can skip what's already there.
   - anything else → **in use**: stop, change nothing, explain that Halden goes into a new, empty
     project so nothing of theirs can be overwritten, and ask for a new project's ID.
4. `.env.local` already points at a different project → stop and ask which project the store should
   use. Never switch it without their clear yes (the setup needs `--force` for that).
5. **User moment 2 — one message:** show the project's **name, region and creation date**, and ask:
   "Install Halden into this project? The setup will create your store's database, security rules
   and photo storage; save the project's keys in a private file on this computer (`.env.local`,
   never uploaded); add the 30 demo products (you can remove them in one click later); create your
   dashboard login; and turn off public sign-ups for this project." A yes approves exactly that.

## C. The setup — run by the user in the Terminal

The setup asks questions and a hidden password, which only the user's Terminal can answer.

1. Build their command (one line):
   - macOS: `npm run setup -- --project-ref <ref>`
   - Windows: `node scripts/setup.mjs --project-ref <ref>` (the same script; Windows PowerShell can
     drop the `--` that `npm run` needs)
   - Earlier setup found in B3: add `--no-demo` if `products` > 0 and `--no-admin` if `admins` > 0,
     so their products and password are left as they are.
2. **User moment 3 — one message:**
   - Open the **Terminal** (the **Terminal** button at the top of this session, or Ctrl+`), paste
     the command, press Enter.
   - What it will ask, and what to answer:
     - **Use this project?** — check it shows *<project name>*, press Enter.
     - **Add them?** (demo products) — press Enter for yes.
     - **Your email** — the email for their store's dashboard login.
     - **Password**, then **Repeat the password** — at least 10 characters. Nothing appears while
       typing; that's normal. Keep it in a password manager, and don't send it here.
     - **Turn them off? (recommended)** — press Enter.
   - It ends with **Done.** Reply "done" here. If a line starting with **✗** appears instead, copy
     that line here (it never contains keys).
   - No Terminal button? Use the computer's own terminal (macOS: **Terminal** in Applications →
     Utilities; Windows: **PowerShell** from the Start menu) and first paste `cd "<full path of this
     folder>"` with the real path filled in.
3. A **✗** line: match it to "When something fails" and give one fix. The setup is safe to run
   again; a re-run on the same project uses the same command, with B3's flags if they now apply.

## D. Checks and the local preview — automatic

1. `.env.local` has all 3 names; its `SUPABASE_URL` is `https://<ref>.supabase.co` for the
   confirmed ref.
2. `npm run db:check` → "All 17 checks passed." This proves the database, photo storage, an admin
   account, the security rules (what shoppers and signed-in strangers can't do) and that sign-ups
   are off.
3. `npm run build`, then `npm run privacy:check` — the same build Hostinger runs, and no key in any
   file a browser receives.
4. Start the preview in the background: `npm run dev`. When it says Ready, check that
   `http://localhost:3000` answers 200 and that
   `curl -sSL -o /dev/null -w '%{http_code} %{url_effective}' http://localhost:3000/admin` ends at
   200 on `/admin/login` (use the port it printed if 3000 was busy). If you have a browser or
   preview tool, you may open it there.
5. One status line ("database installed and checked; security checks pass; the store builds"), then
   **user moment 4 — one message:**
   - The store: `http://localhost:3000`. The Admin Dashboard: `http://localhost:3000/admin` — sign
     in with the email and password they chose in the Terminal.
   - This preview runs only while this session is open. It already uses their real database: what
     they change in this dashboard will also appear on the live site.
   - Next is putting it online on Hostinger — reply when they're ready (or come back any time and
     say "continue setting up Halden").

## E. Hostinger — guided, in their browser

Never use FTP, a VPS, another host or a Hostinger connector, and never change or overwrite an
existing website: Halden is always added as a **new** website.

**User moment 5 — one message, the whole deployment.** Open their private keys file for them in the
same turn (below), then send this once, with their real values filled in. Hostinger's wording can
differ slightly: follow the meaning, not the exact labels.

1. hPanel → **Websites** → **Add Website** (or **Create**) → **Web App**.
2. **Domain:** choose the free **Temporary Domain** (their own can be connected later).
3. **Import Git Repository:** connect GitHub if asked, give Hostinger access to **only** their Halden
   copy (*<owner>/<repo>* from A3), and select it — never `salhiworks/halden-ecommerce-starter`.
   Branch **main**.
4. **Build settings:** Hostinger detects **Next.js** — keep what it fills in (build `npm run build`,
   start `npm start` if asked). Node.js 22 is recommended; any version Hostinger offers that is 20.9
   or newer works.
5. **Environment variables:** add exactly these three names — `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. Their values are already in the file just
   opened on this computer (`.env.local`): copy the part after each `=` into the matching field.
   The secret key is private — never share it. Leave out any other names Hostinger suggests.
6. Click **Deploy**. When it finishes, open the site, and paste its address here.
7. After copying the values, close the file **without saving**.

Opening the file (you run this; you never read it): macOS `open -e .env.local`, Windows
`notepad .env.local` — from this folder. Never `cat`/Read it, never show its contents. If it doesn't
open, tell them the file is `.env.local` in this folder (Finder and Explorer hide dot-files, so use
a text editor's **Open**), or use the fallback below.

A failed build: ask them to copy the last red lines of the build log here (they hold no keys).

**Import .env** — do not suggest it. Hostinger's import was not verified against the generated
`.env.local` (which a user may also have edited), and it would risk bringing in names beyond the
three. Typing the three variables is the supported route.

**Clipboard fallback** — only if they can't copy the values from the file, or ask for help. One key
at a time; the values never appear in chat, a command line, command output or a file:
- Copy with exactly this command, changing only the two names (macOS):
  `sed -n 's/^SUPABASE_PUBLISHABLE_KEY=//p' .env.local | head -n 1 | tr -d '\r\n' | pbcopy && pbpaste | grep -cE '^(sb_publishable_|eyJ)'`
  It prints only `1`. For the secret key: `SUPABASE_SECRET_KEY` and `'^(sb_secret_|eyJ)'`.
  Windows: `| clip` instead of `| pbcopy`, and
  `powershell -NoProfile -Command Get-Clipboard | grep -cE '…'` for the check.
- Never run `pbpaste` or `Get-Clipboard` except piped into that count. A check that prints `0` →
  don't debug it; use the file.
- Copy a key in the same turn as the message asking them to paste it; change the clipboard again
  only after they reply it's pasted. When done, clear it (`printf '' | pbcopy`; Windows
  `printf '' | clip`; Windows clipboard history, Win+V, may keep copies they can delete).

## F. The live store

1. Check from outside, read-only (`https://<domain>` is what they pasted):
   - `curl -sSL -o /dev/null -w '%{http_code}' https://<domain>/` → 200.
   - The homepage HTML contains none of: `data-testid="demo-bar"` (demo mode must be off),
     `reach its database`, `No database is configured`, `sb_secret_`.
   - `curl -sSL -o /dev/null -w '%{http_code} %{url_effective}' https://<domain>/admin` → 200 at
     `/admin/login`: the dashboard is protected. That page's HTML must not contain
     `connected to its database` (the notice shown when Hostinger's variables are wrong).
   - A failure → the matching fix in "When something fails", then check again when they say done.
2. **User moment 6 — one message:** open `https://<domain>/admin`, sign in with the same email and
   password, then **Settings → Store → Shop address** = `https://<domain>`, and save. Reply when
   the dashboard is open.

## G. Done

Short summary, then stop:

- The store is live at `https://<domain>`; the dashboard is `https://<domain>/admin`. Products,
  photos, prices, store name, logo, currency, WhatsApp number, checkout, delivery and colours are
  all changed in the dashboard — no code, no redeploy.
- The demo products can be removed in **Settings → Demo content**.
- Their own domain and SSL: hPanel → the website → Domains.
- Forgot the dashboard password: ask Claude — they'll run `npm run admin:create -- <email>` in the
  Terminal (Windows: `node scripts/create-admin.mjs <email>`).

---

## When db:check fails

Fix only what failed, then run `npm run db:check` again:

- "no settings row" / tables missing → the database step didn't finish: give them the C command
  again (with B3's flags).
- "no admin yet" → they run `npm run admin:create -- <their email>` in the Terminal (Windows:
  `node scripts/create-admin.mjs <their email>`).
- "public sign-ups are off" failed → run `SB config push --project-ref <ref> --yes` (what the setup's
  last step does); if that fails, they turn off **Allow new users to sign up** in Supabase →
  Authentication → Sign In / Providers.
- Any shopper or stranger check failed, or a network error → stop and report it. Never loosen or
  rewrite a security rule.

## When something fails

| What they see | What it means and the fix |
| --- | --- |
| `✗ … not signed in` / sign-in did not complete | Sign in with `npx --yes supabase login` in the Terminal, then the same command again. |
| `✗ No project with the ref …` | The Terminal is signed in to a different Supabase account than the project — sign in with the right one. |
| `✗ Could not apply …` | The database step failed. Stop and report the line; don't edit anything by hand. |
| `✗ … keys could not be read` | Their account can't manage that project's keys, or the project isn't ready. Wait a minute and run it again; otherwise stop. |
| `✗ .env.local is set up for a different Supabase project` | See B4. |
| `git clone` asks for a password and GitHub refuses it (macOS) | GitHub needs a token instead of the account password — see A2 step 4. |
| `npm` or `node` "not found" | Node.js isn't installed, or Claude Desktop wasn't restarted after installing it. |
| `Missing script: "setup"` / cannot find `scripts/setup.mjs` | The terminal isn't in the store's folder: `cd "<full path>"` first. |
| Live site says it can't reach / isn't connected to its database | A variable is missing, misspelled or has a wrong value in Hostinger: check the three names against `.env.local` (opened as in E), then **Redeploy**. |
| Hostinger build fails | Usually the Node.js version (try 22) or a changed build command — use the detected Next.js settings as in E and redeploy. |
| Live homepage shows a demo band | `PUBLIC_DEMO_MODE` was added on Hostinger: remove it and redeploy. |

## Later

- Code changes reach Hostinger through their GitHub copy: each push to **main** redeploys. Commit
  and push only when they ask, only to their own copy, and check `git status` never lists
  `.env.local`. Never push during setup.
- A Halden update that adds a database change: `npm run db:migrate` with their approval.
