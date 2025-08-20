// Package: @repo/worker
// Path: apps/worker/src/index.ts
// Dependencies: bullmq, ioredis, @repo/database

import { Worker, Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from '@repo/database';

// Redis connection configuration
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Important for workers
  enableReadyCheck: false, // Important for Railway
  family: 0, // Important for Railway (IPv4/IPv6)
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    console.log(`Redis connection retry #${times}, waiting ${delay}ms`);
    return delay;
  }
});

// Create queue for post publishing (used by Worker)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const publishQueue = new Queue('publish', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 100 // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600 // Keep failed jobs for 7 days
    }
  }
});

// Create worker to process jobs
const publishWorker = new Worker(
  'publish',
  async (job) => {
    console.log(`Processing job ${job.id}: ${job.name}`);
    const { postId, platform } = job.data;

    try {
      // Update job progress
      await job.updateProgress(10);

      // Fetch post from database
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          team: true,
          author: true
        }
      });

      if (!post) {
        throw new Error(`Post ${postId} not found`);
      }

      await job.updateProgress(30);

      // TODO: Fetch social media connection
      // TODO: Publish to platform
      // For now, just simulate processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      await job.updateProgress(70);

      // Update post status
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date()
        }
      });

      await job.updateProgress(100);

      console.log(`Successfully published post ${postId} to ${platform}`);
      return { success: true, publishedAt: new Date() };
    } catch (error) {
      console.error(`Failed to publish post ${postId}:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 10,
      duration: 1000 // Max 10 jobs per second
    }
  }
);

// Queue event monitoring
const queueEvents = new QueueEvents('publish', { connection });

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} completed:`, returnvalue);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed:`, failedReason);
});

// Worker event handlers
publishWorker.on('ready', () => {
  console.log('✅ Worker is ready and waiting for jobs');
});

publishWorker.on('error', (error) => {
  console.error('Worker error:', error);
});

publishWorker.on('stalled', (jobId) => {
  console.warn(`Job ${jobId} stalled and will be retried`);
});

// Health check endpoint (simple HTTP server)
if (process.env.ENABLE_HEALTH_CHECK === 'true') {
  const http = await import('http');
  const healthServer = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        worker: 'running',
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  const healthPort = parseInt(process.env.HEALTH_PORT || '3001');
  healthServer.listen(healthPort, () => {
    console.log(`Health check server running on port ${healthPort}`);
  });
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new jobs
  await publishWorker.close();
  
  // Wait for current jobs to complete (max 30 seconds)
  const timeout = setTimeout(() => {
    console.log('Forcing shutdown after timeout');
    process.exit(1);
  }, 30000);

  try {
    await publishWorker.disconnect();
    await queueEvents.disconnect();
    await connection.quit();
    await prisma.$disconnect();
    clearTimeout(timeout);
    console.log('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    clearTimeout(timeout);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

console.log('🚀 Worker service started');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`);
console.log(`Concurrency: 5 jobs`);
console.log('Waiting for jobs...');