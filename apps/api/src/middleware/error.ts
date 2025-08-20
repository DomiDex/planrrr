// Package: @repo/api
// Path: apps/api/src/middleware/error.ts
// Dependencies: hono

import { Context } from 'hono';

export function errorHandler(err: Error, c: Context) {
  console.error('API Error:', err);
  
  // Handle different error types
  if (err.message.includes('Unauthorized')) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: err.message
      }
    }, 401);
  }
  
  if (err.message.includes('Not found')) {
    return c.json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: err.message
      }
    }, 404);
  }
  
  // Default error response
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An error occurred' 
        : err.message
    }
  }, 500);
}