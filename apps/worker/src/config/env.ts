import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Determine if we're in test mode
const isTestMode = process.env.NODE_ENV === 'test';

// Load environment variables from appropriate .env file
if (isTestMode) {
  // In test mode, load .env.test
  dotenv.config({ 
    path: path.resolve(process.cwd(), '.env.test') 
  });
} else {
  // Otherwise, load regular .env
  dotenv.config({ 
    path: path.resolve(process.cwd(), '.env') 
  });
}

const envSchema = z.object({
  // Node Environment
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  
  // Redis Configuration
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_TLS_ENABLED: z.coerce.boolean().default(false),
  REDIS_MAX_RETRIES_PER_REQUEST: z
    .union([
      z.literal('null').transform(() => null),
      z.coerce.number()
    ])
    .optional(),
  
  // Database Configuration
  DATABASE_URL: z.string().url(),
  
  // Worker Configuration
  WORKER_CONCURRENCY: z.coerce
    .number()
    .min(1)
    .max(20)
    .default(5),
  WORKER_MAX_JOBS_PER_SECOND: z.coerce
    .number()
    .min(1)
    .max(100)
    .default(10),
  WORKER_RETRY_ATTEMPTS: z.coerce
    .number()
    .min(1)
    .max(10)
    .default(3),
  WORKER_RETRY_DELAY: z.coerce
    .number()
    .min(100)
    .max(60000)
    .default(2000),
  WORKER_STALLED_INTERVAL: z.coerce
    .number()
    .min(5000)
    .max(300000)
    .default(30000),
  WORKER_MAX_STALLED_COUNT: z.coerce
    .number()
    .min(1)
    .max(10)
    .default(3),
  
  // Health Check Configuration
  ENABLE_HEALTH_CHECK: z.coerce.boolean().default(true),
  HEALTH_PORT: z.coerce.number().default(3001),
  HEALTH_CHECK_INTERVAL: z.coerce
    .number()
    .min(5000)
    .max(60000)
    .default(10000),
  
  // Social Media APIs - Facebook/Meta
  // In test mode, these are optional with defaults
  FACEBOOK_APP_ID: isTestMode 
    ? z.string().default('test_facebook_app_id')
    : z.string().min(1).optional(),
  FACEBOOK_APP_SECRET: isTestMode
    ? z.string().default('test_facebook_app_secret')
    : z.string().min(1).optional(),
  FACEBOOK_API_VERSION: z.string().default('v18.0'),
  META_GRAPH_API_URL: z
    .string()
    .url()
    .default('https://graph.facebook.com'),
  
  // Social Media APIs - Twitter/X
  TWITTER_API_KEY: isTestMode
    ? z.string().default('test_twitter_api_key')
    : z.string().min(1).optional(),
  TWITTER_API_SECRET: isTestMode
    ? z.string().default('test_twitter_api_secret')
    : z.string().min(1).optional(),
  TWITTER_BEARER_TOKEN: isTestMode
    ? z.string().default('test_twitter_bearer_token')
    : z.string().min(1).optional(),
  TWITTER_API_URL: z
    .string()
    .url()
    .default('https://api.twitter.com'),
  
  // Social Media APIs - YouTube
  YOUTUBE_API_KEY: isTestMode
    ? z.string().default('test_youtube_api_key')
    : z.string().min(1).optional(),
  YOUTUBE_CLIENT_ID: isTestMode
    ? z.string().default('test_youtube_client_id')
    : z.string().min(1).optional(),
  YOUTUBE_CLIENT_SECRET: isTestMode
    ? z.string().default('test_youtube_client_secret')
    : z.string().min(1).optional(),
  YOUTUBE_API_URL: z
    .string()
    .url()
    .default('https://www.googleapis.com/youtube/v3'),
  
  // Social Media APIs - LinkedIn
  LINKEDIN_CLIENT_ID: isTestMode
    ? z.string().default('test_linkedin_client_id')
    : z.string().min(1).optional(),
  LINKEDIN_CLIENT_SECRET: isTestMode
    ? z.string().default('test_linkedin_client_secret')
    : z.string().min(1).optional(),
  LINKEDIN_API_URL: z
    .string()
    .url()
    .default('https://api.linkedin.com'),
  
  // Monitoring & Observability
  // Allow empty string for SENTRY_DSN in test mode
  SENTRY_DSN: isTestMode 
    ? z.string().optional() 
    : z.string().url().optional(),
  SENTRY_ENVIRONMENT: z
    .enum(['development', 'staging', 'production', 'test'])
    .default(isTestMode ? 'test' : 'development'),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(0.1),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug', 'verbose'])
    .default('info'),
  METRICS_ENABLED: z.coerce.boolean().default(false),
  METRICS_PORT: z.coerce.number().default(9090),
  
  // Security Configuration
  ENCRYPTION_KEY: z
    .string()
    .length(64)
    .optional()
    .describe('32 bytes in hex for AES-256'),
  ENCRYPTION_IV: z
    .string()
    .length(32)
    .optional()
    .describe('16 bytes in hex for AES'),
  API_RATE_LIMIT_PER_MINUTE: z.coerce
    .number()
    .min(1)
    .max(1000)
    .default(60),
  
  // Feature Flags
  ENABLE_DRY_RUN: z.coerce.boolean().default(false),
  ENABLE_RETRY_FAILED_POSTS: z.coerce.boolean().default(true),
  ENABLE_AUTO_RESCHEDULE: z.coerce.boolean().default(false),
  
  // Queue Configuration
  QUEUE_PREFIX: z.string().default('planrrr'),
  QUEUE_REMOVE_ON_COMPLETE_AGE: z.coerce
    .number()
    .min(3600)
    .max(604800)
    .default(86400), // 24 hours in seconds
  QUEUE_REMOVE_ON_FAIL_AGE: z.coerce
    .number()
    .min(86400)
    .max(2592000)
    .default(604800), // 7 days in seconds
  
  // Graceful Shutdown
  SHUTDOWN_TIMEOUT_MS: z.coerce
    .number()
    .min(5000)
    .max(60000)
    .default(30000),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 * Throws an error if required variables are missing or invalid
 */
function parseEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formatted = error.errors
        .map((err) => {
          const path = err.path.join('.');
          const message = err.message;
          return `  - ${path}: ${message}`;
        })
        .join('\n');
      
      throw new Error(
        `Environment validation failed:\n${formatted}\n\n` +
        `Please check your .env file and ensure all required variables are set correctly.`
      );
    }
    
    throw error;
  }
}

