# Multi-stage Dockerfile for API and Worker services
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY . .

# Generate Prisma client
RUN pnpm db:generate

# Build applications
RUN pnpm build --filter=@repo/api --filter=@repo/worker

# Runner stage for API
FROM base AS api-runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built API application
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/node_modules ./apps/api/node_modules

# Copy shared packages
COPY --from=builder --chown=nodejs:nodejs /app/packages/database ./packages/database
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy package files
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./

USER nodejs
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/api/dist/index.js"]

# Runner stage for Worker  
FROM base AS worker-runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built Worker application
COPY --from=builder --chown=nodejs:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/worker/package.json ./apps/worker/
COPY --from=builder --chown=nodejs:nodejs /app/apps/worker/node_modules ./apps/worker/node_modules

# Copy shared packages
COPY --from=builder --chown=nodejs:nodejs /app/packages/database ./packages/database
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy package files
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./

USER nodejs

CMD ["node", "apps/worker/dist/index.js"]