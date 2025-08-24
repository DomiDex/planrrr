// Package: @repo/worker
// Path: apps/worker/src/publishers/x.publisher.ts
// Dependencies: @repo/database

import { BasePublisher, PublishResult, ValidationResult } from './base.publisher.js';
import type { Post, Connection } from '@repo/database';
import { oauthService } from '../services/auth/oauth.service.js';
import { rateLimiter } from '../services/rate-limiter.service.js';
import { retryService } from '../services/retry.service.js';
import { PublisherError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { XApiClient, TweetData } from '../services/x/api-client.service.js';
import { XMediaUploadService, ChunkedUploadOptions } from '../services/x/media-upload.service.js';
import { XContentFormatter } from '../services/x/content-formatter.service.js';
import { XValidator } from '../services/x/validator.service.js';
import { XAuthService } from '../services/x/auth.service.js';

export class XPublisher extends BasePublisher {
  protected platformName = 'TWITTER' as const;
  protected maxRetries = 3;
  protected retryDelay = 2000;

  private readonly apiClient: XApiClient;
  private readonly mediaUploadService: XMediaUploadService;
  private readonly contentFormatter: XContentFormatter;
  private readonly validator: XValidator;
  private readonly authService: XAuthService;

  constructor() {
    super('TWITTER');
    this.apiClient = new XApiClient();
    this.mediaUploadService = new XMediaUploadService();
    this.contentFormatter = new XContentFormatter();
    this.validator = new XValidator();
    this.authService = new XAuthService();
  }

  async publish(post: Post, connection: Connection): Promise<PublishResult> {
    try {
      const conn = await oauthService.refreshTokenIfNeeded(connection);
      await rateLimiter.acquire('TWITTER');

      const { accessToken, accessTokenSecret } = this.extractTokens(conn);

      logger.info('Publishing to X', {
        postId: post.id,
        hasMedia: !!post.mediaUrls?.length
      });

      const formattedContent = this.contentFormatter.formatContent(
        post.content,
        !!post.mediaUrls?.length
      );

      if (formattedContent.weightedLength > 280) {
        return await this.publishThread(
          post,
          accessToken,
          accessTokenSecret
        );
      }

      let mediaIds: string[] = [];
      if (post.mediaUrls && post.mediaUrls.length > 0) {
        mediaIds = await this.uploadMedia(
          post.mediaUrls,
          accessToken,
          accessTokenSecret
        );
      }

      const tweetData: TweetData = {
        text: formattedContent.text
      };

      if (mediaIds.length > 0) {
        tweetData.media = { media_ids: mediaIds };
      }

      const metadata = post.metadata as Record<string, unknown> | null;
      if (metadata?.replyToId) {
        tweetData.reply = {
          in_reply_to_tweet_id: metadata.replyToId as string
        };
      }

      const result = await retryService.withRetry(
        async () => await this.apiClient.createTweet(
          tweetData,
          accessToken,
          accessTokenSecret
        ),
        {
          maxAttempts: this.maxRetries,
          initialDelay: this.retryDelay
        }
      );

      logger.info('Tweet published successfully', {
        postId: post.id,
        tweetId: result.data.id
      });

      return {
        success: true,
        platformPostId: result.data.id,
        url: `https://x.com/status/${result.data.id}`,
        publishedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to publish to X', {
        postId: post.id,
        error
      });

      return this.handleError(error);
    }
  }

  private async publishThread(
    post: Post,
    accessToken: string,
    accessTokenSecret: string
  ): Promise<PublishResult> {
    const tweets = this.contentFormatter.splitIntoThread(post.content, {
      maxLength: 275,
      threadIndicator: true,
      numberThreads: false
    });

    const validation = this.validator.validateThread(tweets);
    if (!validation.valid) {
      throw new PublisherError(
        'THREAD_VALIDATION_ERROR',
        validation.errors.join(', ')
      );
    }

    let mediaIds: string[][] = [];
    if (post.mediaUrls && post.mediaUrls.length > 0) {
      mediaIds = [await this.uploadMedia(
        post.mediaUrls,
        accessToken,
        accessTokenSecret
      )];
    }

    const result = await this.apiClient.createThread(
      tweets,
      accessToken,
      accessTokenSecret,
      mediaIds
    );

    const firstTweetId = result.tweets[0]?.id;

    if (!firstTweetId) {
      throw new PublisherError(
        'THREAD_ERROR',
        'Failed to get first tweet ID from thread'
      );
    }

    return {
      success: true,
      platformPostId: firstTweetId,
      url: `https://x.com/status/${firstTweetId}`,
      publishedAt: new Date()
    };
  }

  private async uploadMedia(
    mediaUrls: string[],
    accessToken: string,
    accessTokenSecret: string
  ): Promise<string[]> {
    const mediaIds: string[] = [];

    for (const url of mediaUrls) {
      const isVideo = this.isVideoFile(url);
      
      if (isVideo) {
        const options: ChunkedUploadOptions = {
          filePath: url,
          mediaType: 'tweet_video',
          mediaCategory: 'tweet_video'
        };
        
        const mediaId = await this.mediaUploadService.uploadVideo(
          options,
          accessToken,
          accessTokenSecret
        );
        mediaIds.push(mediaId);
      } else {
        const mediaId = await this.mediaUploadService.uploadImage(
          url,
          accessToken,
          accessTokenSecret
        );
        mediaIds.push(mediaId);
      }
    }

    return mediaIds;
  }

  validate(content: string): ValidationResult {
    const validation = this.validator.validateTweet(content);
    
    return {
      valid: validation.valid,
      characterCount: this.contentFormatter.calculateLength(content),
      characterLimit: this.getCharacterLimit(),
      errors: validation.errors,
      warnings: validation.warnings
    };
  }

  getCharacterLimit(): number {
    return 280;
  }

  getMediaRequirements() {
    return this.validator.getMediaRequirements();
  }

  private extractTokens(connection: Connection): {
    accessToken: string;
    accessTokenSecret: string;
  } {
    const metadata = connection.metadata as Record<string, unknown>;
    const accessToken = connection.accessToken;
    const accessTokenSecret = metadata?.accessTokenSecret as string;

    if (!accessToken || !accessTokenSecret) {
      throw new PublisherError(
        'MISSING_CREDENTIALS',
        'X OAuth credentials not found in connection'
      );
    }

    return { accessToken, accessTokenSecret };
  }

  private isVideoFile(url: string): boolean {
    const videoExtensions = ['.mp4', '.mov'];
    return videoExtensions.some(ext => 
      url.toLowerCase().includes(ext)
    );
  }

  private shouldRetry(error: unknown): boolean {
    if (error instanceof PublisherError) {
      return ['RATE_LIMIT', 'NETWORK_ERROR'].includes(error.code);
    }
    return false;
  }

  protected async refreshToken(connection: Connection): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }> {
    const refreshToken = connection.refreshToken;
    
    if (!refreshToken) {
      throw new PublisherError(
        'NO_REFRESH_TOKEN',
        'X OAuth refresh token not available'
      );
    }

    const token = await this.authService.refreshOAuth2Token(refreshToken);
    
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in || 7200
    };
  }
}

// Also export as TwitterPublisher for backward compatibility
export class TwitterPublisher extends XPublisher {}