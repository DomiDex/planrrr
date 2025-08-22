// Package: @repo/api
// Path: apps/api/src/procedures/middleware/auth.middleware.ts
// Dependencies: @orpc/server, jsonwebtoken, @repo/database

import { ORPCError } from '@orpc/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@repo/database';
import { publicProcedure } from '../context.js';
import { logger } from '../../lib/logger.js';
import { loadSecrets } from '../../lib/config/secrets.js';

// JWT payload type
interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Load secrets once at module initialization
const secrets = loadSecrets();

// Verify JWT token
async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const payload = jwt.verify(token, secrets.JWT_SECRET) as JWTPayload;
    return payload;
  } catch (error) {
    logger.warn('Invalid JWT token', { error });
    return null;
  }
}

// Protected procedure - requires authentication
export const protectedProcedure = publicProcedure
  .use(async ({ context, next }) => {
    const authHeader = context.headers?.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ORPCError('UNAUTHORIZED', { message: 'Authentication required' });
    }
    
    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    const payload = await verifyToken(token);
    
    if (!payload) {
      throw new ORPCError('UNAUTHORIZED', { message: 'Invalid or expired token' });
    }
    
    // Fetch user with team
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { team: true }
    });
    
    if (!user) {
      throw new ORPCError('UNAUTHORIZED', { message: 'User not found' });
    }
    
    return next({
      context: {
        ...context,
        user,
        session: {
          id: `session_${Date.now()}`,
          userId: user.id,
          token
        }
      }
    });
  });

// Team procedure - requires team membership
export const teamProcedure = protectedProcedure
  .use(async ({ context, next }) => {
    if (!context.user?.teamId || !context.user?.team) {
      throw new ORPCError('FORBIDDEN', { message: 'Team membership required' });
    }
    
    return next({ context });
  });

// Admin procedure - requires admin role
export const adminProcedure = protectedProcedure
  .use(async ({ context, next }) => {
    // Check if user has admin role (you can customize this)
    const isAdmin = context.user?.email?.endsWith('@planrrr.io');
    
    if (!isAdmin) {
      throw new ORPCError('FORBIDDEN', { message: 'Admin access required' });
    }
    
    return next({ context });
  });