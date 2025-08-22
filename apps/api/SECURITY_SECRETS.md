# 🔐 Secure Secrets Management

## Overview

This document describes the secure secrets management implementation for the planrrr.io API service, addressing **CRIT-001** from the security audit.

## Implementation Details

### Files Changed
- `src/lib/config/secrets.ts` - Core secrets management module
- `src/procedures/middleware/auth.middleware.ts` - JWT token verification
- `src/procedures/auth.procedure.ts` - Authentication procedures
- `src/middleware/apiKey.ts` - API key validation
- `src/index.ts` - Application startup with secrets verification
- `src/routes/health.ts` - Health check with secrets validation
- `.env.example` - Template for environment variables
- `scripts/generate-secrets.js` - Secret generation utility

### Security Improvements

1. **No Hardcoded Secrets**: All secrets now loaded from environment variables
2. **Runtime Validation**: Secrets validated at startup with Zod schemas
3. **Development Mode**: Auto-generates secure random secrets for development
4. **Timing-Safe Comparison**: API key validation uses `crypto.timingSafeEqual()` to prevent timing attacks
5. **Secret Rotation Support**: Easy secret rotation through environment variables
6. **Health Check Integration**: Secrets validation included in health checks

## Usage

### 1. Generate Secure Secrets

```bash
# Generate new secrets
node scripts/generate-secrets.js

# Or manually generate a secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Configure Environment

```bash
# Copy example file
cp .env.example .env

# Add generated secrets to .env file
# NEVER commit .env file to version control!
```

### 3. Verify Configuration

```bash
# Start the API server
pnpm dev

# Check health endpoint
curl http://localhost:4000/health
```

The response should show `"secrets": "ok"` if properly configured.

## Security Best Practices

### Secret Requirements
- **Minimum Length**: 32 characters (base64 encoded)
- **Character Set**: Cryptographically random bytes
- **Rotation**: Every 90 days for production
- **Storage**: Use secure vault for production (e.g., HashiCorp Vault, AWS Secrets Manager)

### Environment-Specific Secrets
```bash
# Development (auto-generated if not provided)
NODE_ENV=development

# Production (must be provided, fails if missing)
NODE_ENV=production
JWT_SECRET="<secure-secret>"
JWT_REFRESH_SECRET="<secure-secret>"
ENCRYPTION_SECRET="<secure-secret>"
INTERNAL_API_KEY="<secure-secret>"
```

### Secret Rotation Procedure

1. **Generate New Secrets**
   ```bash
   node scripts/generate-secrets.js
   ```

2. **Update Environment Variables**
   - Development: Update local .env file
   - Production: Update in secret management system

3. **Deploy with Grace Period**
   - Deploy new version with support for both old and new secrets
   - Wait for all active sessions to expire
   - Remove old secret support in next deployment

## Monitoring & Alerts

### Health Check Monitoring
```bash
# Health endpoint includes secrets validation
GET /health

Response:
{
  "checks": {
    "secrets": "ok" | "error"
  }
}
```

### Logging
- Secret loading logged (without exposing values)
- Invalid API key attempts logged with IP address
- JWT validation failures logged

## Testing

### Unit Tests
```typescript
// Test secret validation
import { loadSecrets, verifySecrets } from './lib/config/secrets';

test('should validate secrets', () => {
  const result = verifySecrets();
  expect(result.valid).toBe(true);
});
```

### Integration Tests
```bash
# Test with missing secrets (should fail in production)
NODE_ENV=production pnpm test

# Test with auto-generated secrets (should pass in development)
NODE_ENV=development pnpm test
```

## Migration Guide

### From Hardcoded Secrets

1. **Backup Current Configuration**
   ```bash
   cp .env .env.backup
   ```

2. **Generate New Secrets**
   ```bash
   node scripts/generate-secrets.js
   ```

3. **Update .env File**
   - Remove old hardcoded values
   - Add new generated secrets

4. **Test Locally**
   ```bash
   pnpm dev
   curl http://localhost:4000/health
   ```

5. **Deploy to Production**
   - Add secrets to production secret manager
   - Deploy new code
   - Monitor health checks

## Compliance

This implementation addresses:
- **OWASP A02:2021** - Cryptographic Failures
- **OWASP A07:2021** - Identification and Authentication Failures
- **CWE-798** - Use of Hard-coded Credentials
- **CWE-259** - Use of Hard-coded Password

## Support

For issues or questions about secrets management:
1. Check health endpoint for secrets validation status
2. Review logs for secret loading errors
3. Ensure environment variables are properly set
4. Contact security team for production secret rotation

---

**Last Updated**: 2025-08-22
**Security Review**: Required before production deployment
**Next Review**: 90 days after deployment