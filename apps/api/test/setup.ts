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
  db: parseInt(process.env.TEST_REDIS_DB || '3'), // Different DB for API tests
  lazyConnect: true
});

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.API_KEY_SECRET = 'test-secret-key';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';

beforeAll(async () => {
  try {
    console.log('🔌 Starting API tests...');
    
    // Connect to test database
    await testDb.$connect();
    console.log('✅ Connected to test database');
    
    // Connect to Redis
    await testRedis.connect();
    console.log('✅ Connected to test Redis');
    
    // Clear Redis test database
    await testRedis.flushdb();
  } catch (error) {
    console.error('❌ API test setup failed:', error);
    throw error;
  }
});

afterAll(async () => {
  try {
    console.log('🧹 Cleaning up API tests...');
    await testDb.$disconnect();
    await testRedis.quit();
    console.log('✅ API tests completed');
  } catch (error) {
    console.error('❌ API test teardown failed:', error);
  }
});

beforeEach(async () => {
  // Clear rate limiting keys
  const keys = await testRedis.keys('rate-limit:*');
  if (keys.length > 0) {
    await testRedis.del(...keys);
  }
  
  // Reset all mocks
  vi.clearAllMocks();
});

afterEach(async () => {
  // Clean up test data
  const tablenames = ['Publication', 'Post', 'Connection', 'User', 'Team'];
  
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

// Helper to create authenticated context
export function createAuthContext(userId: string, teamId: string) {
  return {
    user: { id: userId, teamId },
    session: { userId, teamId },
    db: testDb,
    redis: testRedis
  };
}

// Export utilities
export { testDb as db, testRedis as redis };