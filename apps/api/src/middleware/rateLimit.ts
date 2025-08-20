// Package: @repo/api
// Path: apps/api/src/middleware/rateLimit.ts
// Dependencies: hono

import { Context, Next } from 'hono';

// Simple in-memory rate limiting (use Redis in production)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(options = { windowMs: 60000, max: 100 }) {
  return async (c: Context, next: Next) => {
    const identifier = c.req.header('x-forwarded-for') || 'anonymous';
    const now = Date.now();
    
    const userLimit = requestCounts.get(identifier);
    
    if (!userLimit || userLimit.resetTime < now) {
      requestCounts.set(identifier, {
        count: 1,
        resetTime: now + options.windowMs
      });
    } else if (userLimit.count >= options.max) {
      return c.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests'
        }
      }, 429);
    } else {
      userLimit.count++;
    }
    
    await next();
  };
}