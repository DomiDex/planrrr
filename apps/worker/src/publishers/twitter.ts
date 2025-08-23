// Package: @repo/worker
// Path: apps/worker/src/publishers/twitter.ts
// Dependencies: @repo/database

import type { Post, Connection } from '@repo/database';
import type { SocialMediaPublisher, ValidationResult } from './types.js';

export class TwitterPublisher implements SocialMediaPublisher {
  private readonly characterLimit = 280;

  async publish(post: Post, _connection: Connection): Promise<string> {
    // TODO: Implement actual Twitter/X API integration using connection
    console.log(`Publishing to Twitter/X: ${post.content.substring(0, 100)}...`);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Return mock external ID
    return `tweet_${Date.now()}`;
  }

  validate(content: string): ValidationResult {
    const characterCount = content.length;
    const valid = characterCount <= this.characterLimit;

    return {
      valid,
      characterCount,
      characterLimit: this.characterLimit,
      ...(valid ? {} : { error: 'Content exceeds Twitter character limit' })
    };
  }

  getCharacterLimit(): number {
    return this.characterLimit;
  }
}