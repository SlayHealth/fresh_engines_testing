# syntax=docker/dockerfile:1

# SlayHealth backend (Express 5). Multi-stage: the deps stage carries a C/C++
# toolchain to compile the native addons (better-sqlite3, bcrypt) against this
# exact base image, then the runtime stage ships a lean image that runs
# `node src/server.js` directly — no PM2 (the platform/orchestrator supervises
# and restarts; one process per container).
#
# Base is debian-slim (glibc), NOT alpine (musl) — the native addons build far
# more reliably against glibc.

# ---- deps: production deps + compiled native addons ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: minimal image, non-root ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
# Native binaries were compiled against this same base in `deps`, so they run
# as-is here. node_modules is copied first; app source (with node_modules
# excluded via .dockerignore) is layered on top so this copy is authoritative.
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER node
EXPOSE 3001
# Uses the existing GET /health route; `fetch` is a Node 22 global.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
