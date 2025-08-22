import { faker } from '@faker-js/faker';
import type { Team, Prisma } from '@repo/database';

export function createTeamFixture(overrides?: Partial<Team>): Team {
  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
    logo: faker.image.url(),
    website: faker.internet.url(),
    bio: faker.company.catchPhrase(),
    plan: 'free',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    trialEndsAt: null,
    settings: {} as Prisma.JsonValue,
    monthlyPostLimit: 100,
    teamMemberLimit: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides
  } as Team;
}

export function createPaidTeamFixture(overrides?: Partial<Team>): Team {
  return createTeamFixture({
    plan: 'pro',
    stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
    stripeSubscriptionId: `sub_${faker.string.alphanumeric(14)}`,
    monthlyPostLimit: 500,
    teamMemberLimit: 10,
    ...overrides
  });
}

export function createEnterpriseTeamFixture(overrides?: Partial<Team>): Team {
  return createTeamFixture({
    plan: 'enterprise',
    stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
    stripeSubscriptionId: `sub_${faker.string.alphanumeric(14)}`,
    monthlyPostLimit: -1, // unlimited
    teamMemberLimit: -1, // unlimited
    ...overrides
  });
}

export function createTeamsFixture(count: number, overrides?: Partial<Team>): Team[] {
  return Array.from({ length: count }, () => createTeamFixture(overrides));
}