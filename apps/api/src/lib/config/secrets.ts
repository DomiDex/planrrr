// Package: @repo/api
// Path: apps/api/src/lib/config/secrets.ts
// Dependencies: zod, crypto

import { z } from 'zod';
import crypto from 'crypto';
import { logger } from '../logger.js';

// Secret validation schema
const SecretSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ENCRYPTION_SECRET: z.string().min(32, 'ENCRYPTION_SECRET must be at least 32 characters'),
  INTERNAL_API_KEY: z.string().min(32, 'INTERNAL_API_KEY must be at least 32 characters')
});

export type Secrets = z.infer<typeof SecretSchema>;

// Cache for loaded secrets
let cachedSecrets: Secrets | null = null;

/**
 * Generate a cryptographically secure random secret
 */
function generateSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64');
}

/**
 * Load and validate secrets from environment variables
 * Generates random secrets in development if not provided
 */
export function loadSecrets(): Secrets {
  // Return cached secrets if already loaded
  if (cachedSecrets) {
    return cachedSecrets;
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';

  // Generate or load secrets
  const secrets = {
    JWT_SECRET: process.env.JWT_SECRET || 
      (isDevelopment || isTest ? generateSecret(32) : undefined),
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ||
      (isDevelopment || isTest ? generateSecret(32) : undefined),
    ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET ||
      (isDevelopment || isTest ? generateSecret(32) : undefined),
    INTERNAL_API_KEY: process.env.INTERNAL_API_KEY ||
      (isDevelopment || isTest ? generateSecret(32) : undefined)
  };

  // Validate secrets
  const result = SecretSchema.safeParse(secrets);
  
  if (!result.success) {
    const errors = result.error.format();
    logger.error('❌ Invalid secrets configuration', { errors });
    
    // In production, fail fast
    if (!isDevelopment && !isTest) {
      console.error('FATAL: Missing required secrets in production environment');
      console.error('Required secrets:', Object.keys(SecretSchema.shape));
      process.exit(1);
    }
    
    // In development, log warning but continue
    logger.warn('⚠️ Using auto-generated secrets for development');
  }

  // Log secret loading (without exposing values)
  logger.info('✅ Secrets loaded successfully', {
    environment: process.env.NODE_ENV,
    secretsLoaded: Object.keys(secrets).map(key => ({
      key,
      length: secrets[key as keyof typeof secrets]?.length || 0,
      source: process.env[key] ? 'environment' : 'generated'
    }))
  });

  cachedSecrets = result.success ? result.data : secrets as Secrets;
  return cachedSecrets;
}

/**
 * Verify secrets are properly configured
 * Use in health checks
 */
export function verifySecrets(): { valid: boolean; errors?: string[] } {
  try {
    const secrets = loadSecrets();
    const errors: string[] = [];

    // Check each secret
    Object.entries(secrets).forEach(([key, value]) => {
      if (!value || value.length < 32) {
        errors.push(`${key} is invalid or too short`);
      }
    });

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    return {
      valid: false,
      errors: ['Failed to load secrets']
    };
  }
}

/**
 * Clear cached secrets (useful for testing)
 */
export function clearSecretsCache(): void {
  cachedSecrets = null;
}