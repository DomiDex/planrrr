import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { handlers } from './handlers.js';

// Setup mock server with default handlers
export const mockServer = setupServer(...handlers);

// Helper to override handlers for specific tests
export function mockApiResponse(
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  response: unknown,
  status: number = 200
) {
  
  mockServer.use(
    http[method](url, () => {
      return HttpResponse.json(response as Record<string, unknown>, { status });
    })
  );
}

// Helper to simulate API errors
export function mockApiError(
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  error: { message: string; code?: string },
  status: number = 500
) {
  
  mockServer.use(
    http[method](url, () => {
      return HttpResponse.json(
        { error },
        { status }
      );
    })
  );
}

// Helper to simulate network failures
export function mockNetworkError(
  method: 'get' | 'post' | 'put' | 'delete',
  url: string
) {
  
  mockServer.use(
    http[method](url, () => {
      return HttpResponse.error();
    })
  );
}

// Helper to simulate rate limiting
export function mockRateLimit(
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  retryAfter: number = 60
) {
  
  mockServer.use(
    http[method](url, () => {
      return HttpResponse.json(
        {
          error: {
            message: 'Rate limit exceeded',
            code: 'RATE_LIMIT',
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Date.now() + retryAfter * 1000),
          },
        }
      );
    })
  );
}