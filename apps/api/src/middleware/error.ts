// Package: @repo/api
// Path: apps/api/src/middleware/error.ts
// Dependencies: hono

import { Context } from 'hono';
import { logger } from '../lib/logger.js';

export function errorHandler(err: Error, c: Context) {
  logger.error('Request error:', {
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
    requestId: c.get('requestId')
  });

  // Check for known error types
  if (err.name === 'ValidationError') {
    return c.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message
      },
      meta: {
        requestId: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    }, 400);
  }

  if (err.name === 'UnauthorizedError') {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      },
      meta: {
        requestId: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    }, 401);
  }

  // Default error response
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message
    },
    meta: {
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString()
    }
  }, 500);
}