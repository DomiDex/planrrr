---
id: TEST-WORKER-U005
priority: CRITICAL
type: UNIT
component: lib/retry-strategy.ts
dependencies: []
estimated_effort: 4 hours
---

# Test Task: Retry Strategy Logic

## Objective
Ensure the retry strategy correctly determines retry decisions based on error types, implements exponential backoff, and respects rate limits.

## Acceptance Criteria
- ✅ All error types have defined retry behaviors
- ✅ Exponential backoff calculation is accurate
- ✅ Rate limit retry delays are calculated correctly
- ✅ Max retry attempts are enforced
- ✅ Jitter is applied to prevent thundering herd

## Test Cases

### 1. Error Type Handling
```typescript
describe('RetryStrategy.determineRetry', () => {
  it('should not retry authentication failures', () => {
    const job = createJobFixture({ attemptsMade: 1 });
    const error = new AuthenticationError('FACEBOOK');
    
    const decision = RetryStrategy.determineRetry(job, error);
    
    expect(decision.shouldRetry).toBe(false);
    expect(decision.reason).toContain('manual intervention');
  });

  it('should retry network errors with backoff', () => {
    const job = createJobFixture({ attemptsMade: 1 });
    const error = new NetworkError('Connection timeout');
    
    const decision = RetryStrategy.determineRetry(job, error);
    
    expect(decision.shouldRetry).toBe(true);
    expect(decision.delayMs).toBeGreaterThan(0);
    expect(decision.reason).toContain('Network error');
  });

  it('should handle rate limits with proper delay', () => {
    const resetTime = Date.now() + 60000; // 1 minute
    const job = createJobFixture({ attemptsMade: 1 });
    const error = new RateLimitError('TWITTER', resetTime);
    
    const decision = RetryStrategy.determineRetry(job, error);
    
    expect(decision.shouldRetry).toBe(true);
    expect(decision.delayMs).toBeCloseTo(60000, -2);
  });
});
```

### 2. Exponential Backoff
```typescript
describe('Exponential Backoff Calculation', () => {
  it('should increase delay exponentially', () => {
    const delays = [0, 1, 2, 3].map(attempt => 
      RetryStrategy['calculateExponentialBackoff'](attempt)
    );
    
    expect(delays[1]).toBeGreaterThan(delays[0]);
    expect(delays[2]).toBeGreaterThan(delays[1] * 1.5);
    expect(delays[3]).toBeLessThanOrEqual(5 * 60 * 1000); // Max 5 minutes
  });

  it('should add jitter to prevent thundering herd', () => {
    const delays = Array.from({ length: 10 }, () => 
      RetryStrategy['calculateExponentialBackoff'](2)
    );
    
    const uniqueDelays = new Set(delays);
    expect(uniqueDelays.size).toBeGreaterThan(5); // Should have variance
  });
});
```

### 3. Max Attempts Enforcement
```typescript
describe('Max Attempts', () => {
  it('should stop retrying after max attempts', () => {
    const job = createJobFixture({ 
      attemptsMade: 3,
      opts: { attempts: 3 }
    });
    const error = new NetworkError('Timeout');
    
    const decision = RetryStrategy.determineRetry(job, error);
    
    expect(decision.shouldRetry).toBe(false);
    expect(decision.reason).toBe('Max attempts reached');
  });
});
```

### 4. Edge Cases
```typescript
describe('Edge Cases', () => {
  it('should handle missing resetTime for rate limits', () => {
    const job = createJobFixture();
    const error = new RateLimitError('FACEBOOK');
    
    const decision = RetryStrategy.determineRetry(job, error);
    
    expect(decision.shouldRetry).toBe(true);
    expect(decision.delayMs).toBe(15 * 60 * 1000); // Default 15 min
  });

  it('should handle unknown error types conservatively', () => {
    const job = createJobFixture({ attemptsMade: 0 });
    const error = new Error('Unknown error');
    
    const decision = RetryStrategy.determineRetry(job, error);
    
    expect(decision.shouldRetry).toBe(true);
    expect(decision.delayMs).toBeGreaterThan(0);
  });
});
```

## Test Data Requirements
- Mock Job fixtures with various attempt counts
- Error instances for each error type
- Time-based test data for rate limit scenarios

## Mocking Requirements
- `Date.now()` for consistent time-based tests
- Random number generator for jitter testing

## Environment Setup
```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-01'));
});

afterEach(() => {
  vi.useRealTimers();
});
```

## Success Metrics
- 100% branch coverage
- All edge cases handled
- Tests execute in < 100ms
- No flaky tests over 100 runs