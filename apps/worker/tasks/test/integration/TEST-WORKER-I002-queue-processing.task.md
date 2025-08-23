---
id: TEST-WORKER-I002
priority: CRITICAL
type: INTEGRATION
component: Queue Processing System
dependencies: [TEST-WORKER-U005, TEST-WORKER-U006]
estimated_effort: 6 hours
---

# Test Task: BullMQ Queue Processing Integration

## Objective
Verify end-to-end queue processing including job creation, processing, retry logic, and failure handling with real Redis connection.

## Acceptance Criteria
- ✅ Jobs are processed in correct order
- ✅ Failed jobs are retried according to strategy
- ✅ Rate limits are respected
- ✅ Circuit breakers prevent cascading failures
- ✅ Concurrent job processing works correctly
- ✅ Job progress is tracked accurately

## Test Setup

### Docker Compose for Test Redis
```yaml
version: '3.8'
services:
  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

## Test Cases

### 1. Basic Queue Processing
```typescript
describe('Queue Processing Integration', () => {
  let queue: Queue;
  let worker: Worker;
  let redis: Redis;
  
  beforeAll(async () => {
    redis = new Redis({
      host: 'localhost',
      port: 6380,
      db: 1 // Use separate DB for tests
    });
    
    queue = new Queue('test-publish', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 100 }
      }
    });
    
    worker = new Worker('test-publish', processPublishJob, {
      connection: redis,
      concurrency: 2
    });
  });
  
  afterAll(async () => {
    await worker.close();
    await queue.close();
    await redis.quit();
  });

  it('should process job successfully', async () => {
    const jobData = {
      postId: 'post-123',
      platform: 'FACEBOOK',
      connectionId: 'conn-456'
    };
    
    const job = await queue.add('publish', jobData);
    
    await waitForJobCompletion(job);
    
    const completedJob = await Job.fromId(queue, job.id!);
    expect(completedJob?.finishedOn).toBeDefined();
    expect(completedJob?.returnvalue).toMatchObject({
      success: true,
      externalId: expect.any(String)
    });
  });

  it('should handle concurrent jobs', async () => {
    const jobs = await Promise.all(
      Array.from({ length: 5 }, (_, i) => 
        queue.add('publish', {
          postId: `post-${i}`,
          platform: 'TWITTER',
          connectionId: 'conn-789'
        })
      )
    );
    
    const results = await Promise.all(
      jobs.map(job => waitForJobCompletion(job))
    );
    
    expect(results.every(r => r.success)).toBe(true);
    
    // Verify concurrency (max 2 active)
    const activeCount = await queue.getActiveCount();
    expect(activeCount).toBeLessThanOrEqual(2);
  });
});
```

### 2. Retry Logic Integration
```typescript
describe('Retry Logic with Queue', () => {
  it('should retry failed jobs with exponential backoff', async () => {
    let attemptCount = 0;
    
    const failingWorker = new Worker(
      'test-retry',
      async (job) => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new NetworkError('Connection failed');
        }
        return { success: true };
      },
      { connection: redis }
    );
    
    const job = await queue.add('retry-test', { data: 'test' });
    
    await waitForJobCompletion(job);
    
    expect(attemptCount).toBe(3);
    
    // Verify backoff delays
    const logs = await queue.getJobLogs(job.id!);
    const delays = extractDelaysFromLogs(logs);
    expect(delays[1]).toBeGreaterThan(delays[0]);
    
    await failingWorker.close();
  });

  it('should not retry non-retryable errors', async () => {
    let attemptCount = 0;
    
    const worker = new Worker(
      'test-no-retry',
      async () => {
        attemptCount++;
        throw new ValidationError('FACEBOOK', 'Invalid content');
      },
      { connection: redis }
    );
    
    const job = await queue.add('no-retry-test', { data: 'test' });
    
    await waitForJobFailure(job);
    
    expect(attemptCount).toBe(1); // No retries
    
    const failedJob = await Job.fromId(queue, job.id!);
    expect(failedJob?.failedReason).toContain('Invalid content');
    
    await worker.close();
  });
});
```

### 3. Rate Limit Handling
```typescript
describe('Rate Limit Integration', () => {
  it('should delay jobs when rate limited', async () => {
    const worker = new Worker(
      'test-rate-limit',
      async (job) => {
        if (job.attemptsMade === 0) {
          const resetTime = Date.now() + 5000;
          throw new RateLimitError('TWITTER', resetTime);
        }
        return { success: true };
      },
      { connection: redis }
    );
    
    const startTime = Date.now();
    const job = await queue.add('rate-limit-test', {});
    
    await waitForJobCompletion(job);
    
    const duration = Date.now() - startTime;
    expect(duration).toBeGreaterThan(4900);
    expect(duration).toBeLessThan(6000);
    
    await worker.close();
  });
});
```

### 4. Circuit Breaker Integration
```typescript
describe('Circuit Breaker with Queue', () => {
  it('should stop processing when circuit opens', async () => {
    const breaker = getCircuitBreaker('FACEBOOK', {
      failureThreshold: 2,
      resetTimeout: 1000
    });
    
    const worker = new Worker(
      'test-circuit',
      async (job) => {
        return breaker.execute(async () => {
          if (job.data.shouldFail) {
            throw new Error('API Error');
          }
          return { success: true };
        });
      },
      { connection: redis }
    );
    
    // Trigger circuit opening
    await queue.add('circuit-test', { shouldFail: true });
    await queue.add('circuit-test', { shouldFail: true });
    
    await sleep(100);
    
    // This should fail immediately due to open circuit
    const job = await queue.add('circuit-test', { shouldFail: false });
    await waitForJobFailure(job);
    
    const failedJob = await Job.fromId(queue, job.id!);
    expect(failedJob?.failedReason).toContain('Circuit breaker');
    
    await worker.close();
  });
});
```

### 5. Job Progress Tracking
```typescript
describe('Job Progress', () => {
  it('should track job progress accurately', async () => {
    const progressUpdates: number[] = [];
    
    const worker = new Worker(
      'test-progress',
      async (job) => {
        await job.updateProgress(0);
        await sleep(100);
        await job.updateProgress(25);
        await sleep(100);
        await job.updateProgress(50);
        await sleep(100);
        await job.updateProgress(75);
        await sleep(100);
        await job.updateProgress(100);
        return { success: true };
      },
      { connection: redis }
    );
    
    const job = await queue.add('progress-test', {});
    
    job.on('progress', (progress) => {
      progressUpdates.push(progress as number);
    });
    
    await waitForJobCompletion(job);
    
    expect(progressUpdates).toEqual([0, 25, 50, 75, 100]);
    
    await worker.close();
  });
});
```

### 6. Stalled Job Recovery
```typescript
describe('Stalled Job Recovery', () => {
  it('should recover stalled jobs', async () => {
    const worker = new Worker(
      'test-stalled',
      async (job) => {
        if (job.attemptsMade === 0) {
          // Simulate worker crash
          process.exit(1);
        }
        return { success: true };
      },
      {
        connection: redis,
        stalledInterval: 100,
        maxStalledCount: 1
      }
    );
    
    const job = await queue.add('stalled-test', {});
    
    // Wait for job to be marked as stalled
    await sleep(200);
    
    // New worker should pick it up
    const recoveryWorker = new Worker(
      'test-stalled',
      async () => ({ success: true }),
      { connection: redis }
    );
    
    await waitForJobCompletion(job);
    
    const completedJob = await Job.fromId(queue, job.id!);
    expect(completedJob?.attemptsMade).toBeGreaterThan(0);
    
    await recoveryWorker.close();
  });
});
```

## Test Utilities
```typescript
async function waitForJobCompletion(
  job: Job,
  timeout = 10000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Job completion timeout'));
    }, timeout);
    
    job.waitUntilFinished(
      new QueueEvents(job.queue.name, { connection: redis })
    ).then(result => {
      clearTimeout(timer);
      resolve(result);
    }).catch(reject);
  });
}

async function waitForJobFailure(job: Job, timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Job failure timeout'));
    }, timeout);
    
    const checkInterval = setInterval(async () => {
      const currentJob = await Job.fromId(job.queue, job.id!);
      if (currentJob?.failedReason) {
        clearInterval(checkInterval);
        clearTimeout(timer);
        resolve();
      }
    }, 100);
  });
}
```

## Environment Requirements
- Docker or local Redis instance
- Separate test database
- Test timeout: 30 seconds per test

## Success Metrics
- All queue operations tested
- Retry scenarios validated
- Circuit breaker integration verified
- No orphaned jobs in Redis after tests
- Tests complete in < 30 seconds total