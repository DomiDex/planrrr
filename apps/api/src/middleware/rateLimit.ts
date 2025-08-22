// Package: @repo/api
// Path: apps/api/src/middleware/rateLimit.ts
// Dependencies: @upstash/ratelimit, @upstash/redis, winston

import { Context, Next } from 'hono';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from '../lib/logger.js';

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
    // Check for internal API key bypass FIRST
    const apiKey = c.req.header('X-API-Key');
    if (apiKey === process.env.INTERNAL_API_KEY) {
      c.set('rateLimitBypassed', true);
      logger.debug('Rate limit bypassed for internal API call');
      return next();
    }
    
    // Check for authenticated user
    const user = c.get('user');
    const identifier = user?.id 
      ? `user:${user.id}`
      : c.req.header('x-forwarded-for') || 
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
          const retryAfter = Math.ceil((reset - Date.now()) / 1000);
          
          // Structured logging for rate limit event
          logger.warn('Rate limit exceeded', {
            identifier,
            endpoint: c.req.path,
            method: c.req.method,
            limit,
            retryAfter,
            userAgent: c.req.header('user-agent')
          });
          
          c.header('Retry-After', retryAfter.toString());
          
          return c.json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests, please try again later'
            },
            meta: {
              retryAfter,
              limit,
              remaining: 0
            }
          }, 429);
        }
        
        // Log warning if approaching limit
        if (remaining < limit * 0.2) {
          logger.info('Rate limit warning', {
            identifier,
            endpoint: c.req.path,
            remaining,
            limit,
            percentageUsed: Math.round(((limit - remaining) / limit) * 100)
          });
        }
        
        // Store rate limit info in context
        c.set('rateLimit', {
          limit,
          remaining,
          reset: new Date(reset),
          identifier
        });
      } catch (error) {
        logger.error('Rate limiting error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          identifier,
          endpoint: c.req.path
        });
        // Continue on error - don't block requests due to rate limiter failure
        c.set('rateLimitError', true);
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
      analytics: true,
      prefix: 'rl:strict'
    });
    
    return async (c: Context, next: Next) => {
      // Check for internal API key bypass
      const apiKey = c.req.header('X-API-Key');
      if (apiKey === process.env.INTERNAL_API_KEY) {
        c.set('rateLimitBypassed', true);
        return next();
      }
      
      const user = c.get('user');
      const identifier = user?.id 
        ? `user:${user.id}`
        : c.req.header('x-forwarded-for') || 
          c.req.header('x-real-ip') || 
          'anonymous';
      
      const { success, limit, reset, remaining } = await strictLimit.limit(identifier);
      
      c.header('X-RateLimit-Limit', limit.toString());
      c.header('X-RateLimit-Remaining', remaining.toString());
      c.header('X-RateLimit-Reset', new Date(reset).toISOString());
      
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        
        logger.warn('Strict rate limit exceeded', {
          identifier,
          endpoint: c.req.path,
          method: c.req.method,
          limit,
          retryAfter
        });
        
        c.header('Retry-After', retryAfter.toString());
        
        return c.json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests to sensitive endpoint'
          },
          meta: {
            retryAfter,
            limit,
            remaining: 0
          }
        }, 429);
      }
      
      c.set('rateLimit', {
        limit,
        remaining,
        reset: new Date(reset),
        identifier
      });
      
      await next();
    };
  }
  
  // Fallback to regular rate limiter in development
  return rateLimiter({ windowMs: 60000, max: 10 });
}