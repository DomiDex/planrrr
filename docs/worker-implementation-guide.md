# Worker Service Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the missing functionality in the planrrr.io worker service, transforming it from mock implementations to a production-ready social media publishing system.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 0: Emergency Setup](#phase-0-emergency-setup)
3. [Phase 1: Core Implementation](#phase-1-core-implementation)
4. [Phase 2: Reliability & Error Handling](#phase-2-reliability--error-handling)
5. [Phase 3: Testing Strategy](#phase-3-testing-strategy)
6. [Phase 4: Production Excellence](#phase-4-production-excellence)
7. [Deployment Checklist](#deployment-checklist)

## Prerequisites

### Required Accounts & API Access

Before starting implementation, ensure you have:

1. **Facebook/Meta Developer Account**
   - App ID and Secret
   - Facebook Page access token
   - Instagram Business Account ID

2. **Twitter/X Developer Account**
   - API Key and Secret
   - Bearer Token
   - OAuth 2.0 credentials

3. **Google Cloud Console Account**
   - YouTube Data API v3 enabled
   - OAuth 2.0 credentials

4. **LinkedIn Developer Account**
   - Client ID and Secret
   - Organization access (if needed)

5. **Infrastructure**
   - Redis instance (local or cloud)
   - PostgreSQL database
   - Node.js 18+ environment

## Phase 0: Emergency Setup

### Step 1: Install Dependencies

```bash
cd apps/worker

# Core dependencies
pnpm add \
  axios@^1.7.2 \
  winston@^3.11.0 \
  zod@^3.22.4 \
  dotenv@^16.3.1 \
  ioredis@^5.4.0 \
  bullmq@^5.58.0

# Monitoring & Error Tracking
pnpm add \
  @sentry/node@^7.99.0 \
  prom-client@^15.1.0

# Development dependencies
pnpm add -D \
  @types/node@^20 \
  vitest@^2.1.8 \
  @vitest/coverage-v8@^2.1.8 \
  @faker-js/faker@^9.3.0 \
  supertest@^7.0.0
```

### Step 2: Environment Configuration

Create `apps/worker/src/config/env.ts`:

```typescript
import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Redis Configuration
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_MAX_RETRIES_PER_REQUEST: z.literal('null').transform(() => null).optional(),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Worker Configuration
  WORKER_CONCURRENCY: z.coerce.number().min(1).max(20).default(5),
  WORKER_MAX_JOBS_PER_SECOND: z.coerce.number().min(1).max(100).default(10),
  WORKER_RETRY_ATTEMPTS: z.coerce.number().min(1).max(10).default(3),
  WORKER_RETRY_DELAY: z.coerce.number().min(100).max(60000).default(2000),
  
  // Health Check
  ENABLE_HEALTH_CHECK: z.coerce.boolean().default(true),
  HEALTH_PORT: z.coerce.number().default(3001),
  
  // Social Media APIs
  FACEBOOK_APP_ID: z.string().min(1),
  FACEBOOK_APP_SECRET: z.string().min(1),
  FACEBOOK_API_VERSION: z.string().default('v18.0'),
  
  TWITTER_API_KEY: z.string().min(1),
  TWITTER_API_SECRET: z.string().min(1),
  TWITTER_BEARER_TOKEN: z.string().min(1),
  
  YOUTUBE_API_KEY: z.string().min(1),
  YOUTUBE_CLIENT_ID: z.string().min(1),
  YOUTUBE_CLIENT_SECRET: z.string().min(1),
  
  LINKEDIN_CLIENT_ID: z.string().min(1),
  LINKEDIN_CLIENT_SECRET: z.string().min(1),
  
  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  METRICS_PORT: z.coerce.number().default(9090),
  
  // Security
  ENCRYPTION_KEY: z.string().length(64).optional(), // 32 bytes in hex
  ENCRYPTION_IV: z.string().length(32).optional(),  // 16 bytes in hex
});

export type Env = z.infer<typeof envSchema>;

// Parse and validate environment variables
export const env = envSchema.parse(process.env);

// Export for use in other files
export default env;
```

### Step 3: Setup Structured Logging

Create `apps/worker/src/lib/logger.ts`:

```typescript
import winston from 'winston';
import { env } from '../config/env';

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format,
  defaultMeta: { 
    service: 'worker',
    environment: env.NODE_ENV 
  },
  transports: [
    new winston.transports.Console({
      format: env.NODE_ENV === 'development' 
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : format
    })
  ]
});

// Create child loggers for specific contexts
export const createLogger = (context: string) => {
  return logger.child({ context });
};

// Log levels
export const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
} as const;
```

### Step 4: Create Constants

Create `apps/worker/src/config/constants.ts`:

```typescript
// Queue Names
export const QUEUE_NAMES = {
  PUBLISH_POSTS: 'publish-posts',
  RETRY_FAILED: 'retry-failed-posts',
  ANALYTICS_SYNC: 'analytics-sync'
} as const;

// Platform Configuration
export const PLATFORM_CONFIG = {
  FACEBOOK: {
    NAME: 'Facebook',
    CHAR_LIMIT: 63206,
    MEDIA_LIMIT: 10,
    VIDEO_SIZE_LIMIT: 4_000_000_000, // 4GB
    API_VERSION: 'v18.0',
    RATE_LIMIT: { requests: 200, window: 3600000 } // 200 per hour
  },
  TWITTER: {
    NAME: 'Twitter/X',
    CHAR_LIMIT: 280,
    MEDIA_LIMIT: 4,
    VIDEO_SIZE_LIMIT: 512_000_000, // 512MB
    API_VERSION: '2',
    RATE_LIMIT: { requests: 300, window: 900000 } // 300 per 15 min
  },
  INSTAGRAM: {
    NAME: 'Instagram',
    CHAR_LIMIT: 2200,
    HASHTAG_LIMIT: 30,
    MEDIA_REQUIRED: true,
    API_VERSION: 'v18.0',
    RATE_LIMIT: { requests: 200, window: 3600000 } // 200 per hour
  },
  YOUTUBE: {
    NAME: 'YouTube',
    TITLE_LIMIT: 100,
    DESCRIPTION_LIMIT: 5000,
    TAGS_LIMIT: 500,
    VIDEO_SIZE_LIMIT: 128_000_000_000, // 128GB
    API_VERSION: 'v3',
    RATE_LIMIT: { requests: 10000, window: 86400000 } // 10k per day
  },
  LINKEDIN: {
    NAME: 'LinkedIn',
    CHAR_LIMIT: 3000,
    MEDIA_LIMIT: 20,
    API_VERSION: 'v2',
    RATE_LIMIT: { requests: 100, window: 86400000 } // 100 per day
  }
} as const;

// Job Options
export const JOB_OPTIONS = {
  DEFAULT_ATTEMPTS: 3,
  BACKOFF_TYPE: 'exponential' as const,
  BACKOFF_DELAY: 2000,
  REMOVE_ON_COMPLETE_AGE: 24 * 3600 * 1000, // 24 hours
  REMOVE_ON_FAIL_AGE: 7 * 24 * 3600 * 1000, // 7 days
  STALLED_INTERVAL: 30000, // 30 seconds
  MAX_STALLED_COUNT: 3
} as const;

// Error Types
export const ERROR_TYPES = {
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  AUTH_FAILED: 'AUTH_FAILED_ERROR',
  NETWORK: 'NETWORK_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  PLATFORM_API: 'PLATFORM_API_ERROR',
  MEDIA_UPLOAD: 'MEDIA_UPLOAD_ERROR',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED_ERROR'
} as const;
```

## Phase 1: Core Implementation

### Step 1: Create Base Publisher Class

Create `apps/worker/src/publishers/base.publisher.ts`:

```typescript
import { z } from 'zod';
import axios, { AxiosInstance } from 'axios';
import { logger } from '../lib/logger';
import type { Post, Connection, Platform } from '@repo/database';
import { prisma } from '@repo/database';
import { ERROR_TYPES } from '../config/constants';

export interface ValidationResult {
  valid: boolean;
  characterCount: number;
  characterLimit: number;
  errors?: string[];
}

export interface PublishResult {
  externalId: string;
  url?: string;
  metrics?: Record<string, unknown>;
}

export abstract class BasePublisher {
  protected logger;
  protected httpClient: AxiosInstance;
  
  constructor(protected platform: Platform) {
    this.logger = logger.child({ context: `${platform}Publisher` });
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'planrrr.io/1.0'
      }
    });
    
    // Add request/response interceptors
    this.setupInterceptors();
  }
  
  abstract publish(post: Post, connection: Connection): Promise<PublishResult>;
  abstract validate(content: string): ValidationResult;
  abstract getCharacterLimit(): number;
  
  protected async refreshTokenIfNeeded(connection: Connection): Promise<Connection> {
    if (!connection.expiresAt || connection.expiresAt > new Date()) {
      return connection;
    }
    
    this.logger.info('Token expired, refreshing', { 
      connectionId: connection.id,
      platform: this.platform 
    });
    
    try {
      const newTokenData = await this.refreshToken(connection);
      
      const updated = await prisma.connection.update({
        where: { id: connection.id },
        data: {
          accessToken: newTokenData.accessToken,
          refreshToken: newTokenData.refreshToken || connection.refreshToken,
          expiresAt: new Date(Date.now() + newTokenData.expiresIn * 1000)
        }
      });
      
      this.logger.info('Token refreshed successfully', { 
        connectionId: connection.id 
      });
      
      return updated;
    } catch (error) {
      this.logger.error('Token refresh failed', { 
        error, 
        connectionId: connection.id 
      });
      throw new TokenExpiredError(this.platform);
    }
  }
  
  protected abstract refreshToken(connection: Connection): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }>;
  
  private setupInterceptors(): void {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug('API Request', {
          method: config.method,
          url: config.url,
          platform: this.platform
        });
        return config;
      },
      (error) => {
        this.logger.error('Request Error', { error });
        return Promise.reject(error);
      }
    );
    
    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug('API Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        if (error.response?.status === 429) {
          const resetTime = error.response.headers['x-ratelimit-reset'];
          throw new RateLimitError(this.platform, resetTime);
        }
        
        if (error.response?.status === 401) {
          throw new AuthenticationError(this.platform);
        }
        
        this.logger.error('Response Error', {
          status: error.response?.status,
          data: error.response?.data,
          platform: this.platform
        });
        
        throw error;
      }
    );
  }
}

// Custom Error Classes
export class PlatformError extends Error {
  constructor(
    public platform: Platform,
    message: string,
    public errorType: string,
    public isRetryable: boolean = true
  ) {
    super(`[${platform}] ${message}`);
    this.name = 'PlatformError';
  }
}

export class RateLimitError extends PlatformError {
  constructor(platform: Platform, public resetTime?: number) {
    super(platform, 'Rate limit exceeded', ERROR_TYPES.RATE_LIMIT, true);
    this.resetTime = resetTime ? Number(resetTime) * 1000 : Date.now() + 900000;
  }
}

export class AuthenticationError extends PlatformError {
  constructor(platform: Platform) {
    super(platform, 'Authentication failed', ERROR_TYPES.AUTH_FAILED, false);
  }
}

export class TokenExpiredError extends PlatformError {
  constructor(platform: Platform) {
    super(platform, 'Token expired and refresh failed', ERROR_TYPES.TOKEN_EXPIRED, false);
  }
}
```

### Step 2: Implement Facebook Publisher

Create `apps/worker/src/publishers/facebook.publisher.ts`:

```typescript
import { z } from 'zod';
import FormData from 'form-data';
import { BasePublisher, type PublishResult, type ValidationResult } from './base.publisher';
import type { Post, Connection } from '@repo/database';
import { PLATFORM_CONFIG } from '../config/constants';
import { env } from '../config/env';

const FacebookMetadataSchema = z.object({
  pageId: z.string(),
  pageName: z.string().optional()
});

const FacebookResponseSchema = z.object({
  id: z.string(),
  post_id: z.string().optional()
});

export class FacebookPublisher extends BasePublisher {
  private readonly apiVersion = env.FACEBOOK_API_VERSION;
  private readonly baseUrl = 'https://graph.facebook.com';
  
  constructor() {
    super('FACEBOOK');
  }
  
  async publish(post: Post, connection: Connection): Promise<PublishResult> {
    // Refresh token if needed
    const conn = await this.refreshTokenIfNeeded(connection);
    
    // Parse and validate metadata
    const metadata = FacebookMetadataSchema.parse(conn.metadata);
    
    try {
      let externalId: string;
      
      if (post.mediaUrls && post.mediaUrls.length > 0) {
        externalId = await this.publishWithMedia(post, conn, metadata.pageId);
      } else {
        externalId = await this.publishTextPost(post, conn, metadata.pageId);
      }
      
      const postUrl = `https://www.facebook.com/${metadata.pageId}/posts/${externalId}`;
      
      return {
        externalId,
        url: postUrl
      };
    } catch (error) {
      this.logger.error('Facebook publish failed', { 
        error, 
        postId: post.id 
      });
      throw error;
    }
  }
  
  private async publishTextPost(
    post: Post,
    connection: Connection,
    pageId: string
  ): Promise<string> {
    const endpoint = `${this.baseUrl}/${this.apiVersion}/${pageId}/feed`;
    
    const response = await this.httpClient.post(endpoint, {
      message: post.content,
      access_token: connection.accessToken,
      published: true
    });
    
    const data = FacebookResponseSchema.parse(response.data);
    return data.id;
  }
  
  private async publishWithMedia(
    post: Post,
    connection: Connection,
    pageId: string
  ): Promise<string> {
    const mediaUrls = post.mediaUrls!.slice(0, PLATFORM_CONFIG.FACEBOOK.MEDIA_LIMIT);
    
    // For single image, use simple photo upload
    if (mediaUrls.length === 1 && this.isImageUrl(mediaUrls[0])) {
      const endpoint = `${this.baseUrl}/${this.apiVersion}/${pageId}/photos`;
      
      const response = await this.httpClient.post(endpoint, {
        message: post.content,
        url: mediaUrls[0],
        access_token: connection.accessToken,
        published: true
      });
      
      const data = FacebookResponseSchema.parse(response.data);
      return data.post_id || data.id;
    }
    
    // For multiple media, create a media post
    const attachedMedia = await this.uploadMultipleMedia(mediaUrls, connection, pageId);
    
    const endpoint = `${this.baseUrl}/${this.apiVersion}/${pageId}/feed`;
    const response = await this.httpClient.post(endpoint, {
      message: post.content,
      attached_media: attachedMedia,
      access_token: connection.accessToken,
      published: true
    });
    
    const data = FacebookResponseSchema.parse(response.data);
    return data.id;
  }
  
  private async uploadMultipleMedia(
    mediaUrls: string[],
    connection: Connection,
    pageId: string
  ): Promise<string[]> {
    const uploadPromises = mediaUrls.map(async (url) => {
      const endpoint = `${this.baseUrl}/${this.apiVersion}/${pageId}/photos`;
      
      const response = await this.httpClient.post(endpoint, {
        url,
        access_token: connection.accessToken,
        published: false // Don't publish individually
      });
      
      return response.data.id;
    });
    
    return Promise.all(uploadPromises);
  }
  
  validate(content: string): ValidationResult {
    const limit = PLATFORM_CONFIG.FACEBOOK.CHAR_LIMIT;
    const errors: string[] = [];
    
    if (content.length > limit) {
      errors.push(`Content exceeds Facebook's ${limit} character limit`);
    }
    
    if (content.length === 0) {
      errors.push('Content cannot be empty');
    }
    
    return {
      valid: errors.length === 0,
      characterCount: content.length,
      characterLimit: limit,
      errors
    };
  }
  
  getCharacterLimit(): number {
    return PLATFORM_CONFIG.FACEBOOK.CHAR_LIMIT;
  }
  
  protected async refreshToken(connection: Connection): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }> {
    const endpoint = `${this.baseUrl}/${this.apiVersion}/oauth/access_token`;
    
    const response = await this.httpClient.get(endpoint, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: env.FACEBOOK_APP_ID,
        client_secret: env.FACEBOOK_APP_SECRET,
        fb_exchange_token: connection.refreshToken || connection.accessToken
      }
    });
    
    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in || 5183999 // ~60 days default
    };
  }
  
  private isImageUrl(url: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext));
  }
}
```

## Phase 2: Reliability & Error Handling

### Step 1: Implement Retry Strategy

Create `apps/worker/src/lib/retry-strategy.ts`:

```typescript
import { Job } from 'bullmq';
import { logger } from './logger';
import { ERROR_TYPES } from '../config/constants';
import type { Platform } from '@repo/database';

