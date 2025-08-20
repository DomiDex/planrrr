// Package: @repo/api
// Path: apps/api/src/middleware/apiKey.ts
// Dependencies: hono

import { Context, Next } from 'hono';

export function validateApiKey() {
  return async (c: Context, next: Next) => {
    const apiKey = c.req.header('X-API-Key');
    
    if (!apiKey) {
      return c.json({
        success: false,
        error: {
          code: 'API_KEY_REQUIRED',
          message: 'API key is required for this endpoint'
        }
      }, 401);
    }
    
    const validApiKey = process.env.INTERNAL_API_KEY;
    
    if (!validApiKey) {
      console.error('INTERNAL_API_KEY not configured');
      return c.json({
        success: false,
        error: {
          code: 'CONFIGURATION_ERROR',
          message: 'Server configuration error'
        }
      }, 500);
    }
    
    if (apiKey !== validApiKey) {
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