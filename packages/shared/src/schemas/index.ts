// Package: @repo/shared
// Path: packages/shared/src/schemas/index.ts
// Dependencies: zod

import { z } from 'zod';
import { PLATFORM_LIMITS, FILE_LIMITS } from '../constants';

// Common schemas
export const EmailSchema = z
  .string()
  .email('Invalid email address')
  .toLowerCase()
  .trim();

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters');

export const UUIDSchema = z
  .string()
  .uuid('Invalid UUID');

export const CUIDSchema = z
  .string()
  .regex(/^c[a-z0-9]{24}$/, 'Invalid CUID');

export const DateTimeSchema = z
  .string()
  .datetime('Invalid datetime format');

export const URLSchema = z
  .string()
  .url('Invalid URL');

// User schemas
export const UserRoleSchema = z.enum(['ADMIN', 'EDITOR', 'MEMBER']);

export const LoginSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema
});

export const RegisterSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  name: z.string().min(1).max(100),
  teamName: z.string().min(1).max(100).optional()
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: URLSchema.optional()
});

// Team schemas
export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
});

export const InviteTeamMemberSchema = z.object({
  email: EmailSchema,
  role: UserRoleSchema
});

// Platform schemas
export const PlatformSchema = z.enum(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE']);
export const PostStatusSchema = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED']);
export const PublicationStatusSchema = z.enum(['PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED']);

// Post schemas - Fixed to avoid .partial() on refined schema
const BaseCreatePostSchema = z.object({
  content: z.string()
    .min(1, 'Content is required')
    .max(PLATFORM_LIMITS.FACEBOOK, `Content must be less than ${PLATFORM_LIMITS.FACEBOOK} characters`)
    .transform(str => str.trim()),
  mediaUrls: z.array(URLSchema).max(FILE_LIMITS.MAX_IMAGES_PER_POST).optional(),
  platforms: z.array(PlatformSchema).min(1, 'At least one platform is required'),
  scheduledAt: DateTimeSchema.optional(),
  teamId: CUIDSchema
});

export const CreatePostSchema = BaseCreatePostSchema.refine(
  (data) => {
    // Validate content length for each platform
    for (const platform of data.platforms) {
      if (data.content.length > PLATFORM_LIMITS[platform]) {
        return false;
      }
    }
    return true;
  },
  {
    message: 'Content exceeds platform character limits'
  }
);

// Create UpdatePostSchema without using .partial() on refined schema
export const UpdatePostSchema = z.object({
  content: z.string()
    .min(1, 'Content is required')
    .max(PLATFORM_LIMITS.FACEBOOK, `Content must be less than ${PLATFORM_LIMITS.FACEBOOK} characters`)
    .transform(str => str.trim())
    .optional(),
  mediaUrls: z.array(URLSchema).max(FILE_LIMITS.MAX_IMAGES_PER_POST).optional(),
  platforms: z.array(PlatformSchema).min(1, 'At least one platform is required').optional(),
  scheduledAt: DateTimeSchema.optional()
});

export const SchedulePostSchema = z.object({
  scheduledAt: DateTimeSchema.refine(
    (date) => new Date(date) > new Date(),
    'Scheduled time must be in the future'
  )
});

// Connection schemas
export const ConnectPlatformSchema = z.object({
  platform: PlatformSchema,
  code: z.string().min(1),
  redirectUri: URLSchema.optional()
});

export const RefreshTokenSchema = z.object({
  connectionId: CUIDSchema
});

// AI schemas
export const GenerateCaptionSchema = z.object({
  context: z.string().min(1).max(1000),
  platform: PlatformSchema,
  tone: z.enum(['professional', 'casual', 'friendly', 'humorous']).optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  includeHashtags: z.boolean().optional(),
  includeEmojis: z.boolean().optional()
});

export const GenerateImageSchema = z.object({
  prompt: z.string().min(1).max(500),
  style: z.string().max(100).optional(),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional()
});

// Query parameter schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const GetPostsSchema = PaginationSchema.extend({
  teamId: CUIDSchema.optional(),
  status: PostStatusSchema.optional(),
  platform: PlatformSchema.optional(),
  startDate: DateTimeSchema.optional(),
  endDate: DateTimeSchema.optional()
});

export const SearchSchema = PaginationSchema.extend({
  q: z.string().min(1).max(100),
  sort: z.enum(['relevance', 'date', 'popularity']).optional()
});

// File upload schemas
export const FileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimetype: z.string().refine(
    (type) => {
      const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/quicktime'
      ];
      return allowedTypes.includes(type);
    },
    'Invalid file type'
  ),
  size: z.number().int().positive().max(FILE_LIMITS.MAX_VIDEO_SIZE)
});

// Response schemas
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
      field: z.string().optional()
    }).optional(),
    meta: z.object({
      requestId: z.string(),
      timestamp: z.string(),
      version: z.string().optional()
    }).optional()
  });

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  ApiResponseSchema(
    z.object({
      items: z.array(itemSchema),
      pagination: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        totalPages: z.number(),
        hasNext: z.boolean(),
        hasPrev: z.boolean()
      })
    })
  );

// Export type helpers
export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;
export type GenerateCaptionInput = z.infer<typeof GenerateCaptionSchema>;
export type GetPostsQuery = z.infer<typeof GetPostsSchema>;