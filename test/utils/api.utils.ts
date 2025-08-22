import { faker } from '@faker-js/faker';
import type { User, Team } from '@repo/database';

export interface TestContext {
  user: User;
  team: Team;
  token: string;
}

/**
 * Create a mock authentication token
 */
export function createMockToken(userId: string): string {
  return Buffer.from(JSON.stringify({ 
    userId, 
    iat: Date.now(),
    exp: Date.now() + 3600000 
  })).toString('base64');
}

/**
 * Create authorization headers for testing
 */
export function createAuthHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Mock API request helper
 */
export class MockApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl = 'http://localhost:3000', token?: string) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      this.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  setToken(token: string) {
    this.headers['Authorization'] = `Bearer ${token}`;
  }

  async get(path: string, params?: Record<string, any>) {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    return fetch(url.toString(), {
      method: 'GET',
      headers: this.headers
    });
  }

  async post(path: string, body?: any) {
    return fetch(new URL(path, this.baseUrl).toString(), {
      method: 'POST',
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined
    });
  }

  async put(path: string, body?: any) {
    return fetch(new URL(path, this.baseUrl).toString(), {
      method: 'PUT',
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined
    });
  }

  async delete(path: string) {
    return fetch(new URL(path, this.baseUrl).toString(), {
      method: 'DELETE',
      headers: this.headers
    });
  }

  async patch(path: string, body?: any) {
    return fetch(new URL(path, this.baseUrl).toString(), {
      method: 'PATCH',
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined
    });
  }
}

/**
 * Create a mock request object for testing
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
  params?: Record<string, string>;
} = {}) {
  return {
    method: options.method || 'GET',
    url: options.url || '/',
    headers: options.headers || {},
    body: options.body,
    query: options.query || {},
    params: options.params || {}
  };
}

/**
 * Create a mock response object for testing
 */
export function createMockResponse() {
  const response: any = {
    status: 200,
    headers: {},
    body: null,
    statusCode: function(code: number) {
      this.status = code;
      return this;
    },
    setHeader: function(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
    json: function(data: any) {
      this.body = data;
      this.headers['Content-Type'] = 'application/json';
      return this;
    },
    send: function(data: any) {
      this.body = data;
      return this;
    },
    end: function() {
      return this;
    }
  };

  return response;
}

/**
 * Helper to test rate limiting
 */
export async function testRateLimit(
  client: MockApiClient,
  endpoint: string,
  limit: number
) {
  const requests = [];
  
  // Make requests up to the limit
  for (let i = 0; i < limit + 1; i++) {
    requests.push(client.get(endpoint));
  }
  
  const responses = await Promise.all(requests);
  
  // First 'limit' requests should succeed
  for (let i = 0; i < limit; i++) {
    if (responses[i].status === 429) {
      throw new Error(`Request ${i + 1} was rate limited, expected to succeed`);
    }
  }
  
  // Last request should be rate limited
  if (responses[limit].status !== 429) {
    throw new Error(`Request ${limit + 1} was not rate limited, expected 429 status`);
  }
  
  return true;
}

/**
 * Helper to validate API response structure
 */
export function validateApiResponse(response: any, schema: {
  success?: boolean;
  data?: any;
  error?: any;
  meta?: any;
}) {
  if (schema.success !== undefined) {
    expect(response).toHaveProperty('success', schema.success);
  }
  
  if (schema.data !== undefined) {
    expect(response).toHaveProperty('data');
    if (typeof schema.data === 'object') {
      Object.keys(schema.data).forEach(key => {
        expect(response.data).toHaveProperty(key);
      });
    }
  }
  
  if (schema.error !== undefined) {
    expect(response).toHaveProperty('error');
    if (schema.error) {
      expect(response.error).toHaveProperty('code');
      expect(response.error).toHaveProperty('message');
    }
  }
  
  if (schema.meta !== undefined) {
    expect(response).toHaveProperty('meta');
  }
}