interface RetryDecision {
  shouldRetry: boolean;
  delayMs?: number;
  reason?: string;
}

export class RetryStrategy {
  private static readonly MAX_RETRY_DELAY = 24 * 60 * 60 * 1000; // 24 hours
  
  static determineRetry(
    job: Job,
    error: Error & { errorType?: string; resetTime?: number }
  ): RetryDecision {
    const attemptsMade = job.attemptsMade || 0;
    const maxAttempts = job.opts.attempts || 3;
    
    // Don't retry if max attempts reached
    if (attemptsMade >= maxAttempts) {
      return {
        shouldRetry: false,
        reason: 'Max attempts reached'
      };
    }
    
    // Handle specific error types
    switch (error.errorType) {
      case ERROR_TYPES.RATE_LIMIT:
        return this.handleRateLimit(error);
        
      case ERROR_TYPES.AUTH_FAILED:
      case ERROR_TYPES.TOKEN_EXPIRED:
        return {
          shouldRetry: false,
          reason: 'Authentication failure requires manual intervention'
        };
        
      case ERROR_TYPES.NETWORK:
        return {
          shouldRetry: true,
          delayMs: this.calculateExponentialBackoff(attemptsMade),
          reason: 'Network error - will retry'
        };
        
      case ERROR_TYPES.VALIDATION:
        return {
          shouldRetry: false,
          reason: 'Validation error - content needs modification'
        };
        
      default:
        return {
          shouldRetry: attemptsMade < 2, // Retry unknown errors once
          delayMs: this.calculateExponentialBackoff(attemptsMade),
          reason: 'Unknown error - limited retry'
        };
    }
  }
  
