// Package: @repo/api
// Path: apps/api/src/procedures/auth.procedure.ts
// Dependencies: @orpc/server, bcryptjs, jsonwebtoken, @repo/database

import { os, ORPCError } from '@orpc/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@repo/database';
import { publicProcedure } from './context.js';
import { protectedProcedure } from './middleware/auth.middleware.js';
import {
  LoginSchema,
  RegisterSchema,
  AuthResponseSchema,
  RefreshTokenSchema,
  PasswordResetRequestSchema
} from '../schemas/auth.schema.js';
import { logger } from '../lib/logger.js';
import { loadSecrets } from '../lib/config/secrets.js';

// Load secrets once at module initialization
const secrets = loadSecrets();

// Generate JWT token
function generateToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email },
    secrets.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
}

// Generate refresh token
function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'refresh' },
    secrets.JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );
}

// Auth router
export const authRouter = os.router({
  // Login procedure
  login: publicProcedure
    .input(LoginSchema)
    .output(AuthResponseSchema)
    .handler(async ({ input, context }) => {
      const { email, password } = input;
      
      // Find user
      const user = await prisma.user.findUnique({
        where: { email }
      });
      
      if (!user) {
        throw new ORPCError('UNAUTHORIZED', { message: 'Invalid credentials' });
      }
      
      // Verify password (handle null password)
      if (!user.password) {
        throw new ORPCError('UNAUTHORIZED', { message: 'Invalid credentials' });
      }
      const validPassword = await bcrypt.compare(password, user.password);
      
      if (!validPassword) {
        throw new ORPCError('UNAUTHORIZED', { message: 'Invalid credentials' });
      }
      
      // Generate tokens
      const token = generateToken(user.id, user.email);
      const refreshToken = generateRefreshToken(user.id);
      
      logger.info('User logged in', {
        userId: user.id,
        email: user.email,
        requestId: context.requestId
      });
      
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          teamId: user.teamId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        token,
        refreshToken
      };
    }),
  
  // Register procedure
  register: publicProcedure
    .input(RegisterSchema)
    .output(AuthResponseSchema)
    .handler(async ({ input, context }) => {
      const { email, password, name } = input;
      
      // Check if user exists
      const existing = await prisma.user.findUnique({
        where: { email }
      });
      
      if (existing) {
        throw new ORPCError('CONFLICT', { message: 'User already exists' });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name
        }
      });
      
      // Generate tokens
      const token = generateToken(user.id, user.email);
      const refreshToken = generateRefreshToken(user.id);
      
      logger.info('User registered', {
        userId: user.id,
        email: user.email,
        requestId: context.requestId
      });
      
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          teamId: user.teamId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        token,
        refreshToken
      };
    }),
  
  // Logout procedure
  logout: protectedProcedure
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context }) => {
      // In a real app, you might want to invalidate the token
      logger.info('User logged out', {
        userId: context.user?.id,
        requestId: context.requestId
      });
      
      return { success: true };
    }),
  
  // Get current user
  me: protectedProcedure
    .handler(async ({ context }) => {
      if (!context.user) {
        throw new ORPCError('UNAUTHORIZED', { message: 'Not authenticated' });
      }
      
      return {
        id: context.user.id,
        email: context.user.email,
        name: context.user.name,
        teamId: context.user.teamId,
        createdAt: context.user.createdAt,
        updatedAt: context.user.updatedAt
      };
    }),
  
  // Refresh token
  refresh: publicProcedure
    .input(RefreshTokenSchema)
    .output(AuthResponseSchema)
    .handler(async ({ input }) => {
      const { refreshToken } = input;
      
      try {
        const payload = jwt.verify(
          refreshToken,
          secrets.JWT_REFRESH_SECRET
        ) as { userId: string; type: string };
        
        if (payload.type !== 'refresh') {
          throw new Error('Invalid token type');
        }
        
        const user = await prisma.user.findUnique({
          where: { id: payload.userId }
        });
        
        if (!user) {
          throw new Error('User not found');
        }
        
        // Generate new tokens
        const token = generateToken(user.id, user.email);
        const newRefreshToken = generateRefreshToken(user.id);
        
        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            teamId: user.teamId,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          },
          token,
          refreshToken: newRefreshToken
        };
      } catch {
        throw new ORPCError('UNAUTHORIZED', { message: 'Invalid refresh token' });
      }
    }),
  
  // Request password reset
  requestPasswordReset: publicProcedure
    .input(PasswordResetRequestSchema)
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input }) => {
      const { email } = input;
      
      const user = await prisma.user.findUnique({
        where: { email }
      });
      
      if (user) {
        // Generate reset token (simplified - in production, send email)
        const resetToken = jwt.sign(
          { userId: user.id, type: 'reset' },
          secrets.JWT_SECRET,
          { expiresIn: '1h' }
        );
        
        logger.info('Password reset requested', {
          userId: user.id,
          email: user.email
        });
        
        // In production, send email with reset link
        console.log('Reset token:', resetToken);
      }
      
      // Always return success to prevent email enumeration
      return { success: true };
    })
});