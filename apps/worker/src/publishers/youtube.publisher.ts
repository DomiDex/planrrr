// Package: @repo/worker
// Path: apps/worker/src/publishers/youtube.publisher.ts
// Dependencies: @repo/database

import { BasePublisher, PublishResult, ValidationResult } from './base.publisher.js';
import type { Post, Connection } from '@repo/database';
import { oauthService } from '../services/auth/oauth.service.js';
import { rateLimiter } from '../services/rate-limiter.service.js';
import { retryService } from '../services/retry.service.js';
import { PublisherError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { YouTubeVideoUploadService } from '../services/youtube/video-upload.service.js';
import { YouTubeApiClient } from '../services/youtube/api-client.service.js';
import { YouTubeContentProcessor } from '../services/youtube/content-processor.service.js';
import { YouTubeValidator } from '../services/youtube/validator.service.js';
import fs from 'fs';

export class YouTubePublisher extends BasePublisher {
  protected platformName = 'YOUTUBE' as const;
  protected maxRetries = 3;
  protected retryDelay = 5000;

  private readonly contentProcessor: YouTubeContentProcessor;
  private readonly validator: YouTubeValidator;

  constructor() {
    super('YOUTUBE');
    this.contentProcessor = new YouTubeContentProcessor();
    this.validator = new YouTubeValidator();
  }

  async publish(post: Post, connection: Connection): Promise<PublishResult> {
    try {
      const conn = await oauthService.refreshTokenIfNeeded(connection);
      await rateLimiter.acquire('YOUTUBE');

      const videoUploadService = new YouTubeVideoUploadService(conn.accessToken);
      const apiClient = new YouTubeApiClient(conn.accessToken);

      const channelInfo = await apiClient.getChannelInfo();
      
      if (!post.mediaUrls || post.mediaUrls.length === 0) {
        throw new PublisherError(
          'NO_VIDEO',
          'YouTube requires a video file to publish'
        );
      }

      const videoPath = post.mediaUrls[0]!;
      const thumbnailPath = post.mediaUrls[1];
      
      const postMetadata = post.metadata as Record<string, unknown> | null;
      const processedContent = this.contentProcessor.processContent(
        post.content,
        postMetadata?.title as string | undefined
      );

      const videoMetadata = {
        title: processedContent.title,
        description: processedContent.description,
        tags: processedContent.tags,
        categoryId: (postMetadata?.categoryId as string) || '22',
        privacyStatus: this.getPrivacyStatus(post),
        publishAt: post.scheduledAt?.toISOString()
      };

      const result = await retryService.withRetry(
        async () => {
          const uploadResult = await videoUploadService.uploadVideo(
            videoPath,
            videoMetadata,
            (progress) => {
              logger.info(`Upload progress: ${progress}%`, {
                postId: post.id,
                progress
              });
            }
          );

          if (thumbnailPath && fs.existsSync(thumbnailPath)) {
            try {
              await videoUploadService.uploadThumbnail(
                uploadResult.videoId,
                thumbnailPath
              );
            } catch (error) {
              logger.warn('Failed to upload thumbnail', { error });
            }
          }

          const playlistId = postMetadata?.playlistId as string | undefined;
          if (playlistId) {
            try {
              await apiClient.addVideoToPlaylist(uploadResult.videoId, playlistId);
            } catch (error) {
              logger.warn('Failed to add video to playlist', { error });
            }
          }

          return uploadResult;
        },
        {
          maxAttempts: this.maxRetries,
          initialDelay: this.retryDelay
        }
      );

      logger.info('YouTube video published successfully', {
        postId: post.id,
        videoId: result.videoId,
        channelId: channelInfo.id
      });

      return {
        success: true,
        platformPostId: result.videoId,
        url: result.url,
        publishedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to publish to YouTube', {
        postId: post.id,
        error
      });

      return this.handleError(error);
    }
  }

  validate(content: string): ValidationResult {
    const processedContent = this.contentProcessor.processContent(content);
    const titleValidation = this.validator.validateTitle(processedContent.title);
    
    return {
      valid: titleValidation.valid,
      characterCount: processedContent.title.length,
      characterLimit: 100,
      errors: titleValidation.errors,
      warnings: titleValidation.warnings
    };
  }

  getCharacterLimit(): number {
    return 5000;
  }

  getMediaRequirements() {
    return this.validator.getVideoRequirements();
  }

  private getPrivacyStatus(post: Post): 'private' | 'unlisted' | 'public' {
    const metadata = post.metadata as Record<string, unknown> | null;
    const privacy = metadata?.privacy as string | undefined;
    
    if (privacy && ['private', 'unlisted', 'public'].includes(privacy)) {
      return privacy as 'private' | 'unlisted' | 'public';
    }

    if (post.scheduledAt && post.scheduledAt > new Date()) {
      return 'private';
    }

    return 'public';
  }

  private shouldRetry(error: unknown): boolean {
    if (error instanceof PublisherError) {
      return ['RATE_LIMIT', 'NETWORK_ERROR', 'QUOTA_EXCEEDED'].includes(error.code);
    }
    return false;
  }
  
  protected async refreshToken(connection: Connection): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }> {
    return oauthService.refreshAccessToken('YOUTUBE', connection.refreshToken!);
  }
}