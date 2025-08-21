# Railway Deployment Report for planrrr.io

## 📊 Executive Summary

This report provides a comprehensive deployment strategy for planrrr.io on Railway, covering both the web application and worker service deployment, along with required infrastructure setup.

## 🏗️ Architecture Overview

### Services to Deploy
1. **Web Application** (Next.js) - apps/web
2. **Worker Service** (Node.js) - apps/worker
3. **PostgreSQL Database** (Neon - external)
4. **Redis** (Railway)

### Deployment Strategy
- **Monorepo Support**: Railway supports monorepo deployments with root directory configuration
- **Build System**: Turborepo for optimized builds
- **Environment**: Production with staging option

## 📋 Pre-Deployment Checklist

### ✅ Code Readiness
- [ ] All environment variables documented
- [ ] Production build tested locally
- [ ] Database migrations ready
- [ ] Worker queues configured
- [ ] Error handling implemented
- [ ] Security measures in place

### ✅ External Services
- [ ] Neon PostgreSQL database provisioned
- [ ] Social media API credentials obtained
- [ ] Email service configured (SendGrid/Resend)
- [ ] Storage service setup (R2/S3)
- [ ] OAuth providers configured

## 🚀 Step-by-Step Deployment Guide

### Phase 1: Initial Setup

#### 1.1 Create Railway Account
```
1. Go to https://railway.app
2. Sign up with GitHub
3. Verify email
4. Optional: Upgrade to Team plan for production use
```

#### 1.2 Install Railway CLI
```bash
# macOS/Linux
curl -fsSL https://railway.app/install.sh | sh

# Windows (PowerShell)
iwr -useb https://railway.app/install.ps1 | iex

# Verify installation
railway --version
```

#### 1.3 Authenticate CLI
```bash
railway login
# Opens browser for authentication
```

### Phase 2: Database Setup

#### 2.1 Neon PostgreSQL (External)
```bash
# Already configured in NEON_DATABASE_SETUP.md
# Connection string format:
postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

#### 2.2 Railway Redis
```bash
# Create Redis service in Railway
railway add redis

# Get Redis URL
railway variables -s redis
# REDIS_URL=redis://default:password@host:port
```

### Phase 3: Web Application Deployment

#### 3.1 Create Web Service
```bash
# Navigate to project root
cd /path/to/planrrr

# Create new Railway project
railway init

# Link to existing project (if applicable)
railway link [project-id]

# Create web service
railway add
# Select: Empty Service
# Name: planrrr-web
```

#### 3.2 Configure Web Service

**railway.json** (for web service):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install --frozen-lockfile && pnpm build --filter=@repo/web",
    "watchPatterns": [
      "apps/web/**",
      "packages/**"
    ]
  },
  "deploy": {
    "startCommand": "pnpm --filter @repo/web start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30
  },
  "environments": {
    "production": {
      "rootDirectory": ".",
      "port": 3000
    }
  }
}
```

#### 3.3 Set Environment Variables

```bash
# Set production environment variables
railway variables set \
  NODE_ENV=production \
  DATABASE_URL="postgresql://..." \
  BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  BETTER_AUTH_URL="https://planrrr.up.railway.app" \
  NEXT_PUBLIC_APP_URL="https://planrrr.up.railway.app" \
  REDIS_URL="redis://..." \
  R2_ACCOUNT_ID="..." \
  R2_ACCESS_KEY_ID="..." \
  R2_SECRET_ACCESS_KEY="..." \
  R2_BUCKET_NAME="planrrr-production" \
  GOOGLE_CLIENT_ID="..." \
  GOOGLE_CLIENT_SECRET="..." \
  FACEBOOK_APP_ID="..." \
  FACEBOOK_APP_SECRET="..."
```

#### 3.4 Deploy Web Service

```bash
# Manual deployment
railway up

# Or connect to GitHub for auto-deployment
railway github:repo
# Select repository: your-org/planrrr
# Select branch: main
# Enable auto-deploy
```

### Phase 4: Worker Service Deployment

#### 4.1 Create Worker Service

```bash
# Create another service in same project
railway add
# Select: Empty Service  
# Name: planrrr-worker
```

