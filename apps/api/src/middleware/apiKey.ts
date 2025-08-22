// Package: @repo/api
// Path: apps/api/src/middleware/apiKey.ts
// Dependencies: hono, crypto

import { Context, Next } from 'hono';
import crypto from 'crypto';
import { loadSecrets } from '../lib/config/secrets.js';
import { logger } from '../lib/logger.js';

// Load secrets once at module initialization
const secrets = loadSecrets();

/**
 * Validate internal API key for worker communication
 * Uses timing-safe comparison to prevent timing attacks
 */
export function validateApiKey() {
  return async (c: Context, next: Next) => {
    const apiKey = c.req.header('X-API-Key');
    
    if (!apiKey) {
      logger.warn('API key missing in request', {
        path: c.req.path,
        ip: c.req.header('X-Forwarded-For')
      });
      return c.json({
        success: false,
        error: {
          code: 'API_KEY_REQUIRED',
          message: 'API key is required for this endpoint'
        }
      }, 401);
    }
    
    const validApiKey = secrets.INTERNAL_API_KEY;
    
    if (!validApiKey) {
      logger.error('INTERNAL_API_KEY not configured');
      return c.json({
        success: false,
        error: {
          code: 'CONFIGURATION_ERROR',
          message: 'Server configuration error'
        }
      }, 500);
    }
    
    // Use timing-safe comparison to prevent timing attacks
    const providedBuffer = Buffer.from(apiKey);
    const validBuffer = Buffer.from(validApiKey);
    
    // Ensure buffers are same length for timing-safe comparison
    let isValid = providedBuffer.length === validBuffer.length;
    
    if (isValid) {
      isValid = crypto.timingSafeEqual(providedBuffer, validBuffer);
    }
    
    if (!isValid) {
      logger.warn('Invalid API key attempt', {
        path: c.req.path,
        ip: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP')
      });
      return c.json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key'
        }
      }, 401);
    }
    
    // Mark request as internal
    c.set('isInternal', true);
    await next();
  };
}