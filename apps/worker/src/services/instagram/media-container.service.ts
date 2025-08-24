// Package: @repo/worker
// Path: apps/worker/src/services/instagram/media-container.service.ts
// Dependencies: @repo/database

import { InstagramApiClient, InstagramContainer } from './api-client.service.js';
import { PublisherError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

export interface MediaContainerOptions {
  igUserId: string;
  accessToken: string;
  caption?: string;
}

export interface MediaItem {
  url: string;
  type: 'IMAGE' | 'VIDEO';
  thumbnailUrl?: string;
}

export class InstagramMediaContainerService {
  private readonly apiClient: InstagramApiClient;
  private readonly maxRetries = 30;
  private readonly retryDelay = 2000;

  constructor() {
    this.apiClient = new InstagramApiClient();
  }

  async createSingleMediaContainer(
    options: MediaContainerOptions,
    media: MediaItem
  ): Promise<string> {
    logger.info('Creating Instagram media container', {
      igUserId: options.igUserId,
      mediaType: media.type
    });

    let container: InstagramContainer;

    if (media.type === 'VIDEO') {
      container = await this.apiClient.createVideoContainer(
        options.igUserId,
        options.accessToken,
        media.url,
        options.caption,
        media.thumbnailUrl
      );
    } else {
      container = await this.apiClient.createMediaContainer(
        options.igUserId,
        options.accessToken,
        media.url,
        options.caption
      );
    }

    await this.waitForContainerReady(container.id, options.accessToken);
    return container.id;
  }

  async createCarouselContainer(
    options: MediaContainerOptions,
    mediaItems: MediaItem[]
  ): Promise<string> {
    if (mediaItems.length < 2 || mediaItems.length > 10) {
      throw new PublisherError(
        'INVALID_CAROUSEL',
        'Instagram carousel must have between 2 and 10 items'
      );
    }

    logger.info('Creating Instagram carousel container', {
      igUserId: options.igUserId,
      itemCount: mediaItems.length
    });

    const childContainerIds: string[] = [];

    for (const [index, media] of mediaItems.entries()) {
      logger.info(`Creating carousel item ${index + 1}/${mediaItems.length}`);
      
      const childContainer = media.type === 'VIDEO'
        ? await this.apiClient.createVideoContainer(
            options.igUserId,
            options.accessToken,
            media.url,
            undefined,
            media.thumbnailUrl
          )
        : await this.apiClient.createMediaContainer(
            options.igUserId,
            options.accessToken,
            media.url
          );

      await this.waitForContainerReady(childContainer.id, options.accessToken);
      childContainerIds.push(childContainer.id);
    }

    const carouselContainer = await this.apiClient.createCarouselContainer(
      options.igUserId,
      options.accessToken,
      childContainerIds,
      options.caption
    );

    await this.waitForContainerReady(carouselContainer.id, options.accessToken);
    return carouselContainer.id;
  }

  async publishContainer(
    igUserId: string,
    containerId: string,
    accessToken: string
  ): Promise<{ id: string; permalink?: string }> {
    logger.info('Publishing Instagram container', { containerId });

    const result = await this.apiClient.publishContainer(
      igUserId,
      containerId,
      accessToken
    );

    logger.info('Instagram container published successfully', {
      mediaId: result.id,
      permalink: result.permalink
    });

    return result;
  }

  private async waitForContainerReady(
    containerId: string,
    accessToken: string
  ): Promise<void> {
    let attempts = 0;

    while (attempts < this.maxRetries) {
      const status = await this.apiClient.getContainerStatus(
        containerId,
        accessToken
      );

      logger.debug(`Container ${containerId} status: ${status.status}`, {
        attempt: attempts + 1,
        statusCode: status.status_code
      });

      if (status.status === 'FINISHED') {
        return;
      }

      if (status.status === 'ERROR') {
        throw new PublisherError(
          'CONTAINER_ERROR',
          `Media container processing failed: ${status.status_code}`,
          { containerId, statusCode: status.status_code }
        );
      }

      if (status.status === 'PUBLISHED') {
        throw new PublisherError(
          'ALREADY_PUBLISHED',
          'Container has already been published',
          { containerId }
        );
      }

      attempts++;
      await this.delay(this.retryDelay);
    }

    throw new PublisherError(
      'CONTAINER_TIMEOUT',
      'Media container processing timed out',
      { containerId, attempts }
    );
  }

  validateMediaUrl(url: string): void {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new PublisherError(
        'INVALID_MEDIA_URL',
        'Media URL must be publicly accessible via HTTP/HTTPS'
      );
    }

    const supportedFormats = ['.jpg', '.jpeg', '.png', '.mp4', '.mov'];
    const hasValidFormat = supportedFormats.some(format => 
      url.toLowerCase().includes(format)
    );

    if (!hasValidFormat) {
      throw new PublisherError(
        'UNSUPPORTED_FORMAT',
        'Instagram only supports JPEG images and MP4/MOV videos'
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}