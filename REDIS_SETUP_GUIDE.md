# Redis Setup Guide for planrrr.io

## 📋 Current Status

### What's Already Done ✅
- [x] Environment variables configuration (P1-SEC-003) completed
- [x] Upstash account created (fond-herring-52042.upstash.io)
- [x] Redis client implementation created at `/packages/shared/lib/redis.ts`
- [x] Environment files have Upstash placeholders

### What You Need to Do 🔴
1. Get your Upstash REST token
2. Update environment variables with actual credentials
3. Install Redis dependencies
4. Test the connection
5. Configure for different deployment environments

## 🚀 Step-by-Step Setup

### Step 1: Get Upstash Credentials

1. Go to [console.upstash.com](https://console.upstash.com)
2. Click on your database: `fond-herring-52042`
3. Copy these values:
   - **UPSTASH_REDIS_REST_URL**: `https://fond-herring-52042.upstash.io`
   - **UPSTASH_REDIS_REST_TOKEN**: Copy the REST token (starts with `AX...`)
   - **Redis URL** (optional): `redis://default:YOUR_PASSWORD@fond-herring-52042.upstash.io:6379`

### Step 2: Update Environment Files

#### For Web App (`apps/web/.env.local`)
```env
# Upstash Redis REST URL
UPSTASH_REDIS_REST_URL="https://fond-herring-52042.upstash.io"

# Upstash Redis REST Token
UPSTASH_REDIS_REST_TOKEN="YOUR_ACTUAL_TOKEN_HERE"

# Rate limiting configuration
RATE_LIMIT_ENABLED="true"
RATE_LIMIT_WINDOW="60"
RATE_LIMIT_MAX_REQUESTS="100"
```

#### For API Service (`apps/api/.env`)
```env
# Upstash Redis (for rate limiting and caching)
UPSTASH_REDIS_REST_URL="https://fond-herring-52042.upstash.io"
UPSTASH_REDIS_REST_TOKEN="YOUR_ACTUAL_TOKEN_HERE"

# Rate limiting configuration
RATE_LIMIT_ENABLED="true"
RATE_LIMIT_WINDOW="60"
RATE_LIMIT_MAX_REQUESTS="100"
```

#### For Worker Service (`apps/worker/.env`)
```env
# For BullMQ, you might need Redis protocol connection
REDIS_URL="redis://default:YOUR_PASSWORD@fond-herring-52042.upstash.io:6379"

# Or use REST API
UPSTASH_REDIS_REST_URL="https://fond-herring-52042.upstash.io"
UPSTASH_REDIS_REST_TOKEN="YOUR_ACTUAL_TOKEN_HERE"
```

### Step 3: Install Dependencies

```bash
# Install Redis packages in shared package
cd packages/shared
pnpm add @upstash/redis ioredis
pnpm add -D @types/ioredis

# For rate limiting in API
cd ../../apps/api
pnpm add @upstash/ratelimit

# For BullMQ in worker
cd ../worker
pnpm add bullmq
```

### Step 4: Test Redis Connection

Create a test script to verify connection:

```typescript
// test-redis.ts
import { upstashRedis, rateLimiter, redisCache } from '@repo/shared/lib/redis';

async function testRedis() {
  try {
    // Test basic connection
    console.log('Testing Upstash Redis connection...');
    await upstashRedis.set('test:key', 'Hello Redis!');
    const value = await upstashRedis.get('test:key');
    console.log('✅ Basic operations work:', value);

    // Test rate limiter
    console.log('\nTesting rate limiter...');
    const result = await rateLimiter.checkLimit('test-user-123');
    console.log('✅ Rate limiter works:', result);

    // Test cache
    console.log('\nTesting cache manager...');
    await redisCache.set('cache:test', { message: 'Cached data' }, 60);
    const cached = await redisCache.get('cache:test');
    console.log('✅ Cache works:', cached);

    // Cleanup
    await upstashRedis.del('test:key');
    await redisCache.delete('cache:test');
    
    console.log('\n🎉 All Redis tests passed!');
  } catch (error) {
    console.error('❌ Redis test failed:', error);
  }
}

testRedis();
```

Run test:
```bash
npx tsx test-redis.ts
```

### Step 5: Integration Examples

#### Rate Limiting in API Routes
```typescript
// apps/api/src/middleware/rateLimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
});

export async function rateLimitMiddleware(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success, limit, reset, remaining } = await ratelimit.limit(ip);
  
  if (!success) {
    return new Response('Too Many Requests', { 
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(reset).toISOString(),
      }
    });
  }
  
  return null; // Continue
}
```

#### Caching in API
```typescript
// apps/api/src/lib/cache.ts
import { redisCache } from '@repo/shared/lib/redis';

export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 3600
): Promise<T> {
  // Try cache first
  const cached = await redisCache.get<T>(key);
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();
  
  // Cache for next time
  await redisCache.set(key, data, ttl);
  
  return data;
}
```

#### BullMQ Queue Setup (Worker)
```typescript
// apps/worker/src/queues/publish.queue.ts
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

// Create connection for BullMQ
const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

// Create queue
export const publishQueue = new Queue('publish', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Create worker
export const publishWorker = new Worker(
  'publish',
  async (job) => {
    console.log('Processing job:', job.id);
    // Process job here
  },
  { connection }
);
```

## 🔍 Verification Checklist

### Upstash Console Checks
- [ ] Database is active (not paused)
- [ ] REST API is enabled
- [ ] Eviction is enabled (recommended for cache)
- [ ] Max memory is set appropriately
- [ ] TLS/SSL is enabled (default)

### Environment Variables
- [ ] `UPSTASH_REDIS_REST_URL` is set correctly
- [ ] `UPSTASH_REDIS_REST_TOKEN` is set (not placeholder)
- [ ] Rate limiting variables are configured
- [ ] Worker has Redis connection info (if using BullMQ)

### Code Implementation
- [ ] Redis client singleton is working
- [ ] Rate limiter is functional
- [ ] Cache manager can get/set data
- [ ] BullMQ can connect (if using worker)

### Testing
- [ ] Basic set/get operations work
- [ ] Rate limiting blocks after threshold
- [ ] Cache TTL expires correctly
- [ ] Connection handles errors gracefully

## 🚨 Common Issues & Solutions

### Issue: "Invalid token" error
**Solution**: Make sure you copied the full REST token from Upstash console, including any special characters.

### Issue: "Connection timeout"
**Solution**: Check if your IP needs to be whitelisted in Upstash console (if IP filtering is enabled).

### Issue: Rate limiting not working
**Solution**: Ensure `RATE_LIMIT_ENABLED="true"` and Redis connection is successful.

### Issue: BullMQ connection fails
**Solution**: BullMQ needs Redis protocol URL, not REST API. Use the `redis://` URL format.

## 📊 Upstash Free Tier Limits

- **10,000 commands/day** (resets daily)
- **256MB storage**
- **Max 1000 concurrent connections**
- **30-second max request duration**

For planrrr.io development, this should be sufficient. Monitor usage in Upstash console.

## ✅ Task Completion Status

Once you complete the setup:

1. **P1-INFRA-002** (Redis Setup) will be complete
2. This unblocks:
   - Worker service deployment
   - Rate limiting implementation
   - Caching layer activation
   - Session storage setup

## 🎯 Next Steps

1. **Get your Upstash token** from console.upstash.com
2. **Update all .env files** with actual credentials
3. **Run the test script** to verify connection
4. **Deploy to Railway/Vercel** with these env vars
5. **Monitor usage** in Upstash console

Your Redis setup will then be production-ready for:
- ✅ Rate limiting (API protection)
- ✅ Caching (performance optimization)
- ✅ Session storage (user sessions)
- ✅ Job queues (BullMQ for worker)

Remember: For early deployment, you can set `RATE_LIMIT_ENABLED="false"` if Redis isn't ready yet!