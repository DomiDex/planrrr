// Package: @repo/api
// Path: apps/api/src/procedures/connections.procedure.ts
// Dependencies: @orpc/server, @repo/database

import { os, ORPCError } from '@orpc/server';
import { z } from 'zod';
import { prisma } from '@repo/database';
import { teamProcedure } from './middleware/auth.middleware.js';
import {
  CreateConnectionSchema,
  UpdateConnectionSchema,
  ListConnectionsSchema,
  RefreshConnectionSchema,
  TestConnectionSchema,
  ConnectionResponseSchema,
  ConnectionHealthSchema
} from '../schemas/connection.schema.js';
import { logger } from '../lib/logger.js';

// Mock platform API functions (replace with actual implementations)
async function testPlatformConnection(
  platform: string,
  _accessToken: string // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<boolean> {
  // TODO: Implement actual platform API tests
  logger.info('Testing platform connection', { platform });
  return true;
}

async function refreshPlatformToken(
  platform: string,
  _refreshToken: string // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<{ accessToken: string; expiresAt?: Date }> {
  // TODO: Implement actual token refresh
  logger.info('Refreshing platform token', { platform });
  return {
    accessToken: `refreshed_${Date.now()}`,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  };
}

// Connections router
export const connectionsRouter = os.router({
  // List connections
  list: teamProcedure
    .input(ListConnectionsSchema)
    .output(z.array(ConnectionResponseSchema))
    .handler(async ({ input, context }) => {
      const { teamId, platform, status } = input;
      
      // Verify team access
      if (context.user?.teamId !== teamId) {
        throw new ORPCError('FORBIDDEN', { message: 'Access denied to this team' });
      }
      
      const connections = await prisma.connection.findMany({
        where: {
          teamId,
          ...(platform && { platform }),
          ...(status !== undefined && { status })
        },
        orderBy: { createdAt: 'desc' }
      });
      
      return connections.map(conn => ({
        ...conn,
        platform: conn.platform as "FACEBOOK" | "INSTAGRAM" | "TWITTER" | "YOUTUBE",
        lastSync: conn.lastSync || null,
        expiresAt: conn.expiresAt || null
      }));
    }),
  
  // Get single connection
  get: teamProcedure
    .input(z.string())
    .output(ConnectionResponseSchema)
    .handler(async ({ input: id, context }) => {
      const connection = await prisma.connection.findFirst({
        where: {
          id,
          teamId: context.user!.teamId!
        }
      });
      
      if (!connection) {
        throw new ORPCError('NOT_FOUND', { message: 'Connection not found' });
      }
      
      return {
        ...connection,
        platform: connection.platform as "FACEBOOK" | "INSTAGRAM" | "TWITTER" | "YOUTUBE",
        lastSync: connection.lastSync || null,
        expiresAt: connection.expiresAt || null
      };
    }),
  
  // Create connection
  create: teamProcedure
    .input(CreateConnectionSchema)
    .output(ConnectionResponseSchema)
    .handler(async ({ input, context }) => {
      const { platform, accountId, accountName, accessToken, refreshToken, expiresAt, metadata } = input;
      
      // Check for duplicate connection
      const existing = await prisma.connection.findFirst({
        where: {
          teamId: context.user!.teamId!,
          platform,
          accountId
        }
      });
      
      if (existing) {
        throw new ORPCError('CONFLICT', { message: 'Connection already exists for this account' });
      }
      
      // Test the connection
      const isValid = await testPlatformConnection(platform, accessToken);
      if (!isValid) {
        throw new ORPCError('BAD_REQUEST', { message: 'Invalid connection credentials' });
      }
      
      // Create connection
      const connection = await prisma.connection.create({
        data: {
          platform,
          accountId,
          accountName,
          accessToken,
          refreshToken,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          metadata: metadata || {},
          status: 'ACTIVE',
          teamId: context.user!.teamId!,
          lastSync: new Date()
        }
      });
      
      logger.info('Connection created', {
        connectionId: connection.id,
        platform,
        teamId: context.user?.teamId,
        requestId: context.requestId
      });
      
      return {
        ...connection,
        platform: connection.platform as "FACEBOOK" | "INSTAGRAM" | "TWITTER" | "YOUTUBE",
        lastSync: connection.lastSync || null,
        expiresAt: connection.expiresAt || null
      };
    }),
  
  // Update connection
  update: teamProcedure
    .input(UpdateConnectionSchema)
    .output(ConnectionResponseSchema)
    .handler(async ({ input, context }) => {
      const { id, ...updateData } = input;
      
      // Verify connection ownership
      const existing = await prisma.connection.findFirst({
        where: {
          id,
          teamId: context.user!.teamId!
        }
      });
      
      if (!existing) {
        throw new ORPCError('NOT_FOUND', { message: 'Connection not found' });
      }
      
      // Test if access token is being updated
      if (updateData.accessToken) {
        const isValid = await testPlatformConnection(existing.platform, updateData.accessToken);
        if (!isValid) {
          throw new ORPCError('BAD_REQUEST', { message: 'Invalid connection credentials' });
        }
      }
      
      // Update connection
      const connection = await prisma.connection.update({
        where: { id },
        data: {
          ...updateData,
          expiresAt: updateData.expiresAt ? new Date(updateData.expiresAt) : undefined
        }
      });
      
      logger.info('Connection updated', {
        connectionId: connection.id,
        requestId: context.requestId
      });
      
      return {
        ...connection,
        platform: connection.platform as "FACEBOOK" | "INSTAGRAM" | "TWITTER" | "YOUTUBE",
        lastSync: connection.lastSync || null,
        expiresAt: connection.expiresAt || null
      };
    }),
  
  // Delete connection
  delete: teamProcedure
    .input(z.string())
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input: id, context }) => {
      // Verify connection ownership
      const connection = await prisma.connection.findFirst({
        where: {
          id,
          teamId: context.user!.teamId!
        }
      });
      
      if (!connection) {
        throw new ORPCError('NOT_FOUND', { message: 'Connection not found' });
      }
      
      // Delete connection
      await prisma.connection.delete({
        where: { id }
      });
      
      logger.info('Connection deleted', {
        connectionId: id,
        platform: connection.platform,
        requestId: context.requestId
      });
      
      return { success: true };
    }),
  
  // Refresh connection token
  refresh: teamProcedure
    .input(RefreshConnectionSchema)
    .output(ConnectionResponseSchema)
    .handler(async ({ input, context }) => {
      const { id } = input;
      
      const connection = await prisma.connection.findFirst({
        where: {
          id,
          teamId: context.user!.teamId!
        }
      });
      
      if (!connection) {
        throw new ORPCError('NOT_FOUND', { message: 'Connection not found' });
      }
      
      if (!connection.refreshToken) {
        throw new ORPCError('BAD_REQUEST', { message: 'No refresh token available' });
      }
      
      try {
        const { accessToken, expiresAt } = await refreshPlatformToken(
          connection.platform,
          connection.refreshToken
        );
        
        const updated = await prisma.connection.update({
          where: { id },
          data: {
            accessToken,
            expiresAt,
            lastSync: new Date()
          }
        });
        
        logger.info('Connection token refreshed', {
          connectionId: id,
          platform: connection.platform,
          requestId: context.requestId
        });
        
        return {
          ...updated,
          platform: updated.platform as "FACEBOOK" | "INSTAGRAM" | "TWITTER" | "YOUTUBE",
          lastSync: updated.lastSync || null,
          expiresAt: updated.expiresAt || null
        };
      } catch (error) {
        logger.error('Failed to refresh token', {
          connectionId: id,
          error,
          requestId: context.requestId
        });
        
        throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Failed to refresh token' });
      }
    }),
  
  // Test connection
  test: teamProcedure
    .input(TestConnectionSchema)
    .output(z.object({ 
      success: z.boolean(),
      message: z.string().optional()
    }))
    .handler(async ({ input, context }) => {
      const { id } = input;
      
      const connection = await prisma.connection.findFirst({
        where: {
          id,
          teamId: context.user!.teamId!
        }
      });
      
      if (!connection) {
        throw new ORPCError('NOT_FOUND', { message: 'Connection not found' });
      }
      
      try {
        const isValid = await testPlatformConnection(
          connection.platform,
          connection.accessToken
        );
        
        // Update last sync time if successful
        if (isValid) {
          await prisma.connection.update({
            where: { id },
            data: {
              lastSync: new Date(),
              status: 'ACTIVE'
            }
          });
        }
        
        return {
          success: isValid,
          message: isValid ? 'Connection is working' : 'Connection test failed'
        };
      } catch (error) {
        logger.error('Connection test failed', {
          connectionId: id,
          error,
          requestId: context.requestId
        });
        
        return {
          success: false,
          message: 'Connection test failed'
        };
      }
    }),
  
  // Get connection health
  health: teamProcedure
    .output(z.array(ConnectionHealthSchema))
    .handler(async ({ context }) => {
      const connections = await prisma.connection.findMany({
        where: {
          teamId: context.user!.teamId!
        },
        orderBy: { createdAt: 'desc' }
      });
      
      return connections.map(conn => {
        const now = new Date();
        const expiresIn = conn.expiresAt ? conn.expiresAt.getTime() - now.getTime() : null;
        const daysSinceSync = conn.lastSync 
          ? (now.getTime() - conn.lastSync.getTime()) / (1000 * 60 * 60 * 24)
          : null;
        
        let health: 'healthy' | 'warning' | 'error' = 'healthy';
        let message: string | undefined;
        
        if (conn.status !== 'ACTIVE') {
          health = 'error';
          message = 'Connection is inactive';
        } else if (expiresIn && expiresIn < 7 * 24 * 60 * 60 * 1000) {
          health = 'warning';
          message = 'Token expires soon';
        } else if (daysSinceSync && daysSinceSync > 7) {
          health = 'warning';
          message = 'Not synced recently';
        }
        
        return {
          id: conn.id,
          platform: conn.platform as "FACEBOOK" | "INSTAGRAM" | "TWITTER" | "YOUTUBE",
          accountName: conn.accountName,
          status: conn.status as "ACTIVE" | "EXPIRED" | "DISCONNECTED" | "ERROR",
          lastSync: conn.lastSync || null,
          expiresAt: conn.expiresAt || null,
          health,
          message
        };
      });
    })
});