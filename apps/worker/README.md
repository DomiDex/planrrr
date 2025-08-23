# Planrrr Worker Service

Background job processor for social media post scheduling and publishing.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 16 (via Docker or local)
- Redis 7 (via Docker or local)

### Setup Development Environment

#### Option 1: Using Docker (Recommended)

**For Linux/Mac:**
```bash
# Start all services
pnpm setup:dev

# Or manually
pnpm docker:up
```

**For Windows:**
```powershell
# Start all services
pnpm setup:dev:windows

# Or manually
pnpm docker:up
```

#### Option 2: Manual Setup

1. **Copy environment variables:**
```bash
cp .env.example .env
```

2. **Update `.env` with your configuration:**
```env
DATABASE_URL=postgresql://planrrr:planrrr_dev_password@localhost:5432/planrrr_dev
REDIS_HOST=localhost
REDIS_PORT=6379
```

3. **Start PostgreSQL and Redis:**
```bash
docker compose up -d postgres redis
```

4. **Run database migrations:**
```bash
pnpm db:push
pnpm db:generate
```

5. **Start the worker:**
```bash
pnpm dev
```

## 📦 Available Scripts

### Development
- `pnpm dev` - Start worker in development mode with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Start production build

### Database
- `pnpm db:generate` - Generate Prisma client
- `pnpm db:push` - Push schema changes to database
- `pnpm db:studio` - Open Prisma Studio GUI

### Docker
- `pnpm docker:up` - Start all Docker services
- `pnpm docker:down` - Stop all Docker services
- `pnpm docker:reset` - Reset and restart all services (removes data)

### Testing
- `pnpm test` - Run tests in watch mode
- `pnpm test:run` - Run tests once
- `pnpm test:coverage` - Run tests with coverage report

### Code Quality
- `pnpm lint` - Run ESLint
- `pnpm check-types` - Run TypeScript type checking

## 🏗️ Architecture

```
apps/worker/
├── src/
│   ├── config/         # Configuration and environment
│   ├── lib/            # Core utilities (logger, circuit breaker)
│   ├── processors/     # Job processors
│   ├── publishers/     # Social media platform publishers
│   ├── queues/        # Queue definitions
│   ├── services/      # Business logic services
│   └── index.ts       # Worker entry point
├── scripts/           # Development scripts
├── docker-compose.yml # Local development services
└── .env              # Environment variables
```

## 🛠️ Services

### Development Services

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Main database |
| PostgreSQL Test | 5433 | Test database |
| Redis | 6379 | Job queue storage |
| Adminer | 8080 | Database GUI |
| Redis Commander | 8081 | Redis GUI |

### Service URLs

- **Adminer**: http://localhost:8080
  - Server: `postgres`
  - Username: `planrrr`
  - Password: `planrrr_dev_password`
  - Database: `planrrr_dev`

- **Redis Commander**: http://localhost:8081

## 🔧 Configuration

### Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT` - Redis connection
- `WORKER_CONCURRENCY` - Number of concurrent jobs
- `LOG_LEVEL` - Logging verbosity (error, warn, info, debug)

### Queue Configuration

The worker processes the following job types:
- `publish` - Publish posts to social media platforms
- `media-upload` - Upload media files to platforms
- `token-refresh` - Refresh OAuth tokens
- `analytics-sync` - Sync post analytics

## 🧪 Testing

### Run Tests

```bash
# Run all tests
pnpm test:run

# Run with coverage
pnpm test:coverage

# Watch mode for development
pnpm test:watch
```

### Test Structure

```
src/__tests__/
├── unit/
│   ├── publishers/     # Publisher unit tests
│   ├── processors/     # Processor unit tests
│   └── lib/           # Utility tests
├── integration/       # Integration tests
└── e2e/              # End-to-end tests
```

## 📊 Monitoring

### Health Check

The worker exposes a health check endpoint:
- URL: `http://localhost:3002/health`
- Returns: `{ status: 'ok', uptime: seconds, queues: {...} }`

### Metrics

Prometheus metrics available at:
- URL: `http://localhost:3002/metrics`

Key metrics:
- `worker_jobs_processed_total` - Total jobs processed
- `worker_jobs_failed_total` - Total jobs failed
- `worker_job_duration_seconds` - Job processing duration
- `worker_queue_size` - Current queue size

## 🚨 Troubleshooting

### Common Issues

1. **Cannot connect to PostgreSQL**
   - Ensure Docker is running
   - Check if port 5432 is already in use
   - Verify DATABASE_URL in .env

2. **Cannot connect to Redis**
   - Ensure Docker is running
   - Check if port 6379 is already in use
   - Verify REDIS_HOST and REDIS_PORT in .env

3. **Prisma client not found**
   - Run `pnpm db:generate`
   - Ensure @repo/database is built

4. **Tests failing with timeout**
   - Increase test timeout in vitest.config.ts
   - Ensure test database is running (port 5433)

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug pnpm dev
```

### Reset Everything

```bash
# Stop all services and remove data
pnpm docker:reset

# Reinstall dependencies
pnpm install

# Regenerate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push
```

## 📚 Documentation

- [Architecture Overview](./ARCHITECTURE-WORKFLOW.md)
- [API Integration Guide](./API-INTEGRATION-REFERENCE.md)
- [Test Implementation Guide](./TEST-IMPLEMENTATION-GUIDE.md)
- [Project Documentation](../../README.md)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## 📄 License

Private - See repository root for details