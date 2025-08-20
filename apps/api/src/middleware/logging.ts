// Package: @repo/api
// Path: apps/api/src/middleware/logging.ts
// Dependencies: hono

import { Context, Next } from 'hono';
import { logger } from '../lib/logger.js';

export function requestLogger() {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    const requestId = c.get('requestId') || 'unknown';
    
    // Log request
    logger.info('Request received', {
      requestId,
      method: c.req.method,
      path: c.req.path,
      query: c.req.query(),
      ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    });
    
    await next();
    
    // Log response
    const duration = Date.now() - start;
    logger.info('Request completed', {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration: `${duration}ms`
    });
  };
}