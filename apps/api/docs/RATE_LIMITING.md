# Rate Limiting Documentation

## Overview

The Planrrr API implements comprehensive rate limiting with support for both traditional REST endpoints and ORPC procedures. The system uses Upstash Redis for distributed rate limiting with automatic fallback to in-memory limits during development.

## Features

### ✅ Completed Features

- **User-based rate limiting**: Authenticated users are tracked by user ID across different IPs
- **IP-based rate limiting**: Anonymous requests tracked by IP address
- **API key bypass**: Internal services can bypass rate limits with valid API key
- **Per-procedure configuration**: Each ORPC procedure can have custom rate limits
- **Multiple algorithms**: Sliding window for standard limits, token bucket for burst handling
- **Tier-based multipliers**: Pro users get 2x limits, Enterprise users get 10x limits
- **Structured logging**: All rate limit events are logged with Winston
- **Graceful degradation**: Falls back to in-memory limits if Redis unavailable
- **Rate limit headers**: Standard headers included in all responses

## Configuration

### Algorithm Types

1. **Sliding Window** (default)
   - Smoothly distributed rate limiting
   - Used for most endpoints
   - Example: 100 requests per minute

2. **Token Bucket** (AI endpoints)
   - Allows burst traffic
   - Refills at steady rate
   - Example: 20 requests/min with burst of 5

### Per-Procedure Limits

| Procedure | Algorithm | Requests | Window | Burst |
|-----------|-----------|----------|--------|-------|
| **Auth** |
| auth.login | Sliding | 5 | 1m | - |
| auth.register | Sliding | 3 | 1m | - |
| auth.resetPassword | Sliding | 3 | 10m | - |
| **Posts** |
| posts.create | Sliding | 30 | 1m | - |
| posts.update | Sliding | 60 | 1m | - |
| posts.list | Sliding | 100 | 1m | - |
| **AI** |
| ai.generate | Token | 20 | 1m | 5 |
| ai.enhance | Token | 10 | 1m | 3 |
| ai.suggest | Token | 15 | 1m | 4 |
| **Analytics** |
| analytics.* | Sliding | 200 | 1m | - |
| **Default** |
| * | Sliding | 100 | 1m | - |

### User Tiers

| Tier | Multiplier | Example (posts.create) |
|------|------------|------------------------|
| Free | 1x | 30 req/min |
| Pro | 2x | 60 req/min |
| Enterprise | 10x | 300 req/min |

## Implementation

### REST Endpoints

```typescript
import { rateLimiter, strictRateLimiter } from './middleware/rateLimit';

// Standard rate limiting (100 req/min)
app.use('/api/*', rateLimiter());

// Strict rate limiting (10 req/min)
app.use('/api/auth/*', strictRateLimiter());
```

### ORPC Procedures

```typescript
import { createORPCRateLimit } from './middleware/orpcRateLimit';

const publicProcedure = createServer()
  .context<ORPCContext>()
  .use(createORPCRateLimit());
```

### Internal API Bypass

```typescript
// Requests with valid API key bypass rate limiting
headers: {
  'X-API-Key': process.env.INTERNAL_API_KEY
}
```

## Response Headers

All rate-limited responses include:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: ISO timestamp when limit resets
- `X-RateLimit-Procedure`: ORPC procedure path (if applicable)
- `Retry-After`: Seconds until retry (when rate limited)

## Error Responses

### Rate Limit Exceeded (429)

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded for auth.login. Please retry after 45 seconds."
  },
  "meta": {
    "retryAfter": 45,
    "limit": 5,
    "remaining": 0,
    "reset": "2024-01-01T00:01:00.000Z"
  }
}
```

## Monitoring

### Structured Logs

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "warn",
  "message": "Rate limit exceeded",
  "identifier": "user:123",
  "procedure": "ai.generate",
  "limit": 20,
  "retryAfter": 30,
  "userTier": "free"
}
```

### Log Levels

- **ERROR**: Redis connection failures
- **WARN**: Rate limit exceeded events
- **INFO**: Approaching rate limit (< 20% remaining)
- **DEBUG**: Bypass events, configuration loading

## Testing

### Manual Testing

```bash
# Test auth endpoint (5 req/min)
for i in {1..10}; do
  curl -X POST http://localhost:4000/api/auth.login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password"}'
done

# Test AI endpoint with burst (5 immediate, then throttled)
for i in {1..10}; do
  curl -X POST http://localhost:4000/api/ai.generate \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"test"}'
done

# Test internal API bypass
curl -X GET http://localhost:4000/api/internal.metrics \
  -H "X-API-Key: ${INTERNAL_API_KEY}"
```

### Test Script

```bash
# Run rate limit tests
npx tsx src/test/rateLimitTest.ts
```

## Development Mode

In development without Redis configured:
- Uses in-memory rate limiting
- Limits are per-process (not distributed)
- Automatic cleanup of expired entries
- Logs indicate "dry-run mode"

## Environment Variables

```env
# Required for production
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Internal API bypass
INTERNAL_API_KEY=your-secret-key

# Logging
LOG_LEVEL=info
```

## Migration from REST to ORPC

The rate limiting system supports both paradigms:

1. **Current (REST)**: Applied via Hono middleware
2. **Future (ORPC)**: Applied via ORPC middleware
3. **Hybrid**: Both work simultaneously during migration

## Best Practices

1. **Set appropriate limits**: Balance security with usability
2. **Monitor logs**: Watch for patterns of abuse
3. **Use token bucket for AI**: Allows bursts while preventing abuse
4. **Implement user tiers**: Reward paying customers
5. **Test limits**: Ensure they match business requirements
6. **Document limits**: Include in API documentation
7. **Handle errors gracefully**: Provide clear retry information

## Troubleshooting

### Redis Connection Failed
- Check `UPSTASH_REDIS_REST_URL` and token
- Verify network connectivity
- System falls back to in-memory limits

### Rate Limits Not Applied
- Check middleware order
- Verify Redis connection
- Check for API key bypass
- Review structured logs

### Incorrect Limits
- Verify procedure path matches configuration
- Check user tier detection
- Review multiplier logic

## Future Enhancements

- [ ] Dynamic rate limit adjustment
- [ ] Rate limit analytics dashboard
- [ ] Per-team rate limits
- [ ] Webhook rate limit notifications
- [ ] Custom rate limit rules engine
- [ ] Rate limit quota management