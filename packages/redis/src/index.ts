import IORedis, { type RedisOptions } from 'ioredis';

export { IORedis as Redis };
export type { RedisOptions } from 'ioredis';

type Redis = IORedis;

export type RedisDatabase = 'cache' | 'queue' | 'session';

export interface RedisConnectionConfig {
  host?: string;
  port?: number;
  password?: string;
  url?: string;
  provider?: 'upstash' | 'railway' | 'local';
  tls?: boolean;
}

export interface RedisHealthStatus {
  connected: boolean;
  database: RedisDatabase;
  latency?: number;
  error?: string;
  memoryUsage?: {
    used: number;
    peak: number;
    total?: number;
  };
}

const DATABASE_NUMBERS: Record<RedisDatabase, number> = {
  cache: 0,
  queue: 1,
  session: 2,
};

const EVICTION_POLICIES: Record<RedisDatabase, string> = {
  cache: 'allkeys-lru',
  queue: 'noeviction',
  session: 'volatile-lru',
};

export class RedisClient {
  private static connections: Map<string, Redis> = new Map();
  private static config: RedisConnectionConfig | null = null;

  static configure(config: RedisConnectionConfig): void {
    this.config = config;
  }

  private static getConnectionOptions(database: RedisDatabase): RedisOptions {
    if (!this.config) {
      throw new Error('Redis configuration not set. Call RedisClient.configure() first.');
    }

    const dbNumber = DATABASE_NUMBERS[database];
    const baseOptions: RedisOptions = {
      db: dbNumber,
      maxRetriesPerRequest: database === 'queue' ? null : 3,
      enableOfflineQueue: database === 'queue',
      retryStrategy: (times: number) => {
        const maxRetries = database === 'queue' ? 10 : 5;
        if (times > maxRetries) return null;
        
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      },
      lazyConnect: true,
      connectTimeout: 15000,
      commandTimeout: 5000,
      keepAlive: 10000,
      enableReadyCheck: true,
    };

    if (this.config.url) {
      const isRailway = this.config.provider === 'railway' || 
                       this.config.url.includes('railway.internal');
      const isUpstash = this.config.provider === 'upstash' || 
                       this.config.url.includes('upstash.io');

      if (isRailway) {
        const url = this.config.url.includes('?family=0') 
          ? this.config.url 
          : `${this.config.url}?family=0`;

        return new IORedis(url, {
          ...baseOptions,
          tls: process.env.NODE_ENV === 'production' ? {
            rejectUnauthorized: false,
          } : undefined,
        }) as unknown as RedisOptions;
      }

      if (isUpstash) {
        const url = new URL(this.config.url);
        return {
          ...baseOptions,
          host: url.hostname,
          port: parseInt(url.port || '6379'),
          password: url.password || this.config.password,
          username: url.username || 'default',
          tls: {},
        };
      }

      return new IORedis(this.config.url, baseOptions) as unknown as RedisOptions;
    }

    const options: RedisOptions = {
      ...baseOptions,
      host: this.config.host || 'localhost',
      port: this.config.port || 6379,
      password: this.config.password,
    };

    if (this.config.tls || process.env.NODE_ENV === 'production') {
      options.tls = this.config.provider === 'upstash' ? {} : {
        rejectUnauthorized: false,
      };
    }

    return options;
  }

  static getClient(database: RedisDatabase = 'cache'): Redis {
    const key = `${this.config?.host || 'default'}-${database}`;
    
    if (!this.connections.has(key)) {
      const options = this.getConnectionOptions(database);
      const client = new IORedis(options);

      client.on('error', (err) => {
        console.error(`Redis Client Error [${database}]:`, err);
      });

      client.on('connect', () => {
        console.log(`Redis connected to database: ${database} (db: ${DATABASE_NUMBERS[database]})`);
        
        this.configureDatabase(client, database).catch(err => {
          console.error(`Failed to configure database ${database}:`, err);
        });
      });

      client.on('ready', () => {
        console.log(`Redis ready for database: ${database}`);
      });

      client.on('close', () => {
        console.log(`Redis connection closed for database: ${database}`);
      });

      client.on('reconnecting', (delay: number) => {
        console.log(`Redis reconnecting to database ${database} in ${delay}ms`);
      });

      this.connections.set(key, client);
    }

    return this.connections.get(key)!;
  }

