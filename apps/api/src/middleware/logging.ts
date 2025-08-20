// Package: @repo/api
// Path: apps/api/src/middleware/logging.ts
// Dependencies: hono

import { Context, Next } from 'hono';

export function requestLogger() {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    const requestId = c.get('requestId') || 'unknown';
    
    console.log(`[${requestId}] ${c.req.method} ${c.req.path} - Started`);
    
    await next();
    
    const duration = Date.now() - start;
    const status = c.res.status;
    
    console.log(`[${requestId}] ${c.req.method} ${c.req.path} - ${status} - ${duration}ms`);
  };
}