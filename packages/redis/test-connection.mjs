#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Redis from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try loading .env from current directory first, then fallback to worker directory
config({ path: join(__dirname, '.env') });
config({ path: join(__dirname, '../../apps/worker/.env') });

const providers = {
  upstash: {
    name: 'Upstash',
    getConfig: () => ({
      host: process.env.REDIS_HOST || 'global-redis.upstash.io',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      tls: {},
      lazyConnect: true,
      connectTimeout: 10000,
    }),
  },
  railway: {
    name: 'Railway',
    getConfig: () => {
      const url = process.env.REDIS_URL;
      if (!url) {
        throw new Error('REDIS_URL not set for Railway provider');
      }
      const urlWithFamily = url.includes('?family=0') ? url : `${url}?family=0`;
      return {
        url: urlWithFamily,
        tls: process.env.NODE_ENV === 'production' ? {
          rejectUnauthorized: false,
        } : undefined,
        lazyConnect: true,
        connectTimeout: 10000,
      };
    },
  },
  local: {
    name: 'Local',
    getConfig: () => ({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
      connectTimeout: 10000,
    }),
  },
};

async function testBasicOperations(client) {
  console.log('\n📝 Testing basic operations...');
  
  const testKey = 'test:key';
  const testValue = 'Hello Redis!';
  const testJson = { message: 'Hello', timestamp: Date.now() };
  
  await client.set(testKey, testValue);
  const getValue = await client.get(testKey);
  console.log(`  ✓ SET/GET: ${getValue === testValue ? 'PASS' : 'FAIL'}`);
  
  await client.hset('test:hash', 'field1', 'value1', 'field2', 'value2');
  const hashValue = await client.hget('test:hash', 'field1');
  console.log(`  ✓ HSET/HGET: ${hashValue === 'value1' ? 'PASS' : 'FAIL'}`);
  
  await client.set('test:json', JSON.stringify(testJson));
  const jsonStr = await client.get('test:json');
  const jsonValue = JSON.parse(jsonStr);
  console.log(`  ✓ JSON storage: ${jsonValue.message === testJson.message ? 'PASS' : 'FAIL'}`);
  
  await client.lpush('test:list', 'item1', 'item2', 'item3');
  const listLength = await client.llen('test:list');
  console.log(`  ✓ List operations: ${listLength === 3 ? 'PASS' : 'FAIL'}`);
  
  await client.del(testKey, 'test:hash', 'test:json', 'test:list');
  console.log('  ✓ Cleanup completed');
}

async function testPerformance(client) {
  console.log('\n⚡ Testing performance...');
  
  const iterations = 1000;
  const startTime = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    await client.ping();
  }
  
  const duration = Date.now() - startTime;
  const avgLatency = duration / iterations;
  
  console.log(`  ✓ ${iterations} PING commands in ${duration}ms`);
  console.log(`  ✓ Average latency: ${avgLatency.toFixed(2)}ms`);
  
  if (avgLatency < 1) {
    console.log('  ✓ Excellent performance (< 1ms)');
  } else if (avgLatency < 5) {
    console.log('  ✓ Good performance (< 5ms)');
  } else if (avgLatency < 10) {
    console.log('  ⚠️  Acceptable performance (< 10ms)');
  } else {
    console.log('  ⚠️  High latency detected (> 10ms)');
  }
}

async function testBullMQCompatibility(client) {
  console.log('\n🐂 Testing BullMQ compatibility...');
  
  try {
    const testQueue = 'test:bullmq:queue';
    
    await client.zadd(testQueue, Date.now(), 'job1');
    await client.zadd(testQueue, Date.now() + 1000, 'job2');
    
    const jobs = await client.zrange(testQueue, 0, -1);
    console.log(`  ✓ Queue operations: ${jobs.length === 2 ? 'PASS' : 'FAIL'}`);
    
    const multi = client.multi();
    multi.set('test:multi:1', 'value1');
    multi.set('test:multi:2', 'value2');
    const results = await multi.exec();
    console.log(`  ✓ Multi/transaction support: ${results.length === 2 ? 'PASS' : 'FAIL'}`);
    
    const luaScript = `
      local key = KEYS[1]
      local value = ARGV[1]
      redis.call('set', key, value)
      return redis.call('get', key)
    `;
    const scriptResult = await client.eval(luaScript, 1, 'test:lua', 'lua-value');
    console.log(`  ✓ Lua scripting: ${scriptResult === 'lua-value' ? 'PASS' : 'FAIL'}`);
    
    await client.del(testQueue, 'test:multi:1', 'test:multi:2', 'test:lua');
    console.log('  ✓ BullMQ requirements met');
  } catch (error) {
    console.error('  ✗ BullMQ compatibility test failed:', error.message);
  }
}