  private static handleRateLimit(
    error: Error & { resetTime?: number }
  ): RetryDecision {
    if (!error.resetTime) {
      return {
        shouldRetry: true,
        delayMs: 15 * 60 * 1000, // Default 15 minutes
        reason: 'Rate limit - default delay'
      };
    }
    
    const delayMs = Math.min(
      error.resetTime - Date.now(),
      this.MAX_RETRY_DELAY
    );
    
    if (delayMs <= 0) {
      return {
        shouldRetry: true,
        delayMs: 1000, // Retry after 1 second if reset time passed
        reason: 'Rate limit reset time passed'
      };
    }
    
    return {
      shouldRetry: true,
      delayMs,
      reason: `Rate limit - waiting until reset at ${new Date(error.resetTime).toISOString()}`
    };
  }
  
  private static calculateExponentialBackoff(attempt: number): number {
    const baseDelay = 2000; // 2 seconds
    const maxDelay = 5 * 60 * 1000; // 5 minutes
    
    const delay = Math.min(
      baseDelay * Math.pow(2, attempt),
      maxDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000;
    
    return delay + jitter;
  }
}
```

### Step 2: Implement Circuit Breaker

Create `apps/worker/src/lib/circuit-breaker.ts`:

```typescript
import { logger } from './logger';

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: Date;
  private successCount = 0;
  private nextAttempt?: Date;
  
