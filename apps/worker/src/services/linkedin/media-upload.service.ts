// Package: @repo/worker
// Path: apps/worker/src/services/linkedin/media-upload.service.ts
// Dependencies: axios

import axios from 'axios';
import fs from 'fs';
import { LinkedInApiClient } from './api-client.service.js';
import { PublisherError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

export interface UploadedMedia {
  asset: string;
  mediaArtifact?: string;
}

export interface MediaUploadOptions {
  ownerUrn: string;
  accessToken: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
}

export class LinkedInMediaUploadService {
  private readonly apiClient: LinkedInApiClient;
  private readonly maxRetries = 30;
  private readonly retryDelay = 2000;
  private readonly chunkSize = 4 * 1024 * 1024; // 4MB chunks for video

  constructor(apiVersion?: string) {
    this.apiClient = new LinkedInApiClient(apiVersion);
  }

  async uploadImage(
    filePath: string,
    options: MediaUploadOptions
  ): Promise<UploadedMedia> {
    logger.info('Starting LinkedIn image upload', { filePath });

    const { uploadUrl, asset } = await this.apiClient.registerUpload(
      options.ownerUrn,
      options.accessToken,
      'IMAGE'
    );

    const fileBuffer = fs.readFileSync(filePath);
    await this.uploadBinary(uploadUrl, fileBuffer, options.accessToken);

    await this.waitForAssetReady(asset, options.accessToken);

    logger.info('LinkedIn image upload completed', { asset });
    return { asset };
  }

  async uploadVideo(
    filePath: string,
    options: MediaUploadOptions
  ): Promise<UploadedMedia> {
    logger.info('Starting LinkedIn video upload', { filePath });

    const { uploadUrl, asset } = await this.apiClient.registerUpload(
      options.ownerUrn,
      options.accessToken,
      'VIDEO'
    );

    const fileStats = fs.statSync(filePath);
    
    if (fileStats.size < this.chunkSize) {
      const fileBuffer = fs.readFileSync(filePath);
      await this.uploadBinary(uploadUrl, fileBuffer, options.accessToken);
    } else {
      await this.uploadVideoInChunks(uploadUrl, filePath, options.accessToken);
    }

    await this.waitForAssetReady(asset, options.accessToken);

    logger.info('LinkedIn video upload completed', { asset });
    return { asset };
  }

  async uploadDocument(
    filePath: string,
    options: MediaUploadOptions
  ): Promise<UploadedMedia> {
    logger.info('Starting LinkedIn document upload', { filePath });

    const { uploadUrl, asset } = await this.apiClient.registerUpload(
      options.ownerUrn,
      options.accessToken,
      'DOCUMENT'
    );

    const fileBuffer = fs.readFileSync(filePath);
    await this.uploadBinary(uploadUrl, fileBuffer, options.accessToken);

    await this.waitForAssetReady(asset, options.accessToken);

    logger.info('LinkedIn document upload completed', { asset });
    return { asset };
  }

  async uploadFromUrl(
    mediaUrl: string,
    options: MediaUploadOptions
  ): Promise<UploadedMedia> {
    logger.info('Uploading media from URL to LinkedIn', { mediaUrl });

    const response = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      maxContentLength: 100 * 1024 * 1024,
      timeout: 30000
    });

    const buffer = Buffer.from(response.data);
    const mediaType = this.detectMediaType(
      response.headers['content-type'] || '',
      mediaUrl
    );

    const { uploadUrl, asset } = await this.apiClient.registerUpload(
      options.ownerUrn,
      options.accessToken,
      mediaType
    );

    await this.uploadBinary(uploadUrl, buffer, options.accessToken);
    await this.waitForAssetReady(asset, options.accessToken);

    logger.info('LinkedIn media upload from URL completed', { asset });
    return { asset };
  }

  async uploadMultipleImages(
    imagePaths: string[],
    options: MediaUploadOptions
  ): Promise<UploadedMedia[]> {
    const uploadedMedia: UploadedMedia[] = [];

    for (const [index, imagePath] of imagePaths.entries()) {
      logger.info(`Uploading image ${index + 1}/${imagePaths.length}`);
      const media = await this.uploadImage(imagePath, options);
      uploadedMedia.push(media);
    }

    return uploadedMedia;
  }

  private async uploadBinary(
    uploadUrl: string,
    buffer: Buffer,
    accessToken: string
  ): Promise<void> {
    await axios.put(uploadUrl, buffer, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream'
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
  }

  private async uploadVideoInChunks(
    uploadUrl: string,
    filePath: string,
    accessToken: string
  ): Promise<void> {
    const fileSize = fs.statSync(filePath).size;
    const totalChunks = Math.ceil(fileSize / this.chunkSize);
    const fileStream = fs.createReadStream(filePath, {
      highWaterMark: this.chunkSize
    });

    let chunkIndex = 0;
    
    for await (const chunk of fileStream) {
      const start = chunkIndex * this.chunkSize;
      const end = Math.min(start + chunk.length - 1, fileSize - 1);
      
      logger.info(`Uploading video chunk ${chunkIndex + 1}/${totalChunks}`, {
        start,
        end,
        total: fileSize
      });

      await axios.put(uploadUrl, chunk, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Content-Range': `bytes ${start}-${end}/${fileSize}`
        }
      });

      chunkIndex++;
    }
  }

  private async waitForAssetReady(
    assetId: string,
    accessToken: string
  ): Promise<void> {
    let attempts = 0;

    while (attempts < this.maxRetries) {
      const { status } = await this.apiClient.checkAssetStatus(
        assetId,
        accessToken
      );

      logger.debug(`Asset ${assetId} status: ${status}`, {
        attempt: attempts + 1
      });

      if (status === 'AVAILABLE') {
        return;
      }

      if (status === 'PROCESSING_FAILED' || status === 'FAILED') {
        throw new PublisherError(
          'MEDIA_PROCESSING_FAILED',
          `LinkedIn media processing failed with status: ${status}`,
          { assetId, status }
        );
      }

      attempts++;
      await this.delay(this.retryDelay);
    }

    throw new PublisherError(
      'MEDIA_TIMEOUT',
      'LinkedIn media processing timed out',
      { assetId, attempts }
    );
  }

  private detectMediaType(
    contentType: string,
    url: string
  ): 'IMAGE' | 'VIDEO' | 'DOCUMENT' {
    if (contentType.startsWith('image/')) {
      return 'IMAGE';
    }
    
    if (contentType.startsWith('video/')) {
      return 'VIDEO';
    }
    
    if (contentType.includes('pdf')) {
      return 'DOCUMENT';
    }

    const extension = url.toLowerCase().split('.').pop() || '';
    
    if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
      return 'IMAGE';
    }
    
    if (['mp4', 'mov', 'avi'].includes(extension)) {
      return 'VIDEO';
    }
    
    if (['pdf', 'doc', 'docx'].includes(extension)) {
      return 'DOCUMENT';
    }

    return 'IMAGE';
  }

  validateMediaFile(filePath: string, expectedType: 'IMAGE' | 'VIDEO'): void {
    if (!fs.existsSync(filePath)) {
      throw new PublisherError(
        'FILE_NOT_FOUND',
        `Media file not found: ${filePath}`
      );
    }

    const stats = fs.statSync(filePath);
    const maxSizes = {
      IMAGE: 10 * 1024 * 1024,
      VIDEO: 5 * 1024 * 1024 * 1024
    };

    if (stats.size > maxSizes[expectedType]) {
      throw new PublisherError(
        'FILE_TOO_LARGE',
        `File exceeds LinkedIn's size limit for ${expectedType}`
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}