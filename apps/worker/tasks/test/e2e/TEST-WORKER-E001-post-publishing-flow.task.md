---
id: TEST-WORKER-E001
priority: CRITICAL
type: E2E
component: Complete Post Publishing Flow
dependencies: [TEST-WORKER-I002]
estimated_effort: 8 hours
---

# Test Task: End-to-End Post Publishing Flow

## Objective
Validate the complete post publishing flow from job creation through social media API interaction to database updates, simulating real-world scenarios.

## Acceptance Criteria
- ✅ Posts are published to all configured platforms
- ✅ Database state is correctly updated
- ✅ Metrics are captured and stored
- ✅ Error scenarios are handled gracefully
- ✅ Webhooks/notifications are triggered

## Test Environment Setup

### Docker Compose
```yaml
version: '3.8'
services:
  postgres-test:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: testpass
      POSTGRES_DB: planrrr_test
    ports:
      - "5433:5432"
  
  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
  
  mock-apis:
    build: ./test/mock-servers
    ports:
      - "8080:8080"
    environment:
      - RATE_LIMIT_ENABLED=true
      - RANDOM_FAILURES=0.1
```

### Mock API Server
```typescript
// test/mock-servers/social-apis.ts
import express from 'express';
import { faker } from '@faker-js/faker';

const app = express();
app.use(express.json());

// Facebook Mock
app.post('/v18.0/:pageId/feed', (req, res) => {
  if (Math.random() < 0.1) {
    return res.status(429).json({
      error: { message: 'Rate limit exceeded' }
    });
  }
  
  res.json({
    id: `fb_${faker.string.numeric(15)}`,
    post_id: `fb_post_${faker.string.numeric(15)}`
  });
});

// Twitter Mock
app.post('/2/tweets', (req, res) => {
  res.json({
    data: {
      id: faker.string.numeric(19),
      text: req.body.text
    }
  });
});

app.listen(8080);
```

## Test Cases

### 1. Successful Multi-Platform Publishing
```typescript
describe('E2E: Post Publishing Flow', () => {
  let app: TestApplication;
  
  beforeAll(async () => {
    app = await createTestApplication({
      database: 'postgresql://test@localhost:5433/planrrr_test',
      redis: 'redis://localhost:6380',
      mockApis: 'http://localhost:8080'
    });
    
    await app.seedDatabase();
  });
  
  afterAll(async () => {
    await app.cleanup();
  });

  it('should publish post to multiple platforms', async () => {
    // Arrange
    const team = await app.createTeam();
    const user = await app.createUser({ teamId: team.id });
    
    const connections = await Promise.all([
      app.createConnection({
        teamId: team.id,
        platform: 'FACEBOOK',
        accessToken: 'mock_fb_token'
      }),
      app.createConnection({
        teamId: team.id,
        platform: 'TWITTER',
        accessToken: 'mock_twitter_token'
      })
    ]);
    
    const post = await app.createPost({
      teamId: team.id,
      userId: user.id,
      content: 'Test post for E2E testing',
      platforms: ['FACEBOOK', 'TWITTER'],
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 1000)
    });
    
    // Act
    await app.worker.start();
    await sleep(2000); // Wait for scheduled time
    
    // Assert
    const updatedPost = await app.getPost(post.id);
    expect(updatedPost.status).toBe('PUBLISHED');
    expect(updatedPost.publishedAt).toBeDefined();
    
    const publications = await app.getPublications(post.id);
    expect(publications).toHaveLength(2);
    expect(publications.every(p => p.status === 'PUBLISHED')).toBe(true);
    expect(publications.every(p => p.externalId)).toBe(true);
    
    // Verify metrics
    const metrics = await app.getMetrics();
    expect(metrics.postsPublished).toBe(2);
  });

  it('should handle partial failures gracefully', async () => {
    // Setup: Make Twitter API return error
    await app.mockApi.setFailure('TWITTER', true);
    
    const post = await app.createPost({
      content: 'Test partial failure',
      platforms: ['FACEBOOK', 'TWITTER'],
      status: 'SCHEDULED'
    });
    
    await app.worker.processJob(post.id);
    
    const publications = await app.getPublications(post.id);
    const fbPub = publications.find(p => p.platform === 'FACEBOOK');
    const twitterPub = publications.find(p => p.platform === 'TWITTER');
    
    expect(fbPub?.status).toBe('PUBLISHED');
    expect(twitterPub?.status).toBe('FAILED');
    expect(twitterPub?.error).toContain('API error');
    
    // Post should be marked as PARTIAL
    const updatedPost = await app.getPost(post.id);
    expect(updatedPost.status).toBe('PARTIAL');
  });
});
```

### 2. Rate Limit Handling
```typescript
describe('E2E: Rate Limit Scenarios', () => {
  it('should respect platform rate limits', async () => {
    // Create multiple posts to trigger rate limit
    const posts = await Promise.all(
      Array.from({ length: 10 }, () =>
        app.createPost({
          content: faker.lorem.sentence(),
          platforms: ['FACEBOOK'],
          status: 'SCHEDULED'
        })
      )
    );
    
    const startTime = Date.now();
    await app.worker.processJobs(posts.map(p => p.id));
    const duration = Date.now() - startTime;
    
    // Should take longer due to rate limiting
    expect(duration).toBeGreaterThan(5000);
    
    // All should eventually succeed
    const results = await Promise.all(
      posts.map(p => app.getPost(p.id))
    );
    expect(results.every(p => p.status === 'PUBLISHED')).toBe(true);
    
    // Check rate limit metrics
    const metrics = await app.getMetrics();
    expect(metrics.rateLimitHits).toBeGreaterThan(0);
  });
});
```

