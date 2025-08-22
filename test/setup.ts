import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
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
  db: parseInt(process.env.TEST_REDIS_DB || '1'),
  lazyConnect: true
});

// Global setup
beforeAll(async () => {
  try {
    // Connect to test database
    await testDb.$connect();
    console.log('✅ Connected to test database');
    
    // Connect to Redis
    await testRedis.connect();
    console.log('✅ Connected to test Redis');
    
    // Clear Redis test database
    await testRedis.flushdb();
  } catch (error) {
    console.error('❌ Test setup failed:', error);
    throw error;
  }
});

// Global teardown
afterAll(async () => {
  try {
    await testDb.$disconnect();
    await testRedis.quit();
  } catch (error) {
    console.error('❌ Test teardown failed:', error);
  }
});

// Test isolation
beforeEach(async () => {
  // For PostgreSQL, we'll use transactions for test isolation
  // Note: This requires proper transaction handling in tests
  if (process.env.TEST_ISOLATION === 'transaction') {
    await testDb.$executeRaw`BEGIN`;
  }
});

afterEach(async () => {
  // Rollback transaction for test isolation
  if (process.env.TEST_ISOLATION === 'transaction') {
    await testDb.$executeRaw`ROLLBACK`;
  } else {
    // Alternative: Clean up specific tables
    // This is safer but slower
    const tablenames = await testDb.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables 
      WHERE schemaname='public' 
      AND tablename NOT LIKE '_prisma%'
    `;
    
    for (const { tablename } of tablenames) {
      await testDb.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
    }
  }
  
  // Clear Redis keys
  await testRedis.flushdb();
});

// Helper to reset sequences
export async function resetSequences() {
  const sequences = await testDb.$queryRaw<Array<{ relname: string }>>`
    SELECT c.relname 
    FROM pg_class c 
    WHERE c.relkind = 'S'
  `;
  
  for (const { relname } of sequences) {
    await testDb.$executeRawUnsafe(`ALTER SEQUENCE "${relname}" RESTART WITH 1`);
  }
}

// Export test utilities
export { testDb as db, testRedis as redis };