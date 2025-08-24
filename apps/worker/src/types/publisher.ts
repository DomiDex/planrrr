import type { Post, Connection } from '@repo/database';

export interface PublishOptions {
  post: Post;
  connection: Connection;
  metadata?: Record<string, unknown>;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  url?: string;
  publishedAt?: Date;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  characterCount?: number;
  characterLimit?: number;
}

export interface MediaRequirements {
  images?: {
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    maxSizeMB?: number;
    maxSizeGB?: number;
    aspectRatios?: string[];
    formats: string[];
  };
  videos?: {
    minDuration?: number;
    maxDuration?: number;
    maxSizeMB?: number;
    maxSizeGB?: number;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    aspectRatios?: string[];
    formats: string[];
    frameRate?: {
      min: number;
      max: number;
    };
  };
  documents?: {
    maxSizeMB?: number;
    formats: string[];
  };
  maxCount?: number;
  requiresVideo?: boolean;
}