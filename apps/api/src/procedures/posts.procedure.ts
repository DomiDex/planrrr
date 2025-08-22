// Package: @repo/api
// Path: apps/api/src/procedures/posts.procedure.ts
// Dependencies: @orpc/server, @repo/database

import { os, ORPCError } from '@orpc/server';
import { z } from 'zod';
import { prisma } from '@repo/database';
import { teamProcedure } from './middleware/auth.middleware.js';
import {
  CreatePostSchema,
  UpdatePostSchema,
  ListPostsSchema,
  PaginatedPostsSchema,
  PostResponseSchema
} from '../schemas/post.schema.js';
import { logger } from '../lib/logger.js';
import { validatePlatformContent } from '../lib/validators.js';

// Posts router
export const postsRouter = os.router({
  // List posts
  list: teamProcedure
    .input(ListPostsSchema)
    .output(PaginatedPostsSchema)
    .handler(async ({ input, context }) => {
      const { teamId, status, page, limit } = input;
      const offset = (page - 1) * limit;
      
      // Verify team access
      if (context.user?.teamId !== teamId) {
        throw new ORPCError('FORBIDDEN', { message: 'Access denied to this team' });
      }
      
      // Fetch posts
      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where: {
            teamId,
            ...(status && { status })
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit
        }),
        prisma.post.count({
          where: {
            teamId,
            ...(status && { status })
          }
        })
      ]);
      
      return {
        posts: posts.map(post => ({
          ...post,
          platforms: post.platforms as ("FACEBOOK" | "INSTAGRAM" | "TWITTER" | "YOUTUBE")[],
          status: post.status as "DRAFT" | "SCHEDULED" | "PUBLISHED" | "FAILED"
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    }),
  
  // Get single post
  get: teamProcedure
    .input(z.string())
    .output(PostResponseSchema)
    .handler(async ({ input: id, context }) => {
      const post = await prisma.post.findFirst({
        where: {
          id,
          teamId: context.user!.teamId!
        }
      });
      
      if (!post) {
        throw new ORPCError('NOT_FOUND', { message: 'Post not found' });
      }
      
      return {
        ...post,
        platforms: post.platforms as ("FACEBOOK" | "INSTAGRAM" | "TWITTER" | "YOUTUBE")[],
        status: post.status as "DRAFT" | "SCHEDULED" | "PUBLISHED" | "FAILED"
      };
    }),
  
  // Create post
  create: teamProcedure
    .input(CreatePostSchema)
    .output(PostResponseSchema)
    .handler(async ({ input, context }) => {
      const { content, mediaUrls, platforms, scheduledAt, teamId } = input;
      
      // Verify team access
      if (context.user?.teamId !== teamId) {
        throw new ORPCError('FORBIDDEN', { message: 'Access denied to this team' });
      }
      
      // Validate content for platforms
      for (const platform of platforms) {
        const validation = validatePlatformContent(content, platform);
        if (!validation.valid) {
          throw new ORPCError('BAD_REQUEST', { message: validation.error || 'Invalid content for platform' });
        }
      }
      
      // Create post
      const post = await prisma.post.create({
        data: {
          content,
          mediaUrls: mediaUrls || [],
          platforms,
          status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
          scheduledAt,
          userId: context.user!.id,
          teamId
        }
      });
      
      logger.info('Post created', {
        postId: post.id,
        userId: context.user?.id,
        teamId,
        requestId: context.requestId
      });
      
      // TODO: Queue for publishing if scheduled
      
      return {
        ...post,
        platforms: post.platforms as ("FACEBOOK" | "INSTAGRAM" | "TWITTER" | "YOUTUBE")[],
        status: post.status as "DRAFT" | "SCHEDULED" | "PUBLISHED" | "FAILED"
      };
    }),
  
  // Update post
  update: teamProcedure
    .input(UpdatePostSchema)
    .output(PostResponseSchema)
    .handler(async ({ input, context }) => {
      const { id, ...updateData } = input;
      
      // Verify post ownership
      const existing = await prisma.post.findFirst({
        where: {
          id,
          teamId: context.user!.teamId!
        }
      });
      
      if (!existing) {
        throw new ORPCError('NOT_FOUND', { message: 'Post not found' });
      }
      
      // Validate content if platforms changed
      if (updateData.content && updateData.platforms) {
        for (const platform of updateData.platforms) {
          const validation = validatePlatformContent(updateData.content, platform);
          if (!validation.valid) {
            throw new ORPCError('BAD_REQUEST', { message: validation.error || 'Invalid content for platform' });
          }
        }
      }
      
      // Update post
      const post = await prisma.post.update({
        where: { id },
        data: {
          ...updateData,
          status: updateData.scheduledAt ? 'SCHEDULED' : existing.status
        }
      });
      
      logger.info('Post updated', {
        postId: post.id,
        userId: context.user?.id,
        requestId: context.requestId
      });
      
      return {
        ...post,
        platforms: post.platforms as ("FACEBOOK" | "INSTAGRAM" | "TWITTER" | "YOUTUBE")[],
        status: post.status as "DRAFT" | "SCHEDULED" | "PUBLISHED" | "FAILED"
      };
    }),
  
  // Delete post
  delete: teamProcedure
    .input(z.string())
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input: id, context }) => {
      // Verify post ownership
      const post = await prisma.post.findFirst({
        where: {
          id,
          teamId: context.user!.teamId!
        }
      });
      
      if (!post) {
        throw new ORPCError('NOT_FOUND', { message: 'Post not found' });
      }
      
      // Delete post
      await prisma.post.delete({
        where: { id }
      });
      
      logger.info('Post deleted', {
        postId: id,
        userId: context.user?.id,
        requestId: context.requestId
      });
      
      return { success: true };
    }),
  
  // Publish post immediately
  publish: teamProcedure
    .input(z.string())
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input: id, context }) => {
      const post = await prisma.post.findFirst({
        where: {
          id,
          teamId: context.user!.teamId!
        }
      });
      
      if (!post) {
        throw new ORPCError('NOT_FOUND', { message: 'Post not found' });
      }
      
      // TODO: Trigger immediate publishing via worker
      
      await prisma.post.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date()
        }
      });
      
      logger.info('Post published', {
        postId: id,
        userId: context.user?.id,
        requestId: context.requestId
      });
      
      return { success: true };
    })
});