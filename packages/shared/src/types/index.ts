// Package: @repo/shared
// Path: packages/shared/src/types/index.ts
// Dependencies: none

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  field?: string;
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;
  version?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// User & Authentication Types
export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  teamId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'ADMIN' | 'EDITOR' | 'MEMBER';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface Session {
  user: User;
  tokens: AuthTokens;
}

// Team Types
export interface Team {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface TeamMember extends User {
  team: Team;
}

// Post Types
export interface Post {
  id: string;
  content: string;
  mediaUrls: string[];
  status: PostStatus;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  platforms: Platform[];
  authorId: string;
  author?: User;
  teamId: string;
  team?: Team;
  publications?: Publication[];
  createdAt: Date;
  updatedAt: Date;
}

export type PostStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
export type Platform = 'FACEBOOK' | 'INSTAGRAM' | 'TWITTER' | 'YOUTUBE';

// Publication Types
export interface Publication {
  id: string;
  postId: string;
  post?: Post;
  platform: Platform;
  externalId: string | null;
  status: PublicationStatus;
  error: string | null;
  publishedAt: Date | null;
  metrics: Record<string, unknown> | null;
}

export type PublicationStatus = 'PENDING' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';

// Connection Types
export interface Connection {
  id: string;
  teamId: string;
  team?: Team;
  platform: Platform;
  accountName?: string;
  accountId?: string;
  expiresAt: Date | null;
  createdAt: Date;
}

// Request Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  teamName?: string;
}

export interface CreatePostRequest {
  content: string;
  mediaUrls?: string[];
  platforms: Platform[];
  scheduledAt?: string;
  teamId: string;
}

export interface UpdatePostRequest {
  content?: string;
  mediaUrls?: string[];
  platforms?: Platform[];
  scheduledAt?: string;
}

export interface SchedulePostRequest {
  scheduledAt: string;
}

export interface GetPostsParams {
  teamId?: string;
  status?: PostStatus;
  platform?: Platform;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

// AI Types
export interface GenerateCaptionRequest {
  context: string;
  platform: Platform;
  tone?: 'professional' | 'casual' | 'friendly' | 'humorous';
  length?: 'short' | 'medium' | 'long';
  includeHashtags?: boolean;
  includeEmojis?: boolean;
}

export interface GenerateImageRequest {
  prompt: string;
  style?: string;
  width?: number;
  height?: number;
}

// Job Types
export interface PublishJobData {
  postId: string;
  platform: Platform;
  retryCount?: number;
}

export interface JobResult {
  success: boolean;
  externalId?: string;
  error?: string;
  metrics?: Record<string, unknown>;
}

// WebSocket Event Types
export interface WebSocketEvent {
  type: WebSocketEventType;
  payload: unknown;
  timestamp: string;
}

export type WebSocketEventType = 
  | 'post.created'
  | 'post.updated'
  | 'post.deleted'
  | 'post.published'
  | 'post.failed'
  | 'connection.added'
  | 'connection.removed'
  | 'team.updated';

// Error Codes
export const ErrorCodes = {
  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Authorization
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Business Logic
  INVALID_PLATFORM: 'INVALID_PLATFORM',
  CONTENT_TOO_LONG: 'CONTENT_TOO_LONG',
  INVALID_SCHEDULE_TIME: 'INVALID_SCHEDULE_TIME',
  CONNECTION_EXPIRED: 'CONNECTION_EXPIRED',
  PUBLISH_FAILED: 'PUBLISH_FAILED'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];