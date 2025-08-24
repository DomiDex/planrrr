// Package: @repo/worker
// Path: apps/worker/src/index.ts
// Dependencies: @repo/redis, @repo/database

import { initializeRedis, RedisClient, QueueManager } from '@repo/redis';
import { prisma } from '@repo/database';
import { processPublishJob } from './processors/publish.js';

// Initialize Redis with provider configuration
initializeRedis();

// Connect to Redis databases
await RedisClient.connect();
console.log('✅ Redis connections established');

// Test Redis connectivity
const isHealthy = await RedisClient.testConnection();
if (!isHealthy) {
  console.error('❌ Redis health check failed');
  process.exit(1);
}

// Create publish queue
QueueManager.createQueue({
  name: 'publish-posts',
  defaultJobOptions: {
    attempts: parseInt(process.env.WORKER_RETRY_ATTEMPTS || '3'),
    backoff: {
      type: 'exponential',
      delay: parseInt(process.env.WORKER_RETRY_DELAY || '2000')
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 100
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
      count: 500
    }
  }
});

// Create worker
QueueManager.createWorker(
  'publish-posts',
  processPublishJob,
  {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
    limiter: {
      max: parseInt(process.env.WORKER_MAX_JOBS_PER_SECOND || '10'),
      duration: 1000
    }
  }
);

// Create queue events monitor
QueueManager.createQueueEvents('publish-posts');

// Monitor queue statistics periodically
setInterval(async () => {
  const stats = await QueueManager.getQueueStats('publish-posts');
  if (stats) {
    console.log('📊 Queue Statistics:', {
      active: stats.active,
      waiting: stats.waiting,
      completed: stats.completed,
      failed: stats.failed
    });
  }
}, 60000);

// Health check server
if (process.env.ENABLE_HEALTH_CHECK === 'true') {
  const http = await import('http');
  
  const healthServer = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      const [redisHealth, queueStats] = await Promise.all([
        RedisClient.healthCheck('queue'),
        QueueManager.getQueueStats('publish-posts')
      ]);

      const health = {
        status: redisHealth.connected ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        redis: {
          connected: redisHealth.connected,
          latency: redisHealth.latency
        },
        queue: queueStats || { error: 'Queue not available' },
        database: await prisma.$queryRaw`SELECT 1`
          .then(() => ({ connected: true }))
          .catch(() => ({ connected: false }))
      };

      res.writeHead(redisHealth.connected ? 200 : 503, {
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify(health, null, 2));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  const healthPort = parseInt(process.env.HEALTH_PORT || '3001');
  healthServer.listen(healthPort, () => {
    console.log(`🏥 Health check server running on port ${healthPort}`);
  });
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\n📛 Received ${signal}, starting graceful shutdown...`);
  
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

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
});

// Startup info
console.log('🚀 Worker Service Started');
console.log('═'.repeat(50));
console.log('Configuration:');
console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`  Redis Provider: ${process.env.REDIS_PROVIDER || 'local'}`);
console.log(`  Concurrency: ${process.env.WORKER_CONCURRENCY || '5'} jobs`);
console.log(`  Rate Limit: ${process.env.WORKER_MAX_JOBS_PER_SECOND || '10'} jobs/second`);
console.log(`  Retry Attempts: ${process.env.WORKER_RETRY_ATTEMPTS || '3'}`);
console.log('═'.repeat(50));
console.log('⏳ Waiting for jobs...\n');