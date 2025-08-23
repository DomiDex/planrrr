# Worker Service Test Suites Compilation

## Table of Contents
1. [Test Configuration](#test-configuration)
2. [Test Utilities](#test-utilities)
3. [Unit Tests](#unit-tests)
4. [CI/CD Pipeline](#cicd-pipeline)

---

## Test Configuration

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '*.config.ts',
        '*.config.js',
        '**/*.d.ts',
        '**/*.types.ts',
        'test/**',
        '**/test-utils/**',
        '**/__tests__/**',
        'coverage/**'
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 85,
        statements: 85
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    isolate: true,
    pool: 'threads'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/test-utils': resolve(__dirname, './src/test-utils'),
      '@test': resolve(__dirname, './src/test-utils'),
      '@repo/database': resolve(__dirname, '../../packages/database'),
      '@repo/shared': resolve(__dirname, '../../packages/shared'),
      '@repo/redis': resolve(__dirname, '../../packages/redis')
    }
  }
});
```

### vitest.setup.ts
```typescript
import { beforeAll, afterAll, beforeEach, afterEach, vi, expect } from 'vitest';
import { config } from 'dotenv';
import { mockServer } from './src/test-utils/mocks/server.js';

// Load test environment
config({ path: '.env.test' });

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
```

---

## Test Utilities

### src/test-utils/fixtures.ts
```typescript
import { faker } from '@faker-js/faker';
import type { 
  Post, 
  User, 
  Team, 
  Connection,
  Publication,
  PostStatus,
  Platform,
  ConnectionStatus,
  PublicationStatus
} from '@repo/database';

faker.seed(12345); // Deterministic tests

