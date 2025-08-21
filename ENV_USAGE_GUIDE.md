# 📚 Environment Management System - Complete Usage Guide

## 🚀 Quick Start

### 1. Initial Setup
```bash
# Install dependencies
pnpm install

# Generate secure secrets (view only)
pnpm --filter @repo/env generate-secrets --mask

# Generate and save secrets to .env.secrets
pnpm --filter @repo/env generate-secrets --save

# Copy example files to create your .env
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
```

### 2. Validate Your Environment
```bash
# Check all services
pnpm --filter @repo/env check

# Check specific service
pnpm --filter @repo/env check --service web

# Generate detailed report
pnpm --filter @repo/env check --report

# Check for exposed secrets
pnpm --filter @repo/env check --secrets
```

## 📦 Package Structure

```
packages/env/
├── web.ts              # Web app environment schema
├── api.ts              # API service environment schema
├── worker.ts           # Worker service environment schema
├── utils.ts            # Utility functions
├── vault.ts            # Secret vault implementation
├── scripts/
│   ├── generate-secrets.ts  # Secret generation tool
│   └── validate.ts          # Validation tool
└── index.ts            # Main exports
```

## 🔐 Environment Variables by Service

### Web Application (`apps/web`)

#### Required Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `BETTER_AUTH_SECRET` | Auth secret (min 32 chars) | Use generator |
| `BETTER_AUTH_URL` | Application URL | `http://localhost:3000` |
| `ENCRYPTION_SECRET` | Data encryption key | Use generator |
| `FIELD_ENCRYPTION_KEY` | Field encryption key | Use generator |
| `SESSION_SECRET` | Session secret | Use generator |
| `CSRF_SECRET` | CSRF protection | Use generator |

#### Optional Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth | Required in production |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Required in production |
| `STORAGE_PROVIDER` | Storage type | `local` |
| `EMAIL_PROVIDER` | Email service | `console` |
| `AI_PROVIDER` | AI service | `none` |

### API Service (`apps/api`)

#### Required Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | Same as web |
| `JWT_SECRET` | JWT signing secret | Use generator |
| `JWT_REFRESH_SECRET` | Refresh token secret | Use generator |
| `API_SECRET_KEY` | API authentication | Use generator |
| `INTERNAL_API_KEY` | Internal services | Use generator |
| `ENCRYPTION_SECRET` | Data encryption | Use generator |

#### Configuration Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `HOST` | Server host | `0.0.0.0` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `LOG_LEVEL` | Logging level | `info` |

### Worker Service (`apps/worker`)

#### Required Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | Same as web |
| `ENCRYPTION_SECRET` | Data encryption | Use generator |
| `REDIS_HOST` | Queue Redis host | `localhost` |
| `REDIS_PASSWORD` | Redis password | Required in production |

## 🛠️ Usage in Code

### 1. Basic Environment Access (Web App)

```typescript
// apps/web/lib/env.ts
import { env, features, oauth, storage } from './lib/env';

// Access environment variables
const authSecret = env.BETTER_AUTH_SECRET;
const databaseUrl = env.DATABASE_URL;

// Check feature flags
if (features.oauth) {
  console.log('OAuth is enabled');
}

if (features.aiContent) {
  console.log('AI content generation is enabled');
}

// Check OAuth providers
if (oauth.google.enabled) {
  initializeGoogleOAuth({
    clientId: oauth.google.clientId,
    clientSecret: oauth.google.clientSecret,
  });
}

// Access storage configuration
if (storage.provider === 'r2') {
  initializeR2Storage({
    accountId: storage.r2.accountId,
    accessKeyId: storage.r2.accessKeyId,
    secretAccessKey: storage.r2.secretAccessKey,
    bucketName: storage.r2.bucketName,
  });
}
```

### 2. Type-Safe Environment Access

```typescript
import { getEnv } from './lib/env';

// Type-safe access with error handling
try {
  const apiKey = getEnv('OPENAI_API_KEY');
  // apiKey is properly typed
} catch (error) {
  console.error('Missing required environment variable');
}
```

### 3. Environment-Specific Logic

```typescript
import { isProduction, isDevelopment, isTest } from './lib/env';

if (isProduction) {
  // Production-only code
  enableSecurityHeaders();
  enforceSSL();
}

if (isDevelopment) {
  // Development-only code
  enableDebugMode();
  disableRateLimiting();
}

if (isTest) {
  // Test-only code
  useMockDatabase();
}
```

### 4. Using the Validation Package

```typescript
// In any service that needs env validation
import { webEnv } from '@repo/env';

// This will validate on import and fail fast if invalid
const env = webEnv;

// Now env is fully typed and validated
console.log(env.DATABASE_URL); // TypeScript knows this exists
```

## 🔧 Command Reference

### Secret Generation
```bash
# Generate secrets (display only)
pnpm --filter @repo/env generate-secrets

# Generate with masked output
pnpm --filter @repo/env generate-secrets --mask

# Save to .env.secrets file
pnpm --filter @repo/env generate-secrets --save

# Generate in Docker format
pnpm --filter @repo/env generate-secrets --docker
```

### Environment Validation
```bash
# Validate all services
pnpm --filter @repo/env check

# Validate specific service
pnpm --filter @repo/env check --service web
pnpm --filter @repo/env check --service api
pnpm --filter @repo/env check --service worker

# Check for exposed secrets
pnpm --filter @repo/env check --secrets

# Generate detailed report
pnpm --filter @repo/env check --report

# Auto-fix missing configs
pnpm --filter @repo/env check --fix
```

