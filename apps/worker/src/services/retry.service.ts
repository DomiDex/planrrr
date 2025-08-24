import { logger } from '../lib/logger.js';
import { APIError } from '../lib/errors.js';
import type { Platform } from '@repo/database';

export interface RetryOptions {
  maxAttempts?: number;
  backoff?: 'linear' | 'exponential' | 'fixed';
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  jitter?: boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

export class RetryService {
  private readonly defaultOptions: Required<RetryOptions> = {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 1000,
    maxDelay: 30000,
    factor: 2,
    jitter: true,
    onRetry: () => {},
  };

  async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    return this.execute(fn, options);
  }

  async execute<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
    context?: { platform?: Platform; operation?: string }
  ): Promise<T> {
    const config = { ...this.defaultOptions, ...options };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!this.isRetryable(error)) {
          logger.error(
            `Non-retryable error on attempt ${attempt}:`,
            { error, context }
          );
          throw error;
        }

        // Check if we've exhausted attempts
        if (attempt === config.maxAttempts) {
          logger.error(
            `Max retry attempts (${config.maxAttempts}) reached:`,
            { error, context }
          );
          throw error;
        }

        // Calculate delay
        const delay = this.calculateDelay(
          attempt,
          config,
          error as APIError
        );

        logger.warn(
          `Retry attempt ${attempt}/${config.maxAttempts} after ${delay}ms`,
          { error: lastError.message, context }
        );

        // Call retry callback
        config.onRetry(attempt, lastError);

        // Wait before retry
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  async executeWithCircuitBreaker<T>(
    fn: () => Promise<T>,
    circuitBreakerId: string,
    options: RetryOptions = {}
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(circuitBreakerId);
    
    if (breaker.state === 'open') {
      const timeSinceOpen = Date.now() - breaker.openedAt;
      
      if (timeSinceOpen < breaker.timeout) {
        throw new Error(
          `Circuit breaker is open for ${circuitBreakerId}. ` +
          `Retry in ${breaker.timeout - timeSinceOpen}ms`
        );
      }
      
      // Move to half-open state
      breaker.state = 'half-open';
    }

    try {
      const result = await this.execute(fn, options);
      
      // Success - reset circuit breaker
      if (breaker.state === 'half-open') {
        breaker.state = 'closed';
        breaker.failures = 0;
        logger.info(`Circuit breaker closed for ${circuitBreakerId}`);
      }
      
      return result;
    } catch (error) {
      // Increment failure count
      breaker.failures++;
      
      // Open circuit if threshold reached
      if (breaker.failures >= breaker.threshold) {
        breaker.state = 'open';
        breaker.openedAt = Date.now();
        logger.error(
          `Circuit breaker opened for ${circuitBreakerId} ` +
          `after ${breaker.failures} failures`
        );
      }
      
      throw error;
    }
  }

  private isRetryable(error: unknown): boolean {
    // API errors have explicit retry flag
    if (error instanceof APIError) {
      return error.retryable;
    }

    // Network errors are retryable
    if (error instanceof Error) {
      const retryableCodes = [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ECONNRESET',
        'EPIPE',
        'ENOTFOUND',
      ];
      
      if ('code' in error && retryableCodes.includes(error.code as string)) {
        return true;
      }

      // Check for specific error messages
      const message = error.message.toLowerCase();
      const retryableMessages = [
        'network',
        'timeout',
        'temporarily',
        'unavailable',
        'try again',
      ];
      
      return retryableMessages.some(msg => message.includes(msg));
    }

    return false;
  }

  private calculateDelay(
    attempt: number,
    config: Required<RetryOptions>,
    error?: APIError
  ): number {
    let delay: number;

    // Use retry-after header if available
    if (error?.retryAfter) {
      const retryAfter = error.retryAfter;
      
      // If it's a timestamp
      if (retryAfter > 1000000000) {
        delay = Math.max(0, retryAfter - Math.floor(Date.now() / 1000));
      } else {
        delay = retryAfter * 1000;
      }
      
      return Math.min(delay, config.maxDelay);
    }

    // Calculate base delay
    switch (config.backoff) {
      case 'linear':
        delay = config.initialDelay * attempt;
        break;
      
      case 'exponential':
        delay = config.initialDelay * Math.pow(config.factor, attempt - 1);
        break;
      
      case 'fixed':
      default:
        delay = config.initialDelay;
        break;
    }

    // Apply max delay limit
    delay = Math.min(delay, config.maxDelay);

    // Add jitter to prevent thundering herd
    if (config.jitter) {
      const jitterAmount = delay * 0.2; // 20% jitter
      delay += Math.random() * jitterAmount - jitterAmount / 2;
    }

    return Math.round(Math.max(0, delay));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Circuit breaker management
  private circuitBreakers = new Map<string, {
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    threshold: number;
    timeout: number;
    openedAt: number;
  }>();

  private getCircuitBreaker(id: string) {
    if (!this.circuitBreakers.has(id)) {
      this.circuitBreakers.set(id, {
        state: 'closed',
        failures: 0,
        threshold: 5,
        timeout: 60000, // 1 minute
        openedAt: 0,
      });
    }
    
    return this.circuitBreakers.get(id)!;
  }

  resetCircuitBreaker(id: string): void {
    const breaker = this.circuitBreakers.get(id);
    
    if (breaker) {
      breaker.state = 'closed';
      breaker.failures = 0;
      logger.info(`Circuit breaker reset for ${id}`);
    }
  }

  getCircuitBreakerStatus(id: string): {
    state: string;
    failures: number;
    timeUntilClose?: number;
  } | null {
    const breaker = this.circuitBreakers.get(id);
    
    if (!breaker) {
      return null;
    }

    const status: {
      state: string;
      failures: number;
      timeUntilClose?: number;
    } = {
      state: breaker.state,
      failures: breaker.failures,
    };

    if (breaker.state === 'open') {
      const timeSinceOpen = Date.now() - breaker.openedAt;
      status.timeUntilClose = Math.max(0, breaker.timeout - timeSinceOpen);
    }

    return status;
  }

  // Platform-specific retry configurations
  getRetryOptionsForPlatform(platform: Platform): RetryOptions {
    const platformConfigs: Record<Platform, RetryOptions> = {
      FACEBOOK: {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelay: 2000,
        maxDelay: 30000,
      },
      INSTAGRAM: {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelay: 2000,
        maxDelay: 30000,
      },
      TWITTER: {
        maxAttempts: 4,
        backoff: 'exponential',
        initialDelay: 1000,
        maxDelay: 15000,
      },
      YOUTUBE: {
        maxAttempts: 5,
        backoff: 'exponential',
        initialDelay: 5000,
        maxDelay: 60000,
      },
      LINKEDIN: {
        maxAttempts: 3,
        backoff: 'linear',
        initialDelay: 3000,
        maxDelay: 30000,
      },
      TIKTOK: {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelay: 2000,
        maxDelay: 30000,
      },
    };

    return platformConfigs[platform] || this.defaultOptions;
  }

  // Batch retry for multiple operations
  async executeBatch<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions = {}
  ): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
    const results = await Promise.allSettled(
      operations.map(op => this.execute(op, options))
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return { success: true, result: result.value };
      } else {
        return { success: false, error: result.reason };
      }
    });
  }
}

// Singleton instance
export const retryService = new RetryService();

export default RetryService;