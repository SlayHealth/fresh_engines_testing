# syntax=docker/dockerfile:1

# SlayHealth frontend (Next.js 16 App Router). Multi-stage build producing the
# "standalone" output (.next/standalone/server.js) — a minimal, self-contained
# production server with only the traced runtime files, run as non-root.

# ---- deps: all deps (incl. dev) needed to build ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile the standalone production server ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the client bundle AT BUILD TIME (not read
# at container runtime). Point this at the backend's public URL
# (e.g. https://api.slay.health). Leave empty to have the browser call
# same-origin "/api/*" — use that when an edge/proxy (CloudFront, ALB, nginx)
# routes /api to the backend, which also keeps auth cookies first-party.
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime: minimal image, non-root ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# The standalone server binds localhost by default — bind all interfaces so the
# container is reachable, and honor the platform-injected PORT.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# .next/standalone bundles server.js + a minimal node_modules; static assets and
# public/ are copied alongside at the paths the server expects.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
