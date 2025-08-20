# 🚀 Deployment Guide for planrrr.io

## Overview

This guide covers deploying the planrrr.io platform with:
- **Frontend**: Next.js on Vercel
- **API & Worker**: Hono + BullMQ on Railway
- **Database**: Neon PostgreSQL
- **Redis**: Upstash or Railway Redis

## Prerequisites

- [ ] Railway account and CLI installed
- [ ] Vercel account and CLI installed
- [ ] Neon database created
- [ ] Upstash Redis instance created (or Railway Redis)
- [ ] Git repository pushed to GitHub

## Step 1: Database Setup (Neon)

1. **Create Neon Project**:
   ```bash
   # Visit https://console.neon.tech
   # Create new project
   # Copy connection string
   ```

2. **Configure Connection Pooling**:
   - Enable connection pooling in Neon dashboard
   - Use pooled connection string for serverless

3. **Run Migrations**:
   ```bash
   # Set DATABASE_URL in .env
   pnpm db:generate
   pnpm db:push
   ```

## Step 2: Redis Setup (Upstash)

1. **Create Upstash Redis**:
   ```bash
   # Visit https://console.upstash.com
   # Create Redis database
   # Copy REST URL and token
   ```

2. **Alternative: Railway Redis**:
   ```bash
   railway add redis
   # Use internal URL: redis.railway.internal
   ```

## Step 3: Deploy API & Worker to Railway

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Initialize Railway Project**:
   ```bash
   railway init
   # Select "Empty Project"
   ```

3. **Configure Environment Variables**:
   ```bash
   # In Railway Dashboard or CLI
   railway variables set NODE_ENV=production
   railway variables set DATABASE_URL="your-neon-url"
   railway variables set UPSTASH_REDIS_REST_URL="your-upstash-url"
   railway variables set UPSTASH_REDIS_REST_TOKEN="your-token"
   railway variables set JWT_SECRET="generate-secure-secret"
   railway variables set INTERNAL_API_KEY="generate-api-key"
   railway variables set FRONTEND_URL="https://your-app.vercel.app"
   ```

4. **Deploy Services**:
   ```bash
   # Deploy both API and Worker
   railway up
   
   # Or deploy separately
   railway up --service api
   railway up --service worker
   ```

5. **Get Service URLs**:
   ```bash
   railway domain
   # Copy the API URL for frontend configuration
   ```

## Step 4: Deploy Frontend to Vercel

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   vercel login
   ```

2. **Configure Vercel Project**:
   ```bash
   cd apps/web
   vercel
   # Follow prompts
   # Set root directory to "apps/web"
   ```

3. **Set Environment Variables**:
   ```bash
   vercel env add NEXT_PUBLIC_API_URL
   # Enter your Railway API URL
   
   vercel env add DATABASE_URL
   # Enter your Neon connection string
   
   vercel env add BETTER_AUTH_SECRET
   # Generate secure secret
   ```

4. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

## Step 5: Configure Domain & SSL

### Railway (API)
```bash
# Add custom domain
railway domain add api.planrrr.io

# SSL is automatic with Railway
```

### Vercel (Frontend)
```bash
# Add custom domain
vercel domains add planrrr.io

# Configure DNS at your provider
# SSL is automatic with Vercel
```

## Step 6: Post-Deployment Checks

1. **Verify Health Endpoints**:
   ```bash
   curl https://api.planrrr.io/health
   # Should return: {"status":"healthy"}
   ```

2. **Check Logs**:
   ```bash
   # Railway logs
   railway logs --service api
   railway logs --service worker
   
   # Vercel logs
   vercel logs
   ```

3. **Monitor Performance**:
   - Railway: Check metrics dashboard
   - Vercel: Check Analytics dashboard
   - Upstash: Monitor Redis usage

## Environment Variables Reference

### API Service (.env)
```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
JWT_SECRET=...
INTERNAL_API_KEY=...
FRONTEND_URL=https://planrrr.io
SENTRY_DSN=... (optional)
```

### Worker Service (.env)
```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
INTERNAL_API_KEY=...
API_BASE_URL=http://api.railway.internal:4000
```

### Frontend (.env.production)
```env
NEXT_PUBLIC_API_URL=https://api.planrrr.io
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://planrrr.io
```

## Monitoring & Maintenance

### Health Monitoring
- Set up uptime monitoring (UptimeRobot, Pingdom)
- Configure alerts for failures
- Monitor response times

### Database Maintenance
```bash
# Backup database
pg_dump $DATABASE_URL > backup.sql

# Run migrations
pnpm db:migrate deploy
```

### Scaling
- **API**: Increase Railway replicas
- **Worker**: Adjust concurrency in worker config
- **Database**: Upgrade Neon tier
- **Redis**: Increase Upstash limits

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**:
   - Check Redis URL and credentials
   - For Railway: Use internal URL with `?family=0`
   - Enable `maxRetriesPerRequest: null` for workers

2. **Database Connection Issues**:
   - Verify connection string
   - Check SSL mode (`?sslmode=require`)
   - Ensure connection pooling is enabled

3. **CORS Errors**:
   - Verify FRONTEND_URL in API environment
   - Check allowed origins in API config

4. **Worker Not Processing Jobs**:
   - Check Redis connection
   - Verify worker is running: `railway logs --service worker`
   - Check for job errors in logs

### Debug Commands
```bash
# Check service status
railway status

# View recent deployments
railway deployments

# SSH into service (if enabled)
railway shell --service api

# Force redeploy
railway up --force
```

## Security Checklist

- [ ] All secrets are unique and secure
- [ ] Environment variables are set, not hardcoded
- [ ] HTTPS enabled on all endpoints
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Database connections use SSL
- [ ] API keys rotated regularly
- [ ] Monitoring and alerts configured

## Cost Optimization

### Railway
- Use sleep/wake for development environments
- Optimize Docker image size
- Monitor resource usage

### Vercel
- Optimize bundle size
- Use ISR for static content
- Monitor function invocations

### Database
- Use connection pooling
- Optimize queries with indexes
- Regular cleanup of old data

### Redis
- Set appropriate TTLs
- Monitor memory usage
- Use eviction policies wisely

## Next Steps

1. Set up monitoring (Sentry, LogRocket)
2. Configure CI/CD pipeline
3. Implement backup strategy
4. Set up staging environment
5. Configure auto-scaling rules

---

## Quick Deploy Script

```bash
#!/bin/bash
# deploy.sh - Quick deployment script

echo "🚀 Deploying planrrr.io..."

# Build
echo "📦 Building packages..."
pnpm build

# Deploy API/Worker to Railway
echo "🚂 Deploying to Railway..."
railway up

# Deploy Frontend to Vercel
echo "▲ Deploying to Vercel..."
cd apps/web && vercel --prod && cd ../..

echo "✅ Deployment complete!"
echo "API: $(railway domain --service api)"
echo "Frontend: https://planrrr.io"
```

Save this as `deploy.sh` and run with `bash deploy.sh` for quick deployments.

---

For support and updates, visit the [planrrr.io repository](https://github.com/yourusername/planrrr).