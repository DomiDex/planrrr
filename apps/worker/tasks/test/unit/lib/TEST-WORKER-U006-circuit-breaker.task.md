---
id: TEST-WORKER-U006
priority: HIGH
type: UNIT
component: lib/circuit-breaker.ts
dependencies: []
estimated_effort: 3 hours
---

# Test Task: Circuit Breaker Pattern

## Objective
Verify circuit breaker correctly transitions between states (CLOSED, OPEN, HALF_OPEN), tracks failures, and prevents cascading failures.

## Acceptance Criteria
- ✅ State transitions follow circuit breaker pattern
- ✅ Failure threshold triggers circuit opening
- ✅ Success threshold closes circuit from half-open
- ✅ Reset timeout is respected
- ✅ Statistics are accurately tracked

## Test Cases

### 1. State Transitions
```typescript
describe('CircuitBreaker State Transitions', () => {
  let breaker: CircuitBreaker;
  
  beforeEach(() => {
    breaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      resetTimeout: 1000,
      successThreshold: 2
    });
  });

  it('should start in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should open after failure threshold', async () => {
    const failingFn = vi.fn().mockRejectedValue(new Error('fail'));
    
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failingFn)).rejects.toThrow();
    }
    
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('should transition to HALF_OPEN after timeout', async () => {
    // Open the circuit
    await openCircuit(breaker);
    
    // Fast forward past reset timeout
    vi.advanceTimersByTime(1001);
    
    const successFn = vi.fn().mockResolvedValue('success');
    await breaker.execute(successFn);
    
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
  });

  it('should close from HALF_OPEN after success threshold', async () => {
    // Get to HALF_OPEN state
    await transitionToHalfOpen(breaker);
    
    const successFn = vi.fn().mockResolvedValue('success');
    
    // Need 2 successes to close
    await breaker.execute(successFn);
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
    
    await breaker.execute(successFn);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });
});
```

### 2. Circuit Open Behavior
```typescript
describe('Circuit Open Behavior', () => {
  it('should reject calls when open', async () => {
    const breaker = new CircuitBreaker('test', {
      failureThreshold: 1,
      resetTimeout: 60000
    });
    
    await openCircuit(breaker);
    
    const fn = vi.fn();
    await expect(breaker.execute(fn))
      .rejects.toThrow(CircuitOpenError);
    
    expect(fn).not.toHaveBeenCalled();
  });

  it('should provide wait time in error', async () => {
    const breaker = new CircuitBreaker('test', {
      failureThreshold: 1,
      resetTimeout: 5000
    });
    
    await openCircuit(breaker);
    
    try {
      await breaker.execute(() => Promise.resolve());
    } catch (error) {
      expect(error).toBeInstanceOf(CircuitOpenError);
      expect(error.waitTime).toBeGreaterThan(0);
      expect(error.waitTime).toBeLessThanOrEqual(5000);
    }
  });
});
```

### 3. Statistics Tracking
```typescript
describe('Statistics', () => {
  it('should track success and failure counts', async () => {
    const breaker = new CircuitBreaker('test');
    
    await breaker.execute(() => Promise.resolve());
    await breaker.execute(() => Promise.resolve());
    await expect(breaker.execute(() => Promise.reject(new Error())))
      .rejects.toThrow();
    
    const stats = breaker.getStats();
    expect(stats.totalSuccesses).toBe(2);
    expect(stats.totalFailures).toBe(1);
    expect(stats.totalRequests).toBe(3);
  });

  it('should track last failure time', async () => {
    const breaker = new CircuitBreaker('test');
    const now = new Date();
    vi.setSystemTime(now);
    
    await expect(breaker.execute(() => Promise.reject(new Error())))
      .rejects.toThrow();
    
    const stats = breaker.getStats();
    expect(stats.lastFailureTime).toEqual(now);
  });
});
```

### 4. Manual Reset
```typescript
describe('Manual Reset', () => {
  it('should reset all state and counters', async () => {
    const breaker = new CircuitBreaker('test');
    
    // Generate some history
    await openCircuit(breaker);
    
    breaker.reset();
    
    const stats = breaker.getStats();
    expect(stats.state).toBe(CircuitState.CLOSED);
    expect(stats.failureCount).toBe(0);
    expect(stats.successCount).toBe(0);
    expect(stats.nextAttempt).toBeUndefined();
  });
});
```

### 5. Registry Management
```typescript
describe('Circuit Breaker Registry', () => {
  beforeEach(() => {
    resetAllCircuitBreakers();
  });

  it('should reuse breakers for same platform', () => {
    const breaker1 = getCircuitBreaker('FACEBOOK');
    const breaker2 = getCircuitBreaker('FACEBOOK');
    
    expect(breaker1).toBe(breaker2);
  });

  it('should create different breakers for different platforms', () => {
    const facebook = getCircuitBreaker('FACEBOOK');
    const twitter = getCircuitBreaker('TWITTER');
    
    expect(facebook).not.toBe(twitter);
  });

  it('should get all circuit breaker stats', async () => {
    const facebook = getCircuitBreaker('FACEBOOK');
    const twitter = getCircuitBreaker('TWITTER');
    
    await facebook.execute(() => Promise.resolve());
    await twitter.execute(() => Promise.resolve());
    
    const allStats = getAllCircuitBreakerStats();
    
    expect(allStats.size).toBe(2);
    expect(allStats.get('FACEBOOK')?.totalSuccesses).toBe(1);
    expect(allStats.get('TWITTER')?.totalSuccesses).toBe(1);
  });
});
```

## Test Helpers
```typescript
async function openCircuit(breaker: CircuitBreaker): Promise<void> {
  const failingFn = () => Promise.reject(new Error('test'));
  for (let i = 0; i < 5; i++) {
    try {
      await breaker.execute(failingFn);
    } catch {
      // Expected
    }
  }
}

async function transitionToHalfOpen(breaker: CircuitBreaker): Promise<void> {
  await openCircuit(breaker);
  vi.advanceTimersByTime(60001);
  await breaker.execute(() => Promise.resolve());
}
```

## Environment Setup
```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  resetAllCircuitBreakers();
});
```

## Success Metrics
- 100% state transition coverage
- All timing scenarios tested
- Tests complete in < 50ms each
- Clear error messages for debugging