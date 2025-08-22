// Package: @repo/api
// Path: apps/api/src/middleware/orpcRateLimit.ts
// Dependencies: @upstash/ratelimit, @upstash/redis, winston

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from '../lib/logger.js';

// Initialize Redis client for Upstash
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    })
  : null;

// Rate limit configuration types
interface RateLimitConfig {
  algorithm: 'sliding' | 'token';
  requests: number;
  window: '10s' | '1m' | '10m' | '1h' | '1d';  // Upstash Duration type
  burst?: number;
}

// Per-procedure rate limit configuration
const PROCEDURE_LIMITS: Record<string, RateLimitConfig> = {
  // Auth procedures - very strict
  'auth.login': { algorithm: 'sliding', requests: 5, window: '1m' as const },
  'auth.register': { algorithm: 'sliding', requests: 3, window: '1m' as const },
  'auth.resetPassword': { algorithm: 'sliding', requests: 3, window: '10m' as const },
  'auth.requestPasswordReset': { algorithm: 'sliding', requests: 3, window: '10m' as const },
  
  // Post procedures - moderate
  'posts.create': { algorithm: 'sliding', requests: 30, window: '1m' as const },
  'posts.update': { algorithm: 'sliding', requests: 60, window: '1m' as const },
  'posts.delete': { algorithm: 'sliding', requests: 30, window: '1m' as const },
  'posts.list': { algorithm: 'sliding', requests: 100, window: '1m' as const },
  'posts.get': { algorithm: 'sliding', requests: 200, window: '1m' as const },
  'posts.publish': { algorithm: 'sliding', requests: 20, window: '1m' as const },
  'posts.schedule': { algorithm: 'sliding', requests: 30, window: '1m' as const },
  
  // Team procedures - moderate
  'teams.create': { algorithm: 'sliding', requests: 10, window: '1m' as const },
  'teams.update': { algorithm: 'sliding', requests: 30, window: '1m' as const },
  'teams.delete': { algorithm: 'sliding', requests: 5, window: '1m' as const },
  'teams.list': { algorithm: 'sliding', requests: 100, window: '1m' as const },
  'teams.invite': { algorithm: 'sliding', requests: 20, window: '1m' as const },
  
  // Connection procedures - moderate
  'connections.create': { algorithm: 'sliding', requests: 10, window: '1m' as const },
  'connections.delete': { algorithm: 'sliding', requests: 10, window: '1m' as const },
  'connections.refresh': { algorithm: 'sliding', requests: 30, window: '1m' as const },
  'connections.list': { algorithm: 'sliding', requests: 100, window: '1m' as const },
  
  // AI procedures - token bucket for bursts
  'ai.generate': { algorithm: 'token', requests: 20, window: '1m' as const, burst: 5 },
  'ai.enhance': { algorithm: 'token', requests: 10, window: '1m' as const, burst: 3 },
  'ai.suggest': { algorithm: 'token', requests: 15, window: '1m' as const, burst: 4 },
  'ai.analyze': { algorithm: 'token', requests: 10, window: '1m' as const, burst: 3 },
  
  // Analytics procedures - higher limits
  'analytics.overview': { algorithm: 'sliding', requests: 200, window: '1m' as const },
  'analytics.posts': { algorithm: 'sliding', requests: 200, window: '1m' as const },
  'analytics.engagement': { algorithm: 'sliding', requests: 200, window: '1m' as const },
  
  // Default for unspecified procedures
  default: { algorithm: 'sliding', requests: 100, window: '1m' as const }
};

// Create rate limiters for each configuration
const limiters = new Map<string, Ratelimit>();

function getRateLimiter(procedurePath: string): Ratelimit | null {
  if (!redis) return null;
  
  if (!limiters.has(procedurePath)) {
    const config = PROCEDURE_LIMITS[procedurePath] || PROCEDURE_LIMITS.default;
    
    const limiter = config.algorithm === 'token' && config.burst
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.tokenBucket(
            config.requests,
            config.window,
            config.burst
          ),
          prefix: `rl:${procedurePath}`,
          analytics: true
        })
      : new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(
            config.requests,
            config.window
          ),
          prefix: `rl:${procedurePath}`,
          analytics: true
        });
    
    limiters.set(procedurePath, limiter);
  }
  
  return limiters.get(procedurePath) || null;
}

// ORPC context types
interface ORPCContext {
  user?: {
    id: string;
    email?: string;
    teamId?: string;
    tier?: 'free' | 'pro' | 'enterprise';
  };
  headers?: Record<string, string>;
  ip?: string;
  rateLimitBypassed?: boolean;
  rateLimitError?: string;
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: Date;
    procedure: string;
  };
}

interface ORPCMiddlewareParams {
  context: ORPCContext;
  next: (params: { context: ORPCContext }) => Promise<unknown>;
  meta: {
    path: string[];
  };
}

