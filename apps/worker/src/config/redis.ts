import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { redisConfig, env } from './env.js';
import { log } from './logger.js';

/**
 * Redis connection options for BullMQ
 */
export const redisConnection: RedisOptions = {
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  db: redisConfig.db,
  maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
  
  // Connection retry strategy
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 2000, 30000);
    log.warn(`Redis connection retry attempt ${times}`, { delay });
    return delay;
  },
  
  // Connection timeout
  connectTimeout: 30000,
  
  // Keep-alive
  keepAlive: 30000,
  
  // Reconnect on error
  reconnectOnError: (err: Error) => {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    const shouldReconnect = targetErrors.some(e => err.message.includes(e));
    
    if (shouldReconnect) {
      log.warn('Redis reconnecting due to error', { error: err.message });
    }
    
    return shouldReconnect;
  },
  
  // Show friendly error messages
  showFriendlyErrorStack: env.NODE_ENV === 'development',
};

/**
 * Create a new Redis connection
 * Used by BullMQ for queue and worker connections
 */
export function createRedisConnection(): Redis {
  const connection = new Redis(redisConnection);
  
  connection.on('connect', () => {
    log.info('Redis connected', {
      host: redisConfig.host,
      port: redisConfig.port,
      db: redisConfig.db,
    });
  });
  
  connection.on('ready', () => {
    log.debug('Redis ready to accept commands');
  });
  
  connection.on('error', (error: Error) => {
    log.error('Redis connection error', error);
  });
  
  connection.on('close', () => {
    log.warn('Redis connection closed');
  });
  
  connection.on('reconnecting', (delay: number) => {
    log.info('Redis reconnecting', { delay });
  });
  
  connection.on('end', () => {
    log.info('Redis connection ended');
  });
  
  return connection;
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(connection: Redis): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    const pong = await connection.ping();
    const latency = Date.now() - start;
    
    if (pong === 'PONG') {
      return { healthy: true, latency };
    }
    
    return {
      healthy: false,
      error: `Unexpected ping response: ${pong}`,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedisConnection(connection: Redis): Promise<void> {
  try {
    await connection.quit();
    log.info('Redis connection closed gracefully');
  } catch (error) {
    log.error('Error closing Redis connection', error as Error);
    // Force disconnect if quit fails
    connection.disconnect();
  }
}

/**
 * Get Redis info for monitoring
 */
export async function getRedisInfo(connection: Redis): Promise<{
  version?: string;
  usedMemory?: string;
  connectedClients?: number;
  uptime?: number;
}> {
  try {
    const info = await connection.info();
    const lines = info.split('\n');
    const stats: Record<string, string> = {};
    
    lines.forEach((line: string) => {
      const [key, value] = line.split(':');
      if (key && value) {
        stats[key.trim()] = value.trim();
      }
    });
    
    return {
      version: stats.redis_version,
      usedMemory: stats.used_memory_human,
      connectedClients: parseInt(stats.connected_clients || '0', 10),
      uptime: parseInt(stats.uptime_in_seconds || '0', 10),
    };
  } catch (error) {
    log.error('Failed to get Redis info', error as Error);
    return {};
  }
}

export default createRedisConnection;