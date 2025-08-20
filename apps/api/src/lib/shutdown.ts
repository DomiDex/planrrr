// Package: @repo/api
// Path: apps/api/src/lib/shutdown.ts
// Dependencies: none

import { logger } from './logger.js';

export async function gracefulShutdown(server: any, signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Give ongoing requests 10 seconds to complete
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
  
  try {
    // Close database connections
    // await prisma.$disconnect();
    
    // Close Redis connections
    // await redis.quit();
    
    logger.info('All connections closed, exiting');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}