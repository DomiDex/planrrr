// Package: @repo/worker
// Path: apps/worker/src/publishers/instagram.ts
// Dependencies: @repo/database

import type { Post, Connection } from '@repo/database';
import type { SocialMediaPublisher, ValidationResult } from './types.js';

export class InstagramPublisher implements SocialMediaPublisher {
  private readonly characterLimit = 2200;
  private readonly maxHashtags = 30;

  async publish(post: Post, _connection: Connection): Promise<string> {
    // TODO: Implement actual Instagram API integration via Facebook Graph API using connection
    console.log(`Publishing to Instagram: ${post.content.substring(0, 100)}...`);
    
    if (!post.mediaUrls || post.mediaUrls.length === 0) {
      throw new Error('Instagram requires at least one image or video');
    }
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Return mock external ID
    return `ig_${Date.now()}`;
  }

  validate(content: string): ValidationResult {
    const characterCount = content.length;
    const hashtagCount = (content.match(/#/g) || []).length;
    
    const errors: string[] = [];
    
    if (characterCount > this.characterLimit) {
      errors.push('Content exceeds Instagram character limit');
    }
    
    if (hashtagCount > this.maxHashtags) {
      errors.push(`Too many hashtags for Instagram (max ${this.maxHashtags})`);
    }

    return {
      valid: errors.length === 0,
      characterCount,
      characterLimit: this.characterLimit,
      ...(errors.length > 0 ? { error: errors.join(', ') } : {})
    };
  }

  getCharacterLimit(): number {
    return this.characterLimit;
  }
}