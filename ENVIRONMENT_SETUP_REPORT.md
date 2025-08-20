# 🔧 Environment Setup Report - planrrr.io

## Executive Summary

The planrrr.io platform requires configuration of **7 critical services** across **3 environment files** before development can begin. This report provides a complete guide for setting up the development environment, including service provisioning, secret generation, and verification procedures.

**Setup Time Estimate**: 30-45 minutes  
**Complexity Level**: Intermediate  
**Prerequisites**: Node.js 18+, pnpm 9.0.0

---

## 📊 Current Environment Status

### Service Requirements

| Service | Status | Provider | Cost | Priority |
|---------|--------|----------|------|----------|
| PostgreSQL Database | ❌ Not Configured | Neon | Free tier | **CRITICAL** |
| Redis Cache | ❌ Not Configured | Upstash | Free tier | **CRITICAL** |
| JWT Secrets | ❌ Not Generated | Local | Free | **CRITICAL** |
| OAuth Providers | ⏸️ Optional | Google/FB | Free | Medium |
| File Storage | ⏸️ Optional | S3/R2 | Pay-as-you-go | Low |
| Monitoring | ⏸️ Optional | Sentry | Free tier | Low |
| Email Service | ⏸️ Optional | Resend | Free tier | Low |

### Environment Files Status

| File | Location | Status | Required Variables | Optional Variables |
|------|----------|--------|-------------------|-------------------|
| API Environment | `apps/api/.env` | ❌ Not Created | 8 | 6 |
| Worker Environment | `apps/worker/.env` | ❌ Not Created | 4 | 3 |
| Frontend Environment | `apps/web/.env.local` | ❌ Not Created | 4 | 4 |

---

## 🚨 Critical Configuration Required

### Phase 1: Database Setup (10 minutes)

#### Option A: Neon PostgreSQL (Recommended)

1. **Create Account**
   - Navigate to: https://console.neon.tech
   - Sign up with GitHub or email
   - Verification: Email confirmed

2. **Create Database Project**
   ```
   Project Name: planrrr-production
   Region: US East (or closest to you)
   Postgres Version: 16
   ```

3. **Configure Connection Pooling**
   - Enable: "Connection Pooling"
   - Pool Mode: "Transaction"
   - Pool Size: 25

4. **Retrieve Connection String**
   ```
   Format: postgresql://[user]:[password]@[host]/[database]?sslmode=require
   Example: postgresql://alex:AbC123@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

5. **Important Settings**
   - ✅ Enable "Suspend compute after 5 minutes of inactivity"
   - ✅ Enable "Autoscaling"
   - ❌ Disable IP restrictions for development

#### Option B: Local PostgreSQL

```bash
# Docker installation
docker run -d \
  --name planrrr-postgres \
  -e POSTGRES_PASSWORD=localpassword \
  -e POSTGRES_DB=planrrr \
  -p 5432:5432 \
  postgres:16-alpine

# Connection string
DATABASE_URL=postgresql://postgres:localpassword@localhost:5432/planrrr
```

### Phase 2: Redis Setup (10 minutes)

#### Option A: Upstash Redis (Recommended for Production)

1. **Create Account**
   - Navigate to: https://console.upstash.com
   - Sign up with GitHub or email

2. **Create Redis Database**
   ```
   Name: planrrr-cache
   Type: Regional
   Region: US-East-1 (or closest)
   Eviction: Disabled (IMPORTANT for BullMQ)
   ```

3. **Retrieve Credentials**
   ```
   REST URL: https://us1-xxx-xxx.upstash.io
   REST Token: AcXXASQgODk0MGU0...
   ```

4. **Configuration Requirements**
   - ❗ Max Connections: 100
   - ❗ Max Request Size: 1MB
   - ❗ Max Daily Commands: 10,000 (free tier)

#### Option B: Local Redis

```bash
# Docker installation
docker run -d \
  --name planrrr-redis \
  -p 6379:6379 \
  redis:7-alpine

# No authentication required for local
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Phase 3: Secret Generation (5 minutes)

#### PowerShell Method (Windows)

