import { faker } from '@faker-js/faker';
import type { 
  Post, 
  User, 
  Team, 
  Connection,
  PostStatus,
  Platform,
  Prisma 
} from '@repo/database';
import { fixtures } from './fixtures.js';

export class PostBuilder {
  private post: Partial<Post> = {};

  withContent(content: string): this {
    this.post.content = content;
    return this;
  }

  withMediaUrls(...urls: string[]): this {
    this.post.mediaUrls = urls;
    return this;
  }

  withPlatforms(...platforms: Platform[]): this {
    this.post.platforms = platforms;
    return this;
  }

  withStatus(status: PostStatus): this {
    this.post.status = status;
    return this;
  }

  scheduled(at: Date): this {
    this.post.status = 'SCHEDULED';
    this.post.scheduledAt = at;
    return this;
  }

  published(at?: Date): this {
    this.post.status = 'PUBLISHED';
    this.post.publishedAt = at || new Date();
    return this;
  }

  failed(): this {
    this.post.status = 'FAILED';
    return this;
  }

  forTeam(teamId: string): this {
    this.post.teamId = teamId;
    return this;
  }

  byAuthor(userId: string): this {
    this.post.userId = userId;
    return this;
  }

  build(): Post {
    return {
      ...fixtures.post(),
      ...this.post,
    };
  }
}

export class ConnectionBuilder {
  private connection: Partial<Connection> = {};

  forPlatform(platform: Platform): this {
    this.connection.platform = platform;
    return this;
  }

  withToken(accessToken: string, refreshToken?: string): this {
    this.connection.accessToken = accessToken;
    if (refreshToken) {
      this.connection.refreshToken = refreshToken;
    }
    return this;
  }

  expiresAt(date: Date): this {
    this.connection.expiresAt = date;
    return this;
  }

  expired(): this {
    this.connection.expiresAt = faker.date.past();
    return this;
  }

  active(): this {
    this.connection.status = 'ACTIVE';
    this.connection.expiresAt = faker.date.future();
    return this;
  }

  inactive(): this {
    this.connection.status = 'DISCONNECTED';
    return this;
  }

  forTeam(teamId: string): this {
    this.connection.teamId = teamId;
    return this;
  }

  // Connection is at team level, not user level
  withMetadata(metadata: Prisma.JsonValue): this {
    this.connection.metadata = metadata;
    return this;
  }

  withAccountInfo(accountId: string, accountName: string): this {
    this.connection.accountId = accountId;
    this.connection.accountName = accountName;
    return this;
  }

  build(): Connection {
    const platform = this.connection.platform || 'FACEBOOK';
    return {
      ...fixtures.connection(platform),
      ...this.connection,
    };
  }
}

export class TeamBuilder {
  private team: Partial<Team> = {};

  withName(name: string): this {
    this.team.name = name;
    this.team.slug = faker.helpers.slugify(name).toLowerCase();
    return this;
  }

  // Team doesn't have owner in schema
  withSettings(settings: Prisma.JsonValue): this {
    this.team.settings = settings;
    return this;
  }

  build(): Team {
    return {
      ...fixtures.team(),
      ...this.team,
    };
  }
}

export class UserBuilder {
  private user: Partial<User> = {};

  withEmail(email: string): this {
    this.user.email = email;
    return this;
  }

  withName(name: string): this {
    this.user.name = name;
    return this;
  }

  verified(): this {
    this.user.emailVerified = true;
    return this;
  }

  unverified(): this {
    this.user.emailVerified = false;
    return this;
  }

  build(): User {
    return {
      ...fixtures.user(),
      ...this.user,
    };
  }
}

// Job data builders
export class PublishJobBuilder {
  private jobData: Record<string, unknown> = {};

  forPost(postId: string): this {
    this.jobData.postId = postId;
    return this;
  }

  toPlatform(platform: Platform): this {
    this.jobData.platform = platform;
    return this;
  }

  scheduledFor(date: Date): this {
    this.jobData.scheduledFor = date.toISOString();
    return this;
  }

  withRetryCount(count: number): this {
    this.jobData.retryCount = count;
    return this;
  }

  withPriority(priority: number): this {
    this.jobData.priority = priority;
    return this;
  }

  build() {
    return {
      postId: faker.string.uuid(),
      platform: 'FACEBOOK' as Platform,
      scheduledFor: new Date().toISOString(),
      retryCount: 0,
      ...this.jobData,
    };
  }
}

// Test scenario builders
export class TestScenarioBuilder {
  private scenario: {
    team?: Team;
    users: User[];
    posts: Post[];
    connections: Connection[];
  } = {
    users: [],
    posts: [],
    connections: [],
  };

  withTeam(): this {
    this.scenario.team = fixtures.team();
    return this;
  }

  withUsers(count: number): this {
    this.scenario.users = Array.from({ length: count }, () =>
      fixtures.user()
    );
    return this;
  }

  withScheduledPosts(count: number, startDate: Date, endDate: Date): this {
    const teamId = this.scenario.team?.id || faker.string.uuid();
    const _userId = this.scenario.users[0]?.id || faker.string.uuid();
    
    for (let i = 0; i < count; i++) {
      const scheduledAt = faker.date.between({ from: startDate, to: endDate });
      this.scenario.posts.push(
        new PostBuilder()
          .scheduled(scheduledAt)
          .forTeam(teamId)
          .byAuthor(_userId)
          .build()
      );
    }
    return this;
  }

  withConnections(...platforms: Platform[]): this {
    const teamId = this.scenario.team?.id || faker.string.uuid();
    
    this.scenario.connections = platforms.map(platform =>
      new ConnectionBuilder()
        .forPlatform(platform)
        .forTeam(teamId)
        .active()
        .build()
    );
    return this;
  }

  build() {
    return this.scenario;
  }
}