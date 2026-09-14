# QR Scanner Registry

[![CI](https://github.com/cdynak/qr-scanner-registry/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/cdynak/qr-scanner-registry/actions/workflows/ci.yml)
[![Main Branch CI/CD](https://github.com/cdynak/qr-scanner-registry/actions/workflows/main.yml/badge.svg?branch=master)](https://github.com/cdynak/qr-scanner-registry/actions/workflows/main.yml)

Scan QR codes and barcodes with your device camera, and keep the results in a personal, Google-authenticated scan history.

**Live app:** <https://qr-scanner-registry.vercel.app/>

## Features

- **Google sign-in** – OAuth 2.0 login; sessions are kept in an HttpOnly cookie.
- **Camera scanning** – live camera feed with automatic QR / barcode detection, camera-permission handling, and retry on failure.
- **Scan registry** – every scan is saved to Supabase with its content, format, type and timestamp; scans are private per user (Row Level Security).
- **History** – paginated list of previous scans with delete (with confirmation).
- **Offline/mock mode** – run the whole app with an in-memory store and no external services.

## Tech Stack

- [Astro](https://astro.build/) 5 (server-rendered) with [React](https://react.dev/) 19 islands
- [TypeScript](https://www.typescriptlang.org/) 5
- [Tailwind CSS](https://tailwindcss.com/) 4 with shadcn/ui-style components
- [Supabase](https://supabase.com/) (Postgres + RLS) for storage, Google OAuth for identity
- [react-qr-barcode-scanner](https://github.com/jamenamcinteer/react-qr-barcode-scanner) for camera decoding
- [Vitest](https://vitest.dev/) + Testing Library for unit/integration tests, [Playwright](https://playwright.dev/) for E2E
- GitHub Actions for CI, [Vercel](https://vercel.com/) for hosting

## Prerequisites

- Node.js 22.18.0 (see `.nvmrc`; `nvm use` picks it up)
- npm

## Getting Started

```bash
git clone https://github.com/cdynak/qr-scanner-registry.git
cd qr-scanner-registry
npm install
cp .env.example .env   # fill in Supabase + Google OAuth values, or enable mock mode (below)
npm run dev            # https://localhost:3000 (self-signed certificate)
```

The dev server runs over HTTPS because browsers only expose the camera on secure origins.

### Local / offline mode

The app can run without a Supabase project or Google OAuth. Set this in `.env`:

```bash
USE_MOCK_DB=true
```

With mock mode enabled:

- Login skips Google and signs in a deterministic "Local Dev User".
- Users and scans live in an in-memory database (reset when the dev server restarts).
- No external network calls are made for auth or data.

Leave `USE_MOCK_DB` unset or `false` to use the real Supabase project configured via `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`. See `src/db/README.md` for the schema and migrations, and [DEPLOYMENT.md](DEPLOYMENT.md) for deploying to Vercel.

## Available Scripts

| Script                       | Description                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| `npm run dev`                | Start the development server                                  |
| `npm run build`              | Build for production                                          |
| `npm run preview`            | Preview the production build                                  |
| `npm run lint`               | Run ESLint (`lint:fix` to auto-fix)                           |
| `npm run format`             | Format the repo with Prettier (`format:check` to verify only) |
| `npm test`                   | Run unit tests once (`test:watch`, `test:ui` also available)  |
| `npm run test:coverage`      | Unit tests with coverage (80% thresholds enforced)            |
| `npm run e2e`                | Run Playwright E2E tests (starts the app in mock mode)        |
| `npm run e2e:smoke`          | Unauthenticated smoke tests only                              |
| `npm run e2e:infrastructure` | Playwright harness self-checks (no server)                    |
| `npm run e2e:ui`             | Playwright UI mode                                            |
| `npm run e2e:report`         | Open the last Playwright HTML report                          |
| `npm run db:migrate`         | Apply the SQL migrations in `src/db/migrations`               |

## Testing

- **Unit / integration** (`src/test/`) – components, utilities, middleware and every API route, with Supabase and Google OAuth mocked. Coverage thresholds (80% lines/branches/functions/statements) are enforced by `npm run test:coverage`.
- **End-to-end** (`e2e/`) – Playwright runs against the dev server in mock mode on Desktop Chrome, Desktop Firefox and Mobile Chrome. See `e2e/README.md` for the scope.

## CI/CD

GitHub Actions workflows live in `.github/workflows/`:

- **CI** (`ci.yml`) – on every push and pull request to `master`: lint + format check, unit tests with coverage on Node 22.18.0 and 22.x, production build, Playwright E2E, and a non-blocking `npm audit`.
- **Pull Request Checks** (`pr-checks.yml`) – merge-conflict detection, coverage-threshold gate, build, smoke E2E, and an automated PR comment with the results.
- **Main Branch CI/CD** (`main.yml`) – full suite on every push to `master`, with test artifacts retained for 30 days.
- **Nightly** (`nightly.yml`) – scheduled matrix over Node 20/22 and Chromium/Firefox, plus Lighthouse and security scanning.

Deployments to Vercel happen automatically on every push to `master` (see [DEPLOYMENT.md](DEPLOYMENT.md)).

## Project Structure

```text
.
├── .kiro/
│   ├── specs/qr-scanner-registry/  # requirements.md, design.md, tasks.md
│   └── steering/                   # coding guidelines used by the AI agent
├── .github/workflows/              # CI/CD pipelines
├── e2e/                            # Playwright tests
├── src/
│   ├── components/                 # React + Astro UI components
│   ├── db/                         # Supabase client, mock store, migrations
│   ├── layouts/                    # Astro layouts
│   ├── lib/                        # auth, CSRF, validation, error utilities
│   ├── middleware/                 # session + security middleware
│   ├── pages/                      # Astro pages and /api routes
│   └── test/                       # Vitest suites
└── public/                         # Static assets
```

## Development Workflow

The project was built spec-first with an AI coding agent (Kiro):

1. `.kiro/specs/qr-scanner-registry/requirements.md` – user stories with acceptance criteria.
2. `.kiro/specs/qr-scanner-registry/design.md` – architecture, data model, API and testing strategy.
3. `.kiro/specs/qr-scanner-registry/tasks.md` – the implementation plan, executed task by task (each `feat(kiro): N.` commit maps to a task).

`.kiro/steering/` holds the coding guidelines the agent follows (Astro, React, Supabase, shadcn/ui, testing). The same rules are mirrored for Cursor (`.cursor/rules/`), GitHub Copilot (`.github/copilot-instructions.md`) and Windsurf (`.windsurfrules`).

## License

MIT