```powershell
# Run each command separately and save the output

# JWT_SECRET (32 characters)
Write-Host "JWT_SECRET:" -ForegroundColor Green
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})

# JWT_REFRESH_SECRET (32 characters)
Write-Host "JWT_REFRESH_SECRET:" -ForegroundColor Green
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})

# INTERNAL_API_KEY (32 characters)
Write-Host "INTERNAL_API_KEY:" -ForegroundColor Green
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})

# BETTER_AUTH_SECRET (32 characters)
Write-Host "BETTER_AUTH_SECRET:" -ForegroundColor Green
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})

# ENCRYPTION_SECRET (32 characters)
Write-Host "ENCRYPTION_SECRET:" -ForegroundColor Green
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

#### Bash Method (Linux/Mac/WSL)

```bash
# Generate all secrets at once
echo "JWT_SECRET=$(openssl rand -base64 32 | tr -d '=' | tr -d '\n')"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32 | tr -d '=' | tr -d '\n')"
echo "INTERNAL_API_KEY=$(openssl rand -base64 32 | tr -d '=' | tr -d '\n')"
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32 | tr -d '=' | tr -d '\n')"
echo "ENCRYPTION_SECRET=$(openssl rand -base64 32 | tr -d '=' | tr -d '\n')"
```

#### Online Generator (Alternative)

Use: https://generate-secret.vercel.app/32

⚠️ **Security Note**: Generate different secrets for each variable. Never reuse secrets.

---

## 📝 Environment File Configuration

### File 1: API Service (`apps/api/.env`)

```env
# === REQUIRED CONFIGURATION ===

# Node Environment
NODE_ENV=development
PORT=4000
HOSTNAME=0.0.0.0

# Database (Neon) - REQUIRED
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]?sslmode=require

# Redis (Upstash) - REQUIRED
UPSTASH_REDIS_REST_URL=https://[region]-[id].upstash.io
UPSTASH_REDIS_REST_TOKEN=[your-token]

# Authentication - REQUIRED (use generated secrets)
JWT_SECRET=[32-char-secret-1]
JWT_REFRESH_SECRET=[32-char-secret-2]
ENCRYPTION_SECRET=[32-char-secret-3]

# Frontend URL - REQUIRED
FRONTEND_URL=http://localhost:3000

# Internal Communication - REQUIRED
INTERNAL_API_KEY=[32-char-secret-4]

# === OPTIONAL CONFIGURATION ===

# Social Media APIs (can add later)
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
TWITTER_API_KEY=
TWITTER_API_SECRET=
YOUTUBE_API_KEY=

# Storage (can add later)
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=

# Monitoring (recommended but optional)
SENTRY_DSN=
LOG_LEVEL=info

# API Version
API_VERSION=1.0.0
```

### File 2: Worker Service (`apps/worker/.env`)

```env
# === REQUIRED CONFIGURATION ===

# Node Environment
NODE_ENV=development

# Database (same as API) - REQUIRED
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]?sslmode=require

# Redis Connection - REQUIRED (choose one method)

# Method 1: Local Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Method 2: Upstash Redis (direct connection)
# REDIS_HOST=[region]-[id].upstash.io
# REDIS_PORT=6379
# REDIS_PASSWORD=[your-password]

# Internal Communication - REQUIRED
INTERNAL_API_KEY=[same-as-api-service]
API_BASE_URL=http://localhost:4000

# === OPTIONAL CONFIGURATION ===

# Health Check
ENABLE_HEALTH_CHECK=false
HEALTH_PORT=3001

# Monitoring
SENTRY_DSN=
LOG_LEVEL=info
```

### File 3: Frontend (`apps/web/.env.local`)

```env
# === REQUIRED CONFIGURATION ===

# Database (same as API) - REQUIRED
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]?sslmode=require

# Authentication - REQUIRED
BETTER_AUTH_SECRET=[32-char-secret-5]
BETTER_AUTH_URL=http://localhost:3000

# API Connection - REQUIRED
NEXT_PUBLIC_API_URL=http://localhost:4000

# === OPTIONAL CONFIGURATION ===

# OAuth Providers (can add later)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=

# Storage (can add later)
NEXT_PUBLIC_UPLOAD_URL=
```

---

## ✅ Verification Procedures

### Step 1: Database Initialization

```bash
# After configuring .env files
pnpm db:generate
pnpm db:push

# Expected output:
# ✅ Generated Prisma Client
# ✅ Database schema pushed successfully
# ✅ Tables created: User, Team, Post, Publication, Connection
```

### Step 2: Service Health Checks

```bash
# Start services
pnpm dev

# Check API health
curl http://localhost:4000/health

