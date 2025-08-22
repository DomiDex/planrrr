// Package: @repo/api
// Path: apps/api/src/types/index.ts
// Dependencies: none

// User type from authentication
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  teamId?: string;
  tier?: 'free' | 'pro' | 'enterprise';
}

// Rate limit information
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  identifier?: string;
  procedure?: string;
}

// Extended Hono Context
export interface AppContext {
  user?: AuthUser;
  rateLimitBypassed?: boolean;
  rateLimitError?: boolean;
  rateLimit?: RateLimitInfo;
  requestId?: string;
  apiVersion?: 'v1' | 'v2';
  originalPath?: string;
  teamId?: string;
}

// ORPC Context for procedures
export interface ORPCContext {
  user?: AuthUser;
  headers?: Record<string, string>;
  ip?: string;
  rateLimitBypassed?: boolean;
  rateLimitError?: string;
  rateLimit?: RateLimitInfo;
  requestId?: string;
  teamId?: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    retryAfter?: number;
    limit?: number;
    remaining?: number;
    [key: string]: unknown;
  };
}

// Error codes
export const ERROR_CODES = {
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];