// TODO: Enable when @repo/env package is properly configured
// import { webEnv } from '@repo/env';

// Define environment variables type
interface ProcessEnv {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  SESSION_MAX_AGE?: string;
  STORAGE_PROVIDER?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_PUBLIC_URL?: string;
  EMAIL_PROVIDER?: string;
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  RATE_LIMIT_ENABLED?: string;
  RATE_LIMIT_WINDOW?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  AI_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  POSTHOG_KEY?: string;
  POSTHOG_HOST?: string;
  LOG_LEVEL?: string;
  FEATURE_OAUTH_ENABLED?: string;
  FEATURE_AI_CONTENT_GENERATION?: string;
  FEATURE_TEAM_COLLABORATION?: string;
  FEATURE_ANALYTICS_DASHBOARD?: string;
}

// Temporary fallback until @repo/env is configured
const env = process.env as ProcessEnv;

// Type-safe environment variable access
export function getEnv<K extends keyof ProcessEnv>(key: K): ProcessEnv[K] {
  const value = env[key];
  if (value === undefined) {
    throw new Error(`Missing environment variable: ${String(key)}`);
  }
  return value;
}

// Check if running in production
export const isProduction = env.NODE_ENV === 'production';

// Check if running in development
export const isDevelopment = env.NODE_ENV === 'development';

// Check if running in test
export const isTest = env.NODE_ENV === 'test';

// Feature flag helpers
export const features = {
  oauth: env.FEATURE_OAUTH_ENABLED,
  aiContent: env.FEATURE_AI_CONTENT_GENERATION,
  teamCollaboration: env.FEATURE_TEAM_COLLABORATION,
  analytics: env.FEATURE_ANALYTICS_DASHBOARD,
} as const;

// Database configuration
export const database = {
  url: env.DATABASE_URL,
  ssl: isProduction,
} as const;

// Auth configuration
export const auth = {
  secret: env.BETTER_AUTH_SECRET,
  url: env.BETTER_AUTH_URL,
  trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS || [],
  sessionMaxAge: env.SESSION_MAX_AGE,
} as const;

// Storage configuration
export const storage = {
  provider: env.STORAGE_PROVIDER,
  r2: {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucketName: env.R2_BUCKET_NAME,
    publicUrl: env.R2_PUBLIC_URL,
  },
} as const;

// Email configuration
export const email = {
  provider: env.EMAIL_PROVIDER,
  from: env.EMAIL_FROM,
  resendApiKey: env.RESEND_API_KEY,
} as const;

// Rate limiting configuration
export const rateLimit = {
  enabled: env.RATE_LIMIT_ENABLED,
  window: env.RATE_LIMIT_WINDOW,
  maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  upstash: {
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  },
} as const;

// OAuth disabled - using email/password authentication only
export const oauth = {
  enabled: false,
} as const;

// AI configuration
export const ai = {
  provider: env.AI_PROVIDER,
  openai: {
    apiKey: env.OPENAI_API_KEY,
    enabled: env.AI_PROVIDER === 'openai' && Boolean(env.OPENAI_API_KEY),
  },
  anthropic: {
    apiKey: env.ANTHROPIC_API_KEY,
    enabled: env.AI_PROVIDER === 'anthropic' && Boolean(env.ANTHROPIC_API_KEY),
  },
} as const;

// Monitoring configuration
export const monitoring = {
  sentry: {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    enabled: Boolean(env.SENTRY_DSN),
  },
  posthog: {
    key: env.POSTHOG_KEY,
    host: env.POSTHOG_HOST,
    enabled: Boolean(env.POSTHOG_KEY),
  },
  logLevel: env.LOG_LEVEL,
} as const;

// Export full validated environment for edge cases
export default env;