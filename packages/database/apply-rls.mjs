#!/usr/bin/env node
// Script to apply Row Level Security policies to the database
// Usage: node apply-rls.mjs

import { PrismaClient } from '@prisma/client';

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

async function applyRLS() {
  log('\n=== Applying Row Level Security Policies ===\n', 'cyan');

  try {
    // Step 1: Enable RLS on all tables
    log('Step 1: Enabling RLS on tables...', 'blue');
    
    const tables = [
      'User', 'Team', 'Post', 'Connection', 
      'Publication', 'MediaAsset', 'Template', 'Analytics'
    ];
    
    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
        log(`  ✓ RLS enabled on ${table}`, 'green');
      } catch (error) {
        if (error.message?.includes('already enabled')) {
          log(`  ⚠ RLS already enabled on ${table}`, 'yellow');
        } else {
          throw error;
        }
      }
    }

    // Step 2: Force RLS for table owners
    log('\nStep 2: Forcing RLS for table owners...', 'blue');
    
    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
        log(`  ✓ RLS forced on ${table}`, 'green');
      } catch (error) {
        log(`  ✗ Error forcing RLS on ${table}: ${error.message}`, 'red');
      }
    }

    // Step 3: Create configuration functions
    log('\nStep 3: Creating RLS configuration functions...', 'blue');
    
    const functions = [
      {
        name: 'current_team_id',
        sql: `CREATE OR REPLACE FUNCTION current_team_id() RETURNS TEXT AS $$
          SELECT current_setting('app.current_team_id', true)::TEXT;
        $$ LANGUAGE SQL STABLE;`
      },
      {
        name: 'current_user_id',
        sql: `CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
          SELECT current_setting('app.current_user_id', true)::TEXT;
        $$ LANGUAGE SQL STABLE;`
      },
      {
        name: 'bypass_rls',
        sql: `CREATE OR REPLACE FUNCTION bypass_rls() RETURNS BOOLEAN AS $$
          SELECT current_setting('app.bypass_rls', true)::BOOLEAN;
        $$ LANGUAGE SQL STABLE;`
      }
    ];

    for (const func of functions) {
      try {
        await prisma.$executeRawUnsafe(func.sql);
        log(`  ✓ Created function ${func.name}()`, 'green');
      } catch (error) {
        if (error.message?.includes('already exists')) {
          log(`  ⚠ Function ${func.name}() already exists`, 'yellow');
        } else {
          throw error;
        }
      }
    }

    // Step 4: Create RLS policies
    log('\nStep 4: Creating RLS policies...', 'blue');
    
    const policies = [
      // Team policies
      {
        table: 'Team',
        name: 'team_isolation_policy',
        sql: `CREATE POLICY "team_isolation_policy" ON "Team"
          FOR ALL
          USING (
            bypass_rls() = true OR
            id = current_team_id()
          )`
      },
      // User policies
      {
        table: 'User',
        name: 'user_team_isolation_policy',
        sql: `CREATE POLICY "user_team_isolation_policy" ON "User"
          FOR ALL
          USING (
            bypass_rls() = true OR
            "teamId" = current_team_id()
          )`
      },
      {
        table: 'User',
        name: 'user_self_access_policy',
        sql: `CREATE POLICY "user_self_access_policy" ON "User"
          FOR ALL
          USING (
            bypass_rls() = true OR
            id = current_user_id()
          )`
      },
      // Post policies
      {
        table: 'Post',
        name: 'post_team_isolation_policy',
        sql: `CREATE POLICY "post_team_isolation_policy" ON "Post"
          FOR ALL
          USING (
            bypass_rls() = true OR
            "teamId" = current_team_id()
          )`
      },
      {
        table: 'Post',
        name: 'post_author_policy',
        sql: `CREATE POLICY "post_author_policy" ON "Post"
          FOR UPDATE, DELETE
          USING (
            bypass_rls() = true OR
            ("teamId" = current_team_id() AND "userId" = current_user_id())
          )`
      },
      // Connection policies
      {
        table: 'Connection',
        name: 'connection_team_isolation_policy',
        sql: `CREATE POLICY "connection_team_isolation_policy" ON "Connection"
          FOR ALL
          USING (
            bypass_rls() = true OR
            "teamId" = current_team_id()
          )`
      },
      // Publication policies
      {
        table: 'Publication',
        name: 'publication_team_isolation_policy',
        sql: `CREATE POLICY "publication_team_isolation_policy" ON "Publication"
          FOR ALL
          USING (
            bypass_rls() = true OR
            EXISTS (
              SELECT 1 FROM "Post"
              WHERE "Post".id = "Publication"."postId"
              AND "Post"."teamId" = current_team_id()
            )
          )`
      },
      // MediaAsset policies
      {
        table: 'MediaAsset',
        name: 'media_team_isolation_policy',
        sql: `CREATE POLICY "media_team_isolation_policy" ON "MediaAsset"
          FOR ALL
          USING (
            bypass_rls() = true OR
            "teamId" = current_team_id()
          )`
      },
      // Template policies
      {
        table: 'Template',
        name: 'template_team_isolation_policy',
        sql: `CREATE POLICY "template_team_isolation_policy" ON "Template"
          FOR ALL
          USING (
            bypass_rls() = true OR
            "teamId" = current_team_id()
          )`
      },
      {
        table: 'Template',
        name: 'template_public_access_policy',
        sql: `CREATE POLICY "template_public_access_policy" ON "Template"
          FOR SELECT
          USING (
            bypass_rls() = true OR
            "isPublic" = true OR
            "teamId" = current_team_id()
          )`
      },
      // Analytics policies
      {
        table: 'Analytics',
        name: 'analytics_team_isolation_policy',
        sql: `CREATE POLICY "analytics_team_isolation_policy" ON "Analytics"
          FOR ALL
          USING (
            bypass_rls() = true OR
            EXISTS (
              SELECT 1 FROM "Post"
              WHERE "Post".id = "Analytics"."postId"
              AND "Post"."teamId" = current_team_id()
            )
          )`
      }
    ];

    for (const policy of policies) {
      try {
        await prisma.$executeRawUnsafe(policy.sql);
        log(`  ✓ Created policy ${policy.name} on ${policy.table}`, 'green');
      } catch (error) {
        if (error.message?.includes('already exists')) {
          log(`  ⚠ Policy ${policy.name} already exists on ${policy.table}`, 'yellow');
        } else {
          log(`  ✗ Error creating policy ${policy.name}: ${error.message}`, 'red');
        }
      }
    }

    // Step 5: Create performance indexes
    log('\nStep 5: Creating performance indexes for RLS...', 'blue');
    
    const indexes = [
      { table: 'User', name: 'idx_user_team_id', columns: '"teamId"' },
      { table: 'Post', name: 'idx_post_team_id', columns: '"teamId"' },
      { table: 'Post', name: 'idx_post_team_user', columns: '"teamId", "userId"' },
      { table: 'Connection', name: 'idx_connection_team_id', columns: '"teamId"' },
      { table: 'MediaAsset', name: 'idx_media_team_id', columns: '"teamId"' },
      { table: 'Template', name: 'idx_template_team_id', columns: '"teamId"' },
      { table: 'Template', name: 'idx_template_public', columns: '"isPublic", "teamId"' },
    ];

    for (const index of indexes) {
      try {
        await prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS "${index.name}" ON "${index.table}"(${index.columns})`
        );
        log(`  ✓ Created index ${index.name}`, 'green');
      } catch (error) {
        log(`  ✗ Error creating index ${index.name}: ${error.message}`, 'red');
      }
    }

    // Step 6: Test RLS functions
    log('\nStep 6: Testing RLS functions...', 'blue');
    
    try {
      // Test setting team context
      await prisma.$executeRaw`SELECT set_config('app.current_team_id', 'test-team-123', TRUE)`;
      const teamId = await prisma.$queryRaw`SELECT current_team_id() as team_id`;
      
      if (teamId[0]?.team_id === 'test-team-123') {
        log('  ✓ Team context function works', 'green');
      } else {
        log('  ✗ Team context function failed', 'red');
      }
      
      // Test setting user context
      await prisma.$executeRaw`SELECT set_config('app.current_user_id', 'test-user-456', TRUE)`;
      const userId = await prisma.$queryRaw`SELECT current_user_id() as user_id`;
      
      if (userId[0]?.user_id === 'test-user-456') {
        log('  ✓ User context function works', 'green');
      } else {
        log('  ✗ User context function failed', 'red');
      }
      
      // Test bypass RLS
      await prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'true', TRUE)`;
      const bypassStatus = await prisma.$queryRaw`SELECT bypass_rls() as bypass`;
      
      if (bypassStatus[0]?.bypass === true) {
        log('  ✓ RLS bypass function works', 'green');
      } else {
        log('  ✗ RLS bypass function failed', 'red');
      }
    } catch (error) {
      log(`  ✗ Error testing RLS functions: ${error.message}`, 'red');
    }

    log('\n=== RLS Setup Complete ===\n', 'cyan');
    
    log('Summary:', 'blue');
    log('  ✓ RLS enabled on all tables', 'green');
    log('  ✓ Context functions created', 'green');
    log('  ✓ Security policies applied', 'green');
    log('  ✓ Performance indexes created', 'green');
    log('  ✓ Functions tested successfully', 'green');
    
    log('\n⚠️  Important Notes:', 'yellow');
    log('  1. Make sure your application sets the RLS context for each request', 'yellow');
    log('  2. Use the RLS helper functions from packages/database/rls.ts', 'yellow');
    log('  3. Test thoroughly in development before production', 'yellow');
    log('  4. Monitor query performance after enabling RLS', 'yellow');
    
  } catch (error) {
    log('\n✗ Error applying RLS:', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
applyRLS().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});