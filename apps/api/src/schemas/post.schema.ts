// Package: @repo/api
// Path: apps/api/src/schemas/post.schema.ts
// Dependencies: zod

import { z } from 'zod';

// Platform enum
export const PlatformEnum = z.enum(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE']);

// Post status enum
export const PostStatusEnum = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED']);

// Create post schema
export const CreatePostSchema = z.object({
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
  platforms: z.array(PlatformEnum).min(1, 'At least one platform is required'),
  scheduledAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  teamId: z.string().cuid('Invalid team ID')
});

// Update post schema
export const UpdatePostSchema = z.object({
  id: z.string().cuid('Invalid post ID'),
  content: z.string().min(1).max(5000).optional(),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
  platforms: z.array(PlatformEnum).min(1).optional(),
  scheduledAt: z.string().datetime().optional().nullable().transform(val => val ? new Date(val) : null),
  status: PostStatusEnum.optional()
});

// List posts schema
export const ListPostsSchema = z.object({
  teamId: z.string().cuid('Invalid team ID'),
  status: PostStatusEnum.optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20)
});

// Post response schema
export const PostResponseSchema = z.object({
  id: z.string(),
  content: z.string(),
  mediaUrls: z.array(z.string()),
  platforms: z.array(PlatformEnum),
  status: PostStatusEnum,
  scheduledAt: z.date().nullable(),
  publishedAt: z.date().nullable(),
  userId: z.string(),
  teamId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
});

// Paginated response schema
export const PaginatedPostsSchema = z.object({
  posts: z.array(PostResponseSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number()
  })
});

// Type exports
export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;
export type ListPostsInput = z.infer<typeof ListPostsSchema>;
export type PostResponse = z.infer<typeof PostResponseSchema>;
export type PaginatedPosts = z.infer<typeof PaginatedPostsSchema>;