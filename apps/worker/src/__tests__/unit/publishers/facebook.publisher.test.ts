import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FacebookPublisher } from '../../../publishers/facebook.publisher.js';
import { 
  
  PostBuilder, 
  ConnectionBuilder,
  mockApiResponse,
  mockApiError,
  mockRateLimit,
  freezeTime,
  restoreTime
} from '../../../test-utils/index.js';
import type { Post, Connection } from '@repo/database';

describe('FacebookPublisher', () => {
  let publisher: FacebookPublisher;
  let mockPost: Post;
  let mockConnection: Connection;

  beforeEach(() => {
    publisher = new FacebookPublisher();
    
    mockPost = new PostBuilder()
      .withContent('Test Facebook post')
      .withPlatforms('FACEBOOK')
      .scheduled(new Date('2024-03-15T10:00:00Z'))
      .build();
    
    mockConnection = new ConnectionBuilder()
      .forPlatform('FACEBOOK')
      .withToken('mock_facebook_token')
      .withAccountInfo('123456789', 'Test Page')
      .active()
      .build();
    
    freezeTime('2024-03-15T10:00:00Z');
  });

  afterEach(() => {
    restoreTime();
    vi.clearAllMocks();
  });

  describe('publish', () => {
    it('should successfully publish a text post', async () => {
      mockApiResponse(
        'post',
        'https://graph.facebook.com/v18.0/123456789/feed',
        {
          id: '123456789_987654321',
          post_id: '987654321',
        }
      );

      const result = await publisher.publish(mockPost, mockConnection);

      expect(result).toEqual({
        success: true,
        platformPostId: '987654321',
        url: 'https://www.facebook.com/123456789/posts/987654321',
        publishedAt: expect.any(Date),
      });
    });

    it('should successfully publish a post with media', async () => {
      const postWithMedia = new PostBuilder()
        .withContent('Post with image')
        .withMediaUrls('https://example.com/image.jpg')
        .withPlatforms('FACEBOOK')
        .build();

      mockApiResponse(
        'post',
        'https://graph.facebook.com/v18.0/123456789/photos',
        {
          id: '123456789_photo_987654321',
          post_id: 'photo_987654321',
        }
      );

      const result = await publisher.publish(postWithMedia, mockConnection);

      expect(result).toEqual({
        success: true,
        platformPostId: 'photo_987654321',
        url: 'https://www.facebook.com/123456789/posts/photo_987654321',
        publishedAt: expect.any(Date),
      });
    });

    it('should handle rate limiting with retry', async () => {
      mockRateLimit(
        'post',
        'https://graph.facebook.com/v18.0/123456789/feed',
        60
      );

      const result = await publisher.publish(mockPost, mockConnection);

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'RATE_LIMIT',
          message: expect.stringContaining('rate limit'),
          retryAfter: 60,
        }),
      });
    });

    it('should handle API errors', async () => {
      mockApiError(
        'post',
        'https://graph.facebook.com/v18.0/123456789/feed',
        {
          message: 'Invalid OAuth access token',
          code: '190',
        },
        401
      );

      const result = await publisher.publish(mockPost, mockConnection);

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'AUTH_ERROR',
          message: expect.stringContaining('OAuth'),
        }),
      });
    });

    it('should handle expired tokens and attempt refresh', async () => {
      const expiredConnection = new ConnectionBuilder()
        .forPlatform('FACEBOOK')
        .withToken('expired_token', 'refresh_token')
        .expired()
        .build();

      // Mock token refresh
      mockApiResponse(
        'get',
        'https://graph.facebook.com/v18.0/oauth/access_token',
        {
          access_token: 'new_token',
          token_type: 'bearer',
          expires_in: 5184000,
        }
      );

      // Mock successful post with new token
      mockApiResponse(
        'post',
        'https://graph.facebook.com/v18.0/123456789/feed',
        {
          id: '123456789_987654321',
          post_id: '987654321',
        }
      );

      const result = await publisher.publish(mockPost, expiredConnection);

      expect(result.success).toBe(true);
    });

    it('should handle network errors', async () => {
      const { mockNetworkError } = await import('../../../test-utils/index.js');
      
      mockNetworkError(
        'post',
        'https://graph.facebook.com/v18.0/123456789/feed'
      );

      const result = await publisher.publish(mockPost, mockConnection);

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'NETWORK_ERROR',
          message: expect.stringContaining('network'),
        }),
      });
    });
  });

  describe('validate', () => {
    it('should validate content within character limit', () => {
      const content = 'A'.repeat(63206); // Max Facebook limit
      const result = publisher.validate(content);

      expect(result).toEqual({
        valid: true,
        errors: [],
        warnings: [],
        metadata: {
          characterCount: 63206,
          characterLimit: 63206,
        },
      });
    });

    it('should reject content exceeding character limit', () => {
      const content = 'A'.repeat(63207); // Over limit
      const result = publisher.validate(content);

      expect(result).toEqual({
        valid: false,
        errors: ['Content exceeds Facebook character limit of 63206'],
        warnings: [],
        metadata: {
          characterCount: 63207,
          characterLimit: 63206,
        },
      });
    });

    it('should validate URLs in content', () => {
      const content = 'Check out https://example.com and http://test.org';
      const result = publisher.validate(content);

      expect(result.valid).toBe(true);
      expect(result.metadata?.urlCount).toBe(2);
    });

    it('should warn about excessive hashtags', () => {
      const content = '#tag '.repeat(35); // Many hashtags
      const result = publisher.validate(content);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Consider using fewer hashtags for better engagement');
    });
  });

  describe('formatContent', () => {
    it('should preserve formatting and emojis', () => {
      const content = 'Hello World! 🎉\n\nNew paragraph here.';
      const formatted = publisher.formatContent(content);

      expect(formatted).toBe(content);
    });

    it('should handle mentions properly', () => {
      const content = 'Thanks @user for the share!';
      const formatted = publisher.formatContent(content);

      expect(formatted).toBe(content);
    });

    it('should handle line breaks correctly', () => {
      const content = 'Line 1\nLine 2\n\nParagraph 2';
      const formatted = publisher.formatContent(content);

      expect(formatted).toBe(content);
    });
  });

  describe('getMediaRequirements', () => {
    it('should return correct image requirements', () => {
      const requirements = publisher.getMediaRequirements('image');

      expect(requirements).toEqual({
        maxSize: 4 * 1024 * 1024, // 4MB
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        maxDimensions: { width: 2048, height: 2048 },
        minDimensions: { width: 200, height: 200 },
        aspectRatios: {
          square: { width: 1, height: 1 },
          landscape: { width: 1.91, height: 1 },
          portrait: { width: 4, height: 5 },
        },
      });
    });

    it('should return correct video requirements', () => {
      const requirements = publisher.getMediaRequirements('video');

      expect(requirements).toEqual({
        maxSize: 4 * 1024 * 1024 * 1024, // 4GB
        supportedFormats: ['mp4', 'mov'],
        maxDuration: 240 * 60, // 240 minutes
        minDuration: 1,
        aspectRatios: {
          square: { width: 1, height: 1 },
          landscape: { width: 16, height: 9 },
          portrait: { width: 9, height: 16 },
        },
      });
    });
  });

  describe('error handling', () => {
    it('should handle malformed API responses', async () => {
      mockApiResponse(
        'post',
        'https://graph.facebook.com/v18.0/123456789/feed',
        null, // Invalid response
        200
      );

      const result = await publisher.publish(mockPost, mockConnection);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_RESPONSE');
    });

    it('should handle missing connection data', async () => {
      const invalidConnection = new ConnectionBuilder()
        .forPlatform('FACEBOOK')
        .withToken('token')
        .build();
      
      // Remove accountId
      invalidConnection.accountId = '';

      const result = await publisher.publish(mockPost, invalidConnection);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_CONNECTION');
    });

    it('should handle timeout errors', async () => {
      vi.useFakeTimers();
      
      // Create a promise that never resolves
      mockApiResponse(
        'post',
        'https://graph.facebook.com/v18.0/123456789/feed',
        new Promise(() => {}), // Never resolves
        200
      );

      const publishPromise = publisher.publish(mockPost, mockConnection);
      
      // Advance timers to trigger timeout
      vi.advanceTimersByTime(30000);
      
      const result = await publishPromise;

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
      
      vi.useRealTimers();
    });
  });
});