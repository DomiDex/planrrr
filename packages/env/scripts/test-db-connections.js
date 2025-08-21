#!/usr/bin/env node

/**
 * Test script for Neon PostgreSQL connection pooling
 * Tests both pooled and direct connections
 */

import pg from 'pg';
import { PrismaClient } from '@repo/database';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../../apps/web/.env.local') });

const { Pool, Client } = pg;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test configurations
const tests = {
  pooledUrl: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_DATABASE_URL,
};

/**
 * Test basic connection
 */
async function testBasicConnection(connectionString, label) {
  log(`\n🧪 Testing ${label}...`, 'cyan');
  
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    const result = await client.query('SELECT NOW() as now, current_database() as db, version() as version');
    
    log(`✅ ${label} successful`, 'green');
    log(`   Database: ${result.rows[0].db}`, 'blue');
    log(`   Time: ${result.rows[0].now}`, 'blue');
    log(`   Version: ${result.rows[0].version.split(',')[0]}`, 'blue');
    
    return true;
  } catch (error) {
    log(`❌ ${label} failed: ${error.message}`, 'red');
    return false;
  } finally {
    await client.end();
  }
}

/**
 * Test SSL connection
 */
async function testSSLConnection(connectionString) {
  log('\n🔒 Testing SSL/TLS...', 'cyan');
  
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    const result = await client.query("SELECT ssl_is_used()");
    
    if (result.rows[0].ssl_is_used) {
      log('✅ SSL/TLS is enabled and working', 'green');
      
      // Get SSL details
      const sslInfo = await client.query(`
        SELECT 
          ssl_version() as version,
          ssl_cipher() as cipher
      `);
      
      log(`   SSL Version: ${sslInfo.rows[0].version}`, 'blue');
      log(`   Cipher: ${sslInfo.rows[0].cipher}`, 'blue');
    } else {
      log('⚠️  SSL/TLS is NOT enabled', 'yellow');
    }
    
    return true;
  } catch (error) {
    log(`❌ SSL test failed: ${error.message}`, 'red');
    return false;
  } finally {
    await client.end();
  }
}

/**
 * Test connection pooling with concurrent connections
 */
async function testConnectionPooling(connectionString, maxConnections = 100) {
  log(`\n🔄 Testing connection pooling (${maxConnections} concurrent connections)...`, 'cyan');
  
  const pool = new Pool({
    connectionString,
    max: maxConnections,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  });
  
  const startTime = Date.now();
  const results = [];
  
  try {
    // Create concurrent connection promises
    const promises = [];
    for (let i = 0; i < maxConnections; i++) {
      promises.push(
        pool.query('SELECT pg_backend_pid() as pid, NOW() as time')
          .then((result) => {
            results.push({ success: true, pid: result.rows[0].pid });
            return true;
          })
          .catch((error) => {
            results.push({ success: false, error: error.message });
            return false;
          })
      );
    }
    
    // Wait for all connections
    await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const uniquePids = new Set(results.filter(r => r.success).map(r => r.pid)).size;
    
    log(`✅ Connection pooling test completed in ${duration}ms`, 'green');
    log(`   Successful connections: ${successful}/${maxConnections}`, 'blue');
    log(`   Failed connections: ${failed}`, failed > 0 ? 'yellow' : 'blue');
    log(`   Unique backend PIDs: ${uniquePids} (shows connection reuse)`, 'blue');
    
    if (failed > 0) {
      const errors = results.filter(r => !r.success).slice(0, 3);
      errors.forEach(e => log(`   Error: ${e.error}`, 'yellow'));
    }
    
    return successful === maxConnections;
  } catch (error) {
    log(`❌ Connection pooling test failed: ${error.message}`, 'red');
    return false;
  } finally {
    await pool.end();
  }
}

/**
 * Test Prisma connection
 */