#### 4.2 Configure Worker Service

Create `apps/worker/railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install --frozen-lockfile && pnpm build --filter=@repo/worker",
    "watchPatterns": [
      "apps/worker/**",
      "packages/**"
    ]
  },
  "deploy": {
    "startCommand": "pnpm --filter @repo/worker start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5,
    "numReplicas": 1
  },
  "environments": {
    "production": {
      "rootDirectory": "apps/worker"
    }
  }
}
```

#### 4.3 Set Worker Environment Variables

```bash
railway variables set -s planrrr-worker \
  NODE_ENV=production \
  DATABASE_URL="postgresql://..." \
  REDIS_HOST="..." \
  REDIS_PORT="6379" \
  REDIS_PASSWORD="..." \
  META_APP_ID="..." \
  META_APP_SECRET="..." \
  X_API_KEY="..." \
  X_API_SECRET="..." \
  X_BEARER_TOKEN="..." \
  YOUTUBE_API_KEY="..."
```

#### 4.4 Deploy Worker Service

```bash
# Deploy worker
railway up -s planrrr-worker
```

### Phase 5: Domain & SSL Configuration

#### 5.1 Custom Domain Setup

```bash
# Generate domain
railway domain

# Or add custom domain
railway domain add planrrr.io
# Add CNAME record: planrrr.io -> [generated-domain].up.railway.app

# For apex domain
# Add A record: @ -> Railway's IP
# Add AAAA record: @ -> Railway's IPv6
```

#### 5.2 SSL Configuration
- Railway provides automatic SSL certificates via Let's Encrypt
- No additional configuration needed

### Phase 6: Post-Deployment Tasks

#### 6.1 Database Migrations

```bash
# Run migrations
railway run -s planrrr-web pnpm db:push

# Verify database
railway run -s planrrr-web pnpm db:studio
```

#### 6.2 Health Checks

```bash
# Check web service
curl https://planrrr.up.railway.app/api/health

# Check worker metrics
railway logs -s planrrr-worker
```

#### 6.3 Setup Monitoring

```bash
# Add monitoring variables
railway variables set \
  SENTRY_DSN="..." \
  POSTHOG_API_KEY="..." \
  NEW_RELIC_LICENSE_KEY="..."
```

## 📊 Deployment Configuration Files

### Root railway.toml (Alternative to JSON)
```toml
[build]
builder = "nixpacks"
buildCommand = "pnpm install --frozen-lockfile && pnpm build"

[deploy]
startCommand = "pnpm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 30
restartPolicyType = "on-failure"
restartPolicyMaxRetries = 3

[[services]]
name = "web"
rootDirectory = "."
startCommand = "pnpm --filter @repo/web start"
port = 3000

[[services]]
name = "worker"
rootDirectory = "."
startCommand = "pnpm --filter @repo/worker start"
```

### Nixpacks Configuration (nixpacks.toml)
```toml
[phases.setup]
nixPkgs = ["nodejs-18_x", "pnpm-9"]

[phases.install]
cmds = ["pnpm install --frozen-lockfile"]

[phases.build]
cmds = ["pnpm build"]

[start]
cmd = "pnpm start"
```

## 🔧 Troubleshooting Guide

### Common Issues & Solutions

#### Build Failures
```bash
# Check build logs
railway logs -s planrrr-web --build

# Common fixes:
# 1. Ensure all dependencies in package.json
# 2. Check Node version compatibility
# 3. Verify environment variables
# 4. Check turbo.json configuration
```

#### Database Connection Issues
```bash
# Verify connection
railway run -s planrrr-web node -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  prisma.\$connect().then(() => console.log('Connected')).catch(console.error);
"

# Check DATABASE_URL format
# Must include ?sslmode=require for production
```

#### Worker Not Processing Jobs
```bash
# Check Redis connection
railway run -s planrrr-worker node -e "
  const Redis = require('ioredis');
  const redis = new Redis(process.env.REDIS_URL);
  redis.ping().then(console.log).catch(console.error);
"

# Check worker logs
railway logs -s planrrr-worker -n 100
```

