// Package: @repo/worker
// Path: apps/worker/src/services/x/media-upload.service.ts
// Dependencies: axios, form-data

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { PublisherError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { XAuthService } from './auth.service.js';

export interface MediaUploadResult {
  media_id: string;
  media_id_string: string;
  media_key?: string;
  size?: number;
  expires_after_secs?: number;
  processing_info?: {
    state: 'pending' | 'in_progress' | 'failed' | 'succeeded';
    progress_percent?: number;
    check_after_secs?: number;
    error?: {
      code: number;
      name: string;
      message: string;
    };
  };
}

export interface ChunkedUploadOptions {
  filePath: string;
  mediaType: 'tweet_image' | 'tweet_video' | 'tweet_gif';
  mediaCategory?: 'tweet_video' | 'amplify_video';
  additionalOwners?: string[];
  shared?: boolean;
}

export class XMediaUploadService {
  private readonly uploadBaseUrl = 'https://upload.twitter.com/1.1';
  private readonly chunkSize = 5 * 1024 * 1024; // 5MB chunks
  private readonly maxRetries = 10;
  private readonly statusCheckDelay = 5000;
  private authService: XAuthService;

  constructor() {
    this.authService = new XAuthService();
  }

  async uploadImage(
    filePath: string,
    accessToken: string,
    accessTokenSecret: string,
    altText?: string
  ): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    const formData = new FormData();
    formData.append('media', fileBuffer, {
      filename: 'image.jpg'
    });

    const url = `${this.uploadBaseUrl}/media/upload.json`;
    const authHeader = this.authService.generateOAuth1Header(
      'POST',
      url,
      accessToken,
      accessTokenSecret,
      {}
    );

    const response = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': authHeader
      }
    });

    const mediaId = response.data.media_id_string;

    if (altText) {
      await this.setAltText(mediaId, altText, accessToken, accessTokenSecret);
    }

    logger.info('Image uploaded to X', { mediaId });
    return mediaId;
  }

  async uploadVideo(
    options: ChunkedUploadOptions,
    accessToken: string,
    accessTokenSecret: string
  ): Promise<string> {
    const fileStats = fs.statSync(options.filePath);
    const totalBytes = fileStats.size;
    const mimeType = this.getMimeType(options.mediaType);

    const initResult = await this.initChunkedUpload(
      totalBytes,
      mimeType,
      options.mediaCategory,
      accessToken,
      accessTokenSecret
    );

    await this.appendChunks(
      options.filePath,
      initResult.media_id_string,
      accessToken,
      accessTokenSecret
    );

    const finalResult = await this.finalizeUpload(
      initResult.media_id_string,
      accessToken,
      accessTokenSecret
    );

    if (finalResult.processing_info) {
      await this.waitForProcessing(
        initResult.media_id_string,
        accessToken,
        accessTokenSecret
      );
    }

    logger.info('Video uploaded to X', { 
      mediaId: initResult.media_id_string,
      size: totalBytes 
    });

    return initResult.media_id_string;
  }

  private async initChunkedUpload(
    totalBytes: number,
    mediaType: string,
    mediaCategory: string | undefined,
    accessToken: string,
    accessTokenSecret: string
  ): Promise<MediaUploadResult> {
    const params: Record<string, string> = {
      command: 'INIT',
      total_bytes: totalBytes.toString(),
      media_type: mediaType
    };

    if (mediaCategory) {
      params.media_category = mediaCategory;
    }

    const url = `${this.uploadBaseUrl}/media/upload.json`;
    const authHeader = this.authService.generateOAuth1Header(
      'POST',
      url,
      accessToken,
      accessTokenSecret,
      params
    );

    const response = await axios.post(url, null, {
      headers: {
        'Authorization': authHeader
      },
      params
    });

    return response.data;
  }

  private async appendChunks(
    filePath: string,
    mediaId: string,
    accessToken: string,
    accessTokenSecret: string
  ): Promise<void> {
    const fileSize = fs.statSync(filePath).size;
    const totalChunks = Math.ceil(fileSize / this.chunkSize);
    const fileHandle = fs.openSync(filePath, 'r');

    try {
      for (let segmentIndex = 0; segmentIndex < totalChunks; segmentIndex++) {
        const start = segmentIndex * this.chunkSize;
        const end = Math.min(start + this.chunkSize, fileSize);
        const chunkSize = end - start;

        const buffer = Buffer.alloc(chunkSize);
        fs.readSync(fileHandle, buffer, 0, chunkSize, start);

        await this.appendChunk(
          mediaId,
          buffer,
          segmentIndex,
          accessToken,
          accessTokenSecret
        );

        logger.debug(`Uploaded chunk ${segmentIndex + 1}/${totalChunks}`, {
          mediaId,
          progress: Math.round(((segmentIndex + 1) / totalChunks) * 100)
        });
      }
    } finally {
      fs.closeSync(fileHandle);
    }
  }

  private async appendChunk(
    mediaId: string,
    chunk: Buffer,
    segmentIndex: number,
    accessToken: string,
    accessTokenSecret: string
  ): Promise<void> {
    const formData = new FormData();
    formData.append('command', 'APPEND');
    formData.append('media_id', mediaId);
    formData.append('segment_index', segmentIndex.toString());
    formData.append('media', chunk, {
      filename: 'chunk'
    });

    const url = `${this.uploadBaseUrl}/media/upload.json`;
    const authHeader = this.authService.generateOAuth1Header(
      'POST',
      url,
      accessToken,
      accessTokenSecret,
      {
        command: 'APPEND',
        media_id: mediaId,
        segment_index: segmentIndex.toString()
      }
    );

    await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': authHeader
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
  }

  private async finalizeUpload(
    mediaId: string,
    accessToken: string,
    accessTokenSecret: string
  ): Promise<MediaUploadResult> {
    const params = {
      command: 'FINALIZE',
      media_id: mediaId
    };

    const url = `${this.uploadBaseUrl}/media/upload.json`;
    const authHeader = this.authService.generateOAuth1Header(
      'POST',
      url,
      accessToken,
      accessTokenSecret,
      params
    );

    const response = await axios.post(url, null, {
      headers: {
        'Authorization': authHeader
      },
      params
    });

    return response.data;
  }

  private async waitForProcessing(
    mediaId: string,
    accessToken: string,
    accessTokenSecret: string
  ): Promise<void> {
    let attempts = 0;

    while (attempts < this.maxRetries) {
      const status = await this.checkStatus(
        mediaId,
        accessToken,
        accessTokenSecret
      );

      if (!status.processing_info) {
        return;
      }

      if (status.processing_info.state === 'succeeded') {
        return;
      }

      if (status.processing_info.state === 'failed') {
        throw new PublisherError(
          'MEDIA_PROCESSING_FAILED',
          `Media processing failed: ${status.processing_info.error?.message}`,
          { mediaId, error: status.processing_info.error }
        );
      }

      const delay = (status.processing_info.check_after_secs || 5) * 1000;
      await this.delay(Math.min(delay, this.statusCheckDelay));
      attempts++;
    }

    throw new PublisherError(
      'MEDIA_TIMEOUT',
      'Media processing timed out',
      { mediaId, attempts }
    );
  }

  private async checkStatus(
    mediaId: string,
    accessToken: string,
    accessTokenSecret: string
  ): Promise<MediaUploadResult> {
    const params = {
      command: 'STATUS',
      media_id: mediaId
    };

    const url = `${this.uploadBaseUrl}/media/upload.json`;
    const authHeader = this.authService.generateOAuth1Header(
      'GET',
      url,
      accessToken,
      accessTokenSecret,
      params
    );

    const response = await axios.get(url, {
      headers: {
        'Authorization': authHeader
      },
      params
    });

    return response.data;
  }

  private async setAltText(
    mediaId: string,
    altText: string,
    accessToken: string,
    accessTokenSecret: string
  ): Promise<void> {
    const data = {
      media_id: mediaId,
      alt_text: {
        text: altText.substring(0, 1000)
      }
    };

    const url = `${this.uploadBaseUrl}/media/metadata/create.json`;
    const authHeader = this.authService.generateOAuth1Header(
      'POST',
      url,
      accessToken,
      accessTokenSecret
    );

    await axios.post(url, JSON.stringify(data), {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });
  }

  private getMimeType(mediaType: string): string {
    switch (mediaType) {
      case 'tweet_image':
        return 'image/jpeg';
      case 'tweet_gif':
        return 'image/gif';
      case 'tweet_video':
        return 'video/mp4';
      default:
        return 'application/octet-stream';
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}