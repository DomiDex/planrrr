# Row Level Security (RLS) Implementation Guide

## Overview

This package implements PostgreSQL Row Level Security (RLS) to ensure multi-tenant data isolation in planrrr.io. RLS policies automatically filter database queries based on the current user's team context, preventing unauthorized data access at the database level.

## Architecture

### Security Layers

1. **Database Level (RLS)**: PostgreSQL policies filter data based on session variables
2. **Application Level**: Prisma Client extensions set appropriate context
3. **API Level**: Middleware extracts auth context and applies RLS

### Key Components

- **RLS Policies**: PostgreSQL policies that filter data by team/user
- **Context Functions**: SQL functions to manage session variables
- **Prisma Extensions**: TypeScript utilities for setting RLS context
- **Performance Indexes**: Optimized indexes for RLS queries

## Setup

### 1. Apply RLS Migration

```bash
# Apply the RLS migration to your database
pnpm db:migrate:deploy

# Or push directly (development)
pnpm db:push
```

### 2. Verify RLS Setup

```bash
# Run the RLS test script
node packages/database/test-rls.mjs
```

## Usage Examples

### Basic Usage with Team Context

```typescript
import { prisma, forTeam } from '@repo/database';

// Create a team-scoped Prisma client
const teamPrisma = prisma.$extends(forTeam('team-123'));

// All queries are automatically filtered by team
const posts = await teamPrisma.post.findMany();
// Only returns posts where teamId = 'team-123'
```

### User-Scoped Queries

```typescript
import { prisma, forUser } from '@repo/database';

// Create a user-scoped client
const userPrisma = prisma.$extends(forUser('user-456', 'team-123'));

// Queries filtered by both team and user
const myPosts = await userPrisma.post.findMany();
// Returns posts where teamId = 'team-123' AND userId = 'user-456'
```

### API Route Integration

```typescript
// app/api/posts/route.ts
import { prisma, createScopedClient } from '@repo/database';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getSession();
  
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Create scoped client with user's context
  const scopedPrisma = createScopedClient(prisma, {
    teamId: session.teamId,
    userId: session.userId,
  });

  // Queries are automatically filtered
  const posts = await scopedPrisma.post.findMany({
    include: {
      user: true,
      publications: true,
    },
  });

  return Response.json(posts);
}
```

### Server Actions with RLS

```typescript
// app/actions/posts.ts
'use server';

import { prisma, withRLSTransaction } from '@repo/database';
import { getSession } from '@/lib/auth';

export async function createPost(data: PostInput) {
  const session = await getSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }

  // Use transaction with RLS context
  return withRLSTransaction(
    prisma,
    { teamId: session.teamId, userId: session.userId },
    async (tx) => {
      // Create post
      const post = await tx.post.create({
        data: {
          ...data,
          teamId: session.teamId,
          userId: session.userId,
        },
      });

      // Create related records - all within same RLS context
      if (data.mediaUrls?.length) {
        await tx.mediaAsset.createMany({
          data: data.mediaUrls.map(url => ({
            url,
            postId: post.id,
            teamId: session.teamId,
          })),
        });
      }

      return post;
    }
  );
}
```

### Admin Operations (Bypass RLS)

```typescript
import { prisma, bypassRLS } from '@repo/database';

// Admin-only function
export async function adminGetAllTeams() {
  // Bypass RLS for admin operations
  const adminPrisma = prisma.$extends(bypassRLS());
  
  return adminPrisma.team.findMany({
    include: {
      _count: {
        select: {
          users: true,
          posts: true,
        },
      },
    },
  });
}
```

### Middleware Pattern

```typescript
// server/middleware/rls.ts
import { prisma, rlsMiddleware } from '@repo/database';
import { getSession } from '@/lib/auth';

// Create Prisma client with automatic RLS
export const rlsPrisma = prisma.$extends(
  rlsMiddleware(async () => {
    const session = await getSession();
    
    if (!session) {
      return null; // No RLS context
    }

    return {
      teamId: session.teamId,
      userId: session.userId,
    };
  })
);

// Use in your API
import { rlsPrisma } from '@/server/middleware/rls';

export async function getPosts() {
  // Automatically uses session context
  return rlsPrisma.post.findMany();
}
```

## RLS Policies

### Team Isolation

All team-scoped tables have policies that filter by `current_team_id()`:

```sql
CREATE POLICY "team_isolation_policy" ON "Post"
  FOR ALL
  USING (
    bypass_rls() = true OR
    "teamId" = current_team_id()
  );
```

### User-Specific Access

Some operations require user-level permissions:

```sql
CREATE POLICY "post_author_policy" ON "Post"
  FOR UPDATE, DELETE
  USING (
    bypass_rls() = true OR
    ("teamId" = current_team_id() AND "userId" = current_user_id())
  );
```

### Public Content

Templates can be public or team-specific:

```sql
CREATE POLICY "template_public_access_policy" ON "Template"
  FOR SELECT
  USING (
    bypass_rls() = true OR
    "isPublic" = true OR
    "teamId" = current_team_id()
  );
```

## Performance Optimization

### Indexes for RLS

The migration creates indexes to optimize RLS queries:

```sql
CREATE INDEX "idx_post_team_id" ON "Post"("teamId");
CREATE INDEX "idx_post_team_user" ON "Post"("teamId", "userId");
```

### Query Optimization Tips

