// Package: @repo/worker
// Path: apps/worker/src/services/facebook/media-upload.service.ts
// Dependencies: axios, form-data

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { PublisherError } from '../../lib/errors.js';

export interface MediaUploadResult {
  id: string;
  url?: string;
}

export interface CarouselItem {
  media_fbid: string;
}

export class FacebookMediaUploadService {
  private readonly apiVersion = process.env.FACEBOOK_API_VERSION || 'v18.0';
  private readonly baseUrl = 'https://graph.facebook.com';

  async uploadImage(
    pageId: string,
    accessToken: string,
    imagePath: string
  ): Promise<MediaUploadResult> {
    const formData = new FormData();
    formData.append('source', fs.createReadStream(imagePath));
    formData.append('published', 'false');
    formData.append('access_token', accessToken);

    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.apiVersion}/${pageId}/photos`,
        formData,
        {
          headers: formData.getHeaders(),
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      );

      return {
        id: response.data.id,
        url: response.data.post_id
      };
    } catch (error) {
      this.handleUploadError(error, 'image');
      throw error;
    }
  }

  async uploadVideo(
    pageId: string,
    accessToken: string,
    videoPath: string
  ): Promise<MediaUploadResult> {
    const fileSize = fs.statSync(videoPath).size;
    const formData = new FormData();
    formData.append('upload_phase', 'start');
    formData.append('file_size', fileSize.toString());
    formData.append('access_token', accessToken);

    try {
      const initResponse = await axios.post(
        `${this.baseUrl}/${this.apiVersion}/${pageId}/videos`,
        formData,
        { headers: formData.getHeaders() }
      );

      const uploadSessionId = initResponse.data.upload_session_id;
      const videoStream = fs.createReadStream(videoPath);
      const uploadData = new FormData();
      uploadData.append('upload_phase', 'transfer');
      uploadData.append('upload_session_id', uploadSessionId);
      uploadData.append('video_file_chunk', videoStream);
      uploadData.append('access_token', accessToken);

      await axios.post(
        `${this.baseUrl}/${this.apiVersion}/${pageId}/videos`,
        uploadData,
        {
          headers: uploadData.getHeaders(),
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      );

      const finishData = new FormData();
      finishData.append('upload_phase', 'finish');
      finishData.append('upload_session_id', uploadSessionId);
      finishData.append('access_token', accessToken);

      const finishResponse = await axios.post(
        `${this.baseUrl}/${this.apiVersion}/${pageId}/videos`,
        finishData,
        { headers: finishData.getHeaders() }
      );

      return { id: finishResponse.data.video_id };
    } catch (error) {
      this.handleUploadError(error, 'video');
      throw error;
    }
  }

  async createCarousel(
    pageId: string,
    accessToken: string,
    imagePaths: string[]
  ): Promise<CarouselItem[]> {
    const uploadPromises = imagePaths.map(path =>
      this.uploadImage(pageId, accessToken, path)
    );

    try {
      const results = await Promise.all(uploadPromises);
      return results.map(result => ({ media_fbid: result.id }));
    } catch (error) {
      this.handleUploadError(error, 'carousel');
      throw error;
    }
  }

  validateMediaFile(filePath: string, type: 'image' | 'video'): void {
    const stats = fs.statSync(filePath);
    const maxSize = type === 'image' ? 10 * 1024 * 1024 : 1024 * 1024 * 1024;

    if (stats.size > maxSize) {
      throw new PublisherError(
        'MEDIA_TOO_LARGE',
        `${type} file exceeds maximum size`,
        { size: stats.size, maxSize }
      );
    }

    if (!fs.existsSync(filePath)) {
      throw new PublisherError(
        'MEDIA_NOT_FOUND',
        `${type} file not found`,
        { path: filePath }
      );
    }
  }

  private handleUploadError(error: unknown, mediaType: string): void {
    if (axios.isAxiosError(error)) {
      const errorCode = error.response?.data?.error?.code;
      const errorMessage = error.response?.data?.error?.message;

      if (errorCode === 324) {
        throw new PublisherError(
          'MEDIA_UPLOAD_FAILED',
          `Failed to upload ${mediaType}: Missing required upload file`,
          { originalError: errorMessage }
        );
      }

      if (errorCode === 100) {
        throw new PublisherError(
          'INVALID_MEDIA',
          `Invalid ${mediaType} format or corrupted file`,
          { originalError: errorMessage }
        );
      }
    }
  }
}