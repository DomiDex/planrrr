// Package: @repo/worker
// Path: apps/worker/src/publishers/types.ts
// Dependencies: @repo/database

import type { Post, Connection } from '@repo/database';

export interface ValidationResult {
  valid: boolean;
  characterCount: number;
  characterLimit: number;
  error?: string;
}

export interface SocialMediaPublisher {
  publish(post: Post, connection: Connection): Promise<string>;
  validate(content: string): ValidationResult;
  getCharacterLimit(): number;
}