import type { Job } from 'bullmq';
import { createLogger } from './logger.js';
import { ERROR_TYPES, TIME } from '../config/constants.js';

interface RetryDecision {
  shouldRetry: boolean;
  delayMs?: number;
  reason?: string;
}

interface ErrorWithMetadata extends Error {
  errorType?: string;
  resetTime?: number;
  statusCode?: number;
}

export class RetryStrategy {
  private static readonly logger = createLogger('RetryStrategy');
  private static readonly MAX_RETRY_DELAY = TIME.DAY;
  private static readonly DEFAULT_RATE_LIMIT_DELAY = 15 * TIME.MINUTE;
  private static readonly BASE_BACKOFF_DELAY = 2 * TIME.SECOND;
  private static readonly MAX_BACKOFF_DELAY = 5 * TIME.MINUTE;
  
  static determineRetry(
    job: Job,
    error: ErrorWithMetadata
  ): RetryDecision {
    const attemptsMade = job.attemptsMade || 0;
    const maxAttempts = job.opts.attempts || 3;
    
    if (attemptsMade >= maxAttempts) {
      return {
        shouldRetry: false,
        reason: 'Max attempts reached'
      };
    }
    
    switch (error.errorType) {
      case ERROR_TYPES.RATE_LIMIT:
        return this.handleRateLimit(error);
        
      case ERROR_TYPES.AUTH_FAILED:
      case ERROR_TYPES.TOKEN_EXPIRED:
      case ERROR_TYPES.ACCOUNT_SUSPENDED:
        return {
          shouldRetry: false,
          reason: 'Authentication/Account issue - manual intervention required'
        };
        
      case ERROR_TYPES.NETWORK:
        return {
          shouldRetry: true,
          delayMs: this.calculateExponentialBackoff(attemptsMade),
          reason: 'Network error - will retry with backoff'
        };
        
      case ERROR_TYPES.VALIDATION:
      case ERROR_TYPES.CONTENT_POLICY_VIOLATION:
      case ERROR_TYPES.DUPLICATE_POST:
        return {
          shouldRetry: false,
          reason: 'Content issue - cannot be retried automatically'
        };
        
      case ERROR_TYPES.MEDIA_UPLOAD:
        return {
          shouldRetry: attemptsMade < 2,
          delayMs: this.calculateExponentialBackoff(attemptsMade),
          reason: 'Media upload failed - limited retry'
        };
        
      case ERROR_TYPES.PLATFORM_API:
        return this.handlePlatformApiError(error, attemptsMade);
        
      case ERROR_TYPES.QUOTA_EXCEEDED:
        return {
          shouldRetry: true,
          delayMs: TIME.HOUR,
          reason: 'Quota exceeded - retry in 1 hour'
        };
        
      default:
        return this.handleUnknownError(error, attemptsMade);
    }
  }
  
  private static handleRateLimit(
    error: ErrorWithMetadata
  ): RetryDecision {
    if (!error.resetTime) {
      this.logger.warn('Rate limit without reset time, using default delay');
      return {
        shouldRetry: true,
        delayMs: this.DEFAULT_RATE_LIMIT_DELAY,
        reason: 'Rate limit - using default 15 minute delay'
      };
    }
    
    const now = Date.now();
    const delayMs = Math.min(
      Math.max(error.resetTime - now, TIME.SECOND),
      this.MAX_RETRY_DELAY
    );
    
    const resetDate = new Date(error.resetTime).toISOString();
    
    return {
      shouldRetry: true,
      delayMs,
      reason: `Rate limit - waiting until ${resetDate}`
    };
  }
  
  private static handlePlatformApiError(
    error: ErrorWithMetadata,
    attemptsMade: number
  ): RetryDecision {
    if (error.statusCode && error.statusCode >= 500) {
      return {
        shouldRetry: true,
        delayMs: this.calculateExponentialBackoff(attemptsMade),
        reason: 'Platform server error - will retry'
      };
    }
    
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return {
        shouldRetry: false,
        reason: 'Platform client error - cannot retry'
      };
    }
    
    return {
      shouldRetry: attemptsMade < 2,
      delayMs: this.calculateExponentialBackoff(attemptsMade),
      reason: 'Platform API error - limited retry'
    };
  }
  
  private static handleUnknownError(
    error: ErrorWithMetadata,
    attemptsMade: number
  ): RetryDecision {
    this.logger.warn('Unknown error type encountered', {
      error: error.message,
      attemptsMade
    });
    
    return {
      shouldRetry: attemptsMade < 1,
      delayMs: this.calculateExponentialBackoff(attemptsMade),
      reason: 'Unknown error - single retry attempt'
    };
  }
  
  private static calculateExponentialBackoff(attempt: number): number {
    const exponentialDelay = Math.min(
      this.BASE_BACKOFF_DELAY * Math.pow(2, attempt),
      this.MAX_BACKOFF_DELAY
    );
    
    const jitter = Math.random() * TIME.SECOND;
    
    return exponentialDelay + jitter;
  }
  
  /**
   * Apply retry decision to a job
   */
  static async applyRetryDecision(
    job: Job,
    decision: RetryDecision
  ): Promise<void> {
    if (!decision.shouldRetry) {
      this.logger.info('Job will not be retried', {
        jobId: job.id,
        reason: decision.reason
      });
      return;
    }
    
    if (decision.delayMs) {
      this.logger.info('Job scheduled for retry', {
        jobId: job.id,
        delayMs: decision.delayMs,
        reason: decision.reason,
        nextAttempt: new Date(Date.now() + decision.delayMs).toISOString()
      });
      
      await job.moveToDelayed(Date.now() + decision.delayMs);
    } else {
      this.logger.info('Job will retry immediately', {
        jobId: job.id,
        reason: decision.reason
      });
    }
  }
}

/**
 * Calculate backoff with jitter for rate limiting
 */
export function calculateBackoffWithJitter(
  baseDelay: number,
  attempt: number,
  maxDelay: number = TIME.HOUR
): number {
  const exponentialDelay = Math.min(
    baseDelay * Math.pow(2, attempt),
    maxDelay
  );
  
  const jitterRange = exponentialDelay * 0.1;
  const jitter = Math.random() * jitterRange - jitterRange / 2;
  
  return Math.max(0, exponentialDelay + jitter);
}