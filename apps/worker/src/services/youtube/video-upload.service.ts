// Package: @repo/worker
// Path: apps/worker/src/services/youtube/video-upload.service.ts
// Dependencies: googleapis, fs

import { google, youtube_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { PublisherError } from '../../lib/errors.js';

export interface VideoUploadResult {
  videoId: string;
  url: string;
}

export interface ThumbnailUploadResult {
  url: string;
}

export interface VideoMetadata {
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: 'private' | 'unlisted' | 'public';
  publishAt?: string;
}

export class YouTubeVideoUploadService {
  private youtube: youtube_v3.Youtube;

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    this.youtube = google.youtube({ version: 'v3', auth });
  }

  async uploadVideo(
    videoPath: string,
    metadata: VideoMetadata,
    onProgress?: (progress: number) => void
  ): Promise<VideoUploadResult> {
    this.validateVideoFile(videoPath);

    const fileSize = fs.statSync(videoPath).size;
    let uploadedBytes = 0;

    try {
      const response = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: metadata.tags,
            categoryId: metadata.categoryId || '22'
          },
          status: {
            privacyStatus: metadata.privacyStatus || 'private',
            publishAt: metadata.publishAt
          }
        },
        media: {
          body: fs.createReadStream(videoPath)
        }
      }, {
        onUploadProgress: (evt: { bytesRead: number }) => {
          uploadedBytes = evt.bytesRead;
          const progress = Math.round((uploadedBytes / fileSize) * 100);
          onProgress?.(progress);
        }
      });

      if (!response.data.id) {
        throw new PublisherError(
          'VIDEO_UPLOAD_FAILED',
          'Failed to upload video to YouTube'
        );
      }

      return {
        videoId: response.data.id,
        url: `https://youtube.com/watch?v=${response.data.id}`
      };
    } catch (error) {
      this.handleUploadError(error);
      throw error;
    }
  }

  async uploadThumbnail(
    videoId: string,
    thumbnailPath: string
  ): Promise<ThumbnailUploadResult> {
    this.validateThumbnailFile(thumbnailPath);

    try {
      const response = await this.youtube.thumbnails.set({
        videoId,
        media: {
          body: fs.createReadStream(thumbnailPath),
          mimeType: this.getMimeType(thumbnailPath)
        }
      });

      return {
        url: response.data.items?.[0]?.default?.url || ''
      };
    } catch (error) {
      this.handleUploadError(error);
      throw error;
    }
  }

  async updateVideoMetadata(
    videoId: string,
    metadata: Partial<VideoMetadata>
  ): Promise<void> {
    try {
      await this.youtube.videos.update({
        part: ['snippet'],
        requestBody: {
          id: videoId,
          snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: metadata.tags,
            categoryId: metadata.categoryId
          }
        }
      });
    } catch (error) {
      this.handleUploadError(error);
      throw error;
    }
  }

  private validateVideoFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new PublisherError(
        'VIDEO_NOT_FOUND',
        'Video file not found',
        { path: filePath }
      );
    }

    const stats = fs.statSync(filePath);
    const maxSize = 128 * 1024 * 1024 * 1024;

    if (stats.size > maxSize) {
      throw new PublisherError(
        'VIDEO_TOO_LARGE',
        'Video file exceeds YouTube\'s 128GB limit',
        { size: stats.size, maxSize }
      );
    }

    const extension = path.extname(filePath).toLowerCase();
    const supportedFormats = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.3gp', '.webm'];

    if (!supportedFormats.includes(extension)) {
      throw new PublisherError(
        'UNSUPPORTED_VIDEO_FORMAT',
        `Unsupported video format: ${extension}`,
        { supportedFormats }
      );
    }
  }

  private validateThumbnailFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new PublisherError(
        'THUMBNAIL_NOT_FOUND',
        'Thumbnail file not found',
        { path: filePath }
      );
    }

    const stats = fs.statSync(filePath);
    const maxSize = 2 * 1024 * 1024;

    if (stats.size > maxSize) {
      throw new PublisherError(
        'THUMBNAIL_TOO_LARGE',
        'Thumbnail exceeds 2MB limit',
        { size: stats.size, maxSize }
      );
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  private handleUploadError(error: unknown): void {
    if (error && typeof error === 'object' && 'code' in error) {
      const errorCode = (error as { code: number }).code;
      
      if (errorCode === 403) {
        throw new PublisherError(
          'QUOTA_EXCEEDED',
          'YouTube API quota exceeded',
          { originalError: error }
        );
      }

      if (errorCode === 401) {
        throw new PublisherError(
          'AUTH_ERROR',
          'YouTube authentication failed',
          { originalError: error }
        );
      }
    }
  }
}