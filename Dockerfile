# syntax=docker/dockerfile:1.7

# QR Scanner Registry — production image
#
# Builds the Astro app with the @astrojs/node "standalone" adapter (the
# default adapter whenever VERCEL/DEPLOY_TARGET=vercel aren't set — see
# astro.config.mjs) and runs it as a plain Node HTTP server. No reverse proxy
# or TLS termination is included; put one in front if you expose this
# directly to the internet (the browser's camera API requires HTTPS, and the
# app itself only serves plain HTTP).
#
# Configuration is supplied entirely at `docker run` / `docker compose` time
# via environment variables — see .env.example for the full list, and the
# "Run with Docker" section in README.md for a quick start. No .env file or
# secret is ever present during the build (enforced by .dockerignore): the
# app's server-side config reads all fall back to a live `process.env` lookup
# specifically so the same image works across environments without rebuilding
# (see src/db/supabase.ts and src/pages/api/auth/google.ts).

ARG NODE_VERSION=22.18.0

# ---- deps: install once with devDependencies, so `npm run build` can run ---
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile the app, then strip devDependencies back out ----------
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build \
  && npm prune --omit=dev

# ---- runtime: minimal image with only the built output + prod deps --------
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Official node images already ship a non-root "node" user (uid/gid 1000).
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" || exit 1

CMD ["node", "dist/server/entry.mjs"]
