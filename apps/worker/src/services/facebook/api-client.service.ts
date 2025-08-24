// Package: @repo/worker
// Path: apps/worker/src/services/facebook/api-client.service.ts
// Dependencies: axios

import axios, { AxiosInstance, AxiosError } from 'axios';
import { PublisherError, RateLimitError } from '../../lib/errors.js';

export interface FacebookApiResponse {
  id?: string;
  post_id?: string;
  error?: {
    code: number;
    message: string;
    type: string;
  };
}

export class FacebookApiClient {
  private readonly apiVersion = process.env.FACEBOOK_API_VERSION || 'v18.0';
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

  async createPost(
    pageId: string,
    accessToken: string,
    data: Record<string, unknown>
  ): Promise<FacebookApiResponse> {
    const response = await this.client.post(
      `/${pageId}/feed`,
      { ...data, access_token: accessToken }
    );
    return response.data;
  }

  async schedulePost(
    pageId: string,
    accessToken: string,
    data: Record<string, unknown>,
    scheduledTime: number
  ): Promise<FacebookApiResponse> {
    const response = await this.client.post(
      `/${pageId}/feed`,
      {
        ...data,
        published: false,
        scheduled_publish_time: scheduledTime,
        access_token: accessToken
      }
    );
    return response.data;
  }

  async getPageInfo(
    pageId: string,
    accessToken: string
  ): Promise<{ id: string; name: string }> {
    const response = await this.client.get(
      `/${pageId}`,
      { params: { access_token: accessToken, fields: 'id,name' } }
    );
    return response.data;
  }

  async refreshLongLivedToken(
    shortLivedToken: string
  ): Promise<{ access_token: string; expires_in: number }> {
    const response = await this.client.get('/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        fb_exchange_token: shortLivedToken
      }
    });
    return response.data;
  }

  private handleApiError(error: unknown): never {
    if (!axios.isAxiosError(error)) {
      throw error;
    }

    const axiosError = error as AxiosError<FacebookApiResponse>;
    const errorCode = axiosError.response?.data?.error?.code;
    const errorMessage = axiosError.response?.data?.error?.message || 'Unknown error';

    switch (errorCode) {
      case 32:
      case 613:
        throw new RateLimitError(
          300,
          'FACEBOOK'
        );

      case 10:
      case 200:
        throw new PublisherError(
          'PERMISSION_DENIED',
          'Insufficient permissions to publish',
          { originalError: errorMessage }
        );

      case 190:
        throw new PublisherError(
          'TOKEN_EXPIRED',
          'Access token has expired',
          { originalError: errorMessage }
        );

      case 100:
        throw new PublisherError(
          'INVALID_PARAMETER',
          'Invalid request parameters',
          { originalError: errorMessage }
        );

      default:
        throw new PublisherError(
          'API_ERROR',
          `Facebook API error: ${errorMessage}`,
          { code: errorCode, originalError: errorMessage }
        );
    }
  }
}