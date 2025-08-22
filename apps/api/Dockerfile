# Package: @repo/api
# Path: apps/api/Dockerfile
# Multi-stage Docker build for Hono API service

# Stage 1: Base image with pnpm
FROM node:22-alpine AS base
RUN corepack enable
RUN corepack prepare pnpm@latest --activate
WORKDIR /app

# Stage 2: Dependencies installation
FROM base AS deps
# Copy workspace root files first for pnpm workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy all package.json files to preserve workspace structure
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# Stage 3: Build stage
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages ./packages

# Copy source files
COPY . .

# Generate Prisma client
WORKDIR /app/packages/database
RUN pnpm prisma generate

# Build the API application
WORKDIR /app
RUN pnpm turbo build --filter=@repo/api

# Stage 4: Production image
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono

WORKDIR /app

# Copy production dependencies and built application
COPY --from=builder --chown=hono:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=hono:nodejs /app/apps/api/package.json ./package.json

# Copy workspace dependencies
COPY --from=builder --chown=hono:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=hono:nodejs /app/packages/database ./packages/database
COPY --from=builder --chown=hono:nodejs /app/packages/shared ./packages/shared

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4000
ENV HOSTNAME=0.0.0.0

# Use non-root user
USER hono

# Expose API port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the application
CMD ["node", "dist/index.js"]