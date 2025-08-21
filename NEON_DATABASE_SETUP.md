# Neon PostgreSQL Database Setup Guide

## 🚀 Quick Setup Checklist

### Step 1: Create Neon Account & Project

1. **Sign up at [console.neon.tech](https://console.neon.tech)**
2. **Create New Project:**
   - Project Name: `planrrr-production`
   - PostgreSQL Version: `16` (latest stable)
   - Region: Choose closest to your users (e.g., `US East`)

### Step 2: Configure Connection Pooling

In Neon Console:
1. Go to **Settings** → **Connection Pooling**
2. Enable **Connection pooler**
3. Configure settings:
   - Pool Mode: `Transaction` (default, recommended)
   - Pool Size: `25` (Neon automatically scales, but this is default)
   - Max Connections: Neon supports up to `10,000` concurrent connections

### Step 3: Create Database Branches

1. **Main/Production Branch** (created by default)
   - Name: `main`
   - Purpose: Production data
   
2. **Create Development Branch:**
   ```bash
   # Using Neon CLI
   npm install -g neonctl
   neonctl auth
   neonctl branches create --name development --project-id <your-project-id>
   ```
   
   Or via Console:
   - Click **Branches** → **New Branch**
   - Name: `development`
   - Parent: `main`

### Step 4: Get Connection Strings

From Neon Console → **Connection Details**:

#### For Production (main branch):

```env
# Pooled connection (for application queries)
DATABASE_URL="postgresql://neondb_owner:npg_nCpM3fIP0KyQ@ep-jolly-sound-adq5r9d0-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=10"

# Direct connection (for migrations)
DIRECT_DATABASE_URL="postgresql://neondb_owner:npg_nCpM3fIP0KyQ@ep-jolly-sound-adq5r9d0.us-east-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=10"
```

#### For Development (development branch):

```env
# Pooled connection
DATABASE_URL="postgresql://neondb_owner:npg_nCpM3fIP0KyQ@ep-jolly-sound-adq5r9d0-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=10&options=endpoint%3Dep-jolly-sound-adq5r9d0-development"

# Direct connection
DIRECT_DATABASE_URL="postgresql://neondb_owner:npg_nCpM3fIP0KyQ@ep-jolly-sound-adq5r9d0.us-east-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=10&options=endpoint%3Dep-jolly-sound-adq5r9d0-development"
```

### Step 5: Configure Security Settings

1. **SSL/TLS Enforcement:**
   - ✅ Already enforced (sslmode=require in connection strings)
   
2. **IP Allowlisting (Optional but Recommended):**
   - Go to Settings → IP Allow
   - Add your IPs:
     - Vercel: Add Vercel's IP ranges
     - Railway: Add Railway's IP ranges
     - Local Development: Add your IP

3. **Configure Autosuspend:**
   - Settings → Compute
   - Set to `5 minutes` (recommended for cost optimization)
   - Note: First query after suspend has ~1s cold start

### Step 6: Enable Monitoring & Insights

1. **Query Insights:**
   - Settings → Monitoring
   - Enable **Query insights**
   - Monitor slow queries and performance

2. **Set up Alerts:**
   - Configure alerts for:
     - High connection count
     - Slow queries
     - Storage usage

### Step 7: Configure Backups

Neon provides automatic backups:
- **Point-in-time recovery:** Up to 7 days (Free tier) / 30 days (Pro)
- **Branching for backup:** Create branches before major changes

Manual backup command:
```bash
# Create backup branch
neonctl branches create --name backup-$(date +%Y%m%d-%H%M%S)
```

## 📝 Environment Configuration

### Update .env Files

#### apps/web/.env.local
```env
# Neon PostgreSQL (Pooled for queries)
DATABASE_URL="postgresql://[user]:[password]@[endpoint]-pooler.[region].aws.neon.tech/[database]?sslmode=require&pgbouncer=true&connect_timeout=10"

# Direct connection for Prisma migrations
DIRECT_DATABASE_URL="postgresql://[user]:[password]@[endpoint].[region].aws.neon.tech/[database]?sslmode=require&connect_timeout=10"
```

#### apps/api/.env
```env
# Same as web app
DATABASE_URL="postgresql://[user]:[password]@[endpoint]-pooler.[region].aws.neon.tech/[database]?sslmode=require&pgbouncer=true&connect_timeout=10"
DIRECT_DATABASE_URL="postgresql://[user]:[password]@[endpoint].[region].aws.neon.tech/[database]?sslmode=require&connect_timeout=10"
```

#### apps/worker/.env
```env
# Worker uses pooled connection
DATABASE_URL="postgresql://[user]:[password]@[endpoint]-pooler.[region].aws.neon.tech/[database]?sslmode=require&pgbouncer=true&connect_timeout=10"
```

## 🧪 Testing Commands

### Test Direct Connection
```bash
# Test with psql
psql "postgresql://neondb_owner:password@ep-name.region.aws.neon.tech/neondb?sslmode=require"

# Test with Prisma
pnpm dlx prisma db pull
```

### Test Pooled Connection
```bash
# Test pooled connection
psql "postgresql://neondb_owner:password@ep-name-pooler.region.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"

# Verify SSL
echo | openssl s_client -connect ep-name.region.aws.neon.tech:5432 -starttls postgres
```

### Load Test Connection Pooling
```bash
# Create test script: test-connections.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 100, // Test 100 concurrent connections
});

async function testConnections() {
  const promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(
      pool.query('SELECT NOW()')
        .then(() => console.log(`Connection ${i + 1} successful`))
        .catch(err => console.error(`Connection ${i + 1} failed:`, err.message))
    );
  }
  await Promise.all(promises);
  await pool.end();
}

testConnections();
```

Run test:
```bash
node test-connections.js
```

## 🔧 Prisma Configuration

Your Prisma schema is already updated with:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")        # Pooled for queries
  directUrl = env("DIRECT_DATABASE_URL") # Direct for migrations
}
```

### Run Migrations
```bash
# Push schema to database
pnpm db:push