  constructor(
    private name: string,
    private options: CircuitBreakerOptions = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 60000 // 1 minute
    }
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.canAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        logger.info(`Circuit breaker ${this.name} entering HALF_OPEN state`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= 2) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info(`Circuit breaker ${this.name} is now CLOSED`);
      }
    }
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.options.resetTimeout);
      logger.warn(`Circuit breaker ${this.name} is now OPEN`);
      return;
    }
    
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.options.resetTimeout);
      logger.warn(`Circuit breaker ${this.name} opened after ${this.failureCount} failures`);
    }
  }
  
  private canAttemptReset(): boolean {
    return !!this.nextAttempt && new Date() >= this.nextAttempt;
  }
  
  getState(): CircuitState {
    return this.state;
  }
  
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    };
  }
}

// Platform-specific circuit breakers
export const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(platform: string): CircuitBreaker {
  if (!circuitBreakers.has(platform)) {
    circuitBreakers.set(platform, new CircuitBreaker(platform));
  }
  return circuitBreakers.get(platform)!;
}
```

## Phase 3: Testing Strategy

### Step 1: Test Factories

Create `apps/worker/src/test/factories/index.ts`:

```typescript
import { faker } from '@faker-js/faker';
import type { Post, Connection, User, Team, Platform } from '@repo/database';

