#!/usr/bin/env tsx
// Package: @repo/api
// Path: apps/api/src/test/securityTest.ts
// Test script for security configurations

import { corsInfo } from '../middleware/cors.js';
import { versionInfo } from '../middleware/versioning.js';
import { secureCookieOptions } from '../middleware/security.js';

console.log('=== Security Configuration Test ===\n');

// Test CORS configuration
console.log('1. CORS Configuration:');
console.log('   Allowed Origins:', corsInfo.getAllowedOrigins());
console.log('   Credentials:', corsInfo.credentials);
console.log('   Max Age:', corsInfo.maxAge, 'seconds\n');

// Test API versioning
console.log('2. API Versioning:');
console.log('   Current Version:', versionInfo.current);
console.log('   Supported Versions:', versionInfo.supported);
console.log('   Deprecated Versions:', versionInfo.deprecated);
console.log('   Deprecation Dates:', versionInfo.deprecationDates, '\n');

// Test cookie security
console.log('3. Cookie Security:');
console.log('   HTTP Only:', secureCookieOptions.httpOnly);
console.log('   Secure:', secureCookieOptions.secure);
console.log('   Same Site:', secureCookieOptions.sameSite);
console.log('   Max Age:', secureCookieOptions.maxAge, 'seconds\n');

// Test commands
console.log('=== Manual Test Commands ===\n');

console.log('# 1. Test CORS Preflight:');
console.log(`curl -X OPTIONS http://localhost:4000/api/posts \\
  -H "Origin: http://localhost:3000" \\
  -H "Access-Control-Request-Method: POST" \\
  -H "Access-Control-Request-Headers: Content-Type" \\
  -v 2>&1 | grep -i "access-control"
`);

console.log('# 2. Verify Security Headers:');
console.log(`curl -I http://localhost:4000/api/posts 2>/dev/null | grep -E "X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security|X-Request-ID"
`);

console.log('# 3. Test Request ID Generation:');
console.log(`curl -s http://localhost:4000/api/posts -v 2>&1 | grep -i "x-request-id"
`);

console.log('# 4. Test API Versioning (URL):');
console.log(`echo "Testing v1:" && curl -s http://localhost:4000/api/v1/posts | jq .meta.apiVersion
echo "Testing v2:" && curl -s http://localhost:4000/api/v2/posts | jq .meta.apiVersion
`);

console.log('# 5. Test API Versioning (Header):');
console.log(`curl -s http://localhost:4000/api/posts -H "X-API-Version: v2" | jq .meta.apiVersion
`);

console.log('# 6. Check Deprecation Headers:');
console.log(`curl -I http://localhost:4000/api/v1/posts 2>/dev/null | grep -E "X-API-Deprecation|Sunset"
`);

console.log('# 7. Test Security.txt:');
console.log(`curl -s http://localhost:4000/.well-known/security.txt
`);

console.log('# 8. Test Invalid Content-Type:');
console.log(`curl -X POST http://localhost:4000/api/posts \\
  -H "Content-Type: text/plain" \\
  -d "test" \\
  -s | jq .error
`);

console.log('# 9. Test CSRF Protection (should fail):');
console.log(`curl -X POST http://localhost:4000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -H "Origin: http://evil.com" \\
  -d '{"email":"test@example.com","password":"password"}' \\
  -s | jq .error
`);

console.log('# 10. Test Rate Limiting:');
console.log(`for i in {1..10}; do
  echo "Request $i:"
  curl -s http://localhost:4000/api/posts -o /dev/null -w "%{http_code}\\n"
  sleep 0.1
done
`);

console.log('=== Security Validation Checklist ===\n');

const checklist = [
  'CORS allows configured origins only',
  'Security headers present in all responses',
  'Request IDs generated for tracing',
  'API versioning works via URL and header',
  'Deprecation warnings shown for v1',
  'CSRF protection blocks unauthorized origins',
  'Content-Type validation enforces JSON',
  'Rate limiting activates after threshold',
  'Security.txt accessible at well-known URL',
  'Cookies configured with security flags'
];

checklist.forEach((item, index) => {
  console.log(`[ ] ${index + 1}. ${item}`);
});

console.log('\n=== Expected Security Headers ===\n');

const expectedHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-DNS-Prefetch-Control': 'off',
  'X-Download-Options': 'noopen',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-Request-ID': 'req_xxxxxxxxxxxx',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Origin-Agent-Cluster': '?1'
};

Object.entries(expectedHeaders).forEach(([header, value]) => {
  console.log(`${header}: ${value}`);
});

console.log('\n✅ Security configuration test complete!');
console.log('Run the manual commands above to verify all security features.');