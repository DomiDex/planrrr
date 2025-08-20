import { z } from 'zod';
import { createEnv } from './utils';

const apiEnvSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Server Configuration
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  API_URL: z.string().url().default('http://localhost:3001'),
  
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
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),
  
  // Redis Configuration (Cache & Queue)
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
  CACHE_TTL: z.coerce.number().default(3600), // seconds
  
  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  
  // API Keys & Secrets
  API_SECRET_KEY: z.string().min(32, 'API secret key must be at least 32 characters'),
  INTERNAL_API_KEY: z.string().min(32, 'Internal API key must be at least 32 characters'),
  
  // Encryption
  ENCRYPTION_SECRET: z.string().min(32, 'Encryption secret must be at least 32 characters'),
  HASH_SALT_ROUNDS: z.coerce.number().default(10),
  
  // Rate Limiting (Upstash)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60), // seconds
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  
  // CORS Configuration
  CORS_ENABLED: z.coerce.boolean().default(true),
  CORS_ORIGINS: z.string().default('http://localhost:3000').transform(val => val.split(',')),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),
  
  // Queue Configuration
  QUEUE_NAME: z.string().default('social-posts'),
  QUEUE_REDIS_HOST: z.string().optional(),
  QUEUE_REDIS_PORT: z.coerce.number().optional(),
  
  // Monitoring & Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  
  // OpenTelemetry
  OTEL_ENABLED: z.coerce.boolean().default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default('planrrr-api'),
  
  // API Documentation
  SWAGGER_ENABLED: z.coerce.boolean().default(true),
  SWAGGER_PATH: z.string().default('/docs'),
  
  // Health Checks
  HEALTH_CHECK_PATH: z.string().default('/health'),
  READINESS_CHECK_PATH: z.string().default('/ready'),
  
  // Timeouts
  REQUEST_TIMEOUT: z.coerce.number().default(30000), // milliseconds
  DATABASE_TIMEOUT: z.coerce.number().default(5000),
  
  // Security
  HELMET_ENABLED: z.coerce.boolean().default(true),
  TRUST_PROXY: z.coerce.boolean().default(false),
  
  // Feature Flags
  FEATURE_GRAPHQL_ENABLED: z.coerce.boolean().default(false),
  FEATURE_WEBHOOKS_ENABLED: z.coerce.boolean().default(true),
  FEATURE_BATCH_OPERATIONS: z.coerce.boolean().default(true),
  
  // Development
  SKIP_ENV_VALIDATION: z.coerce.boolean().default(false),
  FORCE_COLOR: z.coerce.boolean().default(true),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const apiEnv = createEnv({
  schema: apiEnvSchema,
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
  onValidationError: (error) => {
    console.error('❌ Invalid environment variables in API:');
    console.error(error.flatten());
    process.exit(1);
  },
});