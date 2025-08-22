import { describe, it, expect } from 'vitest';
import { createUserFixture, createPostFixture, createTeamFixture } from './factories';

describe('Test Infrastructure Verification', () => {
  describe('Factory Functions', () => {
    it('should create a user fixture', () => {
      const user = createUserFixture();
      
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
      expect(user.name).toBeDefined();
      expect(user.role).toBe('MEMBER');
    });

    it('should create a team fixture', () => {
      const team = createTeamFixture();
      
      expect(team).toBeDefined();
      expect(team.id).toBeDefined();
      expect(team.name).toBeDefined();
      expect(team.slug).toBeDefined();
      expect(team.plan).toBe('free');
    });

    it('should create a post fixture', () => {
      const post = createPostFixture();
      
      expect(post).toBeDefined();
      expect(post.id).toBeDefined();
      expect(post.content).toBeDefined();
      expect(post.platforms).toBeInstanceOf(Array);
      expect(post.platforms.length).toBeGreaterThan(0);
    });

    it('should allow overriding fixture properties', () => {
      const customEmail = 'test@example.com';
      const user = createUserFixture({ email: customEmail });
      
      expect(user.email).toBe(customEmail);
    });
  });

  describe('Basic Test Infrastructure', () => {
    it('should run basic assertions', () => {
      expect(true).toBe(true);
      expect(1 + 1).toBe(2);
      expect('hello').toContain('ell');
    });

    it('should handle async operations', async () => {
      const promise = Promise.resolve('success');
      const result = await promise;
      expect(result).toBe('success');
    });

    it('should work with arrays', () => {
      const items = [1, 2, 3, 4, 5];
      expect(items).toHaveLength(5);
      expect(items).toContain(3);
      expect(items[0]).toBe(1);
    });

    it('should work with objects', () => {
      const obj = { name: 'test', value: 42 };
      expect(obj).toHaveProperty('name');
      expect(obj.name).toBe('test');
      expect(obj.value).toBe(42);
    });
  });
});