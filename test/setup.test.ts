import { describe, it, expect } from 'vitest';
import { db, redis } from './setup';

describe('Test Infrastructure', () => {
  it('should have database connection', async () => {
    const result = await db.$queryRaw`SELECT 1 as test`;
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should have Redis connection', async () => {
    await redis.set('test-key', 'test-value');
    const value = await redis.get('test-key');
    expect(value).toBe('test-value');
  });

  it('should clean up Redis between tests', async () => {
    const value = await redis.get('test-key');
    expect(value).toBeNull();
  });

  it('should load test factories', async () => {
    const { createUserFixture, createPostFixture } = await import('./factories');
    
    const user = createUserFixture();
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    
    const post = createPostFixture();
    expect(post).toHaveProperty('id');
    expect(post).toHaveProperty('content');
  });
});