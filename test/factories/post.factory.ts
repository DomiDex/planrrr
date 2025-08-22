import { faker } from '@faker-js/faker';
import type { Post, Platform, PostStatus, Prisma } from '@repo/database';

const platforms: Platform[] = ['FACEBOOK', 'TWITTER', 'INSTAGRAM', 'YOUTUBE'];
const statuses: PostStatus[] = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'];

export function createPostFixture(overrides?: Partial<Post>): Post {
  const status = overrides?.status || faker.helpers.arrayElement(statuses);
  const now = new Date();
  
  return {
    id: faker.string.uuid(),
    teamId: faker.string.uuid(),
    userId: faker.string.uuid(),
    content: faker.lorem.paragraph(),
    mediaUrls: faker.helpers.maybe(() => 
      Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, 
        () => faker.image.url()
      ), { probability: 0.3 }) || [],
    platforms: overrides?.platforms || [faker.helpers.arrayElement(platforms)],
    hashtags: faker.lorem.words(3).split(' ').map(w => `#${w}`),
    aiGenerated: false,
    aiPrompt: null,
    aiModel: null,
    status,
    scheduledAt: status === 'SCHEDULED' ? faker.date.future() : null,
    publishedAt: status === 'PUBLISHED' ? faker.date.recent() : null,
    failedAt: status === 'FAILED' ? faker.date.recent() : null,
    failureReason: status === 'FAILED' ? faker.lorem.sentence() : null,
    parentPostId: null,
    threadPosition: null,
    metadata: {} as Prisma.JsonValue,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides
  } as Post;
}

export function createDraftPostFixture(overrides?: Partial<Post>): Post {
  return createPostFixture({
    status: 'DRAFT' as PostStatus,
    scheduledAt: null,
    publishedAt: null,
    failedAt: null,
    ...overrides
  });
}

export function createScheduledPostFixture(overrides?: Partial<Post>): Post {
  return createPostFixture({
    status: 'SCHEDULED' as PostStatus,
    scheduledAt: faker.date.future(),
    publishedAt: null,
    failedAt: null,
    ...overrides
  });
}

export function createPublishedPostFixture(overrides?: Partial<Post>): Post {
  const publishedAt = faker.date.recent();
  return createPostFixture({
    status: 'PUBLISHED' as PostStatus,
    scheduledAt: faker.date.past({ refDate: publishedAt }),
    publishedAt,
    failedAt: null,
    ...overrides
  });
}

export function createFailedPostFixture(overrides?: Partial<Post>): Post {
  return createPostFixture({
    status: 'FAILED' as PostStatus,
    scheduledAt: faker.date.past(),
    publishedAt: null,
    failedAt: faker.date.recent(),
    failureReason: faker.lorem.sentence(),
    ...overrides
  });
}

export function createAIGeneratedPostFixture(overrides?: Partial<Post>): Post {
  return createPostFixture({
    aiGenerated: true,
    aiPrompt: faker.lorem.sentence(),
    aiModel: 'gpt-4',
    ...overrides
  });
}

export function createPostsFixture(count: number, overrides?: Partial<Post>): Post[] {
  return Array.from({ length: count }, () => createPostFixture(overrides));
}