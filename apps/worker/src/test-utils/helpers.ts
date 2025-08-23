import { vi, expect } from 'vitest';
import type { Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

// Test database helpers
export async function withTransaction<T>(
  fn: (tx: Record<string, unknown>) => Promise<T>
): Promise<T> {
  // Mock transaction that always rolls back
  const tx = {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    $rollback: vi.fn(),
  };
  
  try {
    const result = await fn(tx);
    await tx.$rollback();
    return result;
  } catch (error) {
    await tx.$rollback();
    throw error;
  }
}

// Redis test helpers
export function createTestRedis(): Redis {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: 15, // Test database
    keyPrefix: `test:${Date.now()}:`,
    lazyConnect: true,
  });
  
  return redis;
}

export async function cleanupRedis(redis: Redis): Promise<void> {
  const keys = await redis.keys('test:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Queue test helpers
export function createMockQueue(name: string): Partial<Queue> {
  return {
    name,
    add: vi.fn().mockResolvedValue({ id: '1', data: {} }),
    addBulk: vi.fn().mockResolvedValue([{ id: '1', data: {} }]),
    remove: vi.fn().mockResolvedValue(1),
    drain: vi.fn().mockResolvedValue(undefined),
    clean: vi.fn().mockResolvedValue([]),
    obliterate: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    isPaused: vi.fn().mockResolvedValue(false),
    getJobs: vi.fn().mockResolvedValue([]),
    getJob: vi.fn().mockResolvedValue(null),
    getJobCounts: vi.fn().mockResolvedValue({
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      waiting: 0,
    }),
  } as Partial<Queue>;
}

export function createMockJob(data: Record<string, unknown> = {}): Partial<Job> {
  return {
    id: '1',
    name: 'test-job',
    data,
    opts: {},
    progress: 0,
    attemptsMade: 0,
    failedReason: undefined,
    timestamp: Date.now(),
    processedOn: undefined,
    finishedOn: undefined,
    updateProgress: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
    moveToCompleted: vi.fn().mockResolvedValue(undefined),
    moveToFailed: vi.fn().mockResolvedValue(undefined),
    moveToDelayed: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn().mockResolvedValue(undefined),
    discard: vi.fn().mockResolvedValue(undefined),
    isCompleted: vi.fn().mockResolvedValue(false),
    isFailed: vi.fn().mockResolvedValue(false),
    isDelayed: vi.fn().mockResolvedValue(false),
    isActive: vi.fn().mockResolvedValue(false),
    isWaiting: vi.fn().mockResolvedValue(true),
  } as Partial<Job>;
}

export function createMockWorker(): Partial<Worker> {
  return {
    name: 'test-worker',
    run: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    isPaused: vi.fn().mockResolvedValue(false),
    isRunning: vi.fn().mockResolvedValue(true),
  } as Partial<Worker>;
}

// Time helpers
export function freezeTime(date: Date | string): void {
  const timestamp = typeof date === 'string' ? new Date(date) : date;
  vi.useFakeTimers();
  vi.setSystemTime(timestamp);
}

export function advanceTime(ms: number): void {
  vi.advanceTimersByTime(ms);
}

export function restoreTime(): void {
  vi.useRealTimers();
}

// Async helpers
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

export async function expectAsync(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeDefined();
  }
}

// Debug helpers
export function debugTest(name: string, data: unknown): void {
  if (process.env.DEBUG_TESTS) {
    console.log(`[TEST DEBUG] ${name}:`, JSON.stringify(data, null, 2));
  }
}

export function captureConsole() {
  const logs: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];
  
  const originalConsole = { ...console };
  
  console.log = vi.fn((...args) => logs.push(args.join(' ')));
  console.error = vi.fn((...args) => errors.push(args.join(' ')));
  console.warn = vi.fn((...args) => warns.push(args.join(' ')));
  
  return {
    logs,
    errors,
    warns,
    restore: () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
    },
  };
}

// Performance test helpers
export async function measurePerformance<T>(
  fn: () => Promise<T>,
  label: string = 'Operation'
): Promise<{ result: T; duration: number }> {
  const startTime = performance.now();
  const result = await fn();
  const duration = performance.now() - startTime;
  
  if (process.env.DEBUG_PERFORMANCE) {
    console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
  }
  
  return { result, duration };
}

export function expectPerformance(duration: number, maxMs: number): void {
  expect(duration).toBeLessThan(maxMs);
}

// Validation helpers
export function expectValidationError(fn: () => unknown, expectedMessage?: string): void {
  expect(fn).toThrow();
  if (expectedMessage) {
    expect(fn).toThrow(expectedMessage);
  }
}

export function expectToMatchSchema(data: unknown, schema: { safeParse: (data: unknown) => { success: boolean } }): void {
  const result = schema.safeParse(data);
  expect(result.success).toBe(true);
}

// Snapshot helpers
export function sanitizeSnapshot(data: unknown): unknown {
  const sanitized = JSON.parse(JSON.stringify(data));
  
  // Replace dynamic values
  const replaceValues = (obj: unknown): unknown => {
    if (!obj || typeof obj !== 'object') return obj;
    if (obj === null) return obj;
    
    const record = obj as Record<string, unknown>;
    for (const key in record) {
      if (key === 'id' || key.endsWith('Id')) {
        record[key] = '[ID]';
      } else if (key === 'createdAt' || key === 'updatedAt' || key.endsWith('At')) {
        record[key] = '[DATE]';
      } else if (key === 'token' || key.endsWith('Token')) {
        record[key] = '[TOKEN]';
      } else if (typeof record[key] === 'object' && record[key] !== null) {
        record[key] = replaceValues(record[key]);
      }
    }
    
    return record;
  };
  
  return replaceValues(sanitized);
}