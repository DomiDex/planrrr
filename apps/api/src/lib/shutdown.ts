// Package: @repo/api
// Path: apps/api/src/lib/shutdown.ts
// Dependencies: none

import type { Server } from 'http';
import type { Http2Server } from 'http2';
import { logger } from './logger.js';

type ServerType = Server | Http2Server;

export async function gracefulShutdown(server: ServerType, signal: string) {
  logger.info(`Graceful shutdown initiated: ${signal}`);
  
  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    logger.info('HTTP server closed');
    
    // Close database connections
    // Note: Prisma client should be closed here if needed
    
    // Give ongoing requests 10 seconds to complete
    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout');
      process.exit(0);
    }, 10000);
  });
}