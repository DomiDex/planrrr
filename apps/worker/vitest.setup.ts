import { beforeAll, afterAll, beforeEach, afterEach, vi, expect } from 'vitest';
import { config } from 'dotenv';
import { mockServer } from './src/test-utils/mocks/server.js';

// Load test environment
config({ path: '.env.test' });

// Set test environment variables if not already set
process.env.NODE_ENV = 'test';
process.env.SENTRY_DSN = process.env.SENTRY_DSN || '';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/planrrr_test';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';

// Setup mock server for external API calls
beforeAll(() => {
  mockServer.listen({ onUnhandledRequest: 'error' });
});

afterAll(() => {
  mockServer.close();
});

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  
  // Reset mock server handlers
  mockServer.resetHandlers();
  
  // Mock console methods to reduce noise in test output
  global.console = {
    ...console,
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };
});

afterEach(() => {
  // Clear all timers after each test
  vi.useRealTimers();
  
  // Restore console
  vi.restoreAllMocks();
});

// Global test helpers
global.createMockDate = (dateString: string) => new Date(dateString);
global.expectToBeWithinRange = (actual: number, expected: number, range: number) => {
  expect(actual).toBeGreaterThanOrEqual(expected - range);
  expect(actual).toBeLessThanOrEqual(expected + range);
};

// Extend global namespace for TypeScript
declare global {
  var createMockDate: (dateString: string) => Date;
  var expectToBeWithinRange: (actual: number, expected: number, range: number) => void;
}