# Expected response:
{
  "success": true,
  "status": "healthy",
  "checks": {
    "server": "ok",
    "database": "ok",
    "redis": "ok"
  }
}
```

### Step 3: Connection Verification

| Service | Test Command | Expected Result |
|---------|--------------|-----------------|
| Database | `pnpm db:studio` | Prisma Studio opens |
| Redis | Check Upstash dashboard | Connection count > 0 |
| API | `curl localhost:4000/health` | HTTP 200 |
| Frontend | Open http://localhost:3000 | Page loads |

---

## 🚫 Common Configuration Errors

### Error 1: Database Connection Failed
```
Error: P1001: Can't reach database server
```
**Solution**: 
- Verify DATABASE_URL format
- Check if Neon project is active (not suspended)
- Ensure ?sslmode=require is included

### Error 2: Redis Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution**:
- Verify Redis is running (Docker or Upstash)
- Check REDIS_HOST and REDIS_PORT
- For Upstash, ensure REST URL and token are correct

### Error 3: Invalid JWT Secret
```
Error: JWT Secret must be at least 32 characters
```
**Solution**:
- Generate new 32+ character secret
- Ensure no spaces or special characters that need escaping

### Error 4: CORS Blocked
```
Error: CORS policy: No 'Access-Control-Allow-Origin'
```
**Solution**:
- Verify FRONTEND_URL in API .env matches actual frontend URL
- Ensure API is running on expected port

---

## 📊 Configuration Completeness Metrics

### Required Services Setup
- [ ] PostgreSQL Database configured
- [ ] Redis instance configured
- [ ] JWT secrets generated (5 unique secrets)
- [ ] Environment files created (3 files)
- [ ] Database schema pushed
- [ ] Health check passing

### Optional Services (Can defer)
- [ ] OAuth providers configured
- [ ] File storage configured
- [ ] Email service configured
- [ ] Monitoring configured

**Minimum Viable Configuration**: 6/6 required items ✅

---

## 🔒 Security Checklist

### Critical Security Requirements
- ✅ All secrets are 32+ characters
- ✅ Each secret is unique (no reuse)
- ✅ .env files are in .gitignore
- ✅ Database uses SSL connection
- ✅ Internal API key is configured
- ✅ No secrets in code or logs

### Security Best Practices
- 🔄 Rotate secrets every 90 days
- 🔐 Use different secrets for production
- 📝 Document secret rotation procedure
- 🚫 Never commit .env files
- 🔍 Audit environment variables regularly

---

## 💰 Cost Analysis

### Development Environment (Current)
| Service | Provider | Tier | Monthly Cost |
|---------|----------|------|--------------|
| Database | Neon | Free | $0 |
| Redis | Upstash | Free | $0 |
| Hosting | Local | N/A | $0 |
| **Total** | | | **$0/month** |

### Production Environment (Projected)
| Service | Provider | Tier | Monthly Cost |
|---------|----------|------|--------------|
| Database | Neon | Pro | $25 |
| Redis | Upstash | Pay-as-you-go | $10 |
| API/Worker | Railway | Usage-based | $20-50 |
| Frontend | Vercel | Pro | $20 |
| **Total** | | | **$75-105/month** |

---

## 🎯 Next Steps After Configuration

1. **Immediate Actions**
   ```bash
   # Verify configuration
   pnpm build
   pnpm dev
   
   # Check health
   curl http://localhost:4000/health
   ```

2. **Development Priorities**
   - Implement authentication endpoints
   - Create first API routes
   - Connect frontend to API
   - Test database operations

3. **Testing Requirements**
   - Create test user in database
   - Verify JWT token generation
   - Test rate limiting
   - Confirm Redis job processing

---

## 📋 Final Checklist

### Before Starting Development
- [ ] All 3 .env files created and configured
- [ ] Database connection string added
- [ ] Redis credentials configured
- [ ] 5 unique secrets generated and added
- [ ] `pnpm db:push` executed successfully
- [ ] Health endpoint returns "healthy"
- [ ] No error messages in console
- [ ] Frontend loads at localhost:3000
- [ ] API responds at localhost:4000

### Ready for Development When
- ✅ All services show "ok" in health check
- ✅ Database tables created (verify with Prisma Studio)
- ✅ Redis accepting connections
- ✅ No TypeScript errors on build
- ✅ Both frontend and API start without errors

---

## 📞 Support Resources

### Documentation
- [Neon PostgreSQL Docs](https://neon.tech/docs)
- [Upstash Redis Docs](https://docs.upstash.com)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Prisma Connection URLs](https://www.prisma.io/docs/reference/database-reference/connection-urls)

### Troubleshooting
- Database Issues: Check Neon dashboard for connection logs
- Redis Issues: Check Upstash metrics dashboard
- Environment Issues: Run `pnpm build` to see detailed errors
- Port Conflicts: Ensure 3000 and 4000 are available

---

## ⏱️ Time Estimates

| Task | Time | Complexity |
|------|------|------------|
| Create Neon account & database | 5 min | Easy |
| Create Upstash account & Redis | 5 min | Easy |
| Generate secrets | 2 min | Easy |
| Configure .env files | 10 min | Medium |
| Push database schema | 3 min | Easy |
| Verify connections | 5 min | Easy |
| **Total Setup Time** | **30 min** | **Medium** |

---

## 🏁 Conclusion

Environment configuration is the **critical foundation** for planrrr.io development. Without proper configuration of the database, Redis, and authentication secrets, the application cannot function. This report provides all necessary steps to achieve a fully configured development environment.

**Success Indicator**: When `curl http://localhost:4000/health` returns all services as "ok", your environment is properly configured and ready for feature development.

**Next Recommended Action**: After configuration, immediately implement the authentication system as it blocks all other features.