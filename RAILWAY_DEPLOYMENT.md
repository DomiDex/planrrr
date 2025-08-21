# Railway Deployment Guide for planrrr.io

## Prerequisites
- Railway account ([railway.app](https://railway.app))
- Railway CLI installed (optional but recommended)
- GitHub repository connected

## Step 1: Create Railway Project

### Option A: Using Railway Dashboard (Recommended)
1. Go to [railway.app/new](https://railway.app/new)
2. Click "Deploy from GitHub repo"
3. Select your `planrrr` repository
4. Railway will create a new project

### Option B: Using Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize new project
railway init
```

## Step 2: Create Services

In your Railway project, you need TWO services:

### Service 1: API Service
1. Click "New Service" → "GitHub Repo"
2. Select your repository
3. Set **Root Directory**: `/apps/api`
4. Set **Start Command**: `pnpm start`

### Service 2: Worker Service  
1. Click "New Service" → "GitHub Repo"
2. Select your repository again
3. Set **Root Directory**: `/apps/worker`
4. Set **Start Command**: `pnpm start`

## Step 3: Configure Environment Variables

### For API Service

Click on the API service and add these variables:

```bash
# Core Configuration
NODE_ENV=production
PORT=4000
HOSTNAME=0.0.0.0
API_VERSION=1.0.0

# Database (Same as your Vercel app)
DATABASE_URL=postgresql://neondb_owner:npg_nCpM3fIP0KyQ@ep-jolly-sound-adq5r9d0-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require

# Authentication & Security
JWT_SECRET=<generate with: openssl rand -base64 32>
JWT_REFRESH_SECRET=<generate with: openssl rand -base64 32>
ENCRYPTION_SECRET=el1lLHBPRlswMjpiMFJceFlnSC0qPFxHIV5v
INTERNAL_API_KEY=<generate with: openssl rand -base64 32>

# CORS Configuration
FRONTEND_URL=https://planrrr.vercel.app

# Optional - Leave empty for now
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=planrrr-media
R2_PUBLIC_URL=
SENTRY_DSN=

# Features
RATE_LIMIT_ENABLED=false
DEBUG_MODE=false
ALLOW_HTTP=false
```

### For Worker Service

Click on the Worker service and add:

```bash
# Core Configuration
NODE_ENV=production

# Database (Same as API)
DATABASE_URL=postgresql://neondb_owner:npg_nCpM3fIP0KyQ@ep-jolly-sound-adq5r9d0-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require

# Internal Communication
INTERNAL_API_KEY=<same as API service>
API_URL=https://<your-api-service>.railway.app

# Optional - Leave empty for now
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Step 4: Set Build Configuration

### For both services, in Settings:

**Build Command:**
```bash
pnpm install --frozen-lockfile && pnpm db:generate && pnpm build
```

**Watch Paths** (to prevent unnecessary rebuilds):
```
/apps/api/**
/packages/**
/package.json
/pnpm-lock.yaml
```

For Worker, use:
```
/apps/worker/**
/packages/**
/package.json
/pnpm-lock.yaml
```

## Step 5: Deploy

### Automatic Deployment
Once configured, Railway will automatically deploy when you push to GitHub.

### Manual Deployment
```bash
# Using Railway CLI
railway up

# Or trigger from dashboard
# Click "Deploy" button in Railway dashboard
```

## Step 6: Get Service URLs

After deployment:
1. Go to your API service
2. Click "Settings" → "Networking"
3. Click "Generate Domain"
4. You'll get: `https://planrrr-api.railway.app`

Save this URL - you'll need it for:
- Worker service `API_URL` env variable
- Vercel app API endpoint configuration

## Step 7: Update Vercel Environment

Add to your Vercel environment variables:
```bash
NEXT_PUBLIC_API_URL=https://your-api-service.railway.app
```

## Deployment Checklist

- [ ] Railway project created
- [ ] API service created with correct root directory
- [ ] Worker service created with correct root directory  
- [ ] Environment variables added to API service
- [ ] Environment variables added to Worker service
- [ ] Generated domain for API service
- [ ] Updated Vercel with API URL
- [ ] Verified deployments are successful

## Troubleshooting

### Build Failures
- Check build logs in Railway dashboard
- Ensure `pnpm-lock.yaml` is committed
- Verify DATABASE_URL is correct

### Connection Issues
- Ensure CORS is configured correctly
- Check that API_URL in Worker matches API service domain
- Verify INTERNAL_API_KEY matches between services

### Database Issues
- Ensure DATABASE_URL includes `?sslmode=require`
- Run `pnpm db:push` locally first to ensure schema is synced

## Monitoring

Railway provides:
- Logs: Click service → "Logs" tab
- Metrics: Click service → "Metrics" tab
- Deployments: Click service → "Deployments" tab

## Costs

Railway pricing:
- $5/month subscription (includes $5 credits)
- API service: ~$5-10/month
- Worker service: ~$5-10/month
- Total: ~$15-25/month for both services

## Next Steps

1. Set up Upstash Redis for job queue
2. Configure R2 for media storage
3. Add monitoring with Sentry
4. Set up custom domains