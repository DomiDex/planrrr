// Package: @repo/api
// Path: apps/api/src/schemas/connection.schema.ts
// Dependencies: zod

import { z } from 'zod';

// Platform enum
export const PlatformEnum = z.enum(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'YOUTUBE']);

// Connection schemas
export const CreateConnectionSchema = z.object({
  platform: PlatformEnum,
  accountId: z.string().min(1),
  accountName: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional()
});

export const UpdateConnectionSchema = z.object({
  id: z.string().uuid(),
  accountName: z.string().min(1).optional(),
  accessToken: z.string().min(1).optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional()
});

export const ConnectionResponseSchema = z.object({
  id: z.string(),
  platform: PlatformEnum,
  accountId: z.string(),
  accountName: z.string(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'DISCONNECTED', 'ERROR']),
  teamId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date().nullable(),
  lastSync: z.date().nullable()
});

export const ListConnectionsSchema = z.object({
  teamId: z.string().uuid(),
  platform: PlatformEnum.optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'DISCONNECTED', 'ERROR']).optional()
});

export const RefreshConnectionSchema = z.object({
  id: z.string().uuid()
});

export const TestConnectionSchema = z.object({
  id: z.string().uuid()
});

// OAuth callback schema
export const OAuthCallbackSchema = z.object({
  platform: PlatformEnum,
  code: z.string(),
  state: z.string().optional(),
  error: z.string().optional()
});

// Connection health schema
export const ConnectionHealthSchema = z.object({
  id: z.string(),
  platform: PlatformEnum,
  accountName: z.string(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'DISCONNECTED', 'ERROR']),
  lastSync: z.date().nullable(),
  expiresAt: z.date().nullable(),
  health: z.enum(['healthy', 'warning', 'error']),
  message: z.string().optional()
});