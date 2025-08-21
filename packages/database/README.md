# @repo/database

Prisma ORM database package for planrrr.io with multi-schema support, soft deletes, and comprehensive audit logging.

## Features

- 🏗️ **Multi-schema architecture** (public, auth schemas)
- 🗑️ **Soft deletes** for GDPR compliance
- 📝 **Audit logging** for all database operations
- 🔐 **Field-level encryption** markers for sensitive data
- ⚡ **Optimized indexes** for common queries
- 🧪 **Comprehensive seed data** using Faker
- 🔄 **Database migrations** with Prisma Migrate
- 📊 **Prisma Studio** for visual database management

## Setup

### Prerequisites

- PostgreSQL 16+ (Neon recommended)
- Node.js 18+
- pnpm 9+

### Environment Variables

Create a `.env` file in the project root:

```env
# Database URLs
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
DIRECT_DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
```

### Installation

```bash
# Install dependencies
pnpm install

# Generate Prisma Client
pnpm db:generate

# Push schema to database
pnpm db:push

# Seed database with test data
pnpm db:seed
```

## Commands

### Development

```bash
# Generate Prisma Client
pnpm db:generate

# Push schema changes to database (without migration)
pnpm db:push

# Reset database and re-seed
pnpm db:push:force

# Open Prisma Studio
pnpm db:studio

# Validate schema
pnpm db:validate

# Format schema file
pnpm db:format
```

### Migrations

```bash
# Create a new migration
pnpm db:migrate

# Create migration without applying
pnpm db:migrate:create

# Apply migrations in production
pnpm db:migrate:deploy

# Reset database and apply all migrations
pnpm db:migrate:reset

# Check migration status
pnpm db:migrate:status
```

### Seeding

```bash
# Seed database with test data
pnpm db:seed

# The seed script creates:
# - 3 teams (enterprise, pro, free plans)
# - 10+ users with different roles
# - 6 social media connections
# - 10 templates
# - 75+ posts with various statuses
# - Media assets
# - Analytics data
# - Audit logs
```

### Scripts

```bash
# Initialize database (full setup)
./scripts/init-db.sh

# Reset database (drop and recreate)
./scripts/reset-db.sh

# Backup database
./scripts/backup-db.sh
```

## Schema Overview

### Multi-Schema Architecture

- **auth schema**: User authentication models (User, Session, Account)
- **public schema**: Business logic models (Team, Post, Connection, etc.)

### Key Models

#### Authentication (auth schema)

- **User**: User accounts with roles and soft deletes
- **Session**: Active user sessions
- **Account**: OAuth provider accounts

#### Core Business (public schema)

- **Team**: Multi-tenant teams with billing
- **Post**: Social media posts with scheduling
- **Connection**: Social media account connections
- **Publication**: Track published posts per platform
- **Template**: Reusable post templates
- **MediaAsset**: Uploaded media files
- **Analytics**: Post performance metrics
- **AuditLog**: Track all database changes

### Soft Deletes

Models with soft delete support:
- User (deletedAt field)
- Team (deletedAt field)
- Post (deletedAt field)

Soft deleted records are automatically filtered out in queries unless explicitly included.

### Indexes

Optimized indexes for common queries:
- User: email, teamId, deletedAt
- Team: slug, stripeCustomerId
- Post: teamId + status, scheduledAt, createdAt
- Publication: postId, platform + status
- Connection: teamId + platform

## Usage

### Import and Use

```typescript
import { prisma, db } from '@repo/database';
import type { User, Post, Team } from '@repo/database';

// Using the Prisma client directly
const user = await prisma.user.findUnique({
  where: { email: 'user@example.com' }
});

// Using helper functions
const user = await db.user.findByEmail('user@example.com');
const posts = await db.post.findScheduledForPublishing();

// Soft delete a record
await prisma.user.softDelete('user-id');

// Restore a soft deleted record
await prisma.user.restore('user-id');

// Find including soft deleted records
const allUsers = await prisma.user.findManyIncludingDeleted();

// Transactions
const result = await prisma.$transaction(async (tx) => {
  const team = await tx.team.create({ data: {...} });
  const user = await tx.user.create({ data: {...} });
  return { team, user };
});
```

### Common Queries

```typescript
// Find scheduled posts ready for publishing
const posts = await db.post.findScheduledForPublishing();

// Get active connections for a team
const connections = await db.connection.findActiveByTeam(teamId);

// Find expiring tokens
const expiring = await db.connection.findExpiring(7); // 7 days

// Get post analytics
const metrics = await db.analytics.getPostMetrics(postId, startDate, endDate);

// Get team analytics
const teamMetrics = await db.analytics.getTeamMetrics(teamId);
```

## Test Credentials

After seeding, you can log in with:

```
Email: owner@demo-agency.com
Password: Test123!@#
```

Other test accounts:
- `admin@demo-agency.com` (Admin role)
- `owner@startup-hub.com` (Pro plan owner)
- `owner@personal-brand.com` (Free plan owner)

## Troubleshooting

### Common Issues

1. **Multi-schema not working**
   - Ensure you're using Prisma 5.22.0+
   - Check that `multiSchema` is in preview features
   - Verify PostgreSQL version is 14+

2. **Soft deletes not filtering**
   - Use the extended prisma client from `@repo/database`
   - Don't import from `@prisma/client` directly

3. **Seed fails with unique constraint**
   - Run `pnpm db:push:force` to reset the database
   - Or manually clear data before seeding

4. **Connection issues**
   - Verify DATABASE_URL is correct
   - Check SSL settings (Neon requires SSL)
   - Ensure database is accessible

## Development Tips

1. **Use Prisma Studio** for visual data inspection:
   ```bash
   pnpm db:studio
   ```

2. **Enable query logging** in development:
   ```typescript
   const prisma = new PrismaClient({
     log: ['query', 'info', 'warn', 'error'],
   });
   ```

3. **Test migrations** before production:
   ```bash
   pnpm db:migrate:create
   # Review the migration file
   pnpm db:migrate
   ```

4. **Backup before migrations**:
   ```bash
   ./scripts/backup-db.sh
   pnpm db:migrate:deploy
   ```

## Security Notes

- Sensitive fields marked with `/// @encrypted` should be encrypted at the application level
- Always use parameterized queries (Prisma does this automatically)
- Implement row-level security for multi-tenant access
- Audit logs track all database modifications
- Use environment variables for connection strings
- Never commit .env files to version control

## License

Private - Part of planrrr.io monorepo