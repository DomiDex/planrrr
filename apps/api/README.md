# Planrrr API Service

Production-ready Hono API service with hybrid REST/RPC architecture for the Planrrr social media scheduling platform.

## Overview

This API service provides the backend infrastructure for Planrrr, supporting both traditional REST endpoints and ORPC procedures (migration in progress). Built with Hono for edge-optimized performance and full TypeScript support.

## Architecture

### Service Structure

```
apps/api/
├── src/
│   ├── index.ts           # Server entry point
│   ├── app.ts             # Hono app configuration
│   ├── routes/            # REST endpoints
│   │   ├── health.ts      # Health monitoring
│   │   ├── auth.ts        # Authentication
│   │   ├── posts.ts       # Content management
│   │   ├── teams.ts       # Team operations
│   │   ├── connections.ts # Social accounts
│   │   ├── ai.ts          # AI features
│   │   └── internal.ts    # Worker communication
│   ├── procedures/        # ORPC procedures (future)
│   ├── middleware/        # Request processing
│   │   ├── auth.ts        # JWT validation
│   │   ├── error.ts       # Error handling
│   │   ├── rateLimit.ts   # Rate limiting
│   │   ├── apiKey.ts      # API key auth
│   │   └── logging.ts     # Request logging
│   ├── lib/               # Utilities
│   │   ├── logger.ts      # Winston logger
│   │   ├── monitoring.ts  # Sentry integration
│   │   └── shutdown.ts    # Graceful shutdown
│   └── types/             # TypeScript definitions
```

## Features

- **Hybrid Architecture**: Supports both REST and RPC patterns
- **Production Ready**: Full middleware stack with monitoring
- **Type Safety**: Complete TypeScript coverage
- **Security**: JWT auth, rate limiting, API key validation
- **Monitoring**: Health checks, Sentry integration, structured logging
- **Scalable**: Containerized deployment with graceful shutdown

## API Endpoints

### Health Monitoring

- `GET /health` - Basic health check
- `GET /health/live` - Kubernetes liveness probe
- `GET /health/ready` - Readiness with database/Redis checks

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - Session termination
- `GET /api/auth/status` - Authentication status
- `POST /api/auth/refresh` - Token refresh

### Content Management

- `GET /api/posts` - List posts (team-scoped)
- `POST /api/posts` - Create new post
- `GET /api/posts/:id` - Get specific post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/publish` - Publish to platforms

### Team Operations

- `GET /api/teams` - List user's teams
- `POST /api/teams` - Create new team
- `GET /api/teams/:id` - Get team details
- `PUT /api/teams/:id` - Update team
- `DELETE /api/teams/:id` - Delete team
- `POST /api/teams/:id/invite` - Invite member

### Social Connections

- `GET /api/connections` - List connected accounts
- `POST /api/connections` - Add new connection
- `DELETE /api/connections/:id` - Remove connection
- `POST /api/connections/:id/refresh` - Refresh tokens

### AI Features

- `POST /api/ai/generate` - Generate content
- `POST /api/ai/enhance` - Enhance existing content
- `POST /api/ai/suggest` - Get content suggestions

### Internal APIs (Worker Communication)

- `POST /internal/worker/job-completed` - Job completion webhook
- `POST /internal/worker/job-failed` - Job failure webhook
- `GET /internal/metrics` - Service metrics

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL (Neon)
- Redis (for rate limiting)

### Environment Variables

Create `.env.local` from `.env.example`:

```bash
# Server Configuration
NODE_ENV=development
PORT=4000
API_URL=http://localhost:4000

# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Rate Limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Monitoring (optional)
SENTRY_DSN=

# Internal Communication
INTERNAL_API_KEY=your-internal-key
```

### Local Development

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Start development server
pnpm dev

# Run in watch mode
pnpm dev:watch
```

### Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Type checking
pnpm check-types

# Linting
pnpm lint
```

## Docker Deployment

### Build Image

```bash
# Build from monorepo root
docker build -f apps/api/Dockerfile -t planrrr-api .

