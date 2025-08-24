import { logger } from '../lib/logger.js';
import type { Platform } from '@repo/database';

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  limit: number;
  window: number;
}

interface RateLimitConfig {
  limit: number;
  window: number; // in milliseconds
}

export class RateLimiter {
  private buckets = new Map<string, RateLimitBucket>();
  
  private readonly limits: Record<Platform, RateLimitConfig> = {
    FACEBOOK: { limit: 200, window: 3600000 }, // 200 per hour
    INSTAGRAM: { limit: 200, window: 3600000 }, // 200 per hour
    TWITTER: { limit: 300, window: 900000 }, // 300 per 15 minutes
    YOUTUBE: { limit: 10000, window: 86400000 }, // 10000 per day (quota points)
    LINKEDIN: { limit: 100, window: 86400000 }, // 100 per day
    TIKTOK: { limit: 200, window: 3600000 }, // 200 per hour (estimated)
  };

  constructor(customLimits?: Partial<Record<Platform, RateLimitConfig>>) {
    if (customLimits) {
      Object.assign(this.limits, customLimits);
    }
    
    // Initialize buckets for each platform
    for (const [platform, config] of Object.entries(this.limits)) {
      this.buckets.set(platform, {
        tokens: config.limit,
        lastRefill: Date.now(),
        ...config,
      });
    }
  }

  async acquire(platform: Platform, cost: number = 1): Promise<void> {
    const bucket = this.buckets.get(platform);
    
    if (!bucket) {
      logger.warn(`Unknown platform for rate limiting: ${platform}`);
      return; // Allow request for unknown platforms
    }

    this.refillTokens(bucket);

    if (bucket.tokens < cost) {
      const waitTime = this.getWaitTime(bucket);
      logger.warn(
        `Rate limit reached for ${platform}. Waiting ${waitTime}ms. ` +
        `Available: ${bucket.tokens}/${bucket.limit}`
      );
      
      await this.delay(waitTime);
      return this.acquire(platform, cost); // Retry after waiting
    }

    bucket.tokens -= cost;
    logger.debug(
      `Rate limit token consumed for ${platform}. ` +
      `Remaining: ${bucket.tokens}/${bucket.limit}`
    );
  }

  async acquireWithBackoff(
    platform: Platform,
    cost: number = 1,
    maxAttempts: number = 3
  ): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const bucket = this.buckets.get(platform);
      
      if (!bucket) {
        return true; // Allow for unknown platforms
      }

      this.refillTokens(bucket);

      if (bucket.tokens >= cost) {
        bucket.tokens -= cost;
        return true;
      }

      if (attempt < maxAttempts - 1) {
        const backoffTime = Math.min(
          1000 * Math.pow(2, attempt),
          this.getWaitTime(bucket)
        );
        
        logger.info(
          `Rate limit backoff for ${platform}. ` +
          `Attempt ${attempt + 1}/${maxAttempts}. Waiting ${backoffTime}ms`
        );
        
        await this.delay(backoffTime);
      }
    }

    logger.error(`Rate limit exceeded for ${platform} after ${maxAttempts} attempts`);
    return false;
  }

  getStatus(platform: Platform): {
    available: number;
    limit: number;
    resetIn: number;
    percentage: number;
  } | null {
    const bucket = this.buckets.get(platform);
    
    if (!bucket) {
      return null;
    }

    this.refillTokens(bucket);

    const resetIn = this.getResetTime(bucket);
    const percentage = (bucket.tokens / bucket.limit) * 100;

    return {
      available: bucket.tokens,
      limit: bucket.limit,
      resetIn,
      percentage: Math.round(percentage),
    };
  }

  getAllStatuses(): Map<Platform, ReturnType<typeof this.getStatus>> {
    const statuses = new Map<Platform, ReturnType<typeof this.getStatus>>();
    
    for (const platform of Object.keys(this.limits) as Platform[]) {
      statuses.set(platform, this.getStatus(platform));
    }
    
    return statuses;
  }

  reset(platform: Platform): void {
    const config = this.limits[platform];
    
    if (!config) {
      return;
    }

    this.buckets.set(platform, {
      tokens: config.limit,
      lastRefill: Date.now(),
      ...config,
    });
    
    logger.info(`Rate limit reset for ${platform}`);
  }

  resetAll(): void {
    for (const platform of Object.keys(this.limits) as Platform[]) {
      this.reset(platform);
    }
    
    logger.info('All rate limits reset');
  }

  updateLimit(platform: Platform, config: RateLimitConfig): void {
    this.limits[platform] = config;
    
    // Update or create bucket with new config
    const existingBucket = this.buckets.get(platform);
    
    if (existingBucket) {
      // Preserve current token count proportionally
      const ratio = existingBucket.tokens / existingBucket.limit;
      const newTokens = Math.floor(config.limit * ratio);
      
      this.buckets.set(platform, {
        tokens: newTokens,
        lastRefill: Date.now(),
        ...config,
      });
    } else {
      this.buckets.set(platform, {
        tokens: config.limit,
        lastRefill: Date.now(),
        ...config,
      });
    }
    
    logger.info(`Rate limit updated for ${platform}:`, config);
  }

  private refillTokens(bucket: RateLimitBucket): void {
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    
    if (timePassed >= bucket.window) {
      // Full refill if window has passed
      bucket.tokens = bucket.limit;
      bucket.lastRefill = now;
    } else {
      // Partial refill based on time passed
      const tokensToAdd = Math.floor(
        (timePassed / bucket.window) * bucket.limit
      );
      
      if (tokensToAdd > 0) {
        bucket.tokens = Math.min(bucket.limit, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
      }
    }
  }

  private getWaitTime(bucket: RateLimitBucket): number {
    const timeSinceRefill = Date.now() - bucket.lastRefill;
    const timeUntilNextToken = (bucket.window / bucket.limit) - timeSinceRefill;
    
    return Math.max(0, Math.ceil(timeUntilNextToken));
  }

  private getResetTime(bucket: RateLimitBucket): number {
    const timeSinceRefill = Date.now() - bucket.lastRefill;
    return Math.max(0, bucket.window - timeSinceRefill);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Platform-specific cost calculations
  getOperationCost(platform: Platform, operation: string): number {
    // YouTube uses quota points system
    if (platform === 'YOUTUBE') {
      const costs: Record<string, number> = {
        'video.upload': 1600,
        'thumbnail.set': 50,
        'video.update': 50,
        'video.list': 1,
      };
      
      return costs[operation] || 1;
    }

    // Other platforms use simple request counting
    return 1;
  }

  async checkLimit(platform: Platform, cost: number = 1): Promise<boolean> {
    const bucket = this.buckets.get(platform);
    
    if (!bucket) {
      return true;
    }

    this.refillTokens(bucket);
    return bucket.tokens >= cost;
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Export for testing
export default RateLimiter;