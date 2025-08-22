import '@testing-library/jest-dom';
import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import 'whatwg-fetch';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      pathname: '/',
      route: '/',
      query: {},
      asPath: '/',
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
  useParams() {
    return {};
  }
}));

// Mock environment variables
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';

// Setup MSW for API mocking
beforeAll(() => {
  // Set up any global test configuration
  console.log('🧪 Starting web app tests...');
});

afterAll(() => {
  // Clean up after all tests
  console.log('✅ Web app tests completed');
});

afterEach(() => {
  // Clean up React Testing Library
  cleanup();
  
  // Clear all mocks
  vi.clearAllMocks();
  
  // Reset modules if needed
  vi.resetModules();
});