#!/usr/bin/env tsx
// Package: @repo/api
// Path: apps/api/src/test/rateLimitTest.ts
// Test script for rate limiting functionality

import { createORPCRateLimit, getRateLimitForProcedure } from '../middleware/orpcRateLimit.js';

// Test configuration display
console.log('=== Rate Limit Configuration ===\n');
console.log('Auth Endpoints:');
console.log('- auth.login:', getRateLimitForProcedure('auth.login'));
console.log('- auth.register:', getRateLimitForProcedure('auth.register'));

console.log('\nPost Endpoints:');
console.log('- posts.create:', getRateLimitForProcedure('posts.create'));
console.log('- posts.list:', getRateLimitForProcedure('posts.list'));

console.log('\nAI Endpoints (Token Bucket):');
console.log('- ai.generate:', getRateLimitForProcedure('ai.generate'));
console.log('- ai.enhance:', getRateLimitForProcedure('ai.enhance'));

console.log('\nDefault Configuration:');
console.log('- default:', getRateLimitForProcedure('unknown.endpoint'));

// Simulate ORPC middleware usage
async function testRateLimit() {
  console.log('\n=== Testing ORPC Rate Limit Middleware ===\n');
  
  const middleware = createORPCRateLimit();
  
  // Test 1: Anonymous user
  console.log('Test 1: Anonymous user request');
  const anonymousContext = {
    ip: '192.168.1.1',
    headers: {}
  };
  
  try {
    await middleware({
      context: anonymousContext,
      next: async ({ context }) => {
        console.log('✓ Anonymous request passed');
        console.log('  Rate limit info:', context.rateLimit);
        return { success: true };
      },
      meta: { path: ['posts', 'list'] }
    });
  } catch (error) {
    console.log('✗ Anonymous request blocked:', error);
  }
  
  // Test 2: Authenticated user (free tier)
  console.log('\nTest 2: Authenticated user (free tier)');
  const freeUserContext = {
    user: { id: 'user123', email: 'user@example.com', tier: 'free' as const },
    ip: '192.168.1.1',
    headers: {}
  };
  
  try {
    await middleware({
      context: freeUserContext,
      next: async ({ context }) => {
        console.log('✓ Free tier user request passed');
        console.log('  Rate limit info:', context.rateLimit);
        return { success: true };
      },
      meta: { path: ['ai', 'generate'] }
    });
  } catch (error) {
    console.log('✗ Free tier user request blocked:', error);
  }
  
  // Test 3: Pro tier user (2x limits)
  console.log('\nTest 3: Authenticated user (pro tier)');
  const proUserContext = {
    user: { id: 'user456', email: 'pro@example.com', tier: 'pro' as const },
    ip: '192.168.1.2',
    headers: {}
  };
  
  try {
    await middleware({
      context: proUserContext,
      next: async ({ context }) => {
        console.log('✓ Pro tier user request passed');
        console.log('  Rate limit info (2x multiplier):', context.rateLimit);
        return { success: true };
      },
      meta: { path: ['ai', 'generate'] }
    });
  } catch (error) {
    console.log('✗ Pro tier user request blocked:', error);
  }
  
  // Test 4: Internal API key bypass
  console.log('\nTest 4: Internal API key bypass');
  const internalContext = {
    ip: '192.168.1.3',
    headers: { 'x-api-key': process.env.INTERNAL_API_KEY || 'test-key' }
  };
  
  try {
    await middleware({
      context: internalContext,
      next: async ({ context }) => {
        console.log('✓ Internal API request bypassed rate limiting');
        console.log('  Bypass flag:', context.rateLimitBypassed);
        return { success: true };
      },
      meta: { path: ['internal', 'metrics'] }
    });
  } catch (error) {
    console.log('✗ Internal API request failed:', error);
  }
  
  // Test 5: Different procedures
  console.log('\nTest 5: Different procedure limits');
  const procedures = [
    'auth.login',
    'posts.create',
    'ai.generate',
    'analytics.overview'
  ];
  
  for (const proc of procedures) {
    const config = getRateLimitForProcedure(proc);
    console.log(`- ${proc}: ${config.requests} requests per ${config.window}${config.burst ? ` (burst: ${config.burst})` : ''}`);
  }
}

// Run tests if Redis is not configured (dry run)
if (!process.env.UPSTASH_REDIS_REST_URL) {
  console.log('\n⚠️  Note: Running in dry-run mode (Redis not configured)\n');
  testRateLimit().catch(console.error);
} else {
  console.log('\n✓ Redis configured - rate limiting active\n');
  testRateLimit().catch(console.error);
}

// Test bash commands
console.log('\n=== Test Commands ===\n');
console.log('# Test existing rate limiting (REST endpoints):');
console.log('for i in {1..110}; do');
console.log('  curl -X GET http://localhost:4000/api/posts \\');
console.log('    -H "X-Forwarded-For: 192.168.1.1"');
console.log('done');

console.log('\n# Test auth endpoint rate limiting (5/min):');
console.log('for i in {1..10}; do');
console.log('  curl -X POST http://localhost:4000/api/auth.login \\');
console.log('    -H "Content-Type: application/json" \\');
console.log('    -d \'{"email":"test@example.com","password":"password"}\'');
console.log('done');

console.log('\n# Test AI endpoint with token bucket (burst of 5):');
console.log('for i in {1..10}; do');
console.log('  curl -X POST http://localhost:4000/api/ai.generate \\');
console.log('    -H "Authorization: Bearer $TOKEN" \\');
console.log('    -H "Content-Type: application/json" \\');
console.log('    -d \'{"prompt":"test"}\'');
console.log('done');

console.log('\n# Test internal API bypass:');
console.log('curl -X GET http://localhost:4000/api/internal.metrics \\');
console.log('  -H "X-API-Key: ${INTERNAL_API_KEY}"');

console.log('\n# Test user-based limiting (same user, different IPs):');
console.log('curl -X POST http://localhost:4000/api/posts.create \\');
console.log('  -H "Authorization: Bearer $TOKEN" \\');
console.log('  -H "X-Forwarded-For: 1.1.1.1"');
console.log('');
console.log('curl -X POST http://localhost:4000/api/posts.create \\');
console.log('  -H "Authorization: Bearer $TOKEN" \\');
console.log('  -H "X-Forwarded-For: 2.2.2.2"');