import { createLogger } from './logger.js';
import { TIME } from '../config/constants.js';

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  successThreshold: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  nextAttempt?: Date;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private readonly logger = createLogger('CircuitBreaker');
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: Date;
  private successCount = 0;
  private nextAttempt?: Date;
  
  // Metrics
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  
  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions = {
      failureThreshold: 5,
      resetTimeout: TIME.MINUTE,
      monitoringPeriod: TIME.MINUTE,
      successThreshold: 2
    }
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;
    
    if (this.state === CircuitState.OPEN) {
      if (this.canAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        const waitTime = this.getWaitTime();
        const error = new CircuitOpenError(
          this.name,
          waitTime,
          this.nextAttempt
        );
        this.logger.warn('Circuit breaker is OPEN', {
          name: this.name,
          waitTime,
          nextAttempt: this.nextAttempt
        });
        throw error;
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.successCount = 0;
    this.logger.info('Circuit breaker entering HALF_OPEN state', {
      name: this.name
    });
  }
  
  private onSuccess(): void {
    this.totalSuccesses++;
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        this.nextAttempt = undefined;
        this.logger.info('Circuit breaker is now CLOSED', {
          name: this.name,
          successCount: this.successCount
        });
      }
    }
  }
  
  private onFailure(): void {
    this.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.openCircuit();
      return;
    }
    
    if (this.failureCount >= this.options.failureThreshold) {
      this.openCircuit();
    }
  }
  
  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.options.resetTimeout);
    this.successCount = 0;
    
    this.logger.warn('Circuit breaker opened', {
      name: this.name,
      failureCount: this.failureCount,
      nextAttempt: this.nextAttempt
    });
  }
  
  private canAttemptReset(): boolean {
    return !!this.nextAttempt && new Date() >= this.nextAttempt;
  }
  
  private getWaitTime(): number {
    if (!this.nextAttempt) return 0;
    return Math.max(0, this.nextAttempt.getTime() - Date.now());
  }
  
  getState(): CircuitState {
    return this.state;
  }
  
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses
    };
  }
  
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = undefined;
    this.lastFailureTime = undefined;
    
    this.logger.info('Circuit breaker manually reset', {
      name: this.name
    });
  }
}

/**
 * Circuit breaker error class
 */
export class CircuitOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly waitTime: number,
    public readonly nextAttempt?: Date
  ) {
    super(
      `Circuit breaker '${circuitName}' is OPEN. ` +
      `Wait ${Math.ceil(waitTime / 1000)}s before retry.`
    );
    this.name = 'CircuitOpenError';
  }
}

/**
 * Platform-specific circuit breakers registry
 */
const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(
  platform: string,
  options?: Partial<CircuitBreakerOptions>
): CircuitBreaker {
  const key = platform.toUpperCase();
  
  if (!circuitBreakers.has(key)) {
    const breaker = new CircuitBreaker(key, {
      failureThreshold: 5,
      resetTimeout: TIME.MINUTE,
      monitoringPeriod: TIME.MINUTE,
      successThreshold: 2,
      ...options
    });
    circuitBreakers.set(key, breaker);
  }
  
  return circuitBreakers.get(key)!;
}

/**
 * Get all circuit breakers stats
 */
export function getAllCircuitBreakerStats(): Map<string, CircuitBreakerStats> {
  const stats = new Map<string, CircuitBreakerStats>();
  
  circuitBreakers.forEach((breaker, name) => {
    stats.set(name, breaker.getStats());
  });
  
  return stats;
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  circuitBreakers.forEach(breaker => breaker.reset());
}