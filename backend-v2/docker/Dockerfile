# =============================================================================
# Hodl.fun V2 Backend - Multi-Stage Dockerfile
# =============================================================================

# ---------------------------------------------------------------------------
# STAGE 1: Base
# ---------------------------------------------------------------------------
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8 --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# STAGE 2: Dependencies
# ---------------------------------------------------------------------------
FROM base AS dependencies
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/websocket/package.json ./apps/websocket/
COPY apps/indexer/package.json ./apps/indexer/
COPY apps/worker/package.json ./apps/worker/
COPY libs/common/package.json ./libs/common/
COPY libs/database/package.json ./libs/database/
COPY libs/redis/package.json ./libs/redis/
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# STAGE 3: Build
# ---------------------------------------------------------------------------
FROM dependencies AS build
COPY . .
RUN pnpm run prisma:generate
RUN pnpm run build
RUN pnpm prune --prod

# ---------------------------------------------------------------------------
# STAGE 4: Production (API)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS api
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/libs ./libs
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma

USER nestjs
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------------------
# STAGE 5: Production (WebSocket)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS websocket
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/apps/websocket/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/libs ./libs
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma

USER nestjs
EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------------------
# STAGE 6: Production (Indexer)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS indexer
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/apps/indexer/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/libs ./libs
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma

USER nestjs
EXPOSE 3002
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------------------
# STAGE 7: Production (Worker)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS worker
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/apps/worker/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/libs ./libs
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma

USER nestjs
EXPOSE 3003
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
