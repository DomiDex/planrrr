# API Security Documentation

## Overview

The Planrrr API implements comprehensive security measures to protect against common web vulnerabilities and ensure data integrity. This document outlines all security features, configurations, and best practices.

## Security Features

### 1. CORS (Cross-Origin Resource Sharing)

**Configuration:** `/src/middleware/cors.ts`

- **Allowed Origins:** Environment-aware configuration
  - Production: `planrrr.io`, `www.planrrr.io`, `app.planrrr.io`
  - Development: `localhost:3000`, `localhost:3001`, `127.0.0.1:3000`
  - Custom origins via `ALLOWED_ORIGINS` environment variable
- **Credentials:** Enabled for cookie-based authentication
- **Preflight Cache:** 24 hours
- **Exposed Headers:** Request ID, rate limit info, API version

### 2. Security Headers

**Configuration:** `/src/middleware/security.ts`

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Enforces HTTPS |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `Content-Security-Policy` | Complex policy (see below) | Prevents XSS |
| `X-XSS-Protection` | `0` | Disabled (modern browsers) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer info |
| `X-DNS-Prefetch-Control` | `off` | Disables DNS prefetching |

#### Content Security Policy (Production)

```javascript
{
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  imgSrc: ["'self'", "data:", "https:", "blob:"],
  connectSrc: ["'self'", "https://api.planrrr.io", "wss://api.planrrr.io"],
  frameSrc: ["'none'"],
  objectSrc: ["'none'"]
}
```

### 3. Request ID Tracking

**Configuration:** `/src/middleware/security.ts`

- **Format:** `req_[nanoid(12)]` (e.g., `req_abc123def456`)
- **Propagation:** Included in all responses via `X-Request-ID` header
- **Logging:** Attached to all log entries for tracing
- **Error Tracking:** Included in Sentry error reports

### 4. API Versioning

**Configuration:** `/src/middleware/versioning.ts`

- **Supported Versions:** `v1`, `v2`
- **Default Version:** `v1`
- **Access Methods:**
  - URL path: `/api/v1/posts`, `/api/v2/posts`
  - Header: `X-API-Version: v1`
- **Deprecation:** 
  - v1 deprecated on 2025-12-31
  - Headers: `X-API-Deprecation`, `Sunset`

### 5. CSRF Protection

**Configuration:** `/src/middleware/security.ts`

- **Protected Routes:**
  - `/api/*/create`
  - `/api/*/update`
  - `/api/*/delete`
  - `/api/auth/register`
  - `/api/auth/login`
- **Token Header:** `X-CSRF-Token`
- **Origin Validation:** Strict origin checking

### 6. Rate Limiting

**Configuration:** `/src/middleware/rateLimit.ts`

| Endpoint Type | Limit | Window | Algorithm |
|--------------|-------|--------|-----------|
| Standard API | 100 req | 1 min | Sliding Window |
| Auth Endpoints | 5 req | 1 min | Sliding Window |
| AI Endpoints | 20 req | 1 min | Token Bucket (burst: 5) |

**Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Reset timestamp
- `Retry-After`: Seconds until retry (when limited)

### 7. Content Type Validation

**Configuration:** `/src/middleware/security.ts`

- **Required for:** POST, PUT, PATCH requests
- **Allowed Types:** `application/json`, `multipart/form-data`
- **Error Response:** 415 Unsupported Media Type

### 8. Cookie Security

**Configuration:** `/src/middleware/security.ts`

```javascript
{
  httpOnly: true,              // No JavaScript access
  secure: true,                // HTTPS only (production)
  sameSite: 'lax',            // CSRF protection
  path: '/',                   // Available site-wide
  maxAge: 7 * 24 * 60 * 60    // 7 days
}
```

## Environment Variables

```bash
# CORS Configuration
FRONTEND_URL=https://app.planrrr.io
ALLOWED_ORIGINS=https://staging.planrrr.io,https://preview.planrrr.io

# CSRF Configuration
CSRF_ALLOWED_ORIGINS=https://app.planrrr.io,https://planrrr.io

# Security
INTERNAL_API_KEY=your-internal-api-key
NODE_ENV=production
```

## Testing Security

### 1. Test CORS Configuration

```bash
# Test preflight request
curl -X OPTIONS http://localhost:4000/api/posts \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v

# Expected: Access-Control headers in response
```

