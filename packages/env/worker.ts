import { z } from 'zod';
import { createEnv } from './utils';

const workerEnvSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Database Configuration
  DATABASE_URL: z.string().url().refine(
    (url) => {
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction && !url.includes('sslmode=require')) {
        return false;
      }
      return true;
    },
    'Production database URL must include sslmode=require'
  ),
  
  // Redis Configuration (Queue)
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().refine(
    (val) => {
      const isProd = process.env.NODE_ENV === 'production';
      return !isProd || (val && val.length > 0);
    },
    'Redis password is required in production'
  ),
  REDIS_TLS_ENABLED: z.coerce.boolean().default(false),
  REDIS_DB: z.coerce.number().default(0),
  
  // Queue Configuration
  QUEUE_NAME: z.string().default('social-posts'),
  QUEUE_CONCURRENCY: z.coerce.number().default(5),
  QUEUE_MAX_RETRIES: z.coerce.number().default(3),
  QUEUE_RETRY_DELAY: z.coerce.number().default(60000), // milliseconds
  QUEUE_STALLED_INTERVAL: z.coerce.number().default(30000),
  QUEUE_MAX_STALLED_COUNT: z.coerce.number().default(1),
  
  // Social Media API Keys - Facebook/Instagram
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  META_API_VERSION: z.string().default('v18.0'),
  
  // Social Media API Keys - X (Twitter)
  X_API_KEY: z.string().optional(),
  X_API_SECRET: z.string().optional(),
  X_ACCESS_TOKEN: z.string().optional(),
  X_ACCESS_TOKEN_SECRET: z.string().optional(),
  X_BEARER_TOKEN: z.string().optional(),
  
  // Social Media API Keys - LinkedIn
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_ACCESS_TOKEN: z.string().optional(),
  
  // Social Media API Keys - YouTube
  YOUTUBE_API_KEY: z.string().optional(),
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  
  // Social Media API Keys - TikTok
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  
  // Storage Configuration (for media processing)
  STORAGE_PROVIDER: z.enum(['r2', 's3', 'local']).default('local'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('planrrr-media'),
  
  // Worker Health & Monitoring
  WORKER_NAME: z.string().default('planrrr-worker'),
  WORKER_HEALTH_CHECK_PORT: z.coerce.number().default(4000),
  WORKER_METRICS_ENABLED: z.coerce.boolean().default(true),
  
  // Logging & Monitoring
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  
  // Encryption (for sensitive data)
  ENCRYPTION_SECRET: z.string().min(32, 'Encryption secret must be at least 32 characters'),
  
  // Rate Limiting for APIs
  API_RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(60),
  
  // Webhook Configuration
  WEBHOOK_SECRET: z.string().min(32).optional(),
  WEBHOOK_RETRY_ENABLED: z.coerce.boolean().default(true),
  WEBHOOK_RETRY_COUNT: z.coerce.number().default(3),
  
  // Feature Flags
  FEATURE_BATCH_PROCESSING: z.coerce.boolean().default(true),
  FEATURE_MEDIA_OPTIMIZATION: z.coerce.boolean().default(true),
  FEATURE_AUTO_RETRY: z.coerce.boolean().default(true),
  
  // Development
  SKIP_ENV_VALIDATION: z.coerce.boolean().default(false),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export const workerEnv = createEnv({
  schema: workerEnvSchema,
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
  onValidationError: (error) => {
    console.error('❌ Invalid environment variables in worker:');
    console.error(error.flatten());
    process.exit(1);
  },
});