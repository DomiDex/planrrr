// Package: @repo/worker
// Path: apps/worker/src/publishers/linkedin.publisher.ts
// Dependencies: @repo/database

import { BasePublisher, PublishResult, ValidationResult } from './base.publisher.js';
import type { Post, Connection } from '@repo/database';
import { oauthService } from '../services/auth/oauth.service.js';
import { rateLimiter } from '../services/rate-limiter.service.js';
import { retryService } from '../services/retry.service.js';
import { PublisherError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { LinkedInApiClient, LinkedInShareContent } from '../services/linkedin/api-client.service.js';
import { LinkedInMediaUploadService } from '../services/linkedin/media-upload.service.js';
import { LinkedInContentProcessor } from '../services/linkedin/content-processor.service.js';
import { LinkedInValidator } from '../services/linkedin/validator.service.js';

export class LinkedInPublisher extends BasePublisher {
  protected platformName = 'LINKEDIN' as const;
  protected maxRetries = 3;
  protected retryDelay = 2000;

  private readonly apiClient: LinkedInApiClient;
  private readonly mediaUploadService: LinkedInMediaUploadService;
  private readonly contentProcessor: LinkedInContentProcessor;
  private readonly validator: LinkedInValidator;
  private readonly apiVersion: string;

  constructor() {
    super('LINKEDIN');
    this.apiVersion = process.env.LINKEDIN_API_VERSION || '202411';
    this.apiClient = new LinkedInApiClient(this.apiVersion);
    this.mediaUploadService = new LinkedInMediaUploadService(this.apiVersion);
    this.contentProcessor = new LinkedInContentProcessor();
    this.validator = new LinkedInValidator();
  }

  async publish(post: Post, connection: Connection): Promise<PublishResult> {
    try {
      const conn = await oauthService.refreshTokenIfNeeded(connection);
      await rateLimiter.acquire('LINKEDIN');

      const authorUrn = this.extractAuthorUrn(conn);
      const isOrganization = authorUrn.includes('organization');

      logger.info('Publishing to LinkedIn', {
        postId: post.id,
        authorUrn,
        isOrganization,
        apiVersion: this.apiVersion
      });

      const postMetadata = post.metadata as Record<string, unknown> | null;
      const processedContent = this.contentProcessor.processContent(
        post.content,
        postMetadata?.articleUrl as string | undefined,
        postMetadata?.articleTitle as string | undefined,
        postMetadata?.articleDescription as string | undefined
      );

      const postType = this.contentProcessor.determinePostType(
        post.content,
        post.mediaUrls,
        postMetadata?.articleUrl as string | undefined
      );

      const shareContent: LinkedInShareContent = {
        shareCommentary: {
          text: processedContent.text
        },
        shareMediaCategory: 'NONE'
      };

      if (post.mediaUrls && post.mediaUrls.length > 0) {
        const uploadedMedia = await this.uploadMedia(
          authorUrn,
          conn.accessToken,
          post.mediaUrls,
          postType.type
        );

        shareContent.shareMediaCategory = postType.type as 'IMAGE' | 'VIDEO';
        shareContent.media = uploadedMedia.map(media => ({
          status: 'READY',
          media: media.asset
        }));
      } else if (processedContent.articleData) {
        shareContent.shareMediaCategory = 'ARTICLE';
        shareContent.media = [{
          status: 'READY',
          media: processedContent.articleData.url,
          title: {
            text: processedContent.articleData.title
          },
          description: {
            text: processedContent.articleData.description
          }
        }];
      }

      const result = await retryService.withRetry(
        async () => {
          if (this.shouldUseNewApi()) {
            return await this.apiClient.createPost(
              authorUrn,
              shareContent,
              conn.accessToken
            );
          } else {
            return await this.apiClient.createUgcPost(
              authorUrn,
              shareContent,
              conn.accessToken
            );
          }
        },
        {
          maxAttempts: this.maxRetries,
          initialDelay: this.retryDelay
        }
      );

      logger.info('LinkedIn post published successfully', {
        postId: post.id,
        linkedInPostId: result.id
      });

      return {
        success: true,
        platformPostId: result.id,
        url: `https://www.linkedin.com/feed/update/${result.id}`,
        publishedAt: new Date(result.createdAt)
      };
    } catch (error) {
      logger.error('Failed to publish to LinkedIn', {
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
    return 3000;
  }

  getMediaRequirements() {
    return this.validator.getMediaRequirements();
  }

  private async uploadMedia(
    ownerUrn: string,
    accessToken: string,
    mediaUrls: string[],
    mediaType: string
  ) {
    const uploadOptions = {
      ownerUrn,
      accessToken,
      mediaType: mediaType as 'IMAGE' | 'VIDEO' | 'DOCUMENT'
    };

    if (mediaType === 'IMAGE') {
      return await this.mediaUploadService.uploadMultipleImages(
        mediaUrls,
        uploadOptions
      );
    }

    const uploadedMedia = [];
    for (const url of mediaUrls) {
      const media = await this.mediaUploadService.uploadFromUrl(
        url,
        uploadOptions
      );
      uploadedMedia.push(media);
    }

    return uploadedMedia;
  }

  private extractAuthorUrn(connection: Connection): string {
    const metadata = connection.metadata as Record<string, unknown>;
    
    if (metadata?.organizationId) {
      return `urn:li:organization:${metadata.organizationId}`;
    }
    
    if (metadata?.personId) {
      return `urn:li:person:${metadata.personId}`;
    }

    throw new PublisherError(
      'MISSING_AUTHOR',
      'LinkedIn author URN not found in connection metadata'
    );
  }

  private shouldUseNewApi(): boolean {
    const versionNum = parseInt(this.apiVersion);
    return versionNum >= 202209;
  }

  private shouldRetry(error: unknown): boolean {
    if (error instanceof PublisherError) {
      return ['RATE_LIMIT', 'NETWORK_ERROR', 'MEDIA_TIMEOUT'].includes(error.code);
    }
    return false;
  }

  protected async refreshToken(connection: Connection): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }> {
    return oauthService.refreshAccessToken('LINKEDIN', connection.refreshToken!);
  }
}