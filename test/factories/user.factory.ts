import { faker } from '@faker-js/faker';
import type { User, Role } from '@repo/database';

export function createUserFixture(overrides?: Partial<User>): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email().toLowerCase(),
    name: faker.person.fullName(),
    password: faker.internet.password({ length: 12 }),
    role: 'MEMBER' as Role,
    teamId: faker.string.uuid(),
    emailVerified: false,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    image: faker.image.avatar(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides
  } as User;
}

export function createUsersFixture(count: number, overrides?: Partial<User>): User[] {
  return Array.from({ length: count }, () => createUserFixture(overrides));
}

export function createAdminUserFixture(overrides?: Partial<User>): User {
  return createUserFixture({
    role: 'ADMIN' as Role,
    emailVerified: true,
    ...overrides
  });
}

export function createOwnerUserFixture(overrides?: Partial<User>): User {
  return createUserFixture({
    role: 'OWNER' as Role,
    emailVerified: true,
    ...overrides
  });
}