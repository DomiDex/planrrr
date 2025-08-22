// Package: @repo/database
// Path: packages/database/index.ts
// Purpose: Enhanced Prisma Client with extensions for soft deletes, encryption, and auditing

import { PrismaClient, Prisma } from '@prisma/client';
import type { Post, User, Team, Connection, Publication } from '@prisma/client';

// Re-export all types from Prisma Client
export * from '@prisma/client';
export { Prisma };

// Export RLS utilities
export * from './rls.js';

// Define the extended client type
type PrismaClientWithExtensions = ReturnType<typeof createPrismaClient>;

// Global variable to store the client instance
let prismaClient: PrismaClientWithExtensions | undefined;

// Helper function for soft delete filtering (kept for potential future use)
// function excludeSoftDeleted<T extends { deletedAt: Date | null }>(
//   items: T[]
// ): T[] {
//   return items.filter(item => item.deletedAt === null);
// }

// Create Prisma Client with extensions
function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    errorFormat: 'pretty',
  });

  // Add soft delete extension
  const extendedClient = client.$extends({
    name: 'softDelete',
    query: {
      // Automatically filter out soft deleted records for common models
      user: {
        async findMany({ args, query }) {
          args.where = {
            ...args.where,
            deletedAt: null,
          };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = {
            ...args.where,
            deletedAt: null,
          };
          return query(args);
        },
        async findUnique({ args, query }) {
          const result = await query(args);
          if (result && 'deletedAt' in result && result.deletedAt !== null) {
            return null;
          }
          return result;
        },
      },
      team: {
        async findMany({ args, query }) {
          args.where = {
            ...args.where,
            deletedAt: null,
          };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = {
            ...args.where,
            deletedAt: null,
          };
          return query(args);
        },
      },
      post: {
        async findMany({ args, query }) {
          args.where = {
            ...args.where,
            deletedAt: null,
          };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = {
            ...args.where,
            deletedAt: null,
          };
          return query(args);
        },
      },
    },
    model: {
      // Add soft delete methods
      user: {
        async softDelete(id: string) {
          return client.user.update({
            where: { id },
            data: { deletedAt: new Date() },
          });
        },
        async restore(id: string) {
          return client.user.update({
            where: { id },
            data: { deletedAt: null },
          });
        },
        async findManyIncludingDeleted(args?: Prisma.UserFindManyArgs) {
          return client.user.findMany(args);
        },
      },
      team: {
        async softDelete(id: string) {
          return client.team.update({
            where: { id },
            data: { deletedAt: new Date() },
          });
        },
        async restore(id: string) {
          return client.team.update({
            where: { id },
            data: { deletedAt: null },
          });
        },
      },
      post: {
        async softDelete(id: string) {
          return client.post.update({
            where: { id },
            data: { deletedAt: new Date() },
          });
        },
        async restore(id: string) {
          return client.post.update({
            where: { id },
            data: { deletedAt: null },
          });
        },
        async findScheduled(teamId: string) {
          return client.post.findMany({
            where: {
              teamId,
              status: 'SCHEDULED',
              deletedAt: null,
              scheduledAt: {
                gte: new Date(),
              },
            },
            orderBy: {
              scheduledAt: 'asc',
            },
            include: {
              user: true,
              publications: true,
            },
          });
        },
      },
    },
  });

  // Add audit logging extension
  const auditClient = extendedClient.$extends({
    name: 'auditLog',
    query: {
      $allModels: {
        async create({ args, query, model }) {
          const result = await query(args);
          
          // Log creation in audit log
          if (model && !['AuditLog', 'Session', 'Analytics'].includes(String(model))) {
            await client.auditLog.create({
              data: {
                action: 'create',
                resource: String(model).toLowerCase(),
                resourceId: (result as Record<string, unknown>).id as string,
                newValues: result as Prisma.JsonObject,
                details: { model, operation: 'create' },
              },
            }).catch(console.error); // Don't fail the main operation
          }
          
          return result;
        },
        async update({ args, query, model }) {
          // Fetch old values before update
          let oldValues: unknown = null;
          if (model && args.where && 'id' in args.where) {
            const modelName = String(model).toLowerCase();
            // Use dynamic access with type assertion for Prisma models
            const modelClient = (client as unknown as Record<string, unknown>)[modelName];
            if (modelClient && typeof modelClient === 'object' && 'findUnique' in modelClient) {
              oldValues = await (modelClient as { findUnique: (args: { where: unknown }) => Promise<unknown> }).findUnique({
                where: args.where,
              });
            }
          }
          
          const result = await query(args);
          
          // Log update in audit log
          if (model && !['AuditLog', 'Session', 'Analytics'].includes(String(model))) {
            await client.auditLog.create({
              data: {
                action: 'update',
                resource: String(model).toLowerCase(),
                resourceId: (result as Record<string, unknown>).id as string,
                oldValues: oldValues as Prisma.JsonObject || undefined,
                newValues: result as Prisma.JsonObject,
                details: { model, operation: 'update' },
              },
            }).catch(console.error);
          }
          
          return result;
        },
        async delete({ args, query, model }) {
          const result = await query(args);
          
          // Log deletion in audit log
          if (model && !['AuditLog', 'Session', 'Analytics'].includes(String(model))) {
            await client.auditLog.create({
              data: {
                action: 'delete',
                resource: String(model).toLowerCase(),
                resourceId: args.where && 'id' in args.where ? (args.where as Record<string, unknown>).id as string : undefined,
                oldValues: result as Prisma.JsonObject,
                details: { model, operation: 'delete' },
              },
            }).catch(console.error);
          }
          
          return result;
        },
      },
    },
  });

  return auditClient;
}

