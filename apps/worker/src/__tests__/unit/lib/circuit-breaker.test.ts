import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker } from '../../../lib/circuit-breaker-multi.js';
import { freezeTime, advanceTime, restoreTime } from '../../../test-utils/index.js';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let mockFunction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    freezeTime('2024-03-15T10:00:00Z');
    
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
    });

    mockFunction = vi.fn();
  });

  afterEach(() => {
    restoreTime();
    vi.clearAllMocks();
  });

  describe('closed state', () => {
    it('should execute function successfully when closed', async () => {
      mockFunction.mockResolvedValue('success');

      const result = await circuitBreaker.execute('test-service', mockFunction);

      expect(result).toBe('success');
      expect(mockFunction).toHaveBeenCalledOnce();
      expect(circuitBreaker.getState('test-service')).toBe('CLOSED');
    });

    it('should track successful calls', async () => {
      mockFunction.mockResolvedValue('success');

      await circuitBreaker.execute('test-service', mockFunction);
      await circuitBreaker.execute('test-service', mockFunction);
      await circuitBreaker.execute('test-service', mockFunction);

      const metrics = circuitBreaker.getMetrics('test-service');
      expect(metrics.successCount).toBe(3);
      expect(metrics.failureCount).toBe(0);
    });

    it('should track failed calls', async () => {
      mockFunction.mockRejectedValue(new Error('failure'));

      try {
        await circuitBreaker.execute('test-service', mockFunction);
      } catch (_error) {
        // Expected
      }

      const metrics = circuitBreaker.getMetrics('test-service');
      expect(metrics.successCount).toBe(0);
      expect(metrics.failureCount).toBe(1);
    });
  });

  describe('open state', () => {
    it('should open circuit after reaching failure threshold', async () => {
      mockFunction.mockRejectedValue(new Error('failure'));

      // Fail 3 times to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute('test-service', mockFunction);
        } catch (_error) {
          // Expected
        }
      }

      expect(circuitBreaker.getState('test-service')).toBe('OPEN');
    });

    it('should reject calls immediately when open', async () => {
      // Open the circuit
      mockFunction.mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute('test-service', mockFunction);
        } catch (_error) {
          // Expected
        }
      }

      // Reset mock
      mockFunction.mockClear();
      mockFunction.mockResolvedValue('success');

      // Try to execute when open
      await expect(
        circuitBreaker.execute('test-service', mockFunction)
      ).rejects.toThrow('Circuit breaker is OPEN');

      expect(mockFunction).not.toHaveBeenCalled();
    });

    it('should track rejection metrics when open', async () => {
      // Open the circuit
      mockFunction.mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute('test-service', mockFunction);
        } catch (_error) {
          // Expected
        }
      }

      // Try calls when open
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute('test-service', mockFunction);
        } catch (_error) {
          // Expected
        }
      }

      const metrics = circuitBreaker.getMetrics('test-service');
      expect(metrics.rejectedCount).toBe(5);
    });
  });

  describe('half-open state', () => {
    it('should transition to half-open after recovery timeout', async () => {
      // Open the circuit
      mockFunction.mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute('test-service', mockFunction);
        } catch (_error) {
          // Expected
        }
      }

      expect(circuitBreaker.getState('test-service')).toBe('OPEN');

      // Advance time past recovery timeout
      advanceTime(61000); // 61 seconds

      expect(circuitBreaker.getState('test-service')).toBe('HALF_OPEN');
    });

    it('should allow one test call in half-open state', async () => {
      // Open the circuit
      mockFunction.mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute('test-service', mockFunction);
        } catch (_error) {
          // Expected
        }
      }

      // Advance to half-open
      advanceTime(61000);
      
      // Reset mock for success
      mockFunction.mockClear();
      mockFunction.mockResolvedValue('success');

      const result = await circuitBreaker.execute('test-service', mockFunction);

      expect(result).toBe('success');
      expect(mockFunction).toHaveBeenCalledOnce();
    });

    it('should close circuit on successful test call', async () => {
      // Open the circuit
      mockFunction.mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute('test-service', mockFunction);
        } catch (_error) {
          // Expected
        }
      }

      // Advance to half-open
      advanceTime(61000);
      
      // Successful test call
      mockFunction.mockResolvedValue('success');
      await circuitBreaker.execute('test-service', mockFunction);

      expect(circuitBreaker.getState('test-service')).toBe('CLOSED');
    });

    it('should reopen circuit on failed test call', async () => {
      // Open the circuit
      mockFunction.mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute('test-service', mockFunction);
        } catch (_error) {
          // Expected
        }
      }

      // Advance to half-open
      advanceTime(61000);
      
      // Failed test call
      try {
        await circuitBreaker.execute('test-service', mockFunction);
      } catch (_error) {
        // Expected
      }

      expect(circuitBreaker.getState('test-service')).toBe('OPEN');
    });
  });

  describe('configuration', () => {
    it('should respect custom failure threshold', async () => {
      const customBreaker = new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 60000,
      });

      mockFunction.mockRejectedValue(new Error('failure'));

      // Fail 4 times - should still be closed
      for (let i = 0; i < 4; i++) {
        try {
          await customBreaker.execute('test-service', mockFunction);
        } catch (_error) {
          // Expected
        }
      }

      expect(customBreaker.getState('test-service')).toBe('CLOSED');

      // 5th failure should open
      try {
        await customBreaker.execute('test-service', mockFunction);
      } catch (_error) {
        // Expected
      }

      expect(customBreaker.getState('test-service')).toBe('OPEN');
    });

    it('should respect custom recovery timeout', async () => {
      const customBreaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 30000, // 30 seconds
      });

      mockFunction.mockRejectedValue(new Error('failure'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await customBreaker.execute('test-service', mockFunction);
        } catch (_error) {
          // Expected
        }
      }

      expect(customBreaker.getState('test-service')).toBe('OPEN');

      // Advance 29 seconds - should still be open
      advanceTime(29000);
      expect(customBreaker.getState('test-service')).toBe('OPEN');

      // Advance 2 more seconds - should be half-open
      advanceTime(2000);
      expect(customBreaker.getState('test-service')).toBe('HALF_OPEN');
    });
  });

  describe('monitoring period', () => {
    it('should reset metrics after monitoring period', async () => {
      mockFunction.mockRejectedValue(new Error('failure'));

      // Add some failures
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute('test-service', mockFunction);
        } catch (_error) {
          // Expected
        }
      }

      const metricsBefore = circuitBreaker.getMetrics('test-service');
      expect(metricsBefore.failureCount).toBe(2);

      // Advance past monitoring period
      advanceTime(301000); // 5 minutes + 1 second

      const metricsAfter = circuitBreaker.getMetrics('test-service');
      expect(metricsAfter.failureCount).toBe(0);
      expect(metricsAfter.windowStart).toBeGreaterThan(metricsBefore.windowStart);
    });

    it('should maintain circuit state across metric resets', async () => {
      mockFunction.mockRejectedValue(new Error('failure'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute('test-service', mockFunction);
        } catch (_error) {
          // Expected
        }
      }

      expect(circuitBreaker.getState('test-service')).toBe('OPEN');

      // Advance past monitoring period
      advanceTime(301000);

      // Circuit should still be open
      expect(circuitBreaker.getState('test-service')).toBe('OPEN');
    });
  });

  describe('multiple services', () => {
    it('should track services independently', async () => {
      const service1Fn = vi.fn().mockResolvedValue('success1');
      const service2Fn = vi.fn().mockRejectedValue(new Error('failure'));

      // Service 1 succeeds
      await circuitBreaker.execute('service1', service1Fn);

      // Service 2 fails
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute('service2', service2Fn);
        } catch (_error) {
          // Expected
        }
      }

      expect(circuitBreaker.getState('service1')).toBe('CLOSED');
      expect(circuitBreaker.getState('service2')).toBe('OPEN');
    });
  });

  describe('reset functionality', () => {
    it('should reset circuit to closed state', async () => {
      mockFunction.mockRejectedValue(new Error('failure'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute('test-service', mockFunction);
        } catch (_error) {
          // Expected
        }
      }

      expect(circuitBreaker.getState('test-service')).toBe('OPEN');

      // Reset the circuit
      circuitBreaker.reset('test-service');

      expect(circuitBreaker.getState('test-service')).toBe('CLOSED');
      
      const metrics = circuitBreaker.getMetrics('test-service');
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
    });

    it('should reset all circuits', async () => {
      mockFunction.mockRejectedValue(new Error('failure'));

      // Open multiple circuits
      for (const service of ['service1', 'service2', 'service3']) {
        for (let i = 0; i < 3; i++) {
          try {
            await circuitBreaker.execute(service, mockFunction);
          } catch (_error) {
            // Expected
          }
        }
      }

      // Reset all
      circuitBreaker.resetAll();

      expect(circuitBreaker.getState('service1')).toBe('CLOSED');
      expect(circuitBreaker.getState('service2')).toBe('CLOSED');
      expect(circuitBreaker.getState('service3')).toBe('CLOSED');
    });
  });

  describe('error handling', () => {
    it('should handle different error types', async () => {
      const errors = [
        new Error('Standard error'),
        new TypeError('Type error'),
        { message: 'Object error' },
        'String error',
        null,
        undefined,
      ];

      for (const error of errors) {
        mockFunction.mockRejectedValue(error);
        
        try {
          await circuitBreaker.execute(`service-${error}`, mockFunction);
        } catch (_e) {
          // Expected
        }
      }

      // All should have been tracked as failures
      for (const error of errors) {
        const metrics = circuitBreaker.getMetrics(`service-${error}`);
        expect(metrics.failureCount).toBe(1);
      }
    });
  });
});