// Parse and export environment variables
export const env = parseEnv();

// Helper function to check if social media API is configured
export function isSocialMediaConfigured(
  platform: 'FACEBOOK' | 'INSTAGRAM' | 'TWITTER' | 'YOUTUBE' | 'LINKEDIN'
): boolean {
  switch (platform) {
    case 'FACEBOOK':
    case 'INSTAGRAM':
      return Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET);
    
    case 'TWITTER':
      return Boolean(
        env.TWITTER_API_KEY && 
        env.TWITTER_API_SECRET && 
        env.TWITTER_BEARER_TOKEN
      );
    
    case 'YOUTUBE':
      return Boolean(
        env.YOUTUBE_API_KEY && 
        env.YOUTUBE_CLIENT_ID && 
        env.YOUTUBE_CLIENT_SECRET
      );
    
    case 'LINKEDIN':
      return Boolean(
        env.LINKEDIN_CLIENT_ID && 
        env.LINKEDIN_CLIENT_SECRET
      );
    
    default:
      return false;
  }
}

// Export configuration groups for easier access
export const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  db: env.REDIS_DB,
  enableTLS: env.REDIS_TLS_ENABLED,
  maxRetriesPerRequest: env.REDIS_MAX_RETRIES_PER_REQUEST,
} as const;

export const workerConfig = {
  concurrency: env.WORKER_CONCURRENCY,
  maxJobsPerSecond: env.WORKER_MAX_JOBS_PER_SECOND,
  retryAttempts: env.WORKER_RETRY_ATTEMPTS,
  retryDelay: env.WORKER_RETRY_DELAY,
  stalledInterval: env.WORKER_STALLED_INTERVAL,
  maxStalledCount: env.WORKER_MAX_STALLED_COUNT,
} as const;

export const queueConfig = {
  prefix: env.QUEUE_PREFIX,
  removeOnComplete: {
    age: env.QUEUE_REMOVE_ON_COMPLETE_AGE,
  },
  removeOnFail: {
    age: env.QUEUE_REMOVE_ON_FAIL_AGE,
  },
} as const;

export const monitoringConfig = {
  sentryDsn: env.SENTRY_DSN,
  sentryEnvironment: env.SENTRY_ENVIRONMENT,
  sentryTracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  logLevel: env.LOG_LEVEL,
  metricsEnabled: env.METRICS_ENABLED,
  metricsPort: env.METRICS_PORT,
} as const;

export const featureFlags = {
  dryRun: env.ENABLE_DRY_RUN,
  retryFailedPosts: env.ENABLE_RETRY_FAILED_POSTS,
  autoReschedule: env.ENABLE_AUTO_RESCHEDULE,
} as const;

export default env;