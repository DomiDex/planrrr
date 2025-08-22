import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@repo/database';
import Redis from 'ioredis';

// Test database client
export const testDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://planrrr:localdev123@localhost:5432/planrrr_test'
    }
  },
  log: process.env.DEBUG === 'true' ? ['query', 'error', 'warn'] : ['error']
});

// Test Redis client
export const testRedis = new Redis({
  host: process.env.TEST_REDIS_HOST || 'localhost',
  port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
  password: process.env.TEST_REDIS_PASSWORD || 'localdev123',
  db: parseInt(process.env.TEST_REDIS_DB || '2'), // Different DB for worker tests
  lazyConnect: true
});

// Mock BullMQ for testing
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
    close: vi.fn(),
    obliterate: vi.fn()
  })),
  Worker: vi.fn().mockImplementation(() => ({
    run: vi.fn(),
    close: vi.fn(),
    on: vi.fn()
  })),
  QueueEvents: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn()
  }))
}));

beforeAll(async () => {
  try {
    console.log('🚀 Starting worker tests...');
    
    // Connect to test database
    await testDb.$connect();
    console.log('✅ Connected to test database');
    
    // Connect to Redis
    await testRedis.connect();
    console.log('✅ Connected to test Redis');
    
    // Clear Redis test database
    await testRedis.flushdb();
  } catch (error) {
    console.error('❌ Worker test setup failed:', error);
    throw error;
  }
});

afterAll(async () => {
  try {
    console.log('🧹 Cleaning up worker tests...');
    await testDb.$disconnect();
    await testRedis.quit();
    console.log('✅ Worker tests completed');
  } catch (error) {
    console.error('❌ Worker test teardown failed:', error);
  }
});

beforeEach(async () => {
  // Clear specific Redis patterns used by worker
  const keys = await testRedis.keys('bull:*');
  if (keys.length > 0) {
    await testRedis.del(...keys);
  }
  
  // Reset all mocks
  vi.clearAllMocks();
});

afterEach(async () => {
  // Clean up any test data
  const tablenames = ['Publication', 'Post', 'Connection'];
  
  for (const table of tablenames) {
    try {
      await testDb.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
    } catch (error) {
      // Table might not exist in test DB
      console.warn(`Could not truncate ${table}:`, error);
    }
  }
  
  // Clear Redis
  await testRedis.flushdb();
});

// Export utilities
export { testDb as db, testRedis as redis };