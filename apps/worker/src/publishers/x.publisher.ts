import { BasePublisher, PublishResult, ValidationResult } from './base.publisher.js';
import type { Post, Connection } from '@repo/database';

export class XPublisher extends BasePublisher {
  constructor() {
    super('TWITTER');
  }

  async publish(post: Post, _connection: Connection): Promise<PublishResult> {
    // Validate content
    const validation = this.validate(post.content);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.errors?.join(', ') || 'Validation failed',
        }
      };
    }

    try {
      // TODO: Implement actual X API integration
      // For now, return mock success
      return {
        success: true,
        platformPostId: `x_${Date.now()}`,
        url: `https://x.com/status/${Date.now()}`,
        publishedAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PUBLISH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to publish',
        }
      };
    }
  }

  validate(content: string): ValidationResult {
    const limit = this.getCharacterLimit();
    const characterCount = content.length;
    
    return {
      valid: characterCount <= limit,
      characterCount,
      characterLimit: limit,
      errors: characterCount > limit ? [`Content exceeds ${limit} character limit`] : undefined,
    };
  }

  getCharacterLimit(): number {
    return 280; // X (Twitter) character limit
  }

  protected async refreshToken(_connection: Connection): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }> {
    // TODO: Implement X OAuth token refresh
    throw new Error('Token refresh not implemented');
  }
}

// Also export as TwitterPublisher for backward compatibility
export class TwitterPublisher extends XPublisher {}