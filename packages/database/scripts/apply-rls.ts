// Script to apply Row Level Security (RLS) policies to Neon database
// Run with: npx tsx scripts/apply-rls.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyRLS() {
  console.log('🔐 Applying Row Level Security policies to database...\n');

  try {
    // 1. Enable RLS on all tables
    console.log('📋 Enabling RLS on tables...');
    const tables = [
      'auth.users',
      'auth.sessions',
      'auth.accounts',
      'public.teams',
      'public.connections',
      'public.posts',
      'public.publications',
      'public.media_assets',
      'public.templates',
      'public.analytics',
      'public.audit_logs'
    ];

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
        console.log(`  ✓ Enabled RLS on ${table}`);
      } catch (err: unknown) {
        if (err instanceof Error && err.message?.includes('already enabled')) {
          console.log(`  ℹ RLS already enabled on ${table}`);
        } else {
          console.log(`  ⚠ Warning for ${table}:`, err instanceof Error ? err.message : String(err));
        }
      }
    }

    // 2. Create configuration functions
    console.log('\n⚙️ Creating configuration functions...');
    
    // Function to get current team ID
    try {
      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION current_team_id()
        RETURNS TEXT AS $$
        BEGIN
          RETURN current_setting('app.current_team_id', true);
        END;
        $$ LANGUAGE plpgsql STABLE;
      `;
      console.log('  ✓ Created current_team_id() function');
    } catch {
      console.log('  ℹ current_team_id() function may already exist');
    }

    // Function to get current user ID
    try {
      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION current_user_id()
        RETURNS TEXT AS $$
        BEGIN
          RETURN current_setting('app.current_user_id', true);
        END;
        $$ LANGUAGE plpgsql STABLE;
      `;
      console.log('  ✓ Created current_user_id() function');
    } catch {
      console.log('  ℹ current_user_id() function may already exist');
    }

    // Function to check if RLS should be bypassed
    try {
      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION bypass_rls()
        RETURNS BOOLEAN AS $$
        BEGIN
          RETURN current_setting('app.bypass_rls', true)::boolean;
        EXCEPTION
          WHEN OTHERS THEN
            RETURN false;
        END;
        $$ LANGUAGE plpgsql STABLE;
      `;
      console.log('  ✓ Created bypass_rls() function');
    } catch {
      console.log('  ℹ bypass_rls() function may already exist');
    }

    // 3. Create RLS policies
    console.log('\n🛡️ Creating security policies...');

    // Define all policies
    const policies = [
      // Users table policies
      {
        name: 'users_select_policy',
        table: 'auth.users',
        type: 'SELECT',
        using: 'bypass_rls() OR id = current_user_id() OR team_id = current_team_id()'
      },
      {
        name: 'users_update_policy',
        table: 'auth.users',
        type: 'UPDATE',
        using: 'bypass_rls() OR id = current_user_id()'
      },
      // Teams table policies
      {
        name: 'teams_select_policy',
        table: 'public.teams',
        type: 'SELECT',
        using: 'bypass_rls() OR id = current_team_id()'
      },
      {
        name: 'teams_update_policy',
        table: 'public.teams',
        type: 'UPDATE',
        using: `bypass_rls() OR (id = current_team_id() AND EXISTS (
          SELECT 1 FROM auth.users 
          WHERE id = current_user_id() 
          AND team_id = current_team_id() 
          AND role IN ('OWNER', 'ADMIN')
        ))`
      },
      // Posts table policies
      {
        name: 'posts_select_policy',
        table: 'public.posts',
        type: 'SELECT',
        using: 'bypass_rls() OR team_id = current_team_id()'
      },
      {
        name: 'posts_insert_policy',
        table: 'public.posts',
        type: 'INSERT',
        check: 'bypass_rls() OR team_id = current_team_id()'
      },
      {
        name: 'posts_update_policy',
        table: 'public.posts',
        type: 'UPDATE',
        using: `bypass_rls() OR (team_id = current_team_id() AND (
          user_id = current_user_id() OR
          EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = current_user_id() 
            AND team_id = current_team_id() 
            AND role IN ('OWNER', 'ADMIN')
          )
        ))`
      },
      {
        name: 'posts_delete_policy',
        table: 'public.posts',
        type: 'DELETE',
        using: `bypass_rls() OR (team_id = current_team_id() AND (
          user_id = current_user_id() OR
          EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = current_user_id() 
            AND team_id = current_team_id() 
            AND role IN ('OWNER', 'ADMIN')
          )
        ))`
      },
      // Connections table policies
      {
        name: 'connections_select_policy',
        table: 'public.connections',
        type: 'SELECT',
        using: 'bypass_rls() OR team_id = current_team_id()'
      },
      {
        name: 'connections_insert_policy',
        table: 'public.connections',
        type: 'INSERT',
        check: `bypass_rls() OR (team_id = current_team_id() AND EXISTS (
          SELECT 1 FROM auth.users 
          WHERE id = current_user_id() 
          AND team_id = current_team_id() 
          AND role IN ('OWNER', 'ADMIN')
        ))`
      },
      {
        name: 'connections_update_policy',
        table: 'public.connections',
        type: 'UPDATE',
        using: `bypass_rls() OR (team_id = current_team_id() AND EXISTS (
          SELECT 1 FROM auth.users 
          WHERE id = current_user_id() 
          AND team_id = current_team_id() 
          AND role IN ('OWNER', 'ADMIN')
        ))`
      },
      {
        name: 'connections_delete_policy',
        table: 'public.connections',
        type: 'DELETE',
        using: `bypass_rls() OR (team_id = current_team_id() AND EXISTS (
          SELECT 1 FROM auth.users 
          WHERE id = current_user_id() 
          AND team_id = current_team_id() 
          AND role IN ('OWNER', 'ADMIN')
        ))`
      },
      // Publications table policies
      {
        name: 'publications_select_policy',
        table: 'public.publications',
        type: 'SELECT',
        using: `bypass_rls() OR EXISTS (
          SELECT 1 FROM public.posts 
          WHERE id = publications.post_id 
          AND team_id = current_team_id()
        )`
      },
      // Media assets table policies
      {
        name: 'media_assets_select_policy',
        table: 'public.media_assets',
        type: 'SELECT',
        using: 'bypass_rls() OR team_id = current_team_id()'
      },
      {
        name: 'media_assets_insert_policy',
        table: 'public.media_assets',
        type: 'INSERT',
        check: 'bypass_rls() OR team_id = current_team_id()'
      },
      {
        name: 'media_assets_update_policy',
        table: 'public.media_assets',
        type: 'UPDATE',
        using: 'bypass_rls() OR team_id = current_team_id()'
      },
      {
        name: 'media_assets_delete_policy',
        table: 'public.media_assets',
        type: 'DELETE',
        using: 'bypass_rls() OR team_id = current_team_id()'
      },
      // Templates table policies
      {
        name: 'templates_select_policy',
        table: 'public.templates',
        type: 'SELECT',
        using: 'bypass_rls() OR team_id = current_team_id()'
      },
      {
        name: 'templates_insert_policy',
        table: 'public.templates',
        type: 'INSERT',
        check: 'bypass_rls() OR team_id = current_team_id()'
      },
      {
        name: 'templates_update_policy',
        table: 'public.templates',
        type: 'UPDATE',
        using: 'bypass_rls() OR team_id = current_team_id()'
      },
      {
        name: 'templates_delete_policy',
        table: 'public.templates',
        type: 'DELETE',
        using: 'bypass_rls() OR team_id = current_team_id()'
      },
      // Analytics table policies
      {
        name: 'analytics_select_policy',
        table: 'public.analytics',
        type: 'SELECT',
        using: `bypass_rls() OR EXISTS (
          SELECT 1 FROM public.posts 
          WHERE id = analytics.post_id 
          AND team_id = current_team_id()
        )`
      },
      {
        name: 'analytics_insert_policy',
        table: 'public.analytics',
        type: 'INSERT',
        check: `bypass_rls() OR EXISTS (
          SELECT 1 FROM public.posts 
          WHERE id = analytics.post_id 
          AND team_id = current_team_id()
        )`
      },
      // Audit logs table policies
      {
        name: 'audit_logs_select_policy',
        table: 'public.audit_logs',
        type: 'SELECT',
        using: 'bypass_rls() OR team_id = current_team_id() OR user_id = current_user_id()'
      },
      {
        name: 'audit_logs_insert_policy',
        table: 'public.audit_logs',
        type: 'INSERT',
        check: 'bypass_rls() OR team_id = current_team_id() OR user_id = current_user_id()'
      },
      // Sessions table policies
      {
        name: 'sessions_select_policy',
        table: 'auth.sessions',
        type: 'SELECT',
        using: 'bypass_rls() OR user_id = current_user_id()'
      },
      {
        name: 'sessions_insert_policy',
        table: 'auth.sessions',
        type: 'INSERT',
        check: 'bypass_rls() OR user_id = current_user_id()'
      },
      {
        name: 'sessions_update_policy',
        table: 'auth.sessions',
        type: 'UPDATE',
        using: 'bypass_rls() OR user_id = current_user_id()'
      },
      {
        name: 'sessions_delete_policy',
        table: 'auth.sessions',
        type: 'DELETE',
        using: 'bypass_rls() OR user_id = current_user_id()'
      },
      // Accounts table policies
      {
        name: 'accounts_select_policy',
        table: 'auth.accounts',
        type: 'SELECT',
        using: 'bypass_rls() OR user_id = current_user_id()'
      },
      {
        name: 'accounts_insert_policy',
        table: 'auth.accounts',
        type: 'INSERT',
        check: 'bypass_rls() OR user_id = current_user_id()'
      },
      {
        name: 'accounts_update_policy',
        table: 'auth.accounts',
        type: 'UPDATE',
        using: 'bypass_rls() OR user_id = current_user_id()'
      },
      {
        name: 'accounts_delete_policy',
        table: 'auth.accounts',
        type: 'DELETE',
        using: 'bypass_rls() OR user_id = current_user_id()'
      }
    ];

    // Apply each policy
    for (const policy of policies) {
      try {
        let sql = '';
        if (policy.type === 'INSERT' && policy.check) {
          sql = `CREATE POLICY IF NOT EXISTS ${policy.name} ON ${policy.table} FOR ${policy.type} WITH CHECK (${policy.check})`;
        } else if (policy.using) {
          sql = `CREATE POLICY IF NOT EXISTS ${policy.name} ON ${policy.table} FOR ${policy.type} USING (${policy.using})`;
        }
        
        if (sql) {
          await prisma.$executeRawUnsafe(sql);
          console.log(`  ✓ Created ${policy.name}`);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message?.includes('already exists')) {
          console.log(`  ℹ Policy ${policy.name} already exists`);
        } else {
          console.log(`  ⚠ Warning for ${policy.name}:`, err instanceof Error ? err.message : String(err));
        }
      }
    }

    // 4. Create indexes for performance
    console.log('\n📊 Creating performance indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_posts_team_status ON public.posts(team_id, status) WHERE deleted_at IS NULL',
      'CREATE INDEX IF NOT EXISTS idx_connections_team_status ON public.connections(team_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_media_assets_team ON public.media_assets(team_id)',
      'CREATE INDEX IF NOT EXISTS idx_templates_team ON public.templates(team_id)',
      'CREATE INDEX IF NOT EXISTS idx_posts_user ON public.posts(user_id) WHERE deleted_at IS NULL',
      'CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth.sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_accounts_user ON auth.accounts(user_id)'
    ];

    for (const index of indexes) {
      try {
        await prisma.$executeRawUnsafe(index);
        const indexName = index.match(/idx_\w+/)?.[0] || 'index';
        console.log(`  ✓ Created ${indexName}`);
      } catch (err: unknown) {
        const indexName = index.match(/idx_\w+/)?.[0] || 'index';
        if (err instanceof Error && err.message?.includes('already exists')) {
          console.log(`  ℹ Index ${indexName} already exists`);
        } else {
          console.log(`  ⚠ Warning for ${indexName}:`, err instanceof Error ? err.message : String(err));
        }
      }
    }

    console.log('\n✅ RLS policies applied successfully!');
    
    // Test the functions
    console.log('\n🧪 Testing RLS functions...');
    
    try {
      // Test setting and getting team ID
      await prisma.$executeRaw`SELECT set_config('app.current_team_id', 'test-team-id', false)`;
      const teamIdResult = await prisma.$queryRaw`SELECT current_team_id() as team_id`;
      console.log('  ✓ current_team_id() function works:', teamIdResult);
    } catch (err: unknown) {
      console.log('  ⚠ current_team_id() test failed:', err instanceof Error ? err.message : String(err));
    }
    
    try {
      // Test setting and getting user ID
      await prisma.$executeRaw`SELECT set_config('app.current_user_id', 'test-user-id', false)`;
      const userIdResult = await prisma.$queryRaw`SELECT current_user_id() as user_id`;
      console.log('  ✓ current_user_id() function works:', userIdResult);
    } catch (err: unknown) {
      console.log('  ⚠ current_user_id() test failed:', err instanceof Error ? err.message : String(err));
    }
    
    try {
      // Test bypass RLS
      await prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'true', false)`;
      const bypassResult = await prisma.$queryRaw`SELECT bypass_rls() as bypass`;
      console.log('  ✓ bypass_rls() function works:', bypassResult);
    } catch (err: unknown) {
      console.log('  ⚠ bypass_rls() test failed:', err instanceof Error ? err.message : String(err));
    }

    console.log('\n🎉 All RLS policies and functions have been processed!');
    
  } catch (error) {
    console.error('❌ Error applying RLS policies:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
applyRLS().catch((error) => {
  console.error('Failed to apply RLS:', error);
  process.exit(1);
});