// Get or create the Prisma Client instance
export function getPrismaClient(): PrismaClientWithExtensions {
  if (!prismaClient) {
    prismaClient = createPrismaClient();
  }
  return prismaClient;
}

// Export a singleton instance
export const prisma = getPrismaClient();

// Helper functions for common queries
export const db = {
  // User helpers
  user: {
    findByEmail: (email: string) => 
      prisma.user.findUnique({ where: { email } }),
    
    findByTeam: (teamId: string) =>
      prisma.user.findMany({ 
        where: { teamId },
        include: { team: true },
      }),
    
    createWithTeam: async (data: {
      email: string;
      name?: string;
      password: string;
      teamName: string;
      teamSlug: string;
    }) => {
      return prisma.$transaction(async (tx) => {
        const team = await tx.team.create({
          data: {
            name: data.teamName,
            slug: data.teamSlug,
          },
        });
        
        const user = await tx.user.create({
          data: {
            email: data.email,
            name: data.name,
            password: data.password,
            role: 'OWNER',
            teamId: team.id,
          },
        });
        
        return { user, team };
      });
    },
  },
  
  // Post helpers
  post: {
    findScheduledForPublishing: () =>
      prisma.post.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: {
            lte: new Date(),
          },
          deletedAt: null,
        },
        include: {
          team: true,
          user: true,
        },
      }),
    
    updateStatus: (id: string, status: Prisma.EnumPostStatusFieldUpdateOperationsInput) =>
      prisma.post.update({
        where: { id },
        data: { status },
      }),
    
    getWithAnalytics: (id: string) =>
      prisma.post.findUnique({
        where: { id },
        include: {
          publications: true,
          analytics: true,
          mediaAssets: true,
        },
      }),
  },
  
  // Connection helpers
  connection: {
    findActiveByTeam: (teamId: string) =>
      prisma.connection.findMany({
        where: {
          teamId,
          status: 'ACTIVE',
        },
      }),
    
    findExpiring: (days: number = 7) =>
      prisma.connection.findMany({
        where: {
          expiresAt: {
            lte: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
          status: 'ACTIVE',
        },
        include: {
          team: true,
        },
      }),
    
    updateTokens: (id: string, accessToken: string, refreshToken?: string, expiresAt?: Date) =>
      prisma.connection.update({
        where: { id },
        data: {
          accessToken,
          refreshToken,
          expiresAt,
          status: 'ACTIVE',
        },
      }),
  },
  
  // Analytics helpers
  analytics: {
    getPostMetrics: (postId: string, startDate?: Date, endDate?: Date) =>
      prisma.analytics.aggregate({
        where: {
          postId,
          ...(startDate && endDate && {
            date: {
              gte: startDate,
              lte: endDate,
            },
          }),
        },
        _sum: {
          impressions: true,
          reach: true,
          engagement: true,
          clicks: true,
        },
      }),
    
    getTeamMetrics: async (teamId: string, startDate?: Date, endDate?: Date) => {
      const posts = await prisma.post.findMany({
        where: { teamId },
        select: { id: true },
      });
      
      return prisma.analytics.aggregate({
        where: {
          postId: {
            in: posts.map(p => p.id),
          },
          ...(startDate && endDate && {
            date: {
              gte: startDate,
              lte: endDate,
            },
          }),
        },
        _sum: {
          impressions: true,
          reach: true,
          engagement: true,
          clicks: true,
        },
      });
    },
  },
  
  // Transaction helpers
  transaction: prisma.$transaction,
};

// Cleanup function for graceful shutdown
export async function disconnectPrisma() {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = undefined;
  }
}

// Handle graceful shutdown
if (process.env.NODE_ENV !== 'test') {
  process.on('beforeExit', async () => {
    await disconnectPrisma();
  });
}

// Export types for convenience
export type { Post, User, Team, Connection, Publication };