  private static async configureDatabase(client: Redis, database: RedisDatabase): Promise<void> {
    try {
      const evictionPolicy = EVICTION_POLICIES[database];
      
      if (process.env.NODE_ENV === 'production') {
        try {
          await client.config('SET', 'maxmemory-policy', evictionPolicy);
          console.log(`Set eviction policy for ${database}: ${evictionPolicy}`);
        } catch (err) {
          console.warn(`Could not set eviction policy for ${database}:`, err);
        }

        if (database === 'queue') {
          try {
            await client.config('SET', 'save', '900 1 300 10 60 10000');
            await client.config('SET', 'appendonly', 'yes');
            console.log(`Enabled persistence for ${database}`);
          } catch (err) {
            console.warn(`Could not enable persistence for ${database}:`, err);
          }
        }
      }
    } catch (error) {
      console.error(`Error configuring database ${database}:`, error);
    }
  }

  static async connect(database?: RedisDatabase): Promise<void> {
    if (database) {
      const client = this.getClient(database);
      await client.connect();
    } else {
      const databases: RedisDatabase[] = ['cache', 'queue', 'session'];
      await Promise.all(databases.map(db => {
        const client = this.getClient(db);
        return client.connect();
      }));
    }
  }

  static async disconnect(database?: RedisDatabase): Promise<void> {
    if (database) {
      const key = `${this.config?.host || 'default'}-${database}`;
      const client = this.connections.get(key);
      if (client) {
        await client.quit();
        this.connections.delete(key);
      }
    } else {
      const promises: Promise<void>[] = [];
      for (const [key, client] of this.connections) {
        promises.push(client.quit().then(() => {
          this.connections.delete(key);
        }));
      }
      await Promise.all(promises);
    }
  }

  static async healthCheck(database: RedisDatabase): Promise<RedisHealthStatus> {
    try {
      const client = this.getClient(database);
      const startTime = Date.now();
      
      await client.ping();
      const latency = Date.now() - startTime;
      
      const info = await client.info('memory');
      const memoryStats = this.parseMemoryInfo(info);
      
      return {
        connected: true,
        database,
        latency,
        memoryUsage: memoryStats,
      };
    } catch (error) {
      return {
        connected: false,
        database,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private static parseMemoryInfo(info: string): { used: number; peak: number; total?: number } {
    const lines = info.split('\r\n');
    const stats: Record<string, string> = {};
    
    for (const line of lines) {
      const [key, value] = line.split(':');
      if (key && value) {
        stats[key] = value;
      }
    }
    
    return {
      used: parseInt(stats.used_memory || '0'),
      peak: parseInt(stats.used_memory_peak || '0'),
      total: stats.maxmemory ? parseInt(stats.maxmemory) : undefined,
    };
  }

  static async testConnection(): Promise<boolean> {
    try {
      const databases: RedisDatabase[] = ['cache', 'queue', 'session'];
      const results = await Promise.all(databases.map(db => this.healthCheck(db)));
      
      console.log('Redis Health Check Results:');
      results.forEach(result => {
        console.log(`  ${result.database}: ${result.connected ? '✓' : '✗'} ${result.connected ? `(${result.latency}ms)` : result.error}`);
      });
      
      return results.every(r => r.connected);
    } catch (error) {
      console.error('Redis connection test failed:', error);
      return false;
    }
  }

  static getQueueConnection(): Redis {
    return this.getClient('queue');
  }

  static getCacheConnection(): Redis {
    return this.getClient('cache');
  }

  static getSessionConnection(): Redis {
    return this.getClient('session');
  }
}

export const initializeRedis = (config?: RedisConnectionConfig): void => {
  const redisConfig: RedisConnectionConfig = config || {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined,
    password: process.env.REDIS_PASSWORD,
    provider: (process.env.REDIS_PROVIDER as 'upstash' | 'railway' | 'local') || 'local',
    tls: process.env.NODE_ENV === 'production',
  };

  RedisClient.configure(redisConfig);
};

// Export RedisClient as the main class
export { QueueManager } from './queue-manager.js';

export default RedisClient;