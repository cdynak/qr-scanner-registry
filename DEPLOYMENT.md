# Deploying to Vercel

This app is a **server-rendered** Astro application (it needs Node at runtime for
its API routes and middleware), so it cannot run on static hosts like GitHub
Pages. Vercel runs the server as a serverless function.

The adapter is selected automatically in `astro.config.mjs`:

- On Vercel (`VERCEL=1` is set automatically), it uses `@astrojs/vercel`.
- Locally (`npm run dev` / `npm run build`), it uses `@astrojs/node`.

You do not need to change anything to switch between the two.

---

## Prerequisites

- The GitHub repo is pushed (it is): `cdynak/qr-scanner-registry`.
- A live Supabase project with the `users` and `scans` tables (migrations
  `001`–`004` applied).
- A Google OAuth client (Google Cloud Console).

---

## Step 1 — Import the project into Vercel

1. Go to <https://vercel.com/new> and sign in with GitHub.
2. Select the `qr-scanner-registry` repository and click **Import**.
3. Framework preset: Vercel detects **Astro** automatically. Leave the build
   command (`astro build`) and output settings at their defaults.
4. Do **not** deploy yet — add the environment variables first (next step).

## Step 2 — Set environment variables

In the Vercel import screen (or later under **Project → Settings → Environment
Variables**), add the following for the **Production** (and **Preview**)
environments:

| Variable                    | Value                                                           |
| --------------------------- | --------------------------------------------------------------- |
| `SUPABASE_URL`              | Your Supabase project URL                                       |
| `SUPABASE_ANON_KEY`         | Supabase anon key                                               |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key                                       |
| `PUBLIC_SUPABASE_URL`       | Same as `SUPABASE_URL`                                          |
| `PUBLIC_SUPABASE_ANON_KEY`  | Same as `SUPABASE_ANON_KEY`                                     |
| `SUPABASE_JWT_SECRET`       | Supabase → Settings → API → JWT Settings (enables DB-level RLS) |
| `GOOGLE_CLIENT_ID`          | Google OAuth client ID                                          |
| `GOOGLE_CLIENT_SECRET`      | Google OAuth client secret                                      |
| `NEXTAUTH_SECRET`           | A random 32-byte secret (see below)                             |
| `CSRF_SECRET`               | A random secret for CSRF token signing                          |
| `NEXTAUTH_URL`              | `https://<your-app>.vercel.app` (the deployed URL)              |
| `SITE`                      | `https://<your-app>.vercel.app`                                 |
| `NODE_ENV`                  | `production`                                                    |

Leave `USE_MOCK_DB` unset (or `false`) in production so it uses the real
database.

Generate the secrets locally with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> Note: `NEXTAUTH_URL` and `SITE` depend on the final deployed domain. If you do
> not know it yet, deploy once, copy the assigned `*.vercel.app` URL, set these
> two variables, then redeploy.

## Step 3 — Deploy

Click **Deploy**. Vercel installs dependencies, runs `astro build` (which uses
the Vercel adapter because `VERCEL=1`), and serves the app. Every push to
`master` triggers an automatic production deploy; pull requests get preview
deploys.

## Step 4 — Configure Google OAuth for the production URL

In Google Cloud Console → APIs & Services → Credentials → your OAuth client:

- **Authorized redirect URIs**: add
  `https://<your-app>.vercel.app/api/auth/google`
- **Authorized JavaScript origins**: add `https://<your-app>.vercel.app`

Then make sure `NEXTAUTH_URL` matches this domain (the app builds the OAuth
redirect URI from it).

## Step 5 — Verify

1. Open `https://<your-app>.vercel.app/` — the page should load over HTTPS.
2. Visit `/status` — the database status should show **Connected**.
3. Log in with Google, scan a code, and confirm it appears under **History**.

---

## Security checklist before going public

- [ ] **Rotate credentials** that were used during development: the Google
      client secret and the Supabase keys. Update them in Vercel afterwards.
- [ ] Confirm `SUPABASE_JWT_SECRET` is set so Row Level Security is enforced at
      the database (otherwise the app falls back to the service-role client).
- [ ] `.env` is git-ignored and never committed (already the case).
- [ ] HTTPS is provided by Vercel automatically; HSTS can be added via
      `vercel.json` headers if desired.

## Optional: Vercel CLI (deploy from your machine)

```bash
npm i -g vercel
vercel login
vercel link            # link this folder to the Vercel project
vercel env pull        # (optional) pull env vars into .env.local
vercel --prod          # deploy to production
```

## Local development is unchanged

```bash
npm run dev            # https://localhost:3000 with the Node adapter
USE_MOCK_DB=true npm run dev   # fully offline, in-memory data
```

---

## Astro 7 upgrade

The app now runs Astro 7 with `@astrojs/node@11`, `@astrojs/vercel@11`,
`@astrojs/react@6`, `@astrojs/sitemap@latest`, Tailwind's `@tailwindcss/vite@4.3`,
`@vitejs/plugin-basic-ssl@2.3` and Vitest 4 (all on Vite 8). This cleared the
advisories that only had fixes in the Astro 7 line, including the
high-severity `@astrojs/vercel` "Unauthenticated Path Override via
`x-astro-path`" issue (GHSA-mr6q-rp88-fx84) that mattered here because the
middleware makes auth/CSRF decisions based on `url.pathname`.

`npm audit --omit=dev` now reports zero vulnerabilities. Two low-severity dev-only
advisories remain in `eslint`'s dependency tree (fixable only by bumping eslint
outside its currently pinned exact version); left alone since they do not affect
the shipped app and the audit job is non-blocking.

Notes from the migration, in case of a future major bump:

- **`USE_MOCK_DB` env coercion**: Astro's env handling changed how shell-provided
  (non-`.env`-file) values reach `import.meta.env` in server code — a plain
  `=== "true"` string check stopped matching. `src/db/supabase.ts` now also
  falls back to `process.env.USE_MOCK_DB` and accepts a real boolean or the
  string `"true"`.
- **`astro dev` background daemon**: Astro 7 auto-detects AI-agent environments
  and detaches `astro dev` into a background process, which broke Playwright's
  `webServer` (it looked like the process exited immediately). Playwright's
  config now sets `ASTRO_DEV_BACKGROUND=1` to keep the dev server in the
  foreground; this has no effect in CI or a normal terminal.
- No changes were needed for the Rust compiler's stricter HTML parsing, the
  `compressHTML: 'jsx'` default, or removed features (`@astrojs/db` unused, no
  `src/fetch.ts`, no Markdown pages) — the existing `.astro` files and content
  already conformed.
