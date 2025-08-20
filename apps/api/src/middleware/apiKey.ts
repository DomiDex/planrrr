// Package: @repo/api
// Path: apps/api/src/middleware/apiKey.ts
// Dependencies: hono

import { Context, Next } from 'hono';

export function validateApiKey() {
  return async (c: Context, next: Next) => {
    const apiKey = c.req.header('x-api-key');
    const expectedKey = process.env.INTERNAL_API_KEY;
    
    if (!expectedKey) {
      console.warn('INTERNAL_API_KEY not configured');
      return c.json({
        success: false,
        error: {
          code: 'CONFIGURATION_ERROR',
          message: 'API key validation not configured'
        }
      }, 500);
    }
    
    if (apiKey !== expectedKey) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key'
        }
      }, 401);
    }
    
    await next();
  };
}