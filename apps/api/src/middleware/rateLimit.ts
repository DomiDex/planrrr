// Package: @repo/api
// Path: apps/api/src/middleware/rateLimit.ts
// Dependencies: @upstash/ratelimit, @upstash/redis

import { Context, Next } from 'hono';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client for Upstash
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

// Create rate limiter with sliding window
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true // Enable analytics for monitoring
});

// Fallback in-memory rate limiting for development
const inMemoryLimits = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(options = { windowMs: 60000, max: 100 }) {
  return async (c: Context, next: Next) => {
    const identifier = c.req.header('x-forwarded-for') || 
                      c.req.header('x-real-ip') || 
                      'anonymous';
    
    // Use Upstash in production, in-memory in development
    if (process.env.NODE_ENV === 'production' && process.env.UPSTASH_REDIS_REST_URL) {
      try {
        const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
        
        // Add rate limit headers
        c.header('X-RateLimit-Limit', limit.toString());
        c.header('X-RateLimit-Remaining', remaining.toString());
        c.header('X-RateLimit-Reset', new Date(reset).toISOString());
        
        if (!success) {
          return c.json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests, please try again later'
            },
            meta: {
              retryAfter: Math.ceil((reset - Date.now()) / 1000),
              limit,
              remaining: 0
            }
          }, 429);
        }
      } catch (error) {
        console.error('Rate limiting error:', error);
        // Continue on error - don't block requests due to rate limiter failure
      }
    } else {
      // Development/fallback rate limiting
      const now = Date.now();
      const userLimit = inMemoryLimits.get(identifier);
      
      if (!userLimit || userLimit.resetTime < now) {
        inMemoryLimits.set(identifier, {
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
      
      // Clean up old entries periodically
      if (Math.random() < 0.01) { // 1% chance
        for (const [key, value] of inMemoryLimits.entries()) {
          if (value.resetTime < now) {
            inMemoryLimits.delete(key);
          }
        }
      }
    }
    
    await next();
  };
}

// Stricter rate limiting for sensitive endpoints
export function strictRateLimiter() {
  if (process.env.NODE_ENV === 'production' && process.env.UPSTASH_REDIS_REST_URL) {
    const strictLimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
      analytics: true
    });
    
    return async (c: Context, next: Next) => {
      const identifier = c.req.header('x-forwarded-for') || 
                        c.req.header('x-real-ip') || 
                        'anonymous';
      
      const { success, limit, reset, remaining } = await strictLimit.limit(identifier);
      
      c.header('X-RateLimit-Limit', limit.toString());
      c.header('X-RateLimit-Remaining', remaining.toString());
      c.header('X-RateLimit-Reset', new Date(reset).toISOString());
      
      if (!success) {
        return c.json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests to sensitive endpoint'
          },
          meta: {
            retryAfter: Math.ceil((reset - Date.now()) / 1000)
          }
        }, 429);
      }
      
      await next();
    };
  }
  
  // Fallback to regular rate limiter in development
  return rateLimiter({ windowMs: 60000, max: 10 });
}