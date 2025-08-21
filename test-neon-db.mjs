#!/usr/bin/env node

/**
 * Simple Neon database connection test
 * Tests both pooled and direct connections
 */

import { createConnection } from 'net';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, 'apps/web/.env.local') });

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

/**
 * Test Prisma connection
 */
async function testPrismaConnection() {
  log('\n🔷 Testing Prisma connection with Neon...', 'cyan');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
  
  try {
    // Test basic connection
    const result = await prisma.$queryRaw`SELECT NOW() as now, current_database() as db, version() as version`;
    
    log('✅ Prisma connection successful', 'green');
    log(`   Database: ${result[0].db}`, 'blue');
    log(`   Time: ${result[0].now}`, 'blue');
    log(`   PostgreSQL: ${result[0].version.split(' ')[1]}`, 'blue');
    
    // Test SSL
    const sslResult = await prisma.$queryRaw`SELECT ssl_is_used()`;
    if (sslResult[0].ssl_is_used) {
      log('✅ SSL/TLS is enabled', 'green');
    } else {
      log('⚠️  SSL/TLS is NOT enabled', 'yellow');
    }
    
    // Test connection type
    const isPooled = process.env.DATABASE_URL.includes('-pooler');
    log(`   Connection type: ${isPooled ? 'Pooled (PgBouncer)' : 'Direct'}`, 'blue');
    
    // Check tables
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    log(`\n📊 Database Tables (${tables.length} found):`, 'cyan');
    tables.forEach(table => {
      log(`   - ${table.table_name}`, 'blue');
    });
    
    // Test a simple query if tables exist
    if (tables.length > 0) {
      try {
        const userCount = await prisma.user.count();
        log(`\n📈 Data Check:`, 'cyan');
        log(`   Users in database: ${userCount}`, 'blue');
      } catch (e) {
        // Tables might not be migrated yet
        log(`\n⚠️  Tables not migrated yet. Run: pnpm db:push`, 'yellow');
      }
    }
    
    return true;
  } catch (error) {
    log(`❌ Prisma connection failed: ${error.message}`, 'red');
    
    if (error.message.includes('P1001')) {
      log('   Check: Is your database URL correct?', 'yellow');
      log('   Check: Is Neon database running?', 'yellow');
    } else if (error.message.includes('P1002')) {
      log('   Connection timeout - check network and Neon status', 'yellow');
    }
    
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Parse and display connection details
 */
function displayConnectionInfo() {
  log('\n🔍 Connection Configuration:', 'cyan');
  
  const pooledUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_DATABASE_URL;
  
  if (!pooledUrl || !directUrl) {
    log('❌ Missing DATABASE_URL or DIRECT_DATABASE_URL in environment', 'red');
    return false;
  }
  
  // Parse pooled URL
  try {
    const pooledParts = new URL(pooledUrl.replace('postgresql://', 'https://'));
    log('\n📡 Pooled Connection (Application):', 'blue');
    log(`   Host: ${pooledParts.hostname}`, 'blue');
    log(`   Database: ${pooledParts.pathname.slice(1).split('?')[0]}`, 'blue');
    log(`   SSL: ${pooledUrl.includes('sslmode=require') ? 'Required ✅' : 'Not Required ❌'}`, 'blue');
    log(`   PgBouncer: ${pooledUrl.includes('-pooler') ? 'Enabled ✅' : 'Disabled ❌'}`, 'blue');
  } catch (e) {
    log('❌ Invalid pooled URL format', 'red');
  }
  
  // Parse direct URL
  try {
    const directParts = new URL(directUrl.replace('postgresql://', 'https://'));
    log('\n🔗 Direct Connection (Migrations):', 'blue');
    log(`   Host: ${directParts.hostname}`, 'blue');
    log(`   Database: ${directParts.pathname.slice(1).split('?')[0]}`, 'blue');
    log(`   SSL: ${directUrl.includes('sslmode=require') ? 'Required ✅' : 'Not Required ❌'}`, 'blue');
  } catch (e) {
    log('❌ Invalid direct URL format', 'red');
  }
  
  return true;
}

/**
 * Test network connectivity to Neon
 */
async function testNetworkConnectivity() {
  log('\n🌐 Testing Network Connectivity to Neon...', 'cyan');
  
  const url = process.env.DATABASE_URL;
  if (!url) {
    log('❌ No DATABASE_URL found', 'red');
    return false;
  }
  
  try {
    const urlParts = new URL(url.replace('postgresql://', 'https://'));
    const hostname = urlParts.hostname;
    
    return new Promise((resolve) => {
      const socket = createConnection(5432, hostname, () => {
        log(`✅ Network connection successful to ${hostname}:5432`, 'green');
        socket.end();
        resolve(true);
      });
      
      socket.on('error', (err) => {
        log(`❌ Network connection failed: ${err.message}`, 'red');
        resolve(false);
      });
      
      socket.setTimeout(5000, () => {
        log('❌ Network connection timeout', 'red');
        socket.destroy();
        resolve(false);
      });
    });
  } catch (error) {
    log(`❌ Error testing network: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('');
  log('🚀 Neon PostgreSQL Connection Test', 'cyan');
  log('=====================================', 'cyan');
  
  // Display connection info
  const hasConfig = displayConnectionInfo();
  if (!hasConfig) {
    process.exit(1);
  }
  
  // Test network connectivity
  const networkOk = await testNetworkConnectivity();
  
  // Test Prisma connection
  const prismaOk = await testPrismaConnection();
  
  // Summary
  console.log('');
  log('📊 Test Summary', 'cyan');
  log('===============', 'cyan');
  log(`${networkOk ? '✅' : '❌'} Network Connectivity`, networkOk ? 'green' : 'red');
  log(`${prismaOk ? '✅' : '❌'} Database Connection`, prismaOk ? 'green' : 'red');
  
  console.log('');
  if (networkOk && prismaOk) {
    log('🎉 All tests passed! Your Neon database is properly configured.', 'green');
    log('\n📝 Next steps:', 'cyan');
    log('   1. Run migrations: pnpm db:push', 'blue');
    log('   2. Deploy to Vercel/Railway with these env vars', 'blue');
    log('   3. Monitor in Neon Console: console.neon.tech', 'blue');
  } else {
    log('⚠️  Some tests failed. Please check the configuration above.', 'yellow');
    log('\n🔧 Troubleshooting:', 'cyan');
    log('   1. Check your Neon dashboard is the database running', 'blue');
    log('   2. Verify connection strings in .env.local', 'blue');
    log('   3. Ensure your IP is not blocked if using IP allowlist', 'blue');
  }
  
  process.exit(networkOk && prismaOk ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});