async function testPrismaConnection() {
  log('\n🔷 Testing Prisma connection...', 'cyan');
  
  const prisma = new PrismaClient();
  
  try {
    // Test query
    const result = await prisma.$queryRaw`SELECT NOW() as now`;
    log('✅ Prisma connection successful', 'green');
    
    // Test schema introspection
    const tableCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    log(`   Tables in schema: ${tableCount[0].count}`, 'blue');
    
    return true;
  } catch (error) {
    log(`❌ Prisma connection failed: ${error.message}`, 'red');
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Test connection limits and behavior
 */
async function testConnectionBehavior(connectionString) {
  log('\n⚙️  Testing connection behavior...', 'cyan');
  
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // Check connection settings
    const settings = await client.query(`
      SELECT 
        current_setting('statement_timeout') as statement_timeout,
        current_setting('idle_in_transaction_session_timeout') as idle_timeout,
        current_setting('max_connections') as max_connections
    `);
    
    log('✅ Connection settings retrieved', 'green');
    log(`   Statement timeout: ${settings.rows[0].statement_timeout}`, 'blue');
    log(`   Idle timeout: ${settings.rows[0].idle_timeout}`, 'blue');
    log(`   Max connections: ${settings.rows[0].max_connections}`, 'blue');
    
    // Test if this is a pooled connection
    const isPooled = connectionString.includes('-pooler');
    if (isPooled) {
      log('   Connection type: Pooled (PgBouncer)', 'blue');
      
      // Test session variable behavior (won't persist in transaction mode)
      await client.query("SET search_path TO public");
      const searchPath = await client.query("SHOW search_path");
      log(`   Search path: ${searchPath.rows[0].search_path}`, 'blue');
    } else {
      log('   Connection type: Direct', 'blue');
    }
    
    return true;
  } catch (error) {
    log(`❌ Connection behavior test failed: ${error.message}`, 'red');
    return false;
  } finally {
    await client.end();
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('');
  log('🚀 Neon PostgreSQL Connection Test Suite', 'cyan');
  log('=========================================', 'cyan');
  
  if (!tests.pooledUrl || !tests.directUrl) {
    log('❌ Missing DATABASE_URL or DIRECT_DATABASE_URL in environment', 'red');
    process.exit(1);
  }
  
  const results = {
    pooledBasic: false,
    directBasic: false,
    ssl: false,
    pooling: false,
    prisma: false,
    behavior: false,
  };
  
  // Test pooled connection
  results.pooledBasic = await testBasicConnection(tests.pooledUrl, 'Pooled Connection');
  
  // Test direct connection
  results.directBasic = await testBasicConnection(tests.directUrl, 'Direct Connection');
  
  // Test SSL (using direct connection)
  if (results.directBasic) {
    results.ssl = await testSSLConnection(tests.directUrl);
  }
  
  // Test connection pooling
  if (results.pooledBasic) {
    results.pooling = await testConnectionPooling(tests.pooledUrl, 50); // Test with 50 connections
  }
  
  // Test Prisma
  results.prisma = await testPrismaConnection();
  
  // Test connection behavior
  if (results.pooledBasic) {
    results.behavior = await testConnectionBehavior(tests.pooledUrl);
  }
  
  // Summary
  console.log('');
  log('📊 Test Summary', 'cyan');
  log('===============', 'cyan');
  
  const allPassed = Object.values(results).every(r => r);
  
  Object.entries(results).forEach(([test, passed]) => {
    const testName = {
      pooledBasic: 'Pooled Connection',
      directBasic: 'Direct Connection',
      ssl: 'SSL/TLS Security',
      pooling: 'Connection Pooling',
      prisma: 'Prisma Client',
      behavior: 'Connection Behavior',
    }[test];
    
    log(`${passed ? '✅' : '❌'} ${testName}`, passed ? 'green' : 'red');
  });
  
  console.log('');
  if (allPassed) {
    log('🎉 All tests passed! Your Neon database is properly configured.', 'green');
  } else {
    log('⚠️  Some tests failed. Please check the configuration above.', 'yellow');
  }
  
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});