export const fixtures = {
  user: (overrides?: Partial<User>): User => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    image: faker.image.avatar(),
    emailVerified: true,
    password: null,
    role: 'MEMBER',
    twoFactorEnabled: false,
    twoFactorSecret: null,
    teamId: faker.string.uuid(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  } as User),

  team: (overrides?: Partial<Team>): Team => ({
    id: faker.string.uuid(),
    name: faker.company.name(),
    slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
    logo: null,
    website: null,
    bio: null,
    plan: 'free',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    trialEndsAt: null,
    settings: {},
    postsPublished: 0,
    teamMemberLimit: 5,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  } as Team),

  post: (overrides?: Partial<Post>): Post => ({
    id: faker.string.uuid(),
    teamId: faker.string.uuid(),
    userId: faker.string.uuid(),
    content: faker.lorem.paragraph(),
    mediaUrls: faker.helpers.maybe(() => [faker.image.url()], { probability: 0.3 }) || [],
    platforms: ['FACEBOOK', 'TWITTER'] as Platform[],
    hashtags: [],
    aiGenerated: false,
    aiPrompt: null,
    aiModel: null,
    status: 'DRAFT' as PostStatus,
    scheduledAt: null,
    publishedAt: null,
    metadata: {},
    externalId: null,
    externalUrl: null,
    failureReason: null,
    failedAt: null,
    retryCount: 0,
    lastRetryAt: null,
    nextRetryAt: null,
    threadId: null,
    replyToId: null,
    templateId: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  } as Post),

  scheduledPost: (scheduledAt?: Date): Post => 
    fixtures.post({
      status: 'SCHEDULED' as PostStatus,
      scheduledAt: scheduledAt || faker.date.future(),
    }),

  publishedPost: (): Post =>
    fixtures.post({
      status: 'PUBLISHED' as PostStatus,
      publishedAt: faker.date.recent(),
      scheduledAt: faker.date.past(),
    }),

  connection: (platform: Platform, overrides?: Partial<Connection>): Connection => ({
    id: faker.string.uuid(),
    teamId: faker.string.uuid(),
    platform,
    accountName: faker.company.name(),
    accountId: faker.string.alphanumeric(15),
    accessToken: `mock_${platform.toLowerCase()}_token_${faker.string.alphanumeric(20)}`,
    refreshToken: faker.helpers.maybe(() => `mock_refresh_${faker.string.alphanumeric(20)}`) || null,
    expiresAt: faker.date.future(),
    status: 'ACTIVE' as ConnectionStatus,
    metadata: {},
    lastUsedAt: faker.date.recent(),
    errorCount: 0,
    lastErrorAt: null,
    lastErrorMessage: null,
    postsPublished: 0,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  } as Connection),

  publication: (overrides?: Partial<Publication>): Publication => ({
    id: faker.string.uuid(),
    postId: faker.string.uuid(),
    platform: faker.helpers.arrayElement(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE'] as Platform[]),
    externalId: faker.string.alphanumeric(20),
    status: 'PUBLISHED' as PublicationStatus,
    publishedAt: faker.date.recent(),
    error: null,
    retryCount: 0,
    url: faker.internet.url(),
    editUrl: null,
    metadata: {},
    engagementLikes: 0,
    engagementComments: 0,
    engagementShares: 0,
    engagementViews: 0,
    engagementClicks: 0,
    engagementReach: 0,
    engagementImpressions: 0,
    engagementSaves: 0,
    lastSyncAt: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  } as Publication),

  // Platform-specific content generators
  twitterContent: (): string => 
    faker.lorem.sentence().substring(0, 280),

  facebookContent: (): string => 
    faker.lorem.paragraphs(3),

  instagramContent: (): string => {
    const content = faker.lorem.paragraph();
    const hashtags = faker.helpers.multiple(
      () => `#${faker.word.noun()}`,
      { count: { min: 3, max: 10 } }
    );
    return `${content}\n\n${hashtags.join(' ')}`;
  },

  youtubeContent: (): { title: string; description: string } => ({
    title: faker.lorem.sentence().substring(0, 100),
    description: faker.lorem.paragraphs(2).substring(0, 5000),
  }),

  // Job data fixtures
  publishJobData: (postId?: string, platform?: Platform) => ({
    postId: postId || faker.string.uuid(),
    platform: platform || faker.helpers.arrayElement(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE'] as Platform[]),
    retryCount: 0,
    scheduledFor: faker.date.future().toISOString(),
  }),

  // Error fixtures
  apiError: (code: string = 'API_ERROR') => ({
    code,
    message: faker.lorem.sentence(),
    statusCode: faker.helpers.arrayElement([400, 401, 403, 404, 429, 500]),
    details: {
      timestamp: new Date().toISOString(),
      requestId: faker.string.uuid(),
    },
  }),

  rateLimitError: () => ({
    code: 'RATE_LIMIT',
    message: 'Too many requests',
    statusCode: 429,
    retryAfter: faker.number.int({ min: 60, max: 3600 }),
  }),
};

// Batch fixture generators
export const generateBatch = {
  posts: (count: number, teamId?: string): Post[] =>
    Array.from({ length: count }, () => 
      fixtures.post({ teamId: teamId || faker.string.uuid() })
    ),

  scheduledPosts: (count: number, startDate: Date, endDate: Date): Post[] => {
    const posts: Post[] = [];
    for (let i = 0; i < count; i++) {
      const scheduledAt = faker.date.between({ from: startDate, to: endDate });
      posts.push(fixtures.scheduledPost(scheduledAt));
    }
    return posts.sort((a, b) => 
      (a.scheduledAt?.getTime() || 0) - (b.scheduledAt?.getTime() || 0)
    );
  },

  connections: (teamId: string, platforms: Platform[]): Connection[] =>
    platforms.map(platform => fixtures.connection(platform, { teamId })),
};
```

### src/test-utils/builders.ts
```typescript
import { faker } from '@faker-js/faker';
import type { 
  Post, 
  User, 
  Team, 
  Connection,
  PostStatus,
  Platform 
} from '@repo/database';
import { fixtures } from './fixtures.js';

export class PostBuilder {
  private post: Partial<Post> = {};

  withContent(content: string): this {
    this.post.content = content;
    return this;
  }

  withMediaUrls(...urls: string[]): this {
    this.post.mediaUrls = urls;
    return this;
  }

  withPlatforms(...platforms: Platform[]): this {
    this.post.platforms = platforms;
    return this;
  }

  withStatus(status: PostStatus): this {
    this.post.status = status;
    return this;
  }

  scheduled(at: Date): this {
    this.post.status = 'SCHEDULED';
    this.post.scheduledAt = at;
    return this;
  }

  published(at?: Date): this {
    this.post.status = 'PUBLISHED';
    this.post.publishedAt = at || new Date();
    return this;
  }

  failed(): this {
    this.post.status = 'FAILED';
    return this;
  }

  forTeam(teamId: string): this {
    this.post.teamId = teamId;
    return this;
  }

  byAuthor(userId: string): this {
    this.post.userId = userId;
    return this;
  }

  build(): Post {
    return {
      ...fixtures.post(),
      ...this.post,
    };
  }
}

export class ConnectionBuilder {
  private connection: Partial<Connection> = {};

  forPlatform(platform: Platform): this {
    this.connection.platform = platform;
    return this;
  }

  withToken(accessToken: string, refreshToken?: string): this {
    this.connection.accessToken = accessToken;
    if (refreshToken) {
      this.connection.refreshToken = refreshToken;
    }
    return this;
  }

  expiresAt(date: Date): this {
    this.connection.expiresAt = date;
    return this;
  }

  expired(): this {
    this.connection.expiresAt = faker.date.past();
    return this;
  }

  active(): this {
    this.connection.status = 'ACTIVE';
    this.connection.expiresAt = faker.date.future();
    return this;
  }

  inactive(): this {
    this.connection.status = 'DISCONNECTED';
    return this;
  }

  forTeam(teamId: string): this {
    this.connection.teamId = teamId;
    return this;
  }

  withMetadata(metadata: any): this {
    this.connection.metadata = metadata;
    return this;
  }

  withAccountInfo(accountId: string, accountName: string): this {
    this.connection.accountId = accountId;
    this.connection.accountName = accountName;
    return this;
  }

  build(): Connection {
    const platform = this.connection.platform || 'FACEBOOK';
    return {
      ...fixtures.connection(platform),
      ...this.connection,
    };
  }
}

export class PublishJobBuilder {
  private jobData: any = {};

  forPost(postId: string): this {
    this.jobData.postId = postId;
    return this;
  }

  toPlatform(platform: Platform): this {
    this.jobData.platform = platform;
    return this;
  }

  scheduledFor(date: Date): this {
    this.jobData.scheduledFor = date.toISOString();
    return this;
  }

  withRetryCount(count: number): this {
    this.jobData.retryCount = count;
    return this;
  }

  withPriority(priority: number): this {
    this.jobData.priority = priority;
    return this;
  }

  build() {
    return {
      postId: faker.string.uuid(),
      platform: 'FACEBOOK' as Platform,
      scheduledFor: new Date().toISOString(),
      retryCount: 0,
      ...this.jobData,
    };
  }
}
```

### src/test-utils/helpers.ts
```typescript
import { vi, expect } from 'vitest';
import type { Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

// Test database helpers
export async function withTransaction<T>(
  fn: (tx: any) => Promise<T>
): Promise<T> {
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
    db: 15,
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

export function createMockJob(data: any = {}): Partial<Job> {
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
```

### src/test-utils/mocks/handlers.ts
```typescript
import { http, HttpResponse } from 'msw';
import { faker } from '@faker-js/faker';

// Facebook/Meta API handlers
export const metaHandlers = [
  // Facebook Graph API - Post creation
  http.post('https://graph.facebook.com/:version/:pageId/feed', async ({ params, request }) => {
    const body = await request.formData();
    const message = body.get('message');
    
    if (!message) {
      return HttpResponse.json(
        { error: { message: 'Message is required', code: 100 } },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      id: `${params.pageId}_${faker.string.alphanumeric(15)}`,
      post_id: faker.string.alphanumeric(20),
    });
  }),

  // Instagram API - Post creation
  http.post('https://graph.facebook.com/:version/:accountId/media', async ({ request }) => {
    const body = await request.formData();
    const caption = body.get('caption');
    const imageUrl = body.get('image_url');
    
    if (!caption || !imageUrl) {
      return HttpResponse.json(
        { error: { message: 'Caption and image_url are required', code: 100 } },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      id: faker.string.alphanumeric(17),
    });
  }),

  // Token refresh
  http.get('https://graph.facebook.com/:version/oauth/access_token', () => {
    return HttpResponse.json({
      access_token: `mock_refreshed_token_${faker.string.alphanumeric(40)}`,
      token_type: 'bearer',
      expires_in: 5184000,
    });
  }),
];

// X (Twitter) API handlers
export const xHandlers = [
  // Tweet creation
  http.post('https://api.twitter.com/2/tweets', async ({ request }) => {
    const body = await request.json() as any;
    
    if (!body.text) {
      return HttpResponse.json(
        {
          errors: [{
            message: 'Text is required',
            code: 'INVALID_REQUEST',
          }],
        },
        { status: 400 }
      );
    }
    
    if (body.text.length > 280) {
      return HttpResponse.json(
        {
          errors: [{
            message: 'Tweet exceeds character limit',
            code: 'INVALID_REQUEST',
          }],
        },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      data: {
        id: faker.string.numeric(19),
        text: body.text,
        created_at: new Date().toISOString(),
      },
    });
  }),
];

// YouTube API handlers
export const youtubeHandlers = [
  // Video upload initialization
  http.post('https://www.googleapis.com/upload/youtube/v3/videos', async ({ request }) => {
    const url = new URL(request.url);
    const uploadType = url.searchParams.get('uploadType');
    
    if (uploadType === 'resumable') {
      return new HttpResponse(null, {
        status: 200,
        headers: {
          'Location': `https://www.googleapis.com/upload/youtube/v3/videos?upload_id=${faker.string.alphanumeric(20)}`,
        },
      });
    }
    
    return HttpResponse.json({
      id: faker.string.alphanumeric(11),
      snippet: {
        title: 'Test Video',
        description: 'Test Description',
        publishedAt: new Date().toISOString(),
      },
      status: {
        uploadStatus: 'uploaded',
        privacyStatus: 'public',
      },
    });
  }),
];

// Combine all handlers
export const handlers = [
  ...metaHandlers,
  ...xHandlers,
  ...youtubeHandlers,
];
```

---

## Unit Tests

### src/__tests__/unit/lib/circuit-breaker.test.ts
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker } from '../../../lib/circuit-breaker-multi.js';
import { freezeTime, advanceTime, restoreTime } from '../../../test-utils/index.js';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let mockFunction: any;

  beforeEach(() => {
    freezeTime('2024-03-15T10:00:00Z');
    
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
    });

    mockFunction = vi.fn();
  });

  afterEach(() => {
    restoreTime();
    vi.clearAllMocks();
  });

  describe('closed state', () => {
    it('should execute function successfully when closed', async () => {
      mockFunction.mockResolvedValue('success');

      const result = await circuitBreaker.execute('test-service', mockFunction);

      expect(result).toBe('success');
      expect(mockFunction).toHaveBeenCalledOnce();
      expect(circuitBreaker.getState('test-service')).toBe('CLOSED');
    });

    it('should track successful calls', async () => {
      mockFunction.mockResolvedValue('success');

      await circuitBreaker.execute('test-service', mockFunction);
      await circuitBreaker.execute('test-service', mockFunction);
      await circuitBreaker.execute('test-service', mockFunction);

      const metrics = circuitBreaker.getMetrics('test-service');
      expect(metrics.successCount).toBe(3);
      expect(metrics.failureCount).toBe(0);
    });
  });

  describe('open state', () => {
    it('should open circuit after reaching failure threshold', async () => {
      mockFunction.mockRejectedValue(new Error('failure'));

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute('test-service', mockFunction);
        } catch (error) {
          // Expected
        }
      }

      expect(circuitBreaker.getState('test-service')).toBe('OPEN');
    });

    it('should reject calls immediately when open', async () => {
      mockFunction.mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute('test-service', mockFunction);
        } catch (error) {
          // Expected
        }
      }

      mockFunction.mockClear();
      mockFunction.mockResolvedValue('success');

      await expect(
        circuitBreaker.execute('test-service', mockFunction)
      ).rejects.toThrow('Circuit breaker is OPEN');

      expect(mockFunction).not.toHaveBeenCalled();
    });
  });

  describe('half-open state', () => {
    it('should transition to half-open after recovery timeout', async () => {
      mockFunction.mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute('test-service', mockFunction);
        } catch (error) {
          // Expected
        }
      }

      expect(circuitBreaker.getState('test-service')).toBe('OPEN');

      advanceTime(61000); // 61 seconds

      expect(circuitBreaker.getState('test-service')).toBe('HALF_OPEN');
    });

    it('should close circuit on successful test call', async () => {
      mockFunction.mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute('test-service', mockFunction);
        } catch (error) {
          // Expected
        }
      }

      advanceTime(61000);
      
      mockFunction.mockResolvedValue('success');
      await circuitBreaker.execute('test-service', mockFunction);

      expect(circuitBreaker.getState('test-service')).toBe('CLOSED');
    });
  });
});
```

### src/__tests__/unit/publishers/facebook.publisher.test.ts
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FacebookPublisher } from '../../../publishers/facebook.publisher.js';
import { 
  PostBuilder, 
  ConnectionBuilder,
  mockApiResponse,
  mockApiError,
  mockRateLimit,
  freezeTime,
  restoreTime
} from '../../../test-utils/index.js';
import type { Post, Connection } from '@repo/database';

describe('FacebookPublisher', () => {
  let publisher: FacebookPublisher;
  let mockPost: Post;
  let mockConnection: Connection;

  beforeEach(() => {
    publisher = new FacebookPublisher();
    
    mockPost = new PostBuilder()
      .withContent('Test Facebook post')
      .withPlatforms('FACEBOOK')
      .scheduled(new Date('2024-03-15T10:00:00Z'))
      .build();
    
    mockConnection = new ConnectionBuilder()
      .forPlatform('FACEBOOK')
      .withToken('mock_facebook_token')
      .withAccountInfo('123456789', 'Test Page')
      .active()
      .build();
    
    freezeTime('2024-03-15T10:00:00Z');
  });

  afterEach(() => {
    restoreTime();
    vi.clearAllMocks();
  });

  describe('publish', () => {
    it('should successfully publish a text post', async () => {
      mockApiResponse(
        'post',
        'https://graph.facebook.com/v18.0/123456789/feed',
        {
          id: '123456789_987654321',
          post_id: '987654321',
        }
      );

      const result = await publisher.publish(mockPost, mockConnection);

      expect(result).toEqual({
        success: true,
        platformPostId: '987654321',
        url: 'https://www.facebook.com/123456789/posts/987654321',
        publishedAt: expect.any(Date),
      });
    });

    it('should handle rate limiting with retry', async () => {
      mockRateLimit(
        'post',
        'https://graph.facebook.com/v18.0/123456789/feed',
        60
      );

      const result = await publisher.publish(mockPost, mockConnection);

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'RATE_LIMIT',
          message: expect.stringContaining('rate limit'),
          retryAfter: 60,
        }),
      });
    });

    it('should handle API errors', async () => {
      mockApiError(
        'post',
        'https://graph.facebook.com/v18.0/123456789/feed',
        {
          message: 'Invalid OAuth access token',
          code: '190',
        },
        401
      );

      const result = await publisher.publish(mockPost, mockConnection);

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'AUTH_ERROR',
          message: expect.stringContaining('OAuth'),
        }),
      });
    });
  });

  describe('validate', () => {
    it('should validate content within character limit', () => {
      const content = 'A'.repeat(63206);
      const result = publisher.validate(content);

      expect(result).toEqual({
        valid: true,
        errors: [],
        warnings: [],
        metadata: {
          characterCount: 63206,
          characterLimit: 63206,
        },
      });
    });

    it('should reject content exceeding character limit', () => {
      const content = 'A'.repeat(63207);
      const result = publisher.validate(content);

      expect(result).toEqual({
        valid: false,
        errors: ['Content exceeds Facebook character limit of 63206'],
        warnings: [],
        metadata: {
          characterCount: 63207,
          characterLimit: 63206,
        },
      });
    });
  });
});
```

### src/__tests__/unit/processors/publish.test.ts
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Job } from 'bullmq';
import { 
  PostBuilder,
  ConnectionBuilder,
  PublishJobBuilder,
  createMockJob,
  freezeTime,
  restoreTime
} from '../../../test-utils/index.js';

// Mock dependencies
vi.mock('@repo/database', () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    connection: {
      findFirst: vi.fn(),
    },
    publication: {
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn(prisma)),
  },
}));

vi.mock('@/publishers', () => ({
  FacebookPublisher: vi.fn().mockImplementation(() => ({
    publish: vi.fn().mockResolvedValue({
      success: true,
      platformPostId: 'fb_123',
      url: 'https://facebook.com/post/123',
      publishedAt: new Date(),
    }),
  })),
}));

import { processPublishJob } from '../../../processors/publish.js';
import { prisma } from '@repo/database';

describe('processPublishJob', () => {
  let mockJob: Job;
  let mockPost: any;
  let mockConnection: any;

  beforeEach(() => {
    freezeTime('2024-03-15T10:00:00Z');

    mockPost = new PostBuilder()
      .withContent('Test post content')
      .withPlatforms('FACEBOOK', 'TWITTER')
      .scheduled(new Date('2024-03-15T10:00:00Z'))
      .forTeam('team_123')
      .build();

    mockConnection = new ConnectionBuilder()
      .forPlatform('FACEBOOK')
      .forTeam('team_123')
      .active()
      .build();

    const jobData = new PublishJobBuilder()
      .forPost(mockPost.id)
      .toPlatform('FACEBOOK')
      .scheduledFor(new Date('2024-03-15T10:00:00Z'))
      .build();

    mockJob = createMockJob(jobData) as Job;
  });

  afterEach(() => {
    restoreTime();
    vi.clearAllMocks();
  });

  describe('successful publishing', () => {
    it('should successfully publish a post to a single platform', async () => {
      (prisma.post.findUnique as any).mockResolvedValue(mockPost);
      (prisma.connection.findFirst as any).mockResolvedValue(mockConnection);
      (prisma.publication.create as any).mockResolvedValue({
        id: 'pub_123',
        postId: mockPost.id,
        platform: 'FACEBOOK',
        platformPostId: 'fb_123',
        status: 'PUBLISHED',
      });

      const result = await processPublishJob(mockJob);

      expect(result).toEqual({
        success: true,
        platform: 'FACEBOOK',
        platformPostId: 'fb_123',
        url: 'https://facebook.com/post/123',
        publishedAt: expect.any(Date),
      });

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: { id: mockPost.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: expect.any(Date),
        },
      });

      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });
  });

  describe('error handling', () => {
    it('should handle missing post', async () => {
      (prisma.post.findUnique as any).mockResolvedValue(null);

      await expect(processPublishJob(mockJob)).rejects.toThrow('Post not found');
      
      expect(mockJob.log).toHaveBeenCalledWith(
        expect.stringContaining('Post not found')
      );
    });

    it('should handle missing connection', async () => {
      (prisma.post.findUnique as any).mockResolvedValue(mockPost);
      (prisma.connection.findFirst as any).mockResolvedValue(null);

      await expect(processPublishJob(mockJob)).rejects.toThrow(
        'No active connection found'
      );

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: { id: mockPost.id },
        data: { status: 'FAILED' },
      });
    });
  });
});
```

