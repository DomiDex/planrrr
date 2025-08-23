import { faker } from '@faker-js/faker';
import type { 
  Post, 
  User, 
  Team, 
  Connection,
  Publication,
  PostStatus,
  Platform,
  ConnectionStatus,
  PublicationStatus
} from '@repo/database';

faker.seed(12345); // Deterministic tests

export const fixtures = {
  user: (overrides?: Partial<User>): User => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    image: faker.image.avatar(),
    emailVerified: true,
    password: null,
    role: 'MEMBER',
    twoFactorEnabled: false,
    twoFactorSecret: null,
    teamId: faker.string.uuid(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  } as User),

  team: (overrides?: Partial<Team>): Team => ({
    id: faker.string.uuid(),
    name: faker.company.name(),
    slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
    logo: null,
    website: null,
    bio: null,
    plan: 'free',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    trialEndsAt: null,
    settings: {},
    postsPublished: 0,
    teamMemberLimit: 5,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  } as Team),

  post: (overrides?: Partial<Post>): Post => ({
    id: faker.string.uuid(),
    teamId: faker.string.uuid(),
    userId: faker.string.uuid(),
    content: faker.lorem.paragraph(),
    mediaUrls: faker.helpers.maybe(() => [faker.image.url()], { probability: 0.3 }) || [],
    platforms: ['FACEBOOK', 'TWITTER'] as Platform[],
    hashtags: [],
    aiGenerated: false,
    aiPrompt: null,
    aiModel: null,
    status: 'DRAFT' as PostStatus,
    scheduledAt: null,
    publishedAt: null,
    metadata: {},
    externalId: null,
    externalUrl: null,
    failureReason: null,
    failedAt: null,
    retryCount: 0,
    lastRetryAt: null,
    nextRetryAt: null,
    threadId: null,
    replyToId: null,
    templateId: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  } as Post),

  scheduledPost: (scheduledAt?: Date): Post => 
    fixtures.post({
      status: 'SCHEDULED' as PostStatus,
      scheduledAt: scheduledAt || faker.date.future(),
    }),

  publishedPost: (): Post =>
    fixtures.post({
      status: 'PUBLISHED' as PostStatus,
      publishedAt: faker.date.recent(),
      scheduledAt: faker.date.past(),
    }),

  connection: (platform: Platform, overrides?: Partial<Connection>): Connection => ({
    id: faker.string.uuid(),
    teamId: faker.string.uuid(),
    platform,
    accountName: faker.company.name(),
    accountId: faker.string.alphanumeric(15),
    accessToken: `mock_${platform.toLowerCase()}_token_${faker.string.alphanumeric(20)}`,
    refreshToken: faker.helpers.maybe(() => `mock_refresh_${faker.string.alphanumeric(20)}`) || null,
    expiresAt: faker.date.future(),
    status: 'ACTIVE' as ConnectionStatus,
    metadata: {},
    lastUsedAt: faker.date.recent(),
    errorCount: 0,
    lastErrorAt: null,
    lastErrorMessage: null,
    postsPublished: 0,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  } as Connection),

  publication: (overrides?: Partial<Publication>): Publication => ({
    id: faker.string.uuid(),
    postId: faker.string.uuid(),
    platform: faker.helpers.arrayElement(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE'] as Platform[]),
    externalId: faker.string.alphanumeric(20),
    status: 'PUBLISHED' as PublicationStatus,
    publishedAt: faker.date.recent(),
    error: null,
    retryCount: 0,
    url: faker.internet.url(),
    editUrl: null,
    metadata: {},
    engagementLikes: 0,
    engagementComments: 0,
    engagementShares: 0,
    engagementViews: 0,
    engagementClicks: 0,
    engagementReach: 0,
    engagementImpressions: 0,
    engagementSaves: 0,
    lastSyncAt: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  } as Publication),

  // Platform-specific content generators
  twitterContent: (): string => 
    faker.lorem.sentence().substring(0, 280),

  facebookContent: (): string => 
    faker.lorem.paragraphs(3),

  instagramContent: (): string => {
    const content = faker.lorem.paragraph();
    const hashtags = faker.helpers.multiple(
      () => `#${faker.word.noun()}`,
      { count: { min: 3, max: 10 } }
    );
    return `${content}\n\n${hashtags.join(' ')}`;
  },

  youtubeContent: (): { title: string; description: string } => ({
    title: faker.lorem.sentence().substring(0, 100),
    description: faker.lorem.paragraphs(2).substring(0, 5000),
  }),

  // Job data fixtures
  publishJobData: (postId?: string, platform?: Platform) => ({
    postId: postId || faker.string.uuid(),
    platform: platform || faker.helpers.arrayElement(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE'] as Platform[]),
    retryCount: 0,
    scheduledFor: faker.date.future().toISOString(),
  }),

  // Error fixtures
  apiError: (code: string = 'API_ERROR') => ({
    code,
    message: faker.lorem.sentence(),
    statusCode: faker.helpers.arrayElement([400, 401, 403, 404, 429, 500]),
    details: {
      timestamp: new Date().toISOString(),
      requestId: faker.string.uuid(),
    },
  }),

  rateLimitError: () => ({
    code: 'RATE_LIMIT',
    message: 'Too many requests',
    statusCode: 429,
    retryAfter: faker.number.int({ min: 60, max: 3600 }),
  }),
};

// Batch fixture generators
export const generateBatch = {
  posts: (count: number, teamId?: string): Post[] =>
    Array.from({ length: count }, () => 
      fixtures.post({ teamId: teamId || faker.string.uuid() })
    ),

  scheduledPosts: (count: number, startDate: Date, endDate: Date): Post[] => {
    const posts: Post[] = [];
    for (let i = 0; i < count; i++) {
      const scheduledAt = faker.date.between({ from: startDate, to: endDate });
      posts.push(fixtures.scheduledPost(scheduledAt));
    }
    return posts.sort((a, b) => 
      (a.scheduledAt?.getTime() || 0) - (b.scheduledAt?.getTime() || 0)
    );
  },

  connections: (teamId: string, platforms: Platform[]): Connection[] =>
    platforms.map(platform => fixtures.connection(platform, { teamId })),
};