// Package: @repo/worker
// Path: apps/worker/src/publishers/facebook.publisher.ts
// Dependencies: @repo/database

import { BasePublisher, PublishResult, ValidationResult } from './base.publisher.js';
import type { Post, Connection } from '@repo/database';
import { oauthService } from '../services/auth/oauth.service.js';
import { rateLimiter } from '../services/rate-limiter.service.js';
import { retryService } from '../services/retry.service.js';
import { PublisherError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { FacebookMediaUploadService } from '../services/facebook/media-upload.service.js';
import { FacebookApiClient } from '../services/facebook/api-client.service.js';
import { FacebookContentFormatter } from '../services/facebook/content-formatter.service.js';
import { FacebookValidator } from '../services/facebook/validator.service.js';

export class FacebookPublisher extends BasePublisher {
  protected platformName = 'FACEBOOK' as const;
  protected maxRetries = 3;
  protected retryDelay = 2000;
  
  private readonly mediaUploadService: FacebookMediaUploadService;
  private readonly apiClient: FacebookApiClient;
  private readonly contentFormatter: FacebookContentFormatter;
  private readonly validator: FacebookValidator;

  constructor() {
    super('FACEBOOK');
    this.mediaUploadService = new FacebookMediaUploadService();
    this.apiClient = new FacebookApiClient();
    this.contentFormatter = new FacebookContentFormatter();
    this.validator = new FacebookValidator();
  }

  async publish(post: Post, connection: Connection): Promise<PublishResult> {
    try {
      const conn = await oauthService.refreshTokenIfNeeded(connection);
      await rateLimiter.acquire('FACEBOOK');
      
      const pageId = this.extractPageId(conn);
      const formattedContent = this.contentFormatter.formatContent(post.content);
      
      const publishData: Record<string, unknown> = {
        message: formattedContent.message
      };

      if (formattedContent.link) {
        const metadata = post.metadata as Record<string, unknown> | null;
        const linkAttachment = this.contentFormatter.createLinkAttachment(
          formattedContent.link,
          metadata?.linkTitle as string | undefined,
          metadata?.linkDescription as string | undefined
        );
        Object.assign(publishData, linkAttachment);
      }

      if (post.mediaUrls && post.mediaUrls.length > 0) {
        const mediaData = await this.uploadMedia(
          pageId,
          conn.accessToken,
          post.mediaUrls
        );
        Object.assign(publishData, mediaData);
      }

      const result = await retryService.withRetry(
        async () => {
          if (post.scheduledAt && post.scheduledAt > new Date()) {
            const scheduledTime = Math.floor(post.scheduledAt.getTime() / 1000);
            return await this.apiClient.schedulePost(
              pageId,
              conn.accessToken,
              publishData,
              scheduledTime
            );
          }
          return await this.apiClient.createPost(
            pageId,
            conn.accessToken,
            publishData
          );
        },
        {
          maxAttempts: this.maxRetries,
          initialDelay: this.retryDelay
        }
      );

      logger.info('Facebook post published successfully', {
        postId: post.id,
        facebookPostId: result.id
      });

      return {
        success: true,
        platformPostId: result.id,
        url: `https://facebook.com/${result.id}`,
        publishedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to publish to Facebook', {
        postId: post.id,
        error
      });

      return this.handleError(error);
    }
  }

  validate(content: string): ValidationResult {
    const contentValidation = this.validator.validateContent(content);
    
    return {
      valid: contentValidation.valid,
      characterCount: content.length,
      characterLimit: this.getCharacterLimit(),
      errors: contentValidation.errors,
      warnings: contentValidation.warnings
    };
  }

  getCharacterLimit(): number {
    return 63206;
  }

  getMediaRequirements() {
    return this.validator.getMediaRequirements();
  }

  private async uploadMedia(
    pageId: string,
    accessToken: string,
    mediaUrls: string[]
  ): Promise<Record<string, unknown>> {
    if (!mediaUrls[0]) {
      throw new PublisherError('NO_MEDIA', 'No media files provided');
    }
    
    const isVideo = mediaUrls[0].match(/\.(mp4|mov|avi)$/i);
    
    if (isVideo) {
      this.mediaUploadService.validateMediaFile(mediaUrls[0], 'video');
      const result = await this.mediaUploadService.uploadVideo(
        pageId,
        accessToken,
        mediaUrls[0]
      );
      return { attached_media: [{ media_fbid: result.id }] };
    }

    if (mediaUrls.length === 1) {
      this.mediaUploadService.validateMediaFile(mediaUrls[0], 'image');
      const result = await this.mediaUploadService.uploadImage(
        pageId,
        accessToken,
        mediaUrls[0]
      );
      return { attached_media: [{ media_fbid: result.id }] };
    }

    const carouselItems = await this.mediaUploadService.createCarousel(
      pageId,
      accessToken,
      mediaUrls
    );
    return { attached_media: carouselItems };
  }

  private extractPageId(connection: Connection): string {
    const metadata = connection.metadata as Record<string, unknown>;
    const pageId = metadata?.pageId as string;

    if (!pageId) {
      throw new PublisherError(
        'MISSING_PAGE_ID',
        'Facebook page ID not found in connection metadata'
      );
    }

    return pageId;
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
    return oauthService.refreshAccessToken('FACEBOOK', connection.refreshToken!);
  }
}