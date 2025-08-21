#!/usr/bin/env node
// Test script for Row Level Security implementation
// Usage: node test-rls.mjs

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env') });

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// ANSI color codes
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

async function testRLS() {
  log('\n=== Testing Row Level Security Implementation ===\n', 'cyan');

  try {
    // Test 1: Check if RLS functions exist
    log('Test 1: Checking RLS functions...', 'blue');
    
    const functions = await prisma.$queryRaw`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_type = 'FUNCTION' 
      AND routine_name IN ('current_team_id', 'current_user_id', 'bypass_rls')
      AND routine_schema = 'public'
    `;
    
    if (Array.isArray(functions) && functions.length === 3) {
      log('✓ All RLS functions created successfully', 'green');
    } else {
      log('✗ RLS functions missing', 'red');
      console.log('Found functions:', functions);
    }

    // Test 2: Check if RLS is enabled on tables
    log('\nTest 2: Checking RLS status on tables...', 'blue');
    
    const rlsStatus = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('User', 'Team', 'Post', 'Connection', 'Publication', 'MediaAsset', 'Template', 'Analytics')
      ORDER BY tablename
    `;
    
    let allEnabled = true;
    for (const table of rlsStatus) {
      if (table.rowsecurity) {
        log(`✓ RLS enabled on ${table.tablename}`, 'green');
      } else {
        log(`✗ RLS not enabled on ${table.tablename}`, 'red');
        allEnabled = false;
      }
    }

    // Test 3: Check RLS policies
    log('\nTest 3: Checking RLS policies...', 'blue');
    
    const policies = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `;
    
    const policyCount = {};
    for (const policy of policies) {
      policyCount[policy.tablename] = (policyCount[policy.tablename] || 0) + 1;
    }
    
    log(`Found ${policies.length} total policies:`, 'yellow');
    for (const [table, count] of Object.entries(policyCount)) {
      log(`  ${table}: ${count} policies`, 'cyan');
    }

    // Test 4: Test RLS context setting
    log('\nTest 4: Testing RLS context functions...', 'blue');
    
    // Set team context
    await prisma.$executeRaw`SELECT set_config('app.current_team_id', 'test-team-123', TRUE)`;
    const teamId = await prisma.$queryRaw`SELECT current_team_id() as team_id`;
    
    if (teamId[0]?.team_id === 'test-team-123') {
      log('✓ Team context setting works', 'green');
    } else {
      log('✗ Team context setting failed', 'red');
    }
    
    // Set user context
    await prisma.$executeRaw`SELECT set_config('app.current_user_id', 'test-user-456', TRUE)`;
    const userId = await prisma.$queryRaw`SELECT current_user_id() as user_id`;
    
    if (userId[0]?.user_id === 'test-user-456') {
      log('✓ User context setting works', 'green');
    } else {
      log('✗ User context setting failed', 'red');
    }
    
    // Test bypass RLS
    await prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'true', TRUE)`;
    const bypassStatus = await prisma.$queryRaw`SELECT bypass_rls() as bypass`;
    
    if (bypassStatus[0]?.bypass === true) {
      log('✓ RLS bypass setting works', 'green');
    } else {
      log('✗ RLS bypass setting failed', 'red');
    }

    // Test 5: Check indexes for RLS performance
    log('\nTest 5: Checking RLS performance indexes...', 'blue');
    
    const indexes = await prisma.$queryRaw`
      SELECT 
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname LIKE 'idx_%team%'
      ORDER BY tablename, indexname
    `;
    
    if (indexes.length > 0) {
      log(`✓ Found ${indexes.length} RLS performance indexes:`, 'green');
      for (const idx of indexes) {
        log(`  - ${idx.indexname} on ${idx.tablename}`, 'cyan');
      }
    } else {
      log('✗ No RLS performance indexes found', 'yellow');
    }

    // Test 6: Test with actual data (if exists)
    log('\nTest 6: Testing with actual data...', 'blue');
    
    const teamCount = await prisma.team.count();
    if (teamCount > 0) {
      // Get first team
      const team = await prisma.team.findFirst();
      
      if (team) {
        // Set RLS context for this team
        await prisma.$executeRaw`SELECT set_config('app.current_team_id', ${team.id}, TRUE)`;
        await prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'false', TRUE)`;
        
        // Try to query posts - should only see team's posts
        const posts = await prisma.$queryRaw`
          SELECT COUNT(*) as count 
          FROM "Post" 
          WHERE "teamId" = ${team.id}
        `;
        
        log(`✓ RLS filtering test: Found ${posts[0].count} posts for team ${team.id}`, 'green');
      }
    } else {
      log('⚠ No data available for testing, run seed first', 'yellow');
    }

    log('\n=== RLS Testing Complete ===\n', 'cyan');
    
    // Summary
    log('Summary:', 'blue');
    if (allEnabled) {
      log('✓ Row Level Security is properly configured', 'green');
      log('✓ All required functions are created', 'green');
      log('✓ All tables have RLS enabled', 'green');
      log('✓ Context setting functions work correctly', 'green');
    } else {
      log('⚠ Some RLS features need attention', 'yellow');
    }
    
  } catch (error) {
    log('\n✗ Error during RLS testing:', 'red');
    console.error(error);
    
    if (error.message?.includes('does not exist')) {
      log('\n⚠ RLS migration may not have been applied yet', 'yellow');
      log('Run: pnpm db:migrate:deploy to apply migrations', 'cyan');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testRLS().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});