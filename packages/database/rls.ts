// Package: @repo/database
// Path: packages/database/rls.ts
// Purpose: Row Level Security extensions for Prisma Client

import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

export interface RLSContext {
  teamId?: string;
  userId?: string;
  bypassRLS?: boolean;
}

/**
 * Creates a Prisma Client extension for Row Level Security
 * Sets PostgreSQL session variables for RLS context
 */
export function withRLS(context: RLSContext = {}) {
  return Prisma.defineExtension((prisma) =>
    prisma.$extends({
      name: 'row-level-security',
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            // Build SQL commands for setting RLS context
            const sqlCommands: Prisma.Sql[] = [];

            if (context.bypassRLS === true) {
              sqlCommands.push(
                Prisma.sql`SELECT set_config('app.bypass_rls', 'true', TRUE)`
              );
            } else {
              sqlCommands.push(
                Prisma.sql`SELECT set_config('app.bypass_rls', 'false', TRUE)`
              );

              if (context.teamId) {
                sqlCommands.push(
                  Prisma.sql`SELECT set_config('app.current_team_id', ${context.teamId}, TRUE)`
                );
              }

              if (context.userId) {
                sqlCommands.push(
                  Prisma.sql`SELECT set_config('app.current_user_id', ${context.userId}, TRUE)`
                );
              }
            }

            // Execute in transaction to ensure context is set
            const [, result] = await prisma.$transaction([
              ...sqlCommands.map(sql => prisma.$executeRaw(sql)),
              query(args),
            ] as const);

            return result;
          },
        },
      },
    })
  );
}

/**
 * Creates a Prisma Client extension that bypasses RLS
 * Use with caution - only for admin operations
 */
export function bypassRLS() {
  return withRLS({ bypassRLS: true });
}

/**
 * Creates a Prisma Client extension for a specific team context
 * All queries will be automatically filtered by team
 */
export function forTeam(teamId: string, userId?: string) {
  return withRLS({ teamId, userId });
}

/**
 * Creates a Prisma Client extension for a specific user context
 * Queries will be filtered by user's team and user ID
 */
export function forUser(userId: string, teamId: string) {
  return withRLS({ teamId, userId });
}

/**
 * Helper to create a scoped Prisma client with RLS context
 * Use this in API routes and server actions
 */
export function createScopedClient(
  prisma: PrismaClient,
  context: RLSContext
): PrismaClient {
  return prisma.$extends(withRLS(context)) as unknown as PrismaClient;
}

/**
 * Batch operations with RLS context
 * Ensures all operations run with the same RLS context
 */
export async function withRLSTransaction<T>(
  prisma: PrismaClient,
  context: RLSContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Set RLS context for the transaction
    if (context.bypassRLS === true) {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'true', TRUE)`;
    } else {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'false', TRUE)`;

      if (context.teamId) {
        await tx.$executeRaw`SELECT set_config('app.current_team_id', ${context.teamId}, TRUE)`;
      }

      if (context.userId) {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${context.userId}, TRUE)`;
      }
    }

    // Execute the function with RLS context set
    return fn(tx);
  });
}

/**
 * Middleware for setting RLS context from auth session
 * Use this in your API middleware chain
 */
export function rlsMiddleware(getContext: () => Promise<RLSContext | null>) {
  return Prisma.defineExtension((prisma) =>
    prisma.$extends({
      name: 'rls-middleware',
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const context = await getContext();
            
            if (!context) {
              // No context, run without RLS
              return query(args);
            }

            // Set RLS context and run query
            const sqlCommands: Prisma.Sql[] = [];

            if (context.bypassRLS === true) {
              sqlCommands.push(
                Prisma.sql`SELECT set_config('app.bypass_rls', 'true', TRUE)`
              );
            } else {
              sqlCommands.push(
                Prisma.sql`SELECT set_config('app.bypass_rls', 'false', TRUE)`
              );

              if (context.teamId) {
                sqlCommands.push(
                  Prisma.sql`SELECT set_config('app.current_team_id', ${context.teamId}, TRUE)`
                );
              }

              if (context.userId) {
                sqlCommands.push(
                  Prisma.sql`SELECT set_config('app.current_user_id', ${context.userId}, TRUE)`
                );
              }
            }

            const [, result] = await prisma.$transaction([
              ...sqlCommands.map(sql => prisma.$executeRaw(sql)),
              query(args),
            ] as const);

            return result;
          },
        },
      },
    })
  );
}