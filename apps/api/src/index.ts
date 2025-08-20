// Package: @repo/api
// Path: apps/api/src/index.ts  
// Dependencies: @hono/node-server, winston, @sentry/node

import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { initializeSentry } from './lib/monitoring.js';
import { gracefulShutdown } from './lib/shutdown.js';

// Initialize monitoring
initializeSentry();

// Configuration
const port = parseInt(process.env.PORT || '4000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';
const isDevelopment = process.env.NODE_ENV === 'development';

// Create Hono app
const app = createApp();

// Start server with explicit type
const server = serve({
  fetch: app.fetch,
  port,
  hostname
}, (info) => {
  logger.info('🚀 API Server running', {
    port: info.port,
    hostname,
    environment: process.env.NODE_ENV,
    url: `http://${hostname}:${info.port}`
  });
});

// Health check endpoint verification (only in production)
if (!isDevelopment) {
  setInterval(async () => {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (!response.ok) {
        logger.warn('Health check failed', { status: response.status });
      }
    } catch (error) {
      logger.error('Health check error', error);
    }
  }, 30000); // Every 30 seconds
}

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  gracefulShutdown(server, 'SIGTERM');
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  gracefulShutdown(server, 'SIGINT');
});

// Unhandled error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  gracefulShutdown(server, 'uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

export default app;