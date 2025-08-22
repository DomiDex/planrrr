import { faker } from '@faker-js/faker';
import type { Connection, Platform, ConnectionStatus, Prisma } from '@repo/database';

export function createConnectionFixture(overrides?: Partial<Connection>): Connection {
  const platform = overrides?.platform || faker.helpers.arrayElement<Platform>(['FACEBOOK', 'TWITTER', 'INSTAGRAM', 'YOUTUBE']);
  
  return {
    id: faker.string.uuid(),
    teamId: faker.string.uuid(),
    platform,
    accountName: faker.internet.username(),
    accountId: faker.string.alphanumeric(20),
    accessToken: faker.string.alphanumeric(64),
    refreshToken: faker.string.alphanumeric(64),
    expiresAt: faker.date.future(),
    status: 'ACTIVE' as ConnectionStatus,
    metadata: getDefaultMetadata(platform),
    lastSync: faker.date.recent(),
    syncErrors: 0,
    postsPublished: faker.number.int({ min: 0, max: 100 }),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as Connection;
}

function getDefaultMetadata(platform: Platform): Prisma.JsonValue {
  switch (platform) {
    case 'FACEBOOK':
      return {
        pageId: faker.string.numeric(15),
        pageName: faker.company.name()
      };
    case 'INSTAGRAM':
      return {
        businessAccountId: faker.string.numeric(17),
        username: faker.internet.username().toLowerCase()
      };
    case 'TWITTER':
      return {
        username: `@${faker.internet.username()}`,
        userId: faker.string.numeric(19)
      };
    case 'YOUTUBE':
      return {
        channelId: `UC${faker.string.alphanumeric(22)}`,
        channelName: faker.company.name()
      };
    default:
      return {};
  }
}

export function createFacebookConnectionFixture(overrides?: Partial<Connection>): Connection {
  return createConnectionFixture({
    platform: 'FACEBOOK' as Platform,
    accountName: `${faker.person.firstName()} ${faker.person.lastName()}`,
    ...overrides
  });
}

export function createInstagramConnectionFixture(overrides?: Partial<Connection>): Connection {
  return createConnectionFixture({
    platform: 'INSTAGRAM' as Platform,
    accountName: faker.internet.username().toLowerCase(),
    ...overrides
  });
}

export function createTwitterConnectionFixture(overrides?: Partial<Connection>): Connection {
  return createConnectionFixture({
    platform: 'TWITTER' as Platform,
    accountName: `@${faker.internet.username()}`,
    ...overrides
  });
}

export function createYoutubeConnectionFixture(overrides?: Partial<Connection>): Connection {
  return createConnectionFixture({
    platform: 'YOUTUBE' as Platform,
    accountName: faker.company.name(),
    ...overrides
  });
}

export function createExpiredConnectionFixture(overrides?: Partial<Connection>): Connection {
  return createConnectionFixture({
    expiresAt: faker.date.past(),
    status: 'EXPIRED' as ConnectionStatus,
    ...overrides
  });
}

export function createInactiveConnectionFixture(overrides?: Partial<Connection>): Connection {
  return createConnectionFixture({
    status: 'INACTIVE' as ConnectionStatus,
    syncErrors: faker.number.int({ min: 1, max: 10 }),
    ...overrides
  });
}

export function createConnectionsFixture(count: number, overrides?: Partial<Connection>): Connection[] {
  return Array.from({ length: count }, () => createConnectionFixture(overrides));
}