import { PrismaClient } from '@repo/database';
import { db } from '../setup';

/**
 * Create a test database transaction
 * Useful for isolating tests without actually committing to database
 */
export async function withTransaction<T>(
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => {
    try {
      return await fn(tx as PrismaClient);
    } catch (error) {
      throw error;
    }
  });
}

/**
 * Seed the database with test data
 */
export async function seedDatabase(data: {
  teams?: any[];
  users?: any[];
  posts?: any[];
  connections?: any[];
}) {
  const results = {
    teams: [] as any[],
    users: [] as any[],
    posts: [] as any[],
    connections: [] as any[]
  };

  // Create teams first
  if (data.teams) {
    for (const team of data.teams) {
      const created = await db.team.create({ data: team });
      results.teams.push(created);
    }
  }

  // Create users (they depend on teams)
  if (data.users) {
    for (const user of data.users) {
      const created = await db.user.create({ data: user });
      results.users.push(created);
    }
  }

  // Create connections
  if (data.connections) {
    for (const connection of data.connections) {
      const created = await db.connection.create({ data: connection });
      results.connections.push(created);
    }
  }

  // Create posts
  if (data.posts) {
    for (const post of data.posts) {
      const created = await db.post.create({ data: post });
      results.posts.push(created);
    }
  }

  return results;
}

/**
 * Clean all data from database
 */
export async function cleanDatabase() {
  // Delete in order of dependencies
  await db.publication.deleteMany();
  await db.post.deleteMany();
  await db.connection.deleteMany();
  await db.user.deleteMany();
  await db.team.deleteMany();
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Create a database snapshot for restoration
 */
export async function createSnapshot() {
  const snapshot = {
    teams: await db.team.findMany(),
    users: await db.user.findMany(),
    posts: await db.post.findMany(),
    connections: await db.connection.findMany(),
    publications: await db.publication.findMany()
  };
  
  return snapshot;
}

/**
 * Restore database from snapshot
 */
export async function restoreSnapshot(snapshot: any) {
  await cleanDatabase();
  
  // Restore in order
  for (const team of snapshot.teams) {
    await db.team.create({ data: team });
  }
  
  for (const user of snapshot.users) {
    await db.user.create({ data: user });
  }
  
  for (const connection of snapshot.connections) {
    await db.connection.create({ data: connection });
  }
  
  for (const post of snapshot.posts) {
    await db.post.create({ data: post });
  }
  
  for (const publication of snapshot.publications) {
    await db.publication.create({ data: publication });
  }
}