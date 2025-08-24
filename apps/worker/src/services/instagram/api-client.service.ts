// Package: @repo/worker
// Path: apps/worker/src/services/instagram/api-client.service.ts
// Dependencies: axios

import axios, { AxiosInstance, AxiosError } from 'axios';
import { PublisherError, RateLimitError } from '../../lib/errors.js';

export interface InstagramContainer {
  id: string;
  status?: 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'PUBLISHED';
  status_code?: string;
  upload_url?: string;
}

export interface InstagramPublishResponse {
  id: string;
  permalink?: string;
}

export interface InstagramBusinessAccount {
  id: string;
  username: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}

export class InstagramApiClient {
  private readonly apiVersion = process.env.INSTAGRAM_API_VERSION || 'v18.0';
  private readonly baseUrl = 'https://graph.facebook.com';
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${this.baseUrl}/${this.apiVersion}`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.client.interceptors.response.use(
      response => response,
      error => this.handleApiError(error)
    );
  }

  async getBusinessAccount(
    userId: string,
    accessToken: string
  ): Promise<InstagramBusinessAccount> {
    const response = await this.client.get(`/${userId}`, {
      params: {
        fields: 'id,username,profile_picture_url,followers_count,media_count',
        access_token: accessToken
      }
    });
    return response.data;
  }

  async createMediaContainer(
    igUserId: string,
    accessToken: string,
    imageUrl: string,
    caption?: string
  ): Promise<InstagramContainer> {
    const params: Record<string, unknown> = {
      image_url: imageUrl,
      access_token: accessToken
    };

    if (caption) {
      params.caption = caption;
    }

    const response = await this.client.post(
      `/${igUserId}/media`,
      null,
      { params }
    );
    return response.data;
  }

  async createCarouselContainer(
    igUserId: string,
    accessToken: string,
    childrenIds: string[],
    caption?: string
  ): Promise<InstagramContainer> {
    const params: Record<string, unknown> = {
      media_type: 'CAROUSEL',
      children: childrenIds.join(','),
      access_token: accessToken
    };

    if (caption) {
      params.caption = caption;
    }

    const response = await this.client.post(
      `/${igUserId}/media`,
      null,
      { params }
    );
    return response.data;
  }

  async createVideoContainer(
    igUserId: string,
    accessToken: string,
    videoUrl: string,
    caption?: string,
    thumbnailUrl?: string
  ): Promise<InstagramContainer> {
    const params: Record<string, unknown> = {
      media_type: 'VIDEO',
      video_url: videoUrl,
      access_token: accessToken
    };

    if (caption) {
      params.caption = caption;
    }

    if (thumbnailUrl) {
      params.thumb_offset = thumbnailUrl;
    }

    const response = await this.client.post(
      `/${igUserId}/media`,
      null,
      { params }
    );
    return response.data;
  }

  async getContainerStatus(
    containerId: string,
    accessToken: string
  ): Promise<InstagramContainer> {
    const response = await this.client.get(`/${containerId}`, {
      params: {
        fields: 'id,status,status_code',
        access_token: accessToken
      }
    });
    return response.data;
  }

  async publishContainer(
    igUserId: string,
    containerId: string,
    accessToken: string
  ): Promise<InstagramPublishResponse> {
    const response = await this.client.post(
      `/${igUserId}/media_publish`,
      null,
      {
        params: {
          creation_id: containerId,
          access_token: accessToken
        }
      }
    );
    return response.data;
  }

  async getMediaInsights(
    mediaId: string,
    accessToken: string,
    metrics: string[] = ['impressions', 'reach', 'engagement']
  ): Promise<Record<string, unknown>> {
    const response = await this.client.get(`/${mediaId}/insights`, {
      params: {
        metric: metrics.join(','),
        access_token: accessToken
      }
    });
    return response.data;
  }

  private handleApiError(error: unknown): never {
    if (!axios.isAxiosError(error)) {
      throw error;
    }

    const axiosError = error as AxiosError<{ error?: { code: number; message: string } }>;
    const errorCode = axiosError.response?.data?.error?.code;
    const errorMessage = axiosError.response?.data?.error?.message || 'Unknown error';

    switch (errorCode) {
      case 4:
      case 17:
        throw new RateLimitError(3600, 'INSTAGRAM');

      case 10:
      case 200:
        throw new PublisherError(
          'PERMISSION_DENIED',
          'Insufficient permissions to publish to Instagram',
          { originalError: errorMessage }
        );

      case 190:
        throw new PublisherError(
          'TOKEN_EXPIRED',
          'Instagram access token has expired',
          { originalError: errorMessage }
        );

      case 100:
        throw new PublisherError(
          'INVALID_PARAMETER',
          'Invalid request parameters for Instagram',
          { originalError: errorMessage }
        );

      case 9:
        throw new PublisherError(
          'MEDIA_ERROR',
          'Media container creation failed',
          { originalError: errorMessage }
        );

      default:
        throw new PublisherError(
          'API_ERROR',
          `Instagram API error: ${errorMessage}`,
          { code: errorCode, originalError: errorMessage }
        );
    }
  }
}