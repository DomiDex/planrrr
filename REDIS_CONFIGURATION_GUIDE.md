# Redis Configuration Guide for planrrr.io

## Overview

This guide provides comprehensive instructions for configuring Redis in the planrrr.io monorepo. Redis is used for caching, session storage, and job queues (via BullMQ) across both the web application and worker service.

## Table of Contents

1. [Provider Options](#provider-options)
2. [Quick Setup](#quick-setup)
3. [Environment Configuration](#environment-configuration)
4. [Testing Your Configuration](#testing-your-configuration)
5. [Integration Guide](#integration-guide)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)
8. [Security Best Practices](#security-best-practices)

## Provider Options

### 1. Upstash (Recommended for Serverless)

**Pros:**
- Serverless pricing model (pay-per-request)
- Global edge caching
- Built-in REST API
- Automatic scaling
- No connection limit issues

**Cons:**
- Command limitations on free tier
- Higher latency for some operations
- Requires fixed plan for BullMQ (continuous polling)

**Best for:** Vercel deployments, serverless environments, global applications

### 2. Railway (Recommended for Dedicated)

**Pros:**
- Full Redis feature set
- Predictable performance
- Private networking support
- Automatic backups
- Lower latency

**Cons:**
- Fixed monthly cost
- Regional deployment
- Connection pooling required

**Best for:** Railway deployments, traditional hosting, high-throughput applications

### 3. Local Development

**Pros:**
- Zero latency
- Full control
- No cost
- Easy debugging

**Setup:**
```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Using Homebrew (macOS)
brew install redis
brew services start redis

# Using apt (Ubuntu/Debian)
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

## Quick Setup

### Step 1: Install Dependencies

```bash
# Install Redis package
pnpm install

# The @repo/redis package is already configured with:
# - ioredis: Redis client with connection pooling
# - bullmq: Queue management for background jobs
```

### Step 2: Choose Your Provider

#### Option A: Upstash Setup

1. Create account at [upstash.com](https://upstash.com)
2. Create a new Redis database
3. Choose a region close to your deployment
4. **Important:** Select a Fixed plan for BullMQ compatibility
5. Copy credentials from the dashboard

#### Option B: Railway Setup

1. Go to [railway.app](https://railway.app)
2. Add Redis service to your project
3. Get the connection URL from service variables
4. Ensure your app is in the same project/region

### Step 3: Configure Environment Variables

Create `.env.local` files in both `apps/web` and `apps/worker`:

#### Upstash Configuration

```bash
# apps/web/.env.local & apps/worker/.env.local
REDIS_PROVIDER="upstash"
REDIS_HOST="your-endpoint.upstash.io"
REDIS_PORT="6379"
REDIS_PASSWORD="your-password"
UPSTASH_REDIS_REST_URL="https://your-endpoint.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-rest-token"
```

#### Railway Configuration

```bash
# apps/web/.env.local & apps/worker/.env.local
REDIS_PROVIDER="railway"
REDIS_URL="redis://default:password@redis.railway.internal:6379"
```

#### Local Development

```bash
# apps/web/.env.local & apps/worker/.env.local
REDIS_PROVIDER="local"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""  # Leave empty for local
```

## Testing Your Configuration

### Basic Connection Test

```bash
# Test Redis connection
cd packages/redis
node test-connection.mjs

# Test with specific provider
node test-connection.mjs --provider=upstash
node test-connection.mjs --provider=railway
node test-connection.mjs --provider=local
```

Expected output:
```
✅ Connected successfully!
✅ PING successful (2ms)
✅ All tests passed!
```

### BullMQ Queue Test

```bash
# Test queue functionality
cd packages/redis
node test-queues.mjs
```

This tests:
- Job creation and processing
- Scheduled/delayed jobs
- Rate limiting
- Priority queues
- Error handling and retries

## Integration Guide

### Using Redis in Your Application

#### 1. Initialize Redis (apps/web or apps/worker)

```typescript
// app/lib/redis.ts or src/lib/redis.ts
import { initializeRedis, RedisClient } from '@repo/redis';

// Initialize on app start
initializeRedis();

// Or with custom config
initializeRedis({
  provider: 'upstash',
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});
```

#### 2. Cache Operations

```typescript
import { RedisClient } from '@repo/redis';

// Get cache client
const cache = RedisClient.getCacheConnection();

// Set cache with TTL
await cache.setex('user:123', 3600, JSON.stringify(userData));

// Get from cache
const cached = await cache.get('user:123');
if (cached) {
  const userData = JSON.parse(cached);
}

// Delete from cache
await cache.del('user:123');

// Pattern-based deletion
const keys = await cache.keys('user:*');
if (keys.length) {
  await cache.del(...keys);
}
```

#### 3. Session Storage

```typescript
import { RedisClient } from '@repo/redis';

const session = RedisClient.getSessionConnection();

// Store session
await session.setex(
  `session:${sessionId}`,
  7 * 24 * 3600, // 7 days
  JSON.stringify(sessionData)
);

// Retrieve session
const data = await session.get(`session:${sessionId}`);

// Extend session
await session.expire(`session:${sessionId}`, 7 * 24 * 3600);
```

#### 4. Queue Management

```typescript
import { QueueManager } from '@repo/redis';

// Create a queue
const publishQueue = QueueManager.createQueue({
  name: 'publish-posts',
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

// Add jobs to queue
await publishQueue.add('publish', {
  postId: 'post_123',
  platform: 'FACEBOOK',
  scheduledAt: new Date(),
});

// Create a worker
const worker = QueueManager.createWorker(
  'publish-posts',
  async (job) => {
    console.log('Publishing post:', job.data.postId);
    // Process the job
    return { success: true, publishedAt: new Date() };
  },
  { concurrency: 5 }
);

// Monitor queue
const stats = await QueueManager.getQueueStats('publish-posts');
console.log('Queue stats:', stats);
```

## Monitoring & Maintenance

### Health Checks

```typescript
import { RedisClient } from '@repo/redis';

// Check individual database health
const health = await RedisClient.healthCheck('cache');
console.log(`Cache health: ${health.connected ? 'OK' : 'ERROR'}`);
console.log(`Latency: ${health.latency}ms`);

// Full connection test
const allHealthy = await RedisClient.testConnection();
```

### Memory Management

```typescript
// Monitor memory usage
const cache = RedisClient.getCacheConnection();
const info = await cache.info('memory');
console.log('Memory info:', info);

// Set memory limits (production only)
await cache.config('SET', 'maxmemory', '256mb');
await cache.config('SET', 'maxmemory-policy', 'allkeys-lru');
```

### Queue Monitoring

```typescript
import { QueueManager } from '@repo/redis';

// Get queue statistics
const stats = await QueueManager.getQueueStats('publish-posts');
console.log(`Active jobs: ${stats.active}`);
console.log(`Waiting jobs: ${stats.waiting}`);
console.log(`Failed jobs: ${stats.failed}`);

// Clean old jobs
await QueueManager.cleanQueue('publish-posts', 24 * 3600 * 1000); // 24 hours

// Monitor all queues
const allStats = await QueueManager.monitorQueues();
allStats.forEach((stats, name) => {
  console.log(`Queue ${name}:`, stats);
});
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Connection Refused (ECONNREFUSED)

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solutions:**
- Ensure Redis is running: `redis-cli ping`
- Check host and port in environment variables
- For Docker: ensure port mapping is correct
- For Railway: use internal URL when deployed

#### 2. Authentication Failed (NOAUTH)

**Symptoms:**
```
ReplyError: NOAUTH Authentication required
```

**Solutions:**
- Verify REDIS_PASSWORD is set correctly
- Check password doesn't contain special characters that need escaping
- For Upstash: use the password from the dashboard
- For local: remove password if not configured

#### 3. TLS/SSL Issues (ECONNRESET)

**Symptoms:**
```
Error: read ECONNRESET
```

**Solutions:**
- Upstash: Ensure `tls: {}` is in connection config
- Railway: Add `?family=0` to connection URL
- Production: Set `rejectUnauthorized: false` for self-signed certs

#### 4. BullMQ High Command Count (Upstash)

**Symptoms:**
- High Redis command usage
- Unexpected costs on pay-as-you-go plan

**Solutions:**
- Switch to Upstash Fixed plan
- Increase worker poll interval
- Reduce queue monitoring frequency
- Consider Railway for high-throughput needs

#### 5. Memory Limit Exceeded

**Symptoms:**
```
OOM command not allowed when used memory > 'maxmemory'
```

**Solutions:**
- Increase memory limit or upgrade plan
- Implement proper cache eviction policies
- Set TTL on all cache entries
- Clean up old queue jobs regularly

### Debug Commands

```bash
# Test connection directly
redis-cli -h your-host -p 6379 -a your-password --tls ping

# Check Redis version
redis-cli info server | grep redis_version

# Monitor commands in real-time
redis-cli monitor

# Check memory usage
redis-cli info memory

# List all keys (use carefully in production)
redis-cli --scan --pattern '*'
```

## Security Best Practices

### 1. Connection Security

- **Always use TLS/SSL in production**
- **Rotate passwords regularly**
- **Use connection pooling to prevent connection exhaustion**
- **Implement retry logic with exponential backoff**

### 2. Access Control

```typescript
// Implement rate limiting
import { RedisClient } from '@repo/redis';

const cache = RedisClient.getCacheConnection();

export async function rateLimit(ip: string, limit = 100) {
  const key = `rate:${ip}`;
  const current = await cache.incr(key);
  
  if (current === 1) {
    await cache.expire(key, 60); // 1 minute window
  }
  
  return current <= limit;
}
```

### 3. Data Protection

- **Never store sensitive data unencrypted**
- **Set appropriate TTLs on all data**
- **Implement key namespacing to prevent collisions**
- **Regular backups for critical data**

### 4. Monitoring

```typescript
// Log suspicious activity
import { RedisClient } from '@repo/redis';

const cache = RedisClient.getCacheConnection();

// Monitor slow commands
const slowlog = await cache.slowlog('GET', 10);
console.log('Slow commands:', slowlog);

// Track client connections
const clients = await cache.client('LIST');
console.log('Connected clients:', clients.split('\n').length);
```

## Performance Optimization

### 1. Connection Pooling

The Redis client automatically manages connection pooling. Configure pool size based on your needs:

```typescript
import { RedisClient } from '@repo/redis';

// Connections are pooled per database
const cache = RedisClient.getCacheConnection(); // Pool 1
const queue = RedisClient.getQueueConnection(); // Pool 2
const session = RedisClient.getSessionConnection(); // Pool 3
```

### 2. Pipeline Operations

```typescript
// Batch operations for better performance
const pipeline = cache.pipeline();

pipeline.set('key1', 'value1');
pipeline.set('key2', 'value2');
pipeline.expire('key1', 3600);
pipeline.expire('key2', 3600);

const results = await pipeline.exec();
```

### 3. Lua Scripts

```typescript
// Use Lua for atomic operations
const script = `
  local current = redis.call('get', KEYS[1])
  if not current then
    current = 0
  end
  current = current + ARGV[1]
  redis.call('set', KEYS[1], current)
  redis.call('expire', KEYS[1], ARGV[2])
  return current
`;

const result = await cache.eval(
  script,
  1,
  'counter:123',
  '1',
  '3600'
);
```

## Deployment Checklist

### Pre-Deployment

- [ ] Redis credentials configured in environment variables
- [ ] TLS/SSL enabled for production
- [ ] Connection tested with `test-connection.mjs`
- [ ] Queue functionality tested with `test-queues.mjs`
- [ ] Memory limits configured appropriately
- [ ] Eviction policies set for each database
- [ ] Monitoring and alerting configured

### Post-Deployment

- [ ] Verify Redis connectivity from deployed services
- [ ] Check queue processing is working
- [ ] Monitor memory usage and performance
- [ ] Test failover and reconnection logic
- [ ] Verify session persistence
- [ ] Check cache hit rates

## Support & Resources

### Official Documentation

- [Redis Documentation](https://redis.io/documentation)
- [ioredis Documentation](https://github.com/redis/ioredis)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Upstash Documentation](https://docs.upstash.com/redis)
- [Railway Redis Guide](https://docs.railway.app/guides/redis)

### Getting Help

1. Check the troubleshooting section above
2. Run diagnostic scripts in `packages/redis/`
3. Review logs for error messages
4. Check provider-specific status pages
5. Open an issue in the repository

## Summary

Redis is configured as a critical component of planrrr.io's infrastructure, providing:

1. **High-performance caching** for frequently accessed data
2. **Reliable session storage** for user authentication
3. **Robust job queues** for background processing
4. **Real-time capabilities** for live updates

Follow this guide to ensure your Redis setup is secure, performant, and production-ready.