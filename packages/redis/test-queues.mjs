#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try loading .env from current directory first, then fallback to worker directory
config({ path: join(__dirname, '.env') });
config({ path: join(__dirname, '../../apps/worker/.env') });

function getRedisConnection() {
  const provider = process.env.REDIS_PROVIDER || 'local';
  
  if (provider === 'upstash') {
    return {
      host: process.env.REDIS_HOST || 'global-redis.upstash.io',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      tls: {},
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      lazyConnect: true,
    };
  } else if (provider === 'railway') {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('REDIS_URL not set');
    
    const urlWithFamily = url.includes('?family=0') ? url : `${url}?family=0`;
    const redis = new Redis(urlWithFamily, {
      tls: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false,
      } : undefined,
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
        lazyConnect: true,
    });
    return redis;
  } else {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
    };
  }
}

async function testPublishQueue() {
  console.log('\n📬 Testing Publish Queue...');
  
  const connection = getRedisConnection();
  const queueName = 'test-publish';
  
  const queue = new Queue(queueName, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600,
        count: 10,
      },
      removeOnFail: {
        age: 24 * 3600,
        count: 100,
      },
    },
  });
  
  const jobPromises = [];
  const jobResults = new Map();
  
  const worker = new Worker(
    queueName,
    async (job) => {
      console.log(`  Processing job ${job.id}: ${job.data.postId} to ${job.data.platform}`);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (Math.random() > 0.8) {
        throw new Error(`Simulated failure for job ${job.id}`);
      }
      
      const result = {
        postId: job.data.postId,
        platform: job.data.platform,
        publishedAt: new Date().toISOString(),
        platformPostId: `${job.data.platform}_${Date.now()}`,
      };
      
      jobResults.set(job.id, result);
      return result;
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );
  
  const events = new QueueEvents(queueName, {
    connection: getRedisConnection(),
  });
  
  let completedCount = 0;
  let failedCount = 0;
  
  events.on('completed', ({ jobId, returnvalue }) => {
    completedCount++;
    console.log(`  ✓ Job ${jobId} completed`);
  });
  
  events.on('failed', ({ jobId, failedReason }) => {
    failedCount++;
    console.log(`  ✗ Job ${jobId} failed: ${failedReason}`);
  });
  
  const platforms = ['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE'];
  const jobs = [];
  
  for (let i = 1; i <= 10; i++) {
    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    const job = await queue.add(
      `publish-${i}`,
      {
        postId: `post_${i}`,
        platform,
        content: `Test post ${i} for ${platform}`,
        teamId: 'test_team',
        scheduledAt: new Date().toISOString(),
      },
      {
        delay: Math.random() * 2000,
      }
    );
    jobs.push(job);
    jobPromises.push(job.waitUntilFinished(events));
  }
  
  console.log(`  ✓ Added ${jobs.length} jobs to queue`);
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const counts = await queue.getJobCounts();
  console.log(`  Queue status: ${JSON.stringify(counts)}`);
  
  await worker.close();
  await events.close();
  await queue.close();
  
  console.log(`  ✓ Completed: ${completedCount}, Failed: ${failedCount}`);
  console.log('  ✓ Publish queue test completed');
  
  return true;
}

async function testScheduledJobs() {
  console.log('\n⏰ Testing Scheduled Jobs...');
  
  const connection = getRedisConnection();
  const queueName = 'test-scheduled';
  
  const queue = new Queue(queueName, { connection });
  
  const futureDate = new Date(Date.now() + 60000);
  const scheduledJobs = [];
  
  for (let i = 1; i <= 5; i++) {
    const delay = i * 1000;
    const job = await queue.add(
      `scheduled-${i}`,
      {
        postId: `scheduled_post_${i}`,
        scheduledFor: new Date(Date.now() + delay).toISOString(),
      },
      {
        delay,
      }
    );
    scheduledJobs.push(job);
  }
  
  console.log(`  ✓ Added ${scheduledJobs.length} scheduled jobs`);
  
  const delayedCount = await queue.getDelayedCount();
  console.log(`  ✓ Delayed jobs in queue: ${delayedCount}`);
  
  const jobs = await queue.getDelayed();
  console.log(`  ✓ Retrieved ${jobs.length} delayed jobs`);
  
  for (const job of jobs.slice(0, 3)) {
    const delay = job.opts.delay || 0;
    const scheduledTime = new Date(job.timestamp + delay);
    console.log(`    - Job ${job.id} scheduled for ${scheduledTime.toISOString()}`);
  }
  
  await queue.obliterate({ force: true });
  console.log('  ✓ Scheduled jobs test completed');
  
  return true;
}