# Or run migrations
pnpm prisma migrate dev --name init
```

## ⚠️ Important Considerations

### Connection Pooling Limitations

**Transaction Mode Limitations:**
- Session variables don't persist between transactions
- Prepared statements are disabled by default
- Some features like `WITH HOLD CURSOR` not supported

**When to Use Direct Connection:**
- Database migrations
- Long-running transactions
- Administrative operations (pg_dump, etc.)
- Setting persistent session variables

### Performance Optimization

1. **Connection Pool Sizing:**
   - Neon handles up to 10,000 connections via pooler
   - But only ~25-100 can be active simultaneously (based on tier)
   
2. **Query Timeouts:**
   - Default query timeout: 2 minutes
   - Configure in connection string: `&statement_timeout=30000` (30 seconds)

3. **Cold Starts:**
   - First query after autosuspend: ~1 second delay
   - Keep-alive queries can prevent suspension

## 📊 Monitoring

### Neon Console Metrics
- **Connections:** Monitor active/idle connections
- **Query Performance:** Track slow queries
- **Storage:** Monitor database size
- **Compute:** Track CPU and memory usage

### Connection Query
```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Check connection details
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  state_change
FROM pg_stat_activity
WHERE state != 'idle';
```

## 🔄 Rollback Plan

1. **Using Neon Branching:**
   ```bash
   # Create backup before changes
   neonctl branches create --name pre-deployment-backup
   
   # If issues occur, restore from branch
   neonctl branches set-primary --branch pre-deployment-backup
   ```

2. **Using pg_dump:**
   ```bash
   # Export data
   pg_dump $DIRECT_DATABASE_URL > backup.sql
   
   # Restore if needed
   psql $DIRECT_DATABASE_URL < backup.sql
   ```

## ✅ Final Checklist

- [x] Neon account created
- [x] Project configured with PostgreSQL 16
- [x] Connection pooling enabled
- [x] Development and production branches created
- [x] SSL/TLS enforced (sslmode=require)
- [x] Connection strings documented
- [x] Prisma schema updated with dual URLs
- [x] Environment variables updated
- [x] Autosuspend configured (5 minutes)
- [x] Query insights enabled
- [x] Backup strategy documented
- [ ] Connection tests passing
- [ ] Load test completed (100 connections)
- [ ] Monitoring alerts configured

## 🎯 Next Steps

1. Test both connection strings locally
2. Run Prisma migrations
3. Configure monitoring alerts
4. Set up IP allowlisting for production
5. Document connection strings in password manager
6. Test backup and restore process

## 📚 Resources

- [Neon Documentation](https://neon.tech/docs)
- [Neon Connection Pooling](https://neon.tech/docs/connect/connection-pooling)
- [Neon Branching Guide](https://neon.tech/docs/introduction/branching)
- [Prisma with Neon](https://www.prisma.io/docs/orm/overview/databases/neon)
- [Neon CLI Reference](https://neon.tech/docs/reference/cli-reference)