### Secret Vault Operations
```bash
# Initialize vault
cd packages/env
npx tsx vault.ts init

# Add secret to vault
npx tsx vault.ts add KEY_NAME "secret_value"

# Get secret from vault
npx tsx vault.ts get KEY_NAME

# List all vault keys
npx tsx vault.ts list

# Remove secret from vault
npx tsx vault.ts remove KEY_NAME

# Export vault to environment
npx tsx vault.ts export
```

## 🚀 Deployment Configuration

### Vercel Deployment
```bash
# Set environment variables via Vercel CLI
vercel env add DATABASE_URL production
vercel env add BETTER_AUTH_SECRET production
vercel env add ENCRYPTION_SECRET production
# ... add all required variables

# Or use Vercel Dashboard
# 1. Go to Project Settings > Environment Variables
# 2. Add each variable with production scope
# 3. Redeploy
```

### Railway Deployment
```bash
# Set via Railway CLI
railway variables set DATABASE_URL="postgresql://..."
railway variables set BETTER_AUTH_SECRET="..."
railway variables set ENCRYPTION_SECRET="..."

# Or use Railway Dashboard
# 1. Go to Variables tab
# 2. Add each variable
# 3. Deploy
```

### Docker Deployment
```yaml
# docker-compose.yml
version: '3.8'
services:
  web:
    env_file:
      - apps/web/.env
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
```

## 📊 Environment Configuration Matrix

| Feature | Development | Staging | Production |
|---------|------------|---------|------------|
| SSL Required | ❌ | ✅ | ✅ |
| Redis Password | Optional | Required | Required |
| OAuth Providers | Optional | Optional | Required |
| Rate Limiting | Disabled | Enabled | Enabled |
| Debug Mode | Enabled | Disabled | Disabled |
| Error Details | Full | Limited | Hidden |
| Log Level | debug | info | warn/error |
| CORS | Permissive | Restricted | Strict |

## 🔒 Security Best Practices

### 1. Secret Generation
```bash
# Always use the generator for secrets
pnpm --filter @repo/env generate-secrets

# Never use simple or predictable values
# BAD: AUTH_SECRET="mysecret123"
# GOOD: AUTH_SECRET="8C3LW0gKrM4Ypb2NnV6RTaSJlxhQ5trig="
```

### 2. Environment Files
```bash
# Always use .env.example as template
cp apps/web/.env.example apps/web/.env

# Never commit .env files
git status  # Should not show .env files

# Use different secrets per environment
# .env.development.local
# .env.production.local
```

### 3. Production Security
- Always use SSL (`sslmode=require` in DATABASE_URL)
- Set strong Redis passwords
- Enable all security features
- Use vault for sensitive data
- Rotate secrets every 90 days

## 🐛 Troubleshooting

### Common Issues

#### 1. "Missing environment variable" Error
```bash
# Check which variables are missing
pnpm --filter @repo/env check --service web

# Generate missing secrets
pnpm --filter @repo/env generate-secrets --save

# Copy to .env file
cat .env.secrets >> apps/web/.env
```

#### 2. "Invalid environment variables" Error
```bash
# Validate your .env file
pnpm --filter @repo/env check

# Check for typos or invalid formats
# Common issues:
# - Missing quotes around values with spaces
# - Invalid URLs (missing protocol)
# - Secrets too short (min 32 chars for most)
```

#### 3. Build Failures
```bash
# Skip validation temporarily (development only!)
SKIP_ENV_VALIDATION=true pnpm build

# Fix issues then remove skip flag
```

#### 4. OAuth Not Working
```bash
# Ensure callback URLs are correct
BETTER_AUTH_URL="https://yourdomain.com"  # Must match OAuth provider

# Check provider credentials
# Google: https://console.cloud.google.com
# Facebook: https://developers.facebook.com
```

## 📈 Monitoring & Maintenance

### Regular Tasks
- **Weekly**: Run `pnpm audit` for security updates
- **Monthly**: Review and update environment variables
- **Quarterly**: Rotate all secrets
- **Yearly**: Full security audit

### Health Checks
```bash
# Check environment health
pnpm --filter @repo/env check --report

# Verify no exposed secrets
pnpm --filter @repo/env check --secrets

# Test production config locally
NODE_ENV=production pnpm --filter @repo/env check
```

## 📝 Examples by Use Case

### Setting Up Development Environment
```bash
# 1. Clone repository
git clone <repo>
cd planrrr

# 2. Install dependencies
pnpm install

# 3. Generate secrets
pnpm --filter @repo/env generate-secrets --save

# 4. Create .env files
cp apps/web/.env.example apps/web/.env
cat .env.secrets >> apps/web/.env

# 5. Add OAuth credentials (get from providers)
echo 'GOOGLE_CLIENT_ID="your-client-id"' >> apps/web/.env
echo 'GOOGLE_CLIENT_SECRET="your-secret"' >> apps/web/.env

# 6. Validate setup
pnpm --filter @repo/env check

# 7. Start development
pnpm dev
```

### Preparing for Production
```bash
# 1. Generate production secrets
pnpm --filter @repo/env generate-secrets > prod-secrets.txt

# 2. Update DATABASE_URL with SSL
# postgresql://user:pass@host:5432/db?sslmode=require

# 3. Set all required production variables
# - All OAuth providers
# - Redis password
# - Monitoring (Sentry, PostHog)

# 4. Validate production config
NODE_ENV=production pnpm --filter @repo/env check

# 5. Deploy to platform
vercel --prod  # or railway up
```

## 🆘 Support

- **Documentation**: Check `.env.example` files for detailed comments
- **Validation**: Run `pnpm --filter @repo/env check` for diagnostics
- **Security**: Review `DEPLOYMENT_SECRETS_CHECKLIST.md`
- **Issues**: Check TypeScript errors in `packages/env/*.ts`

---

**Last Updated**: 2025-08-20  
**Version**: 1.0.0  
**Status**: Production Ready