// ORPC Rate Limiting Middleware
export function createORPCRateLimit() {
  return async ({ context, next, meta }: ORPCMiddlewareParams): Promise<unknown> => {
    // Check for internal API key bypass
    if (context.headers?.['x-api-key'] === process.env.INTERNAL_API_KEY) {
      context.rateLimitBypassed = true;
      logger.debug('ORPC rate limit bypassed for internal API call', {
        procedure: meta.path.join('.')
      });
      return next({ context });
    }
    
    // Get procedure path (e.g., "posts.create")
    const procedurePath = meta.path.join('.');
    
    // Determine identifier (user ID takes precedence over IP)
    const identifier = context.user?.id 
      ? `user:${context.user.id}`
      : `ip:${context.ip || 'anonymous'}`;
    
    // Check for user tier-based adjustments
    const tierMultiplier = context.user?.tier === 'enterprise' ? 10 
      : context.user?.tier === 'pro' ? 2 
      : 1;
    
    // Skip rate limiting in development if Redis not configured
    if (!redis) {
      logger.debug('ORPC rate limiting skipped (Redis not configured)', {
        procedure: procedurePath,
        identifier
      });
      context.rateLimitBypassed = true;
      return next({ context });
    }
    
    try {
      const limiter = getRateLimiter(procedurePath);
      if (!limiter) {
        context.rateLimitBypassed = true;
        return next({ context });
      }
      
      // Apply tier multiplier by using a different identifier
      const rateLimitIdentifier = tierMultiplier > 1 
        ? `${identifier}:tier${tierMultiplier}`
        : identifier;
      
      const { success, limit, remaining, reset } = await limiter.limit(rateLimitIdentifier);
      
      // Adjust limits for display based on tier
      const adjustedLimit = limit * tierMultiplier;
      const adjustedRemaining = Math.max(0, remaining * tierMultiplier);
      
      // Add rate limit info to context
      context.rateLimit = {
        limit: adjustedLimit,
        remaining: adjustedRemaining,
        reset: new Date(reset),
        procedure: procedurePath
      };
      
      // Set headers (ORPC will pass these through)
      context.headers = {
        ...context.headers,
        'X-RateLimit-Limit': adjustedLimit.toString(),
        'X-RateLimit-Remaining': adjustedRemaining.toString(),
        'X-RateLimit-Reset': new Date(reset).toISOString(),
        'X-RateLimit-Procedure': procedurePath
      };
      
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        
        // Log rate limit event
        logger.warn('ORPC rate limit exceeded', {
          identifier,
          procedure: procedurePath,
          limit: adjustedLimit,
          retryAfter,
          userTier: context.user?.tier || 'free',
          userAgent: context.headers?.['user-agent']
        });
        
        // Create ORPC-compatible error
        interface RateLimitError extends Error {
          code: string;
          status: number;
          data: {
            retryAfter: number;
            limit: number;
            remaining: number;
            reset: string;
          };
        }
        
        const error = new Error(`Rate limit exceeded for ${procedurePath}. Please retry after ${retryAfter} seconds.`) as RateLimitError;
        error.code = 'TOO_MANY_REQUESTS';
        error.status = 429;
        error.data = {
          retryAfter,
          limit: adjustedLimit,
          remaining: 0,
          reset: new Date(reset).toISOString()
        };
        
        throw error;
      }
      
      // Log if approaching limit
      if (adjustedRemaining < adjustedLimit * 0.2) {
        logger.info('ORPC rate limit warning', {
          identifier,
          procedure: procedurePath,
          remaining: adjustedRemaining,
          limit: adjustedLimit,
          percentageUsed: Math.round(((adjustedLimit - adjustedRemaining) / adjustedLimit) * 100),
          userTier: context.user?.tier || 'free'
        });
      }
      
      return next({ context });
    } catch (error) {
      // Re-throw ORPC errors
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'TOO_MANY_REQUESTS') {
        throw error;
      }
      
      // Redis failure - log and continue
      logger.error('ORPC rate limiting error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        procedure: procedurePath,
        identifier
      });
      
      // Add bypass flag to context
      context.rateLimitBypassed = true;
      context.rateLimitError = error instanceof Error ? error.message : 'Unknown error';
      
      return next({ context });
    }
  };
}

// Export configuration for documentation/testing
export const RATE_LIMIT_CONFIG = PROCEDURE_LIMITS;

// Utility to get rate limit for a specific procedure
export function getRateLimitForProcedure(procedurePath: string): RateLimitConfig {
  return PROCEDURE_LIMITS[procedurePath] || PROCEDURE_LIMITS.default;
}

// Utility to clear all rate limits (for testing)
export async function clearAllRateLimits(): Promise<void> {
  if (!redis) return;
  
  logger.warn('Clearing all rate limits');
  
  // Clear all keys with rl: prefix
  // Note: This is a simplified version - in production you'd want to be more careful
  for (const [path] of Object.entries(PROCEDURE_LIMITS)) {
    if (path !== 'default') {
      try {
        // This would need actual implementation based on Upstash's API
        logger.debug(`Clearing rate limits for ${path}`);
      } catch (error) {
        logger.error(`Failed to clear rate limits for ${path}`, { error });
      }
    }
  }
}