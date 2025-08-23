# Worker Service Test Implementation Guide

## Quick Start

```bash
# Install test dependencies
pnpm add -D vitest @vitest/ui @vitest/coverage-v8 \
  @faker-js/faker supertest msw \
  @testcontainers/redis @testcontainers/postgresql

# Run tests
pnpm test              # Run all tests
pnpm test:unit        # Unit tests only
pnpm test:integration # Integration tests
pnpm test:e2e         # E2E tests
pnpm test:coverage    # With coverage report
```

## Test Structure

```
apps/worker/
├── src/
│   ├── __tests__/          # Test files co-located with source
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   └── test-utils/         # Shared test utilities
│       ├── fixtures.ts
│       ├── mocks.ts
│       └── helpers.ts
├── vitest.config.ts        # Test configuration
└── vitest.setup.ts         # Global test setup
```

## Configuration Files

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '*.config.ts',
        '**/types.ts'
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 85,
        statements: 85
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './src/test-utils')
    }
  }
});
```

### vitest.setup.ts
```typescript
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { config } from 'dotenv';

// Load test environment
config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Setup test database
  await setupTestDatabase();
  
  // Start mock servers if needed
  await startMockServers();
});

afterAll(async () => {
  // Cleanup
  await cleanupTestDatabase();
  await stopMockServers();
});

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();
  
  // Reset circuit breakers
  resetAllCircuitBreakers();
});

afterEach(() => {
  // Clear timers
  vi.useRealTimers();
});
```

## Test Patterns

### 1. Unit Test Pattern
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ComponentName', () => {
  let component: ComponentType;
  
  beforeEach(() => {
    // Setup
    component = new Component();
  });
  
  describe('methodName', () => {
    it('should handle success case', () => {
      // Arrange
      const input = createFixture();
      
      // Act
      const result = component.method(input);
      
      // Assert
      expect(result).toMatchSnapshot();
    });
    
    it('should handle error case', () => {
      // Arrange
      const invalidInput = createInvalidFixture();
      
      // Act & Assert
      expect(() => component.method(invalidInput))
        .toThrow(ExpectedError);
    });
  });
});
```

### 2. Integration Test Pattern
```typescript
describe('Integration: Service Name', () => {
  let service: Service;
  let database: TestDatabase;
  let redis: TestRedis;
  
  beforeAll(async () => {
    // Setup test infrastructure
    database = await createTestDatabase();
    redis = await createTestRedis();
    
    service = new Service({ database, redis });
  });
  
  afterAll(async () => {
    await database.close();
    await redis.close();
  });
  
  it('should perform end-to-end operation', async () => {
    // Complex multi-step test
    const entity = await service.create(data);
    const processed = await service.process(entity.id);
    const result = await service.verify(processed.id);
    
    expect(result).toMatchObject({
      status: 'completed',
      errors: []
    });
  });
});
```

### 3. E2E Test Pattern
```typescript
describe('E2E: Feature Name', () => {
  let app: TestApplication;
  
  beforeAll(async () => {
    app = await TestApplication.create({
      seedData: true,
      mockExternalServices: true
    });
  });
  
  afterAll(async () => {
    await app.destroy();
  });
  
  it('should complete user journey', async () => {
    // Simulate real user flow
    const user = await app.createUser();
    const post = await app.createPost({ userId: user.id });
    
    await app.schedulePost(post.id);
    await app.waitForProcessing();
    
    const result = await app.getPostStatus(post.id);
    expect(result.published).toBe(true);
  });
});
```

## Mock Strategies

### 1. Database Mocking
```typescript
// Using transaction rollback
export async function withTransaction<T>(
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  const tx = await prisma.$transaction();
  try {
    const result = await fn(tx);
    await tx.$rollback(); // Always rollback
    return result;
  } catch (error) {
    await tx.$rollback();
    throw error;
  }
}
```

### 2. Redis Mocking
```typescript
// Using separate keyspace
export function createTestRedis(): Redis {
  const redis = new Redis({
    ...config,
    db: 15, // Test DB
    keyPrefix: `test:${Date.now()}:`
  });
  
  return redis;
}
```