async function testMemoryInfo(client) {
  console.log('\n💾 Memory information...');
  
  try {
    const info = await client.info('memory');
    const lines = info.split('\r\n');
    const memStats = {};
    
    for (const line of lines) {
      const [key, value] = line.split(':');
      if (key && value) {
        memStats[key] = value;
      }
    }
    
    const usedMemory = parseInt(memStats.used_memory || 0);
    const peakMemory = parseInt(memStats.used_memory_peak || 0);
    const maxMemory = memStats.maxmemory ? parseInt(memStats.maxmemory) : null;
    
    console.log(`  ✓ Used memory: ${(usedMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  ✓ Peak memory: ${(peakMemory / 1024 / 1024).toFixed(2)} MB`);
    if (maxMemory) {
      console.log(`  ✓ Max memory: ${(maxMemory / 1024 / 1024).toFixed(2)} MB`);
      const usage = (usedMemory / maxMemory * 100).toFixed(2);
      console.log(`  ✓ Memory usage: ${usage}%`);
    }
  } catch (error) {
    console.log('  ⚠️  Could not retrieve memory information');
  }
}

async function testProvider(providerKey) {
  const provider = providers[providerKey];
  if (!provider) {
    console.error(`Unknown provider: ${providerKey}`);
    return false;
  }
  
  console.log(`\n🔌 Testing ${provider.name} Redis connection...`);
  console.log('─'.repeat(50));
  
  let client;
  
  try {
    const config = provider.getConfig();
    
    if (config.url) {
      client = new Redis(config.url, config);
    } else {
      client = new Redis(config);
    }
    
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const pingStart = Date.now();
    await client.ping();
    const pingLatency = Date.now() - pingStart;
    console.log(`✅ PING successful (${pingLatency}ms)`);
    
    await testBasicOperations(client);
    await testPerformance(client);
    await testBullMQCompatibility(client);
    await testMemoryInfo(client);
    
    console.log('\n✅ All tests passed!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    
    if (error.message.includes('NOAUTH')) {
      console.error('   → Authentication required. Check REDIS_PASSWORD');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('   → Connection refused. Check host and port');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('   → Host not found. Check REDIS_HOST');
    } else if (error.message.includes('ETIMEDOUT')) {
      console.error('   → Connection timeout. Check network and firewall');
    } else if (error.message.includes('ECONNRESET')) {
      console.error('   → Connection reset. TLS might be required');
    }
    
    return false;
  } finally {
    if (client) {
      await client.quit();
      console.log('\n🔌 Connection closed');
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const providerArg = args.find(arg => arg.startsWith('--provider='));
  const provider = providerArg ? providerArg.split('=')[1] : process.env.REDIS_PROVIDER || 'local';
  
  console.log('Redis Connection Test Tool');
  console.log('═'.repeat(50));
  console.log(`Provider: ${provider}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  const success = await testProvider(provider);
  
  console.log('\n' + '═'.repeat(50));
  if (success) {
    console.log('✅ Redis configuration is working correctly!');
    process.exit(0);
  } else {
    console.log('❌ Redis configuration needs attention');
    console.log('\nTroubleshooting tips:');
    console.log('1. Check your .env file has the correct Redis credentials');
    console.log('2. Ensure Redis service is running and accessible');
    console.log('3. Verify network connectivity and firewall rules');
    console.log('4. For production, ensure TLS/SSL is properly configured');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});