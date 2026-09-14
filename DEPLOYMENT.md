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

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
| `PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `PUBLIC_SUPABASE_ANON_KEY` | Same as `SUPABASE_ANON_KEY` |
| `SUPABASE_JWT_SECRET` | Supabase → Settings → API → JWT Settings (enables DB-level RLS) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_SECRET` | A random 32-byte secret (see below) |
| `CSRF_SECRET` | A random secret for CSRF token signing |
| `NEXTAUTH_URL` | `https://<your-app>.vercel.app` (the deployed URL) |
| `SITE` | `https://<your-app>.vercel.app` |
| `NODE_ENV` | `production` |

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

## Recommended follow-up: upgrade to Astro 7

The app currently runs Astro 5.18.2 (which patched the worst confirmed CVEs).
`npm audit` still flags a few advisories whose fixes only exist in the Astro 7
line, including a **high-severity `@astrojs/vercel` issue** — "Unauthenticated
Path Override via `x-astro-path`" (GHSA-mr6q-rp88-fx84). That one is relevant
here because the middleware makes auth/CSRF decisions based on `url.pathname`,
so it is worth prioritizing.

This upgrade was intentionally **not** done as part of routine maintenance
because it is a **major, non-low-risk migration** (two majors: 5 → 6 → 7):

- **Vite 8** (Astro 7 bundler): requires Vite-8-compatible versions of the Vite
  plugins used here (`@tailwindcss/vite`, `@vitejs/plugin-basic-ssl`).
- **New Rust compiler**: stricter about invalid/unclosed HTML. The hand-written
  `.astro` pages (`index`, `history`, `scanner`, `404`, `error`) must build
  cleanly under it.
- **`compressHTML: 'jsx'`** default: whitespace between inline elements can
  change; needs a visual check.
- Adapters must move to majors: `@astrojs/node@11`, `@astrojs/vercel@11`,
  plus `@astrojs/react@latest`, `@astrojs/sitemap@latest`.
- Node ≥ 22.12.0 required (already satisfied locally and on Vercel).

Not affected: `@astrojs/db` (removed in v7) is unused; there are no Astro-rendered
`.md`/`.mdx` pages; there is no `src/fetch.ts` (a newly reserved filename).

### Suggested upgrade procedure (do on a branch)

```bash
git checkout -b chore/astro-7
npx @astrojs/upgrade            # upgrades astro + official integrations together
npm run build                   # fix any Rust-compiler HTML errors it reports
npm run test                    # keep the unit/integration suite green
npm run e2e:smoke               # verify unauthenticated pages still render
```

Then deploy the branch as a Vercel preview and re-run `npm audit --omit=dev` to
confirm the advisories are cleared before merging.