---

## CI/CD Pipeline

### .github/workflows/worker-tests.yml
```yaml
name: Worker Service Tests

on:
  push:
    paths:
      - 'apps/worker/**'
      - 'packages/database/**'
      - 'packages/redis/**'
      - '.github/workflows/worker-tests.yml'
  pull_request:
    paths:
      - 'apps/worker/**'
      - 'packages/database/**'
      - 'packages/redis/**'

jobs:
  test:
    name: Test Worker Service
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: planrrr_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Generate Prisma client
        run: pnpm db:generate
        working-directory: ./packages/database
      
      - name: Run database migrations
        run: pnpm db:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/planrrr_test?schema=public
        working-directory: ./packages/database
      
      - name: Run unit tests
        run: pnpm test:run
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/planrrr_test?schema=public
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          NODE_ENV: test
        working-directory: ./apps/worker
      
      - name: Run test coverage
        run: pnpm test:coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/planrrr_test?schema=public
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          NODE_ENV: test
        working-directory: ./apps/worker
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/worker/coverage/lcov.info
          flags: worker
          name: worker-coverage
          fail_ci_if_error: false

  lint:
    name: Lint Worker Service
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run linter
        run: pnpm lint
        working-directory: ./apps/worker
      
      - name: Check types
        run: pnpm check-types
        working-directory: ./apps/worker

  build:
    name: Build Worker Service
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Generate Prisma client
        run: pnpm db:generate
        working-directory: ./packages/database
      
      - name: Build worker
        run: pnpm build
        working-directory: ./apps/worker
      
      - name: Verify build output
        run: |
          if [ ! -d "dist" ]; then
            echo "Build failed: dist directory not found"
            exit 1
          fi
          if [ ! -f "dist/index.js" ]; then
            echo "Build failed: index.js not found"
            exit 1
          fi
        working-directory: ./apps/worker
```

