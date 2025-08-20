// Package: @repo/api
// Path: apps/api/src/app.ts
// Dependencies: hono, @sentry/node

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';
import { requestId } from 'hono/request-id';
import { timing } from 'hono/timing';
import * as Sentry from '@sentry/node';

// Routes
import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import teamRoutes from './routes/teams.js';
import connectionRoutes from './routes/connections.js';
import healthRoutes from './routes/health.js';
import aiRoutes from './routes/ai.js';

// Middleware
import { errorHandler } from './middleware/error.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { validateApiKey } from './middleware/apiKey.js';
import { requestLogger } from './middleware/logging.js';

export function createApp() {
  const app = new Hono();

  // Request ID and timing
  app.use('*', requestId());
  app.use('*', timing());

  // Logging
  app.use('*', requestLogger());
  if (process.env.NODE_ENV === 'development') {
    app.use('*', honoLogger());
  }

  // Compression
  app.use('*', compress({
    encoding: 'gzip'
  }));

  // CORS configuration
  app.use('*', cors({
    origin: (origin) => {
      const allowedOrigins = [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'https://planrrr.io',
        'https://www.planrrr.io',
        'https://app.planrrr.io'
      ];
      
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return '*';
      
      // Check if origin is allowed
      return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-API-Key',
      'X-Team-Id'
    ],
    exposeHeaders: [
      'X-Request-Id',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    maxAge: 86400 // 24 hours
  }));

  // Security headers
  app.use('*', secureHeaders({
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: '?1',
    referrerPolicy: 'strict-origin-when-cross-origin',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
    xContentTypeOptions: 'nosniff',
    xDnsPrefetchControl: 'off',
    xDownloadOptions: 'noopen',
    xFrameOptions: 'DENY',
    xPermittedCrossDomainPolicies: 'none',
    xXssProtection: '0'
  }));

  // Health check (no rate limiting)
  app.route('/health', healthRoutes);

  // Internal API endpoints (for worker communication)
  app.use('/internal/*', validateApiKey());

  // Public API rate limiting
  app.use('/api/*', rateLimiter());

  // API routes
  app.route('/api/auth', authRoutes);
  app.route('/api/posts', postRoutes);
  app.route('/api/teams', teamRoutes);
  app.route('/api/connections', connectionRoutes);
  app.route('/api/ai', aiRoutes);

  // Internal routes (for worker)
  app.get('/internal/post/:id', validateApiKey(), async (c) => {
    const postId = c.req.param('id');
    // TODO: Return post data for worker processing
    return c.json({ success: true, data: { postId } });
  });

  // Sentry error tracking
  app.onError((err, c) => {
    Sentry.captureException(err, {
      extra: {
        requestId: c.get('requestId'),
        path: c.req.path,
        method: c.req.method
      }
    });
    return errorHandler(err, c);
  });

  // 404 handler
  app.notFound((c) => {
    return c.json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${c.req.method} ${c.req.path} not found`
      },
      meta: {
        requestId: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    }, 404);
  });

  return app;
}