1. **Use team context whenever possible** - It's faster than user context
2. **Batch operations** - Use transactions to set context once
3. **Avoid N+1 queries** - Use includes/joins appropriately
4. **Monitor slow queries** - RLS adds overhead, profile regularly

## Testing RLS

### Unit Tests

```typescript
import { prisma, forTeam } from '@repo/database';
import { describe, it, expect } from 'vitest';

describe('RLS', () => {
  it('should isolate team data', async () => {
    const team1Prisma = prisma.$extends(forTeam('team-1'));
    const team2Prisma = prisma.$extends(forTeam('team-2'));

    // Create posts for different teams
    await team1Prisma.post.create({
      data: { content: 'Team 1 post', teamId: 'team-1', userId: 'user-1' },
    });

    await team2Prisma.post.create({
      data: { content: 'Team 2 post', teamId: 'team-2', userId: 'user-2' },
    });

    // Each team can only see their own posts
    const team1Posts = await team1Prisma.post.findMany();
    const team2Posts = await team2Prisma.post.findMany();

    expect(team1Posts).toHaveLength(1);
    expect(team1Posts[0].content).toBe('Team 1 post');

    expect(team2Posts).toHaveLength(1);
    expect(team2Posts[0].content).toBe('Team 2 post');
  });
});
```

### Integration Tests

```typescript
// Run the test script
node packages/database/test-rls.mjs
```

## Security Considerations

### Best Practices

1. **Never use superuser in production** - RLS is bypassed for superusers
2. **Always set context** - Unscoped queries may leak data
3. **Validate input** - RLS doesn't replace input validation
4. **Audit sensitive operations** - Log admin/bypass operations
5. **Test thoroughly** - Verify isolation in all scenarios

### Common Pitfalls

#### ❌ Wrong: Direct Prisma usage without context

```typescript
// DANGEROUS: No RLS context set
const posts = await prisma.post.findMany();
// May return posts from all teams!
```

#### ✅ Correct: Always use scoped client

```typescript
const scopedPrisma = createScopedClient(prisma, {
  teamId: session.teamId,
});
const posts = await scopedPrisma.post.findMany();
// Only returns posts from user's team
```

#### ❌ Wrong: Mixing contexts in transaction

```typescript
// BAD: Different contexts in same transaction
await prisma.$transaction([
  team1Prisma.post.create({ ... }),
  team2Prisma.post.create({ ... }), // Different context!
]);
```

#### ✅ Correct: Use consistent context

```typescript
await withRLSTransaction(prisma, { teamId }, async (tx) => {
  await tx.post.create({ ... });
  await tx.mediaAsset.create({ ... });
  // All use same context
});
```

## Troubleshooting

### RLS Not Working

1. Check if RLS is enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

2. Verify policies exist:
```sql
SELECT * FROM pg_policies 
WHERE schemaname = 'public';
```

3. Test context functions:
```sql
SELECT current_team_id(), current_user_id(), bypass_rls();
```

### Performance Issues

1. Check for missing indexes:
```sql
SELECT * FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';
```

2. Analyze query plans:
```sql
EXPLAIN ANALYZE 
SELECT * FROM "Post" 
WHERE "teamId" = 'team-123';
```

### Migration Errors

If migration fails:

1. Check database permissions
2. Ensure not using reserved roles
3. Verify PostgreSQL version (>= 9.5)
4. Check for existing policies/functions

## Advanced Patterns

### Dynamic Role-Based Access

```typescript
import { prisma, withRLS } from '@repo/database';

export async function getPostsForRole(session: Session) {
  const context = {
    teamId: session.teamId,
    userId: session.userId,
    // Admin can bypass RLS
    bypassRLS: session.role === 'ADMIN',
  };

  const scopedPrisma = prisma.$extends(withRLS(context));
  return scopedPrisma.post.findMany();
}
```

### Multi-Database Support

```typescript
// For read replicas
const readPrisma = new PrismaClient({
  datasources: { db: { url: process.env.READ_DATABASE_URL } },
});

const scopedReadPrisma = createScopedClient(readPrisma, {
  teamId: session.teamId,
});
```

### Caching with RLS Context

```typescript
import { cache } from 'react';

const getTeamPosts = cache(async (teamId: string) => {
  const scopedPrisma = prisma.$extends(forTeam(teamId));
  return scopedPrisma.post.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
  });
});
```

## Migration Guide

### From Non-RLS to RLS

1. **Backup your database**
2. **Apply RLS migration**
3. **Update all Prisma queries to use scoped clients**
4. **Test thoroughly in staging**
5. **Monitor for permission errors**
6. **Gradually roll out to production**

### Rollback Plan

If you need to disable RLS:

```sql
-- Disable RLS on tables
ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Team" DISABLE ROW LEVEL SECURITY;
-- ... repeat for all tables

-- Drop policies
DROP POLICY IF EXISTS "team_isolation_policy" ON "Team";
-- ... repeat for all policies

-- Drop functions
DROP FUNCTION IF EXISTS current_team_id();
DROP FUNCTION IF EXISTS current_user_id();
DROP FUNCTION IF EXISTS bypass_rls();
```

## Support

For issues or questions about RLS implementation:

1. Check this documentation
2. Run the test script: `node test-rls.mjs`
3. Review PostgreSQL RLS docs
4. Check Prisma Client extensions docs
5. Open an issue in the repository