### 3. API Mocking with MSW
```typescript
import { setupServer } from 'msw/node';
import { rest } from 'msw';

export const mockServer = setupServer(
  rest.post('https://graph.facebook.com/*', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 'mock_fb_id',
        post_id: 'mock_post_id'
      })
    );
  })
);

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());
```

## Test Data Management

### Fixtures
```typescript
// test-utils/fixtures.ts
export const fixtures = {
  post: (overrides?: Partial<Post>): Post => ({
    id: faker.string.uuid(),
    content: faker.lorem.paragraph(),
    status: 'DRAFT',
    ...overrides
  }),
  
  connection: (platform: Platform): Connection => ({
    id: faker.string.uuid(),
    platform,
    accessToken: `mock_${platform}_token`,
    // ... platform-specific defaults
  })
};
```

### Builders
```typescript
// test-utils/builders.ts
export class PostBuilder {
  private post: Partial<Post> = {};
  
  withContent(content: string): this {
    this.post.content = content;
    return this;
  }
  
  withPlatforms(...platforms: Platform[]): this {
    this.post.platforms = platforms;
    return this;
  }
  
  scheduled(at: Date): this {
    this.post.status = 'SCHEDULED';
    this.post.scheduledAt = at;
    return this;
  }
  
  build(): Post {
    return {
      ...fixtures.post(),
      ...this.post
    };
  }
}
```

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: Worker Tests

on:
  push:
    paths:
      - 'apps/worker/**'
      - 'packages/database/**'
  pull_request:
    paths:
      - 'apps/worker/**'

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      
      - name: Run migrations
        run: pnpm db:push
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
      
      - name: Run tests
        run: pnpm test:coverage
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/worker/coverage/coverage-final.json
```

## Performance Testing

### Load Test Example
```typescript
import { performance } from 'perf_hooks';

describe('Performance: Queue Processing', () => {
  it('should handle 1000 jobs within SLA', async () => {
    const startTime = performance.now();
    
    // Create 1000 jobs
    const jobs = await Promise.all(
      Array.from({ length: 1000 }, () =>
        queue.add('test', { data: 'test' })
      )
    );
    
    // Process with 10 workers
    const workers = Array.from({ length: 10 }, () =>
      new Worker('test', processor, { connection })
    );
    
    // Wait for completion
    await Promise.all(
      jobs.map(job => job.waitUntilFinished(events))
    );
    
    const duration = performance.now() - startTime;
    
    // Assert SLA
    expect(duration).toBeLessThan(60000); // 1 minute
    
    // Check metrics
    const avgProcessingTime = duration / 1000;
    expect(avgProcessingTime).toBeLessThan(100); // 100ms per job
    
    // Cleanup
    await Promise.all(workers.map(w => w.close()));
  });
});
```

## Debugging Tests

### Debug Configuration
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Worker Tests",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": [
    "test",
    "--run",
    "${file}"
  ],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Test Utilities
```typescript
// Debug helper
export function debugTest(name: string, data: any) {
  if (process.env.DEBUG_TESTS) {
    console.log(`[TEST DEBUG] ${name}:`, 
      JSON.stringify(data, null, 2)
    );
  }
}

// Usage in tests
it('should process job', async () => {
  const result = await processor.process(job);
  debugTest('Job Result', result);
  expect(result.success).toBe(true);
});
```

## Best Practices

1. **Isolation**: Each test should be completely independent
2. **Determinism**: Use fixed seeds and frozen time
3. **Speed**: Parallelize where possible, mock heavy operations
4. **Clarity**: Test name should describe scenario and expected outcome
5. **Maintenance**: Update tests when requirements change
6. **Documentation**: Tests serve as living documentation

## Common Pitfalls to Avoid

1. **Shared State**: Always reset state between tests
2. **Race Conditions**: Use proper async/await patterns
3. **Flaky Tests**: Fix immediately, don't ignore
4. **Over-Mocking**: Test real integrations where critical
5. **Under-Testing**: Cover edge cases and error paths
6. **Slow Tests**: Optimize or split into smaller units

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [MSW - Mock Service Worker](https://mswjs.io/)
- [Faker.js](https://fakerjs.dev/)
- [BullMQ Testing Guide](https://docs.bullmq.io/guide/testing)