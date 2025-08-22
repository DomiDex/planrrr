// Package: @repo/api
// Path: apps/api/src/lib/orpc.ts
// Dependencies: @orpc/server, hono

import { RPCHandler } from '@orpc/server/fetch';
import { apiRouter } from '../procedures/index.js';
import type { Context } from 'hono';
import type { AppContext } from '../types/index.js';
import { logger } from './logger.js';

// Create ORPC fetch handler
const orpcHandler = new RPCHandler(apiRouter);

// Hono middleware to handle ORPC requests
export async function handleORPC(c: Context<{ Variables: AppContext }>) {
  try {
    // Build context from Hono context
    const orpcContext = {
      requestId: c.get('requestId'),
      headers: Object.fromEntries(c.req.raw.headers.entries()),
      user: c.get('user') || null,
      apiVersion: c.get('apiVersion') || 'v1',
      rateLimit: c.get('rateLimit') || undefined
    };
    
    // Handle the request with ORPC
    const result = await orpcHandler.handle(c.req.raw, {
      context: orpcContext,
      prefix: '/api/orpc'
    });
    
    if (result.response) {
      // Copy response headers to Hono context
      result.response.headers.forEach((value: string, key: string) => {
        c.header(key, value);
      });
      
      // Return the response body
      const contentType = result.response.headers.get('content-type');
      const status = result.response.status as Parameters<typeof c.json>[1];
      
      if (contentType?.includes('application/json')) {
        const data = await result.response.json() as Record<string, unknown>;
        return c.json(data, status);
      } else {
        const text = await result.response.text();
        return c.text(text, status as Parameters<typeof c.text>[1]);
      }
    }
    
    // No matching procedure
    return c.json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Procedure not found'
      },
      meta: {
        requestId: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    }, 404);
  } catch (error) {
    logger.error('ORPC Handler Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: c.get('requestId')
    });
    
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to process RPC request'
      },
      meta: {
        requestId: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    }, 500);
  }
}