### 3. Media Upload Flow
```typescript
describe('E2E: Media Upload', () => {
  it('should upload media before publishing', async () => {
    const post = await app.createPost({
      content: 'Post with media',
      mediaUrls: [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg'
      ],
      platforms: ['FACEBOOK', 'INSTAGRAM']
    });
    
    // Mock media upload endpoints
    app.mockApi.onMediaUpload((url) => ({
      mediaId: `media_${faker.string.numeric(10)}`,
      url: url
    }));
    
    await app.worker.processJob(post.id);
    
    const publications = await app.getPublications(post.id);
    
    // Instagram requires media
    const igPub = publications.find(p => p.platform === 'INSTAGRAM');
    expect(igPub?.status).toBe('PUBLISHED');
    expect(igPub?.metadata?.mediaIds).toHaveLength(2);
  });
});
```

### 4. Retry and Recovery
```typescript
describe('E2E: Retry and Recovery', () => {
  it('should retry transient failures', async () => {
    let attemptCount = 0;
    
    app.mockApi.onRequest('FACEBOOK', () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Network timeout');
      }
      return { id: 'fb_success' };
    });
    
    const post = await app.createPost({
      content: 'Test retry',
      platforms: ['FACEBOOK']
    });
    
    await app.worker.processJob(post.id);
    
    expect(attemptCount).toBe(3);
    
    const publication = await app.getPublication(post.id, 'FACEBOOK');
    expect(publication.status).toBe('PUBLISHED');
    expect(publication.attemptCount).toBe(3);
  });

  it('should handle worker restart gracefully', async () => {
    const post = await app.createPost({
      content: 'Test worker restart',
      platforms: ['FACEBOOK']
    });
    
    // Start processing
    const jobPromise = app.worker.processJob(post.id);
    
    // Simulate worker crash after 100ms
    setTimeout(() => {
      app.worker.stop();
    }, 100);
    
    await expect(jobPromise).rejects.toThrow();
    
    // Restart worker
    await app.worker.start();
    
    // Job should be picked up and completed
    await sleep(2000);
    
    const updatedPost = await app.getPost(post.id);
    expect(updatedPost.status).toBe('PUBLISHED');
  });
});
```

### 5. Performance and Load Testing
```typescript
describe('E2E: Performance', () => {
  it('should handle concurrent publishing efficiently', async () => {
    const CONCURRENT_POSTS = 50;
    
    const posts = await Promise.all(
      Array.from({ length: CONCURRENT_POSTS }, () =>
        app.createPost({
          content: faker.lorem.sentence(),
          platforms: ['FACEBOOK', 'TWITTER'],
          status: 'SCHEDULED'
        })
      )
    );
    
    const startTime = Date.now();
    
    await app.worker.startWithConcurrency(10);
    await app.worker.processAllJobs();
    
    const duration = Date.now() - startTime;
    
    // Should process efficiently with concurrency
    expect(duration).toBeLessThan(30000); // 30 seconds for 50 posts
    
    // Verify all completed
    const results = await Promise.all(
      posts.map(p => app.getPost(p.id))
    );
    
    const successRate = results.filter(p => 
      p.status === 'PUBLISHED'
    ).length / CONCURRENT_POSTS;
    
    expect(successRate).toBeGreaterThan(0.95); // 95% success rate
    
    // Check system metrics
    const metrics = await app.getSystemMetrics();
    expect(metrics.avgJobProcessingTime).toBeLessThan(2000);
    expect(metrics.peakMemoryUsage).toBeLessThan(500 * 1024 * 1024); // 500MB
  });
});
```

### 6. Webhook and Notification Testing
```typescript
describe('E2E: Webhooks and Notifications', () => {
  it('should trigger webhooks on publish events', async () => {
    const webhookReceiver = new WebhookReceiver(8081);
    await webhookReceiver.start();
    
    await app.configureWebhook({
      url: 'http://localhost:8081/webhook',
      events: ['post.published', 'post.failed']
    });
    
    const post = await app.createPost({
      content: 'Test webhook',
      platforms: ['FACEBOOK']
    });
    
    await app.worker.processJob(post.id);
    
    const webhooks = webhookReceiver.getReceived();
    expect(webhooks).toHaveLength(1);
    expect(webhooks[0]).toMatchObject({
      event: 'post.published',
      data: {
        postId: post.id,
        platform: 'FACEBOOK',
        externalId: expect.any(String)
      }
    });
    
    await webhookReceiver.stop();
  });
});
```

## Test Utilities
```typescript
class TestApplication {
  async seedDatabase() {
    await this.db.migrate();
    await this.db.seed();
  }
  
  async cleanup() {
    await this.db.truncate();
    await this.redis.flushdb();
    await this.worker.stop();
  }
  
  async createPost(data: Partial<Post>): Promise<Post> {
    return this.db.post.create({
      data: {
        content: faker.lorem.sentence(),
        status: 'DRAFT',
        ...data
      }
    });
  }
  
  async getMetrics(): Promise<Metrics> {
    return this.monitoring.getMetrics();
  }
}
```

## Environment Requirements
- Docker Compose stack running
- Mock API server configured
- Test database with migrations
- Minimum 2GB RAM for load tests

## Success Metrics
- All happy path scenarios pass
- Error scenarios handled gracefully
- 95%+ success rate under load
- No memory leaks after 100 iterations
- Tests complete in < 2 minutes