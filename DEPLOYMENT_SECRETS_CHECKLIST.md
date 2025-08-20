# 🔐 Production Deployment Secrets Checklist

## Pre-Deployment Security Audit

This checklist must be completed before deploying to production. All items marked as **REQUIRED** must be checked off.

## 🚨 Critical Security Requirements

### Database Security
- [ ] **REQUIRED**: `DATABASE_URL` includes `sslmode=require`
- [ ] **REQUIRED**: Database password is strong (min 20 chars, mixed case, numbers, symbols)
- [ ] **REQUIRED**: Database user has minimal required permissions
- [ ] Database connection pooling is configured
- [ ] Database backups are encrypted at rest
- [ ] Database access is IP-restricted

### Authentication Secrets
- [ ] **REQUIRED**: `BETTER_AUTH_SECRET` is unique and ≥32 characters
- [ ] **REQUIRED**: `SESSION_SECRET` is unique and ≥32 characters
- [ ] **REQUIRED**: `JWT_SECRET` is unique and ≥32 characters
- [ ] **REQUIRED**: `JWT_REFRESH_SECRET` is unique and ≥32 characters
- [ ] **REQUIRED**: All secrets are generated using cryptographically secure methods
- [ ] **REQUIRED**: Different secrets for each environment (dev/staging/prod)

### Encryption Keys
- [ ] **REQUIRED**: `ENCRYPTION_SECRET` is unique and ≥32 characters
- [ ] **REQUIRED**: `FIELD_ENCRYPTION_KEY` is unique and ≥32 characters
- [ ] **REQUIRED**: `CSRF_SECRET` is unique and ≥16 characters
- [ ] Encryption keys are stored in secure vault (not in code)
- [ ] Key rotation schedule is established (90 days)

### OAuth Configuration
- [ ] **REQUIRED**: OAuth redirect URLs use HTTPS only
- [ ] **REQUIRED**: OAuth credentials are production-specific
- [ ] OAuth app permissions are minimal required scope
- [ ] OAuth refresh tokens are encrypted when stored
- [ ] OAuth state parameter is validated

### Redis Security
- [ ] **REQUIRED**: `REDIS_PASSWORD` is set and strong
- [ ] **REQUIRED**: Redis TLS is enabled (`REDIS_TLS_ENABLED=true`)
- [ ] Redis connection uses SSL/TLS
- [ ] Redis ACLs are configured
- [ ] Redis persistence is configured appropriately

## 🛡️ Infrastructure Security

### Environment Variables
- [ ] **REQUIRED**: No secrets in environment variable names
- [ ] **REQUIRED**: No secrets in code repository
- [ ] **REQUIRED**: `.env` files are in `.gitignore`
- [ ] Environment variables are injected at runtime
- [ ] Secrets are stored in secure vault (Vercel, Railway, etc.)
- [ ] Access to secrets vault is role-based and audited

### API Security
- [ ] **REQUIRED**: `API_SECRET_KEY` is unique and ≥32 characters
- [ ] **REQUIRED**: `INTERNAL_API_KEY` is unique and ≥32 characters
- [ ] **REQUIRED**: Rate limiting is enabled
- [ ] **REQUIRED**: CORS is properly configured
- [ ] API keys have expiration dates
- [ ] API access is logged and monitored

### Network Security
- [ ] **REQUIRED**: All URLs use HTTPS
- [ ] **REQUIRED**: `BETTER_AUTH_URL` uses production domain
- [ ] **REQUIRED**: `ALLOWED_HOSTS` is restrictive
- [ ] SSL/TLS certificates are valid
- [ ] HSTS is enabled
- [ ] CSP headers are configured

## 📊 Monitoring & Compliance

### Logging & Monitoring
- [ ] **REQUIRED**: `LOG_LEVEL` is set to appropriate level (not 'debug' in prod)
- [ ] **REQUIRED**: Sensitive data is not logged
- [ ] Error tracking (Sentry) is configured
- [ ] Audit logging is enabled
- [ ] Security alerts are configured
- [ ] Log retention policies are set

### Compliance
- [ ] GDPR compliance verified
- [ ] CCPA compliance verified
- [ ] SOC2 requirements met
- [ ] Data encryption at rest verified
- [ ] Data encryption in transit verified
- [ ] Right to deletion implemented

## 🔄 Secret Rotation

### Rotation Schedule
- [ ] Database passwords: Every 90 days
- [ ] API keys: Every 90 days
- [ ] OAuth secrets: Every 180 days
- [ ] Encryption keys: Every 365 days (with migration plan)
- [ ] JWT secrets: Every 90 days

### Rotation Process
- [ ] Rotation scripts are tested
- [ ] Rollback procedure is documented
- [ ] Zero-downtime rotation is implemented
- [ ] Old secrets are securely deleted
- [ ] Rotation is logged and audited

## 🚀 Deployment Platforms

### Vercel Configuration
```bash
# Set secrets via Vercel CLI
vercel env add BETTER_AUTH_SECRET production
vercel env add DATABASE_URL production
vercel env add ENCRYPTION_SECRET production
# ... add all required secrets
```

### Railway Configuration
```bash
# Set secrets via Railway CLI
railway variables set BETTER_AUTH_SECRET="<value>"
railway variables set DATABASE_URL="<value>"
railway variables set ENCRYPTION_SECRET="<value>"
# ... add all required secrets
```

### Docker Configuration
```yaml
# docker-compose.yml (use secrets, not environment)
services:
  web:
    secrets:
      - better_auth_secret
      - database_url
      - encryption_secret

secrets:
  better_auth_secret:
    external: true
  database_url:
    external: true
  encryption_secret:
    external: true
```

## 📝 Final Verification

Before deployment, run:

```bash
# Validate all environment variables
pnpm --filter @repo/env check --report

# Check for exposed secrets
pnpm --filter @repo/env check --secrets

# Generate security report
pnpm audit

# Test with production-like environment
NODE_ENV=production pnpm build
NODE_ENV=production pnpm start
```

## ⚠️ Emergency Procedures

### If a Secret is Compromised:
1. Immediately rotate the compromised secret
2. Invalidate all sessions/tokens using that secret
3. Check logs for unauthorized access
4. Notify security team
5. Document incident
6. Update security procedures

### Secret Recovery:
1. Secrets should be backed up in secure vault
2. Recovery requires two-person authorization
3. All recovery actions are logged
4. Test recovery procedure quarterly

## 📋 Sign-off

- [ ] Security team has reviewed configuration
- [ ] DevOps team has verified infrastructure
- [ ] All REQUIRED items are checked
- [ ] Secrets are documented in secure location
- [ ] Team is trained on security procedures

**Deployment Approved By:** _____________________  
**Date:** _____________________  
**Version:** _____________________

---

⚠️ **This document contains sensitive security information. Handle with appropriate security measures.**