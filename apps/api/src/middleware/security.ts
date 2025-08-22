// Package: @repo/api
// Path: apps/api/src/middleware/security.ts
// Dependencies: hono, nanoid

import { Context, Next } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { csrf } from 'hono/csrf';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger.js';
import type { AppContext } from '../types/index.js';

// Security headers configuration - conditional based on environment
const cspConfig = process.env.NODE_ENV === 'production' ? {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'", // Required for Next.js inline scripts
    'https://cdn.jsdelivr.net',
    'https://unpkg.com'
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Required for inline styles
    'https://fonts.googleapis.com',
    'https://cdn.jsdelivr.net'
  ],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
  imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
  connectSrc: [
    "'self'",
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://api.planrrr.io',
    'wss://api.planrrr.io',
    'https://*.amazonaws.com', // For S3/R2 uploads
    'https://*.cloudflare.com'  // For R2 storage
  ],
  mediaSrc: ["'self'", 'https:', 'blob:'],
  frameSrc: ["'none'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  upgradeInsecureRequests: []
} : undefined; // undefined instead of false for development

export const securityHeadersMiddleware = secureHeaders({
  contentSecurityPolicy: cspConfig,
  crossOriginEmbedderPolicy: false, // Can break some third-party embeds
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'cross-origin', // Allow resources to be loaded cross-origin
  originAgentCluster: '?1',
  referrerPolicy: 'strict-origin-when-cross-origin',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
  xContentTypeOptions: 'nosniff',
  xDnsPrefetchControl: 'off',
  xDownloadOptions: 'noopen',
  xFrameOptions: 'DENY',
  xPermittedCrossDomainPolicies: 'none',
  xXssProtection: '0' // Disabled in modern browsers, can cause issues
});

// CSRF protection configuration
export const csrfProtection = csrf({
  origin: (origin) => {
    // Get allowed origins for CSRF
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://planrrr.io',
      'https://www.planrrr.io',
      'https://app.planrrr.io'
    ];
    
    if (process.env.NODE_ENV !== 'production') {
      allowedOrigins.push(
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000'
      );
    }
    
    // Add custom origins from environment
    if (process.env.CSRF_ALLOWED_ORIGINS) {
      allowedOrigins.push(...process.env.CSRF_ALLOWED_ORIGINS.split(','));
    }
    
    return allowedOrigins.includes(origin);
  }
});

// Request ID middleware
export function requestIdMiddleware() {
  return async (c: Context<{ Variables: AppContext }>, next: Next) => {
    // Check for existing request ID or generate new one
    const existingId = c.req.header('X-Request-ID');
    const requestId = existingId || `req_${nanoid(12)}`;
    
    // Store in context
    c.set('requestId', requestId);
    
    // Add to response headers
    c.header('X-Request-ID', requestId);
    
    // Log request with ID
    logger.info('Request received', {
      requestId,
      method: c.req.method,
      path: c.req.path,
      ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
      userAgent: c.req.header('user-agent')
    });
    
    // Track request timing
    const start = Date.now();
    
    try {
      await next();
      
      // Log response
      const duration = Date.now() - start;
      logger.info('Request completed', {
        requestId,
        status: c.res.status,
        duration,
        path: c.req.path
      });
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Request failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration,
        path: c.req.path
      });
      throw error;
    }
  };
}

// Content type validation middleware
export function contentTypeValidator(allowedTypes: string[] = ['application/json']) {
  return async (c: Context, next: Next) => {
    // Skip validation for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      return next();
    }
    
    const contentType = c.req.header('content-type');
    
    // Check if content type is present
    if (!contentType) {
      return c.json({
        success: false,
        error: {
          code: 'MISSING_CONTENT_TYPE',
          message: 'Content-Type header is required'
        }
      }, 400);
    }
    
    // Check if content type is allowed
    const isAllowed = allowedTypes.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );
    
    if (!isAllowed) {
      logger.warn('Invalid content type', {
        contentType,
        allowedTypes,
        path: c.req.path
      });
      
      return c.json({
        success: false,
        error: {
          code: 'INVALID_CONTENT_TYPE',
          message: `Content-Type must be one of: ${allowedTypes.join(', ')}`
        }
      }, 415);
    }
    
    return next();
  };
}

// Secure cookie configuration
export const secureCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 // 7 days
};

// Security policy violation reporter
export function securityViolationReporter() {
  return async (c: Context, next: Next) => {
    // Add CSP report endpoint
    if (c.req.path === '/.well-known/csp-report') {
      const report = await c.req.json();
      
      logger.warn('CSP violation reported', {
        report,
        userAgent: c.req.header('user-agent'),
        ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
      });
      
      // Return 204 No Content for CSP reports
      c.status(204);
      return c.body(null);
    }
    
    return next();
  };
}

// Combined security middleware for easy application
export function applySecurityMiddleware() {
  return [
    requestIdMiddleware(),
    securityHeadersMiddleware,
    contentTypeValidator(['application/json', 'multipart/form-data'])
  ];
}