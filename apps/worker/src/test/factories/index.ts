import { faker } from '@faker-js/faker';
import type { 
  Post, 
  Connection, 
  User, 
  Team, 
  Platform,
  Publication
} from '@repo/database';

/**
 * Create a mock Post fixture for testing
 */
export function createPostFixture(overrides?: Partial<Post>): Post {
  return {
    id: faker.string.uuid(),
    content: faker.lorem.paragraph(),
    mediaUrls: [],
    platforms: ['FACEBOOK'] as Platform[],
    status: 'SCHEDULED',
    scheduledAt: faker.date.future(),
    publishedAt: null,
    teamId: faker.string.uuid(),
    userId: faker.string.uuid(),
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as Post;
}

/**
 * Create a mock Connection fixture for testing
 */
export function createConnectionFixture(
  overrides?: Partial<Connection>
): Connection {
  const platform = overrides?.platform || 'FACEBOOK';
  
  return {
    id: faker.string.uuid(),
    teamId: faker.string.uuid(),
    platform: platform as Platform,
    accountName: faker.company.name(),
    accountId: faker.string.numeric(10),
    accessToken: faker.string.alphanumeric(40),
    refreshToken: faker.string.alphanumeric(40),
    expiresAt: faker.date.future(),
    status: 'ACTIVE',
    metadata: getPlatformMetadata(platform as Platform),
    lastSync: faker.date.recent(),
    syncErrors: 0,
    postsPublished: faker.number.int({ min: 0, max: 1000 }),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as Connection;
}

/**
 * Create a mock User fixture for testing
 */
export function createUserFixture(overrides?: Partial<User>): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    image: faker.image.avatar(),
    emailVerified: faker.date.past(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as User;
}

/**
 * Create a mock Team fixture for testing
 */
export function createTeamFixture(overrides?: Partial<Team>): Team {
  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
    image: faker.image.url(),
    plan: 'PRO',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as Team;
}

/**
 * Create a mock Publication fixture for testing
 */
export function createPublicationFixture(
  overrides?: Partial<Publication>
): Publication {
  return {
    id: faker.string.uuid(),
    postId: faker.string.uuid(),
    platform: 'FACEBOOK' as Platform,
    externalId: `fb_${faker.string.numeric(15)}`,
    url: faker.internet.url(),
    status: 'PUBLISHED',
    publishedAt: faker.date.recent(),
    metrics: {
      likes: faker.number.int({ min: 0, max: 1000 }),
      shares: faker.number.int({ min: 0, max: 100 }),
      comments: faker.number.int({ min: 0, max: 50 }),
      views: faker.number.int({ min: 0, max: 10000 })
    },
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as Publication;
}

/**
 * Helper function to generate platform-specific metadata
 */
function getPlatformMetadata(platform: Platform): Record<string, unknown> {
  switch (platform) {
    case 'FACEBOOK':
      return {
        pageId: faker.string.numeric(15),
        pageName: faker.company.name()
      };
    
    case 'INSTAGRAM':
      return {
        accountId: faker.string.numeric(10),
        username: faker.internet.username()
      };
    
    case 'TWITTER':
      return {
        userId: faker.string.numeric(10),
        username: faker.internet.username(),
        handle: `@${faker.internet.username()}`
      };
    
    case 'YOUTUBE':
      return {
        channelId: faker.string.alphanumeric(24),
        channelName: faker.company.name()
      };
    
    case 'LINKEDIN':
      return {
        organizationId: faker.string.numeric(10),
        organizationName: faker.company.name()
      };
    
    default:
      return {};
  }
}

/**
 * Create a batch of fixtures
 */
export function createBatch<T>(
  factory: (overrides?: Partial<T>) => T,
  count: number,
  overrides?: Partial<T>
): T[] {
  return Array.from({ length: count }, () => factory(overrides));
}

/**
 * Create a complete test scenario with related entities
 */
export function createTestScenario() {
  const team = createTeamFixture();
  const user = createUserFixture();
  const connection = createConnectionFixture({ teamId: team.id });
  const post = createPostFixture({ 
    teamId: team.id, 
    userId: user.id,
    platforms: [connection.platform]
  });
  const publication = createPublicationFixture({
    postId: post.id,
    platform: connection.platform
  });
  
  return {
    team,
    user,
    connection,
    post,
    publication
  };
}