export function createPostFixture(overrides?: Partial<Post>): Post {
  return {
    id: faker.string.uuid(),
    content: faker.lorem.paragraph(),
    mediaUrls: [],
    platforms: ['FACEBOOK'] as Platform[],
    status: 'SCHEDULED',
    scheduledAt: faker.date.future(),
    publishedAt: null,
    teamId: faker.string.uuid(),
    userId: faker.string.uuid(),
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as Post;
}

export function createConnectionFixture(overrides?: Partial<Connection>): Connection {
  return {
    id: faker.string.uuid(),
    teamId: faker.string.uuid(),
    platform: 'FACEBOOK' as Platform,
    accountName: faker.company.name(),
    accountId: faker.string.numeric(10),
    accessToken: faker.string.alphanumeric(40),
    refreshToken: faker.string.alphanumeric(40),
    expiresAt: faker.date.future(),
    status: 'ACTIVE',
    metadata: {
      pageId: faker.string.numeric(15),
      pageName: faker.company.name()
    },
    lastSync: faker.date.recent(),
    syncErrors: 0,
    postsPublished: faker.number.int({ min: 0, max: 1000 }),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as Connection;
}
```

### Step 2: Publisher Tests

Create `apps/worker/src/__tests__/publishers/facebook.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { FacebookPublisher } from '../../publishers/facebook.publisher';
import { createPostFixture, createConnectionFixture } from '../../test/factories';

vi.mock('axios');

describe('FacebookPublisher', () => {
  let publisher: FacebookPublisher;
  let mockAxios: any;
  
  beforeEach(() => {
    publisher = new FacebookPublisher();
    mockAxios = axios.create as any;
    mockAxios.post = vi.fn();
    mockAxios.get = vi.fn();
    mockAxios.interceptors = {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    };
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('publish', () => {
    it('should publish text post successfully', async () => {
      const post = createPostFixture({
        content: 'Test post content',
        mediaUrls: []
      });
      
      const connection = createConnectionFixture({
        platform: 'FACEBOOK',
        metadata: { pageId: '123456789' }
      });
      
      mockAxios.post.mockResolvedValue({
        data: { id: 'fb_post_123' }
      });
      
      const result = await publisher.publish(post, connection);
      
      expect(result).toEqual({
        externalId: 'fb_post_123',
        url: 'https://www.facebook.com/123456789/posts/fb_post_123'
      });
      
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/123456789/feed'),
        expect.objectContaining({
          message: 'Test post content',
          access_token: connection.accessToken,
          published: true
        })
      );
    });
    
    it('should handle rate limit errors', async () => {
      const post = createPostFixture();
      const connection = createConnectionFixture();
      
      mockAxios.post.mockRejectedValue({
        response: {
          status: 429,
          headers: { 'x-ratelimit-reset': '1234567890' }
        }
      });
      
      await expect(publisher.publish(post, connection))
        .rejects.toThrow('Rate limit exceeded');
    });
    
    it('should validate content length', () => {
      const longContent = 'a'.repeat(63207);
      const result = publisher.validate(longContent);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Content exceeds Facebook's 63206 character limit"
      );
    });
  });
});
```

## Phase 4: Production Excellence

### Step 1: Monitoring Setup

Create `apps/worker/src/lib/metrics.ts`:

```typescript
import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { createServer } from 'http';
import { env } from '../config/env';
import { logger } from './logger';

// Create registry
export const register = new Registry();

// Define metrics
export const metrics = {
  jobsProcessed: new Counter({
    name: 'worker_jobs_processed_total',
    help: 'Total number of jobs processed',
    labelNames: ['platform', 'status'],
    registers: [register]
  }),
  
  jobDuration: new Histogram({
    name: 'worker_job_duration_seconds',
    help: 'Job processing duration in seconds',
    labelNames: ['platform'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    registers: [register]
  }),
  
  activeJobs: new Gauge({
    name: 'worker_active_jobs',
    help: 'Number of currently active jobs',
    labelNames: ['platform'],
    registers: [register]
  }),
  
  queueSize: new Gauge({
    name: 'worker_queue_size',
    help: 'Number of jobs in queue',
    labelNames: ['status'],
    registers: [register]
  }),
  
  apiCalls: new Counter({
    name: 'worker_api_calls_total',
    help: 'Total number of API calls',
    labelNames: ['platform', 'status'],
    registers: [register]
  }),
  
  tokenRefreshes: new Counter({
    name: 'worker_token_refreshes_total',
    help: 'Total number of token refreshes',
    labelNames: ['platform', 'status'],
    registers: [register]
  })
};

// Start metrics server
export function startMetricsServer(): void {
  const server = createServer((req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', register.contentType);
      register.metrics().then(data => {
        res.end(data);
      }).catch(err => {
        res.statusCode = 500;
        res.end(err.message);
      });
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  });
  
  server.listen(env.METRICS_PORT, () => {
    logger.info(`Metrics server listening on port ${env.METRICS_PORT}`);
  });
}
```

### Step 2: Sentry Integration

Create `apps/worker/src/lib/error-tracking.ts`:

```typescript
import * as Sentry from '@sentry/node';
import { env } from '../config/env';

export function initializeSentry(): void {
  if (!env.SENTRY_DSN) {
    return;
  }
  
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Console(),
    ],
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      if (event.extra?.accessToken) {
        delete event.extra.accessToken;
      }
      return event;
    }
  });
}

