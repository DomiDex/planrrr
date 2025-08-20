import { z } from 'zod';
import { createEnv } from './utils';

const webEnvSchema = z.object({
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
  
  // Authentication & Security
  BETTER_AUTH_SECRET: z.string().min(32, 'Auth secret must be at least 32 characters'),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional().transform(val => val?.split(',') || []),
  
  // Encryption Keys
  ENCRYPTION_SECRET: z.string().min(32, 'Encryption secret must be at least 32 characters'),
  FIELD_ENCRYPTION_KEY: z.string().min(32, 'Field encryption key must be at least 32 characters'),
  
  // Session Configuration
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  SESSION_MAX_AGE: z.coerce.number().default(30 * 24 * 60 * 60), // 30 days in seconds
  
  // CSRF Protection
  CSRF_SECRET: z.string().min(16, 'CSRF secret must be at least 16 characters'),
  
  // OAuth - Google
  GOOGLE_CLIENT_ID: z.string().optional().refine(
    (val) => {
      const isProd = process.env.NODE_ENV === 'production';
      return !isProd || (val && val.length > 0);
    },
    'Google OAuth is required in production'
  ),
  GOOGLE_CLIENT_SECRET: z.string().optional().refine(
    (val) => {
      const isProd = process.env.NODE_ENV === 'production';
      return !isProd || (val && val.length > 0);
    },
    'Google OAuth is required in production'
  ),
  
  // OAuth - Facebook
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  
  // OAuth - X (Twitter)
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  
  // Storage Configuration (R2/S3)
  STORAGE_PROVIDER: z.enum(['r2', 's3', 'local']).default('local'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('planrrr-media'),
  R2_PUBLIC_URL: z.string().url().optional(),
  
  // Email Configuration
  EMAIL_PROVIDER: z.enum(['resend', 'sendgrid', 'smtp', 'console']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@planrrr.io'),
  
  // Rate Limiting
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60), // seconds
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  
  // AI Services (Optional)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'none']).default('none'),
  
  // Monitoring & Analytics
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  POSTHOG_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().url().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Feature Flags
  FEATURE_OAUTH_ENABLED: z.coerce.boolean().default(true),
  FEATURE_AI_CONTENT_GENERATION: z.coerce.boolean().default(false),
  FEATURE_TEAM_COLLABORATION: z.coerce.boolean().default(true),
  FEATURE_ANALYTICS_DASHBOARD: z.coerce.boolean().default(false),
  
  // Security Headers
  CONTENT_SECURITY_POLICY: z.string().optional(),
  ALLOWED_HOSTS: z.string().optional().transform(val => val?.split(',') || []),
  
  // Development Only
  NEXT_PUBLIC_DEBUG_MODE: z.coerce.boolean().default(false),
  SKIP_ENV_VALIDATION: z.coerce.boolean().default(false),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export const webEnv = createEnv({
  schema: webEnvSchema,
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
  onValidationError: (error) => {
    console.error('❌ Invalid environment variables in web app:');
    console.error(error.flatten());
    process.exit(1);
  },
});