# Or with specific platform
docker build --platform linux/amd64 -f apps/api/Dockerfile -t planrrr-api .
```

### Run Container

```bash
# Run with environment file
docker run -p 4000:4000 --env-file .env planrrr-api

# Run with individual environment variables
docker run -p 4000:4000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  -e NODE_ENV=production \
  planrrr-api

# Run with Docker Compose
docker-compose up api
```

### Health Check

The Docker container includes a built-in health check:

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' <container_id>

# View health check logs
docker inspect --format='{{json .State.Health}}' <container_id>
```

## Production Deployment

### Railway Deployment

1. Connect GitHub repository
2. Set root directory to `apps/api`
3. Configure environment variables
4. Deploy with automatic builds

### Vercel Edge Functions (Alternative)

For edge deployment, the API can run on Vercel Edge Runtime:

```javascript
// vercel.json
{
  "functions": {
    "api/index.ts": {
      "runtime": "@vercel/node@3",
      "maxDuration": 30
    }
  }
}
```

## Middleware Stack

Middleware executes in the following order:

1. **Request ID** - Generates unique request identifiers
2. **Logging** - Structured request/response logging
3. **CORS** - Cross-origin resource sharing
4. **Compression** - Gzip response compression
5. **Rate Limiting** - Upstash Redis-based limits
6. **Authentication** - JWT token validation
7. **Error Handling** - Centralized error responses

## Security

- **Authentication**: JWT-based with refresh tokens
- **Authorization**: Team-based access control
- **Rate Limiting**: IP and user-based limits
- **API Keys**: Internal service authentication
- **CORS**: Configured for frontend domains
- **Helmet**: Security headers (when applicable)
- **Input Validation**: Zod schema validation

## Monitoring

### Logging

Structured JSON logging with Winston:

```javascript
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "info",
  "message": "Request completed",
  "requestId": "req_abc123",
  "method": "GET",
  "path": "/api/posts",
  "statusCode": 200,
  "duration": 45
}
```

### Metrics

- Request rate and latency
- Error rates by endpoint
- Database connection pool stats
- Redis connection health
- Memory and CPU usage

### Alerts

Configure alerts for:
- High error rates (>1%)
- Slow response times (>1s)
- Failed health checks
- Database connection issues

## Migration to ORPC

The API is designed for gradual migration from REST to ORPC:

### Phase 1: Current State ✓
- Traditional REST endpoints
- Hono routing
- Standard middleware

### Phase 2: Hybrid Mode (Next)
- Add ORPC router
- Parallel REST/RPC endpoints
- Gradual frontend migration

### Phase 3: Full RPC
- Complete ORPC migration
- Remove REST endpoints
- Type-safe client/server

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Find process using port 4000
lsof -i :4000
# Kill the process
kill -9 <PID>
```

**Database Connection Failed**
- Verify DATABASE_URL format
- Check network connectivity
- Ensure database is running
- Verify SSL requirements

**Redis Connection Failed**
- Check REDIS_HOST and REDIS_PORT
- Verify Redis is running
- Check authentication credentials

**Build Failures**
```bash
# Clear cache and rebuild
rm -rf node_modules dist
pnpm install
pnpm build
```

### Debug Mode

Enable debug logging:

```bash
DEBUG=* pnpm dev
```

## Performance

### Optimization Tips

1. **Database Queries**
   - Use Prisma query optimization
   - Implement connection pooling
   - Add appropriate indexes

2. **Caching**
   - Redis for session data
   - CDN for static assets
   - Response caching for read-heavy endpoints

3. **Compression**
   - Gzip enabled by default
   - Brotli for better compression (optional)

4. **Rate Limiting**
   - Configured per endpoint
   - Sliding window algorithm
   - Distributed across instances

## Contributing

1. Follow TypeScript best practices
2. Maintain test coverage above 80%
3. Document new endpoints
4. Update this README for significant changes
5. Ensure all checks pass before merging

## License

Copyright (c) 2024 Planrrr. All rights reserved.