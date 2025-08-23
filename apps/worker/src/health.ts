// Package: @repo/worker
// Path: apps/worker/src/health.ts
// Dependencies: http, @repo/redis, @repo/database

import http from 'http';
import { RedisClient, QueueManager } from '@repo/redis';
import { prisma } from '@repo/database';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  redis: {
    connected: boolean;
    latency?: number;
  };
  queue: {
    active?: number;
    waiting?: number;
    completed?: number;
    failed?: number;
    delayed?: number;
    repeat?: number;
    total?: number;
    error?: string;
  };
  database: {
    connected: boolean;
  };
}

export async function createHealthServer(port: number): Promise<http.Server> {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      const health = await getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      
      res.writeHead(statusCode, {
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify(health, null, 2));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, () => {
      console.log(`🏥 Health check server running on port ${port}`);
      resolve(server);
    });
  });
}

async function getHealthStatus(): Promise<HealthStatus> {
  const [redisHealth, queueStats, dbHealth] = await Promise.allSettled([
    RedisClient.healthCheck('queue'),
    QueueManager.getQueueStats('publish-posts'),
    checkDatabase()
  ]);

  const redis = redisHealth.status === 'fulfilled' 
    ? { connected: redisHealth.value.connected, latency: redisHealth.value.latency }
    : { connected: false, latency: undefined };

  const queue = queueStats.status === 'fulfilled' && queueStats.value
    ? queueStats.value
    : { error: 'Queue not available' };

  const database = dbHealth.status === 'fulfilled'
    ? dbHealth.value
    : { connected: false };

  const isHealthy = redis.connected && database.connected && !('error' in queue);

  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    redis,
    queue,
    database
  };
}

async function checkDatabase(): Promise<{ connected: boolean }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { connected: true };
  } catch {
    return { connected: false };
  }
}