export function captureException(error: Error, context?: Record<string, any>): void {
  Sentry.captureException(error, {
    extra: context
  });
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, level);
}
```

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] Database migrations run
- [ ] Redis connection tested
- [ ] API credentials verified for each platform
- [ ] Rate limits configured per platform
- [ ] Error tracking (Sentry) configured
- [ ] Metrics endpoint accessible
- [ ] Health check endpoint responding

### Deployment Steps

1. **Build the worker**:
```bash
cd apps/worker
pnpm build
```

2. **Run tests**:
```bash
pnpm test
pnpm test:coverage
```

3. **Deploy to Railway/Render/etc**:
```bash
# Example for Railway
railway up

# Example for Docker
docker build -t planrrr-worker .
docker run -d --env-file .env.production planrrr-worker
```

4. **Verify deployment**:
```bash
# Check health
curl https://your-worker-domain.com:3001/health

# Check metrics
curl https://your-worker-domain.com:9090/metrics
```

### Post-Deployment

- [ ] Monitor error rates in Sentry
- [ ] Check job processing metrics
- [ ] Verify all platforms publishing successfully
- [ ] Set up alerts for failure rates > 5%
- [ ] Document any issues encountered

## Troubleshooting Guide

### Common Issues

1. **Token Expiration**
   - Check token refresh logic
   - Verify refresh token is stored
   - Check API credentials are valid

2. **Rate Limiting**
   - Monitor rate limit headers
   - Implement backoff strategy
   - Consider upgrading API tier

3. **Memory Leaks**
   - Monitor memory usage
   - Check for unclosed connections
   - Review event listener cleanup

4. **Job Stalling**
   - Increase job timeout
   - Add progress updates
   - Check for infinite loops

### Debug Commands

```bash
# View Redis queue status
redis-cli
> INFO keyspace
> KEYS bull:*

# Check worker logs
docker logs planrrr-worker --tail 100

# Monitor memory usage
docker stats planrrr-worker

# Test specific publisher
pnpm test -- facebook.test.ts
```

## Conclusion

This implementation guide provides a complete roadmap for transforming the worker service from mock implementations to a production-ready system. Follow the phases sequentially, ensuring each phase is fully tested before moving to the next.

Key success factors:
- Implement one platform at a time
- Test thoroughly with real API calls
- Monitor everything in production
- Have rollback plans ready
- Document all API quirks discovered

The estimated timeline for full implementation is 4 weeks with two developers working in parallel.