// Package: @repo/worker
// Path: apps/worker/src/shutdown.ts
// Dependencies: @repo/redis, @repo/database

import { QueueManager, RedisClient } from '@repo/redis';
import { prisma } from '@repo/database';

let isShuttingDown = false;

export async function gracefulShutdown(signal: string, error?: Error): Promise<void> {
  if (isShuttingDown) {
    console.log('🔄 Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;

  if (error) {
    console.error(`💥 ${signal}:`, error);
  } else {
    console.log(`\n📛 Received ${signal}, starting graceful shutdown...`);
  }
  
  const timeout = setTimeout(() => {
    console.error('⏱️ Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, 30000);

  try {
    await QueueManager.pauseWorker('publish-posts');
    console.log('⏸️ Worker paused');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await QueueManager.closeAll();
    console.log('🔌 Queue connections closed');
    
    await RedisClient.disconnect();
    console.log('🔌 Redis disconnected');
    
    await prisma.$disconnect();
    console.log('🔌 Database disconnected');
    
    clearTimeout(timeout);
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    clearTimeout(timeout);
    process.exit(1);
  }
}