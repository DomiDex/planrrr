// Package: @repo/api
// Path: apps/api/src/middleware/cors.ts
// Dependencies: hono

import { cors } from 'hono/cors';
import { logger } from '../lib/logger.js';

// Environment-aware CORS configuration
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];
  
  // Primary frontend URL
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  origins.push(frontendUrl);
  
  if (process.env.NODE_ENV === 'production') {
    // Production domains
    origins.push(
      'https://planrrr.io',
      'https://www.planrrr.io',
      'https://app.planrrr.io',
      'https://api.planrrr.io'
    );
  } else {
    // Development domains
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    );
  }
  
  // Add custom allowed origins from environment
  if (process.env.ALLOWED_ORIGINS) {
    const customOrigins = process.env.ALLOWED_ORIGINS.split(',')
      .map(origin => origin.trim())
      .filter(Boolean);
    origins.push(...customOrigins);
  }
  
  // Remove duplicates
  return [...new Set(origins)];
};

// CORS middleware configuration
export const corsMiddleware = cors({
  origin: (origin, c) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Allow requests with no origin (non-browser requests)
    if (!origin) {
      return undefined;
    }
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      return origin;
    }
    
    // Check for wildcard subdomain support (e.g., *.planrrr.io)
    const isAllowedSubdomain = allowedOrigins.some(allowed => {
      if (allowed.includes('*.')) {
        const domain = allowed.replace('*.', '');
        return origin.endsWith(domain);
      }
      return false;
    });
    
    if (isAllowedSubdomain) {
      return origin;
    }
    
    // Log denied origin for debugging
    logger.warn('CORS: Denied origin', {
      origin,
      allowedOrigins,
      path: c.req.path,
      method: c.req.method
    });
    
    return null;
  },
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-API-Version',
    'X-CSRF-Token',
    'X-API-Key',
    'X-Team-ID',
    'X-User-Agent'
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  exposeHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-RateLimit-Procedure',
    'X-API-Version',
    'X-API-Deprecation',
    'Retry-After',
    'Content-Length',
    'Content-Type'
  ],
  credentials: true,
  maxAge: 86400 // 24 hours
});

// Preflight request handler for complex CORS scenarios
export function handlePreflight(origin: string | undefined): Response {
  const allowedOrigins = getAllowedOrigins();
  const headers = new Headers();
  
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // Allow non-browser requests
    headers.set('Access-Control-Allow-Origin', '*');
  }
  
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-API-Version, X-CSRF-Token');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Content-Length', '0');
  
  return new Response(null, {
    status: 204,
    headers
  });
}

// CORS configuration info for documentation
export const corsInfo = {
  getAllowedOrigins,
  maxAge: 86400,
  credentials: true,
  description: 'CORS configuration for planrrr.io API'
};