### 2. Verify Security Headers

```bash
# Check security headers
curl -I http://localhost:4000/api/posts | grep -E "X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security"

# Expected: All security headers present
```

### 3. Test Request ID Generation

```bash
# Check request ID
curl http://localhost:4000/api/posts -v | grep X-Request-ID

# Expected: X-Request-ID: req_xxxxxxxxxxxx
```

### 4. Test CSRF Protection

```bash
# Should fail without CSRF token
curl -X POST http://localhost:4000/api/posts/create \
  -H "Content-Type: application/json" \
  -H "Origin: http://evil.com" \
  -d '{"content":"test"}'

# Expected: 403 Forbidden
```

### 5. Test API Versioning

```bash
# URL-based versioning
curl http://localhost:4000/api/v1/posts
curl http://localhost:4000/api/v2/posts

# Header-based versioning
curl http://localhost:4000/api/posts -H "X-API-Version: v1"
curl http://localhost:4000/api/posts -H "X-API-Version: v2"

# Check deprecation headers
curl -I http://localhost:4000/api/v1/posts | grep -E "X-API-Deprecation|Sunset"
```

### 6. Security Audit Tools

```bash
# Install security headers checker
npm install -g security-headers

# Run audit
security-headers http://localhost:4000

# Install OWASP ZAP for comprehensive testing
# https://www.zaproxy.org/
```

## Security Endpoints

### Security.txt

**URL:** `/.well-known/security.txt`

```text
Contact: security@planrrr.io
Expires: 2025-12-31T23:59:59.000Z
Preferred-Languages: en
Canonical: https://planrrr.io/.well-known/security.txt
Policy: https://planrrr.io/security-policy
Acknowledgments: https://planrrr.io/security/acknowledgments
```

### CSP Violation Reporting

**URL:** `/.well-known/csp-report`  
**Method:** POST  
**Purpose:** Receives Content Security Policy violation reports

## Security Best Practices

### 1. Input Validation

- All inputs validated with Zod schemas
- SQL injection prevention via Prisma ORM
- XSS prevention via output encoding

### 2. Authentication

- JWT tokens with short expiration
- Refresh token rotation
- Session invalidation on logout

### 3. Authorization

- Team-based access control
- Resource-level permissions
- API key validation for internal services

### 4. Data Protection

- HTTPS enforced in production
- Sensitive data encryption at rest
- PII data minimization

### 5. Error Handling

- Generic error messages to users
- Detailed logs for debugging
- No stack traces in production

### 6. Monitoring

- Request ID tracking
- Security header violations logged
- Rate limit violations tracked
- Failed authentication attempts monitored

## Compliance

### GDPR Compliance

- Data minimization
- Right to erasure support
- Consent management
- Data portability

### SOC 2 Requirements

- Access controls
- Encryption in transit
- Audit logging
- Incident response

## Security Checklist

Before deploying to production:

- [ ] HTTPS configured and enforced
- [ ] All environment variables set
- [ ] CSP policy reviewed and tested
- [ ] CORS origins properly configured
- [ ] Rate limiting thresholds appropriate
- [ ] API keys rotated and secured
- [ ] Security headers validated
- [ ] CSRF protection active
- [ ] Input validation comprehensive
- [ ] Error messages sanitized
- [ ] Logging configured properly
- [ ] Monitoring alerts set up
- [ ] Security.txt file accessible
- [ ] Penetration testing completed
- [ ] Security audit passed

## Incident Response

In case of security incident:

1. **Immediate Actions:**
   - Activate rate limiting
   - Review access logs
   - Check for data breach

2. **Investigation:**
   - Analyze request IDs
   - Review security logs
   - Identify attack vector

3. **Mitigation:**
   - Patch vulnerability
   - Update security rules
   - Rotate credentials

4. **Communication:**
   - Notify affected users
   - Update security.txt
   - Document lessons learned

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Mozilla Security Headers](https://infosec.mozilla.org/guidelines/web_security)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [Security Headers Scanner](https://securityheaders.com/)
- [CORS Tester](https://www.test-cors.org/)

## Contact

For security concerns or vulnerability reports:
- Email: security@planrrr.io
- Response Time: < 24 hours
- Bug Bounty: https://planrrr.io/security/bug-bounty