// Package: @repo/api
// Path: apps/api/src/app.ts
// Dependencies: hono, @sentry/node

import { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';
import { compress } from 'hono/compress';
import { timing } from 'hono/timing';
import * as Sentry from '@sentry/node';
import type { AppContext } from './types/index.js';

// Routes
import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import teamRoutes from './routes/teams.js';
import connectionRoutes from './routes/connections.js';
import healthRoutes from './routes/health.js';
import aiRoutes from './routes/ai.js';

// Middleware
import { errorHandler } from './middleware/error.js';
import { rateLimiter, strictRateLimiter } from './middleware/rateLimit.js';
import { validateApiKey } from './middleware/apiKey.js';
import { requestLogger } from './middleware/logging.js';
import { corsMiddleware } from './middleware/cors.js';
import { 
  securityHeadersMiddleware, 
  requestIdMiddleware, 
  contentTypeValidator,
  csrfProtection,
  securityViolationReporter
} from './middleware/security.js';
import { apiVersioning } from './middleware/versioning.js';

export function createApp() {
  const app = new Hono<{ Variables: AppContext }>();

  // Core middleware - Order matters!
  // 1. Request ID generation (must be first)
  app.use('*', requestIdMiddleware());
  
  // 2. Timing middleware
  app.use('*', timing());

  // 3. Logging
  app.use('*', requestLogger());
  if (process.env.NODE_ENV === 'development') {
    app.use('*', honoLogger());
  }

  // 4. CORS configuration (before security headers)
  app.use('*', corsMiddleware);

  // 5. Security headers
  app.use('*', securityHeadersMiddleware);
  
  // 6. API versioning
  app.use('*', apiVersioning());
  
  // 7. Compression
  app.use('*', compress({
    encoding: 'gzip'
  }));
  
  // 8. Content type validation for API routes
  app.use('/api/*', contentTypeValidator(['application/json']));
  
  // 9. Security violation reporting
  app.use('*', securityViolationReporter());
  
  // 10. CSRF protection for state-changing operations
  app.use('/api/*/create', csrfProtection);
  app.use('/api/*/update', csrfProtection);
  app.use('/api/*/delete', csrfProtection);
  app.use('/api/auth/register', csrfProtection);
  app.use('/api/auth/login', csrfProtection);

  // Health check endpoints (no rate limiting)
  app.route('/health', healthRoutes);
  
  // Security.txt endpoint
  app.get('/.well-known/security.txt', (c) => {
    const securityTxt = `
Contact: security@planrrr.io
Expires: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}
Preferred-Languages: en
Canonical: https://planrrr.io/.well-known/security.txt
Policy: https://planrrr.io/security-policy
Acknowledgments: https://planrrr.io/security/acknowledgments
`.trim();
    
    c.header('Content-Type', 'text/plain');
    return c.text(securityTxt);
  });
  
  // API version info endpoint
  app.get('/api/version', (c) => {
    const version = c.get('apiVersion') || 'v1';
    return c.json({
      success: true,
      data: {
        version,
        supported: ['v1', 'v2'],
        deprecated: version === 'v1' ? true : false,
        deprecationDate: version === 'v1' ? '2025-12-31' : null
      }
    });
  });

  // Internal API endpoints (for worker communication)
  app.use('/internal/*', validateApiKey());

  // Rate limiting for different endpoint types
  app.use('/api/auth/*', strictRateLimiter()); // Strict for auth
  app.use('/api/ai/*', rateLimiter({ windowMs: 60000, max: 20 })); // Lower for AI
  app.use('/api/*', rateLimiter()); // Standard for other endpoints

  // API routes with versioning support
  app.route('/api/auth', authRoutes);
  app.route('/api/posts', postRoutes);
  app.route('/api/teams', teamRoutes);
  app.route('/api/connections', connectionRoutes);
  app.route('/api/ai', aiRoutes);
  
  // Versioned API routes (v1 and v2)
  app.route('/api/v1/auth', authRoutes);
  app.route('/api/v1/posts', postRoutes);
  app.route('/api/v1/teams', teamRoutes);
  app.route('/api/v1/connections', connectionRoutes);
  
  app.route('/api/v2/auth', authRoutes);
  app.route('/api/v2/posts', postRoutes);
  app.route('/api/v2/teams', teamRoutes);
  app.route('/api/v2/connections', connectionRoutes);
  app.route('/api/v2/ai', aiRoutes);

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
    const requestId = c.get('requestId');
    const apiVersion = c.get('apiVersion');
    
    return c.json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${c.req.method} ${c.req.path} not found`
      },
      meta: {
        requestId,
        apiVersion,
        timestamp: new Date().toISOString(),
        path: c.req.path,
        method: c.req.method
      }
    }, 404);
  });

  return app;
}