---

## Package.json Scripts

```json
{
  "name": "@repo/worker",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint . --max-warnings 0",
    "check-types": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch",
    "test:ui": "vitest --ui"
  }
}
```

---

## Test Commands

```bash
# Install dependencies
pnpm add -D vitest @vitest/ui @vitest/coverage-v8 \
  @faker-js/faker supertest msw \
  @testcontainers/redis @testcontainers/postgresql

# Run tests
pnpm test              # Run all tests in watch mode
pnpm test:run          # Run all tests once
pnpm test:coverage     # Run with coverage report
pnpm test:watch        # Watch mode
pnpm test:ui           # Open Vitest UI

# Run specific test file
pnpm test src/__tests__/unit/publishers/facebook.publisher.test.ts

# Run tests matching pattern
pnpm test -- --grep="FacebookPublisher"

# Debug tests
DEBUG_TESTS=true pnpm test
DEBUG_PERFORMANCE=true pnpm test
```

---

## Test Coverage Requirements

- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 85%
- **Statements**: 85%

## Key Features

1. **Comprehensive Test Utilities**
   - Fixtures for all database entities
   - Builder pattern for complex objects
   - Mock helpers for Queue, Redis, and APIs
   - Time manipulation utilities

2. **MSW Mock Server**
   - Realistic API mocking for Facebook, Instagram, X, YouTube
   - Rate limiting simulation
   - Error scenario testing

3. **Multi-Service Circuit Breaker**
   - Independent circuit management per service
   - Configurable thresholds and timeouts
   - Proper state transitions

4. **CI/CD Integration**
   - GitHub Actions workflow
   - PostgreSQL and Redis services
   - Coverage reporting with Codecov
   - Parallel test, lint, and build jobs

5. **Type Safety**
   - Full TypeScript support
   - Proper type definitions for all test utilities
   - No `any` types in production code

This comprehensive test suite provides a solid foundation for TDD development of the worker service with 85%+ code coverage targets.