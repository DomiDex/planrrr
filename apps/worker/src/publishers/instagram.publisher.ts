// Package: @repo/worker
// Path: apps/worker/src/publishers/instagram.publisher.ts
// Dependencies: @repo/database

import { BasePublisher, PublishResult, ValidationResult } from './base.publisher.js';
import type { Post, Connection } from '@repo/database';
import { oauthService } from '../services/auth/oauth.service.js';
import { rateLimiter } from '../services/rate-limiter.service.js';
import { retryService } from '../services/retry.service.js';
import { PublisherError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { InstagramApiClient } from '../services/instagram/api-client.service.js';
import { InstagramMediaContainerService, MediaItem } from '../services/instagram/media-container.service.js';
import { InstagramContentFormatter } from '../services/instagram/content-formatter.service.js';
import { InstagramValidator } from '../services/instagram/validator.service.js';

export class InstagramPublisher extends BasePublisher {
  protected platformName = 'INSTAGRAM' as const;
  protected maxRetries = 3;
  protected retryDelay = 2000;

  private readonly apiClient: InstagramApiClient;
  private readonly mediaContainerService: InstagramMediaContainerService;
  private readonly contentFormatter: InstagramContentFormatter;
  private readonly validator: InstagramValidator;

  constructor() {
    super('INSTAGRAM');
    this.apiClient = new InstagramApiClient();
    this.mediaContainerService = new InstagramMediaContainerService();
    this.contentFormatter = new InstagramContentFormatter();
    this.validator = new InstagramValidator();
  }

  async publish(post: Post, connection: Connection): Promise<PublishResult> {
    try {
      const conn = await oauthService.refreshTokenIfNeeded(connection);
      await rateLimiter.acquire('INSTAGRAM');

      const igUserId = this.extractInstagramUserId(conn);
      const businessAccount = await this.apiClient.getBusinessAccount(
        igUserId,
        conn.accessToken
      );

      logger.info('Publishing to Instagram', {
        postId: post.id,
        accountId: businessAccount.id,
        username: businessAccount.username
      });

      const formattedContent = this.contentFormatter.formatContent(post.content);
      
      if (!post.mediaUrls || post.mediaUrls.length === 0) {
        throw new PublisherError(
          'NO_MEDIA',
          'Instagram requires at least one image or video'
        );
      }

      const mediaItems: MediaItem[] = post.mediaUrls.map(url => ({
        url,
        type: this.determineMediaType(url)
      }));

      const containerId = await retryService.withRetry(
        async () => {
          if (mediaItems.length === 1) {
            const firstItem = mediaItems[0];
            if (!firstItem) {
              throw new PublisherError('NO_MEDIA', 'No media items found');
            }
            return await this.mediaContainerService.createSingleMediaContainer(
              {
                igUserId,
                accessToken: conn.accessToken,
                caption: formattedContent.caption
              },
              firstItem
            );
          } else {
            return await this.mediaContainerService.createCarouselContainer(
              {
                igUserId,
                accessToken: conn.accessToken,
                caption: formattedContent.caption
              },
              mediaItems
            );
          }
        },
        {
          maxAttempts: this.maxRetries,
          initialDelay: this.retryDelay
        }
      );

      const publishResult = await this.mediaContainerService.publishContainer(
        igUserId,
        containerId,
        conn.accessToken
      );

      logger.info('Instagram post published successfully', {
        postId: post.id,
        instagramPostId: publishResult.id,
        permalink: publishResult.permalink
      });

      return {
        success: true,
        platformPostId: publishResult.id,
        url: publishResult.permalink || `https://www.instagram.com/p/${publishResult.id}`,
        publishedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to publish to Instagram', {
        postId: post.id,
        error
      });

      return this.handleError(error);
    }
  }

  validate(content: string): ValidationResult {
    const validation = this.validator.validateContent(content);
    
    return {
      valid: validation.valid,
      characterCount: content.length,
      characterLimit: this.getCharacterLimit(),
      errors: validation.errors,
      warnings: validation.warnings
    };
  }

  getCharacterLimit(): number {
    return 2200;
  }

  getMediaRequirements() {
    return this.validator.getMediaRequirements();
  }

  private extractInstagramUserId(connection: Connection): string {
    const metadata = connection.metadata as Record<string, unknown>;
    const igUserId = metadata?.instagramBusinessAccountId as string;

    if (!igUserId) {
      throw new PublisherError(
        'MISSING_ACCOUNT_ID',
        'Instagram Business Account ID not found in connection metadata'
      );
    }

    return igUserId;
  }

  private determineMediaType(url: string): 'IMAGE' | 'VIDEO' {
    const videoExtensions = ['.mp4', '.mov'];
    const isVideo = videoExtensions.some(ext => 
      url.toLowerCase().includes(ext)
    );
    
    return isVideo ? 'VIDEO' : 'IMAGE';
  }

  private shouldRetry(error: unknown): boolean {
    if (error instanceof PublisherError) {
      return ['RATE_LIMIT', 'NETWORK_ERROR', 'CONTAINER_ERROR'].includes(error.code);
    }
    return false;
  }

  protected async refreshToken(connection: Connection): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }> {
    return oauthService.refreshAccessToken('INSTAGRAM', connection.refreshToken!);
  }
}