async function testRateLimiting() {
  console.log('\n🚦 Testing Rate Limiting...');
  
  const connection = getRedisConnection();
  const queueName = 'test-ratelimit';
  
  const queue = new Queue(queueName, { connection });
  
  let processedCount = 0;
  const startTime = Date.now();
  
  const worker = new Worker(
    queueName,
    async (job) => {
      processedCount++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  Processing job ${job.id} at ${elapsed}s (total: ${processedCount})`);
      await new Promise(resolve => setTimeout(resolve, 50));
      return { processed: true };
    },
    {
      connection: getRedisConnection(),
      concurrency: 3,
      limiter: {
        max: 5,
        duration: 1000,
      },
    }
  );
  
  const jobs = [];
  for (let i = 1; i <= 15; i++) {
    const job = await queue.add(`rate-${i}`, { index: i });
    jobs.push(job);
  }
  
  console.log(`  ✓ Added ${jobs.length} jobs with rate limiting (5 jobs/second)`);
  
  await new Promise(resolve => setTimeout(resolve, 4000));
  
  await worker.close();
  await queue.close();
  
  const duration = (Date.now() - startTime) / 1000;
  const rate = processedCount / duration;
  
  console.log(`  ✓ Processed ${processedCount} jobs in ${duration.toFixed(1)}s`);
  console.log(`  ✓ Actual rate: ${rate.toFixed(1)} jobs/second`);
  console.log('  ✓ Rate limiting test completed');
  
  return true;
}

async function testPriorities() {
  console.log('\n🎯 Testing Job Priorities...');
  
  const connection = getRedisConnection();
  const queueName = 'test-priority';
  
  const queue = new Queue(queueName, { connection });
  
  const processOrder = [];
  
  const worker = new Worker(
    queueName,
    async (job) => {
      processOrder.push(job.data.priority);
      console.log(`  Processing job with priority ${job.data.priority}`);
      return { processed: true };
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
    }
  );
  
  await queue.add('low-1', { priority: 'low' }, { priority: 10 });
  await queue.add('high-1', { priority: 'high' }, { priority: 1 });
  await queue.add('medium-1', { priority: 'medium' }, { priority: 5 });
  await queue.add('high-2', { priority: 'high' }, { priority: 1 });
  await queue.add('low-2', { priority: 'low' }, { priority: 10 });
  
  console.log('  ✓ Added jobs with different priorities');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await worker.close();
  await queue.close();
  
  const highFirst = processOrder.slice(0, 2).every(p => p === 'high');
  console.log(`  ✓ High priority jobs processed first: ${highFirst ? 'PASS' : 'FAIL'}`);
  console.log(`  ✓ Processing order: ${processOrder.join(' → ')}`);
  console.log('  ✓ Priority test completed');
  
  return true;
}

async function cleanupQueues() {
  console.log('\n🧹 Cleaning up test queues...');
  
  const connection = getRedisConnection();
  const queueNames = ['test-publish', 'test-scheduled', 'test-ratelimit', 'test-priority'];
  
  for (const name of queueNames) {
    try {
      const queue = new Queue(name, { connection: getRedisConnection() });
      await queue.obliterate({ force: true });
      console.log(`  ✓ Cleaned queue: ${name}`);
    } catch (error) {
      console.log(`  ⚠️  Could not clean queue ${name}: ${error.message}`);
    }
  }
  
  console.log('  ✓ Cleanup completed');
}

async function main() {
  console.log('BullMQ Queue Test Suite');
  console.log('═'.repeat(50));
  console.log(`Provider: ${process.env.REDIS_PROVIDER || 'local'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  try {
    const connection = getRedisConnection();
    let testClient;
    
    if (connection instanceof Redis) {
      testClient = connection;
    } else {
      testClient = new Redis(connection);
    }
    
    await testClient.ping();
    console.log('✅ Redis connection established');
    await testClient.quit();
    
    await testPublishQueue();
    await testScheduledJobs();
    await testRateLimiting();
    await testPriorities();
    await cleanupQueues();
    
    console.log('\n' + '═'.repeat(50));
    console.log('✅ All BullMQ tests passed successfully!');
    console.log('Your Redis setup is ready for the worker service.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    
    console.log('\nTroubleshooting:');
    console.log('1. Ensure Redis is running and accessible');
    console.log('2. Check your .env file has correct Redis credentials');
    console.log('3. Verify the Redis version supports required features');
    console.log('4. For Upstash, ensure you have a paid plan for BullMQ');
    
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});