#### Memory Issues
```bash
# Increase memory limits in railway.json
{
  "deploy": {
    "memoryLimit": "2Gi"
  }
}
```

## 📈 Performance Optimization

### Build Optimization
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install --frozen-lockfile --prefer-offline",
    "cacheDirectories": [
      "node_modules",
      ".next/cache",
      ".turbo"
    ]
  }
}
```

### Runtime Optimization
- Enable Node.js cluster mode for web service
- Implement horizontal scaling for worker service
- Use Railway's edge network for CDN

### Scaling Configuration
```bash
# Scale web service
railway scale -s planrrr-web --replicas 3

# Scale worker service
railway scale -s planrrr-worker --replicas 2

# Auto-scaling (Team plan)
railway autoscale -s planrrr-web \
  --min 1 \
  --max 10 \
  --target-cpu 70
```

## 💰 Cost Estimation

### Railway Pricing (as of 2024)

| Service | Specification | Monthly Cost |
|---------|--------------|--------------|
| Web App | 1GB RAM, 1 vCPU | ~$5-10 |
| Worker | 1GB RAM, 1 vCPU | ~$5-10 |
| Redis | 512MB | ~$5 |
| **Total** | | **~$15-25/month** |

### External Services
- Neon DB: $19/month (Pro plan)
- R2 Storage: $0.015/GB/month
- Email Service: Variable

## 🔐 Security Checklist

- [ ] All secrets in environment variables
- [ ] Database SSL enabled
- [ ] HTTPS enforced
- [ ] Rate limiting configured
- [ ] CORS properly set
- [ ] Input validation active
- [ ] XSS protection enabled
- [ ] SQL injection prevention
- [ ] Authentication required
- [ ] Audit logging enabled

## 📝 Deployment Scripts

### Quick Deploy Script (deploy.sh)
```bash
#!/bin/bash

# Deploy script for Railway
set -e

echo "🚀 Deploying planrrr.io to Railway..."

# Run tests
echo "Running tests..."
pnpm test

# Build locally to verify
echo "Building application..."
pnpm build

# Deploy web service
echo "Deploying web service..."
railway up -s planrrr-web

# Deploy worker service
echo "Deploying worker service..."
railway up -s planrrr-worker

# Run migrations
echo "Running database migrations..."
railway run -s planrrr-web pnpm db:push

# Health check
echo "Checking deployment health..."
curl -f https://planrrr.up.railway.app/api/health || exit 1

echo "✅ Deployment complete!"
```

### Rollback Script
```bash
#!/bin/bash

# Rollback to previous deployment
railway rollback -s planrrr-web
railway rollback -s planrrr-worker
```

## 🎯 Next Steps

1. **Immediate Actions**
   - Start Docker Desktop
   - Test local Docker setup
   - Verify all environment variables
   - Create Railway account

2. **Deployment Sequence**
   - Deploy Redis on Railway
   - Deploy web application
   - Deploy worker service
   - Configure custom domain
   - Setup monitoring

3. **Post-Launch**
   - Monitor performance metrics
   - Setup alerting
   - Configure backups
   - Document runbooks

## 📚 Resources

- [Railway Documentation](https://docs.railway.app)
- [Railway CLI Reference](https://docs.railway.app/reference/cli-api)
- [Nixpacks Documentation](https://nixpacks.com/docs)
- [Railway Templates](https://railway.app/templates)
- [Railway Discord](https://discord.gg/railway)

## ✅ Deployment Validation

After deployment, verify:

- [ ] Web app accessible at production URL
- [ ] Authentication working
- [ ] Database queries executing
- [ ] Redis caching functional
- [ ] Worker processing jobs
- [ ] Email sending working
- [ ] File uploads successful
- [ ] Social media APIs connected
- [ ] Monitoring active
- [ ] Logs accessible

## 🚨 Emergency Contacts

- Railway Support: support@railway.app
- Railway Status: https://status.railway.app
- Team Escalation: [Your team contacts]

---

**Report Generated**: 2025-08-21
**Project**: planrrr.io
**Deployment Target**: Railway (Production)
**Estimated Deployment Time**: 30-45 minutes
**Monthly Cost Estimate**: $15-25 (Railway) + External Services