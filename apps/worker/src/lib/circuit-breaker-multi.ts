import { createLogger } from './logger.js';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeout?: number;
  monitoringPeriod?: number;
  successThreshold?: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface ServiceState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  rejectedCount: number;
  lastFailureTime?: number;
  lastResetTime: number;
  windowStart: number;
}

interface ServiceMetrics {
  successCount: number;
  failureCount: number;
  rejectedCount: number;
  windowStart: number;
}

/**
 * Multi-service circuit breaker implementation
 * Supports managing circuit breakers for multiple services independently
 */
export class CircuitBreaker {
  private readonly logger = createLogger('CircuitBreaker');
  private readonly services = new Map<string, ServiceState>();
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      recoveryTimeout: options.recoveryTimeout ?? 60000, // 1 minute
      monitoringPeriod: options.monitoringPeriod ?? 300000, // 5 minutes
      successThreshold: options.successThreshold ?? 1,
    };
  }

  async execute<T>(serviceName: string, fn: () => Promise<T> | T): Promise<T> {
    const state = this.getServiceState(serviceName);
    this.checkMonitoringWindow(serviceName, state);

    // Check circuit state
    if (state.state === 'OPEN') {
      const now = Date.now();
      if (now < state.lastFailureTime! + this.options.recoveryTimeout) {
        state.rejectedCount++;
        throw new Error(`Circuit breaker is OPEN for service: ${serviceName}`);
      }
      // Move to half-open after recovery timeout
      state.state = 'HALF_OPEN';
      state.failureCount = 0;
      state.successCount = 0;
    }

    try {
      const result = await fn();
      this.onSuccess(serviceName, state);
      return result;
    } catch (error) {
      this.onFailure(serviceName, state);
      throw error;
    }
  }

  getState(serviceName: string): CircuitState {
    const state = this.getServiceState(serviceName);
    
    // Check if should transition from OPEN to HALF_OPEN
    if (state.state === 'OPEN') {
      const now = Date.now();
      if (now >= state.lastFailureTime! + this.options.recoveryTimeout) {
        state.state = 'HALF_OPEN';
        state.failureCount = 0;
        state.successCount = 0;
      }
    }
    
    return state.state;
  }

  getMetrics(serviceName: string): ServiceMetrics {
    const state = this.getServiceState(serviceName);
    this.checkMonitoringWindow(serviceName, state);
    
    return {
      successCount: state.successCount,
      failureCount: state.failureCount,
      rejectedCount: state.rejectedCount,
      windowStart: state.windowStart,
    };
  }

  reset(serviceName: string): void {
    const now = Date.now();
    this.services.set(serviceName, {
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      rejectedCount: 0,
      lastResetTime: now,
      windowStart: now,
    });
  }

  resetAll(): void {
    this.services.clear();
  }

  private getServiceState(serviceName: string): ServiceState {
    if (!this.services.has(serviceName)) {
      const now = Date.now();
      this.services.set(serviceName, {
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        rejectedCount: 0,
        lastResetTime: now,
        windowStart: now,
      });
    }
    return this.services.get(serviceName)!;
  }

  private checkMonitoringWindow(serviceName: string, state: ServiceState): void {
    const now = Date.now();
    
    // Reset metrics if monitoring period has passed
    if (now - state.windowStart > this.options.monitoringPeriod) {
      state.windowStart = now;
      state.successCount = 0;
      state.failureCount = 0;
      state.rejectedCount = 0;
      // Note: We don't reset the circuit state itself
    }
  }

  private onSuccess(serviceName: string, state: ServiceState): void {
    state.successCount++;

    if (state.state === 'HALF_OPEN') {
      // Successfully tested in half-open state, close the circuit
      if (state.successCount >= this.options.successThreshold) {
        state.state = 'CLOSED';
        state.failureCount = 0;
        this.logger.info(`Circuit closed for service: ${serviceName}`);
      }
    }
  }

  private onFailure(serviceName: string, state: ServiceState): void {
    state.failureCount++;
    state.lastFailureTime = Date.now();

    if (state.state === 'HALF_OPEN') {
      // Failed in half-open state, reopen the circuit
      state.state = 'OPEN';
      this.logger.warn(`Circuit reopened for service: ${serviceName}`);
    } else if (state.state === 'CLOSED' && state.failureCount >= this.options.failureThreshold) {
      // Threshold reached, open the circuit
      state.state = 'OPEN';
      this.logger.error(`Circuit opened for service: ${serviceName} after ${state.failureCount} failures`);
    }
  }
}