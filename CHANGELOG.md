# Changelog

All notable changes to planrrr.io will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security - 2025-01-20

#### 🔒 Critical Security Patch - CVE-2025-29927

- **Updated** Next.js to version 15.5.0 (includes patch for CVE-2025-29927)
  - Fixes critical middleware bypass vulnerability that allowed complete authentication bypass
  - Vulnerability allowed attackers to bypass middleware by adding `x-middleware-subrequest` header
  - All self-hosted deployments should update immediately

#### 🛡️ Security Enhancements

- **Added** Comprehensive security middleware (`middleware.ts`)
  - Blocks malicious `x-middleware-subrequest` headers
  - Enforces authentication on protected routes
  - Implements security headers (CSP, X-Frame-Options, etc.)
  - Adds CORS and referrer policies

- **Added** Security verification script (`scripts/verify-security.ts`)
  - Automated checks for Next.js version compliance
  - Middleware configuration validation
  - Environment variable security audit
  - TypeScript strict mode verification

- **Added** Protected API test route (`app/api/protected/route.ts`)
  - Endpoint for testing middleware security
  - CVE-2025-29927 vulnerability verification
  - Authentication requirement testing

- **Enhanced** Next.js configuration (`next.config.js`)
  - Added comprehensive security headers
  - Disabled X-Powered-By header
  - Configured strict Content Security Policy
  - Added image domain restrictions
  - Implemented security redirects

- **Added** Security testing commands in `package.json`
  - `pnpm verify:security` - Run security verification
  - `pnpm test:security` - Test middleware protection
  - `pnpm audit` - Check for vulnerabilities
  - `pnpm audit:fix` - Auto-fix vulnerabilities

### Testing Instructions

1. **Verify Security Patches:**
   ```bash
   cd apps/web
   pnpm verify:security
   ```

2. **Test Middleware Protection:**
   ```bash
   # Start the development server
   pnpm dev

   # In another terminal, test the vulnerability (should return 403)
   curl -H "x-middleware-subrequest: middleware:middleware:middleware" http://localhost:3000/api/protected
   ```

3. **Check Next.js Version:**
   ```bash
   pnpm list next
   # Should show version 15.5.0 or higher
   ```

### Migration Notes

- No breaking changes for existing functionality
- Middleware can be disabled by renaming `middleware.ts` if issues arise
- Security headers are automatically applied to all routes
- Authentication checks now enforced on `/dashboard` and `/api/protected` routes

### Contributors

- Security patch implementation following P1-SEC-001 task requirements

---

## [0.1.0] - 2025-01-15

### Added
- Initial monorepo setup with Turborepo
- Next.js 15 application with App Router
- Basic project structure for web, worker, and shared packages
- Prisma database schema
- Better Auth configuration
- Initial TypeScript and ESLint configurations