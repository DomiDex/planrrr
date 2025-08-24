// Package: @repo/worker
// Path: apps/worker/src/services/x/api-client.service.ts
// Dependencies: axios

import axios, { AxiosInstance, AxiosError } from 'axios';
import { PublisherError, RateLimitError } from '../../lib/errors.js';
import { XAuthService } from './auth.service.js';

export interface TweetData {
  text: string;
  media?: {
    media_ids?: string[];
    tagged_user_ids?: string[];
  };
  poll?: {
    options: string[];
    duration_minutes: number;
  };
  reply?: {
    in_reply_to_tweet_id: string;
    exclude_reply_user_ids?: string[];
  };
  quote_tweet_id?: string;
  geo?: {
    place_id?: string;
  };
}

export interface TweetResponse {
  data: {
    id: string;
    text: string;
    created_at?: string;
    edit_history_tweet_ids?: string[];
  };
}

export interface ThreadResponse {
  tweets: Array<{
    id: string;
    text: string;
  }>;
}

export interface UserResponse {
  data: {
    id: string;
    username: string;
    name: string;
  };
}

export class XApiClient {
  private readonly v2BaseUrl = 'https://api.twitter.com/2';
  private readonly v1BaseUrl = 'https://api.twitter.com/1.1';
  private client: AxiosInstance;
  private authService: XAuthService;

  constructor() {
    this.authService = new XAuthService();
    this.client = axios.create({
      timeout: 30000
    });

    this.client.interceptors.response.use(
      response => response,
      error => this.handleApiError(error)
    );
  }

  async createTweet(
    tweetData: TweetData,
    accessToken: string,
    accessTokenSecret: string
  ): Promise<TweetResponse> {
    const url = `${this.v2BaseUrl}/tweets`;
    const authHeader = this.authService.generateOAuth1Header(
      'POST',
      url,
      accessToken,
      accessTokenSecret
    );

    const response = await this.client.post(
      url,
      tweetData,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  async createThread(
    tweets: string[],
    accessToken: string,
    accessTokenSecret: string,
    mediaIds?: string[][]
  ): Promise<ThreadResponse> {
    const createdTweets: Array<{ id: string; text: string }> = [];
    let replyToId: string | undefined;

    for (let i = 0; i < tweets.length; i++) {
      const tweetText = tweets[i];
      if (!tweetText) {
        throw new PublisherError(
          'INVALID_TWEET',
          `Tweet at index ${i} is undefined`
        );
      }
      
      const tweetData: TweetData = {
        text: tweetText
      };

      if (i > 0 && replyToId) {
        tweetData.reply = {
          in_reply_to_tweet_id: replyToId
        };
      }

      if (mediaIds && mediaIds[i]) {
        tweetData.media = {
          media_ids: mediaIds[i]
        };
      }

      const result = await this.createTweet(
        tweetData,
        accessToken,
        accessTokenSecret
      );

      createdTweets.push({
        id: result.data.id,
        text: result.data.text
      });

      replyToId = result.data.id;

      if (i < tweets.length - 1) {
        await this.delay(1000);
      }
    }

    return { tweets: createdTweets };
  }

  async deleteTweet(
    tweetId: string,
    accessToken: string,
    accessTokenSecret: string
  ): Promise<void> {
    const url = `${this.v2BaseUrl}/tweets/${tweetId}`;
    const authHeader = this.authService.generateOAuth1Header(
      'DELETE',
      url,
      accessToken,
      accessTokenSecret
    );

    await this.client.delete(url, {
      headers: {
        'Authorization': authHeader
      }
    });
  }

  async getUserInfo(
    accessToken: string,
    accessTokenSecret: string
  ): Promise<UserResponse> {
    const url = `${this.v2BaseUrl}/users/me`;
    const authHeader = this.authService.generateOAuth1Header(
      'GET',
      url,
      accessToken,
      accessTokenSecret
    );

    const response = await this.client.get(url, {
      headers: {
        'Authorization': authHeader
      }
    });

    return response.data;
  }

  async getTweetMetrics(
    tweetId: string,
    bearerToken: string
  ): Promise<Record<string, unknown>> {
    const response = await this.client.get(
      `${this.v2BaseUrl}/tweets/${tweetId}`,
      {
        headers: {
          'Authorization': `Bearer ${bearerToken}`
        },
        params: {
          'tweet.fields': 'public_metrics,created_at,lang'
        }
      }
    );

    return response.data;
  }

  private handleApiError(error: unknown): never {
    if (!axios.isAxiosError(error)) {
      throw error;
    }

    const axiosError = error as AxiosError<{
      errors?: Array<{ code: number; message: string }>;
      detail?: string;
      title?: string;
    }>;

    const status = axiosError.response?.status;
    const errors = axiosError.response?.data?.errors;
    const errorMessage = errors?.[0]?.message || 
                        axiosError.response?.data?.detail || 
                        'Unknown error';

    switch (status) {
      case 429: {
        const retryAfter = axiosError.response?.headers['x-rate-limit-reset'];
        const resetTime = retryAfter ? parseInt(retryAfter) : Date.now() / 1000 + 900;
        throw new RateLimitError(
          Math.ceil(resetTime - Date.now() / 1000),
          'TWITTER'
        );
      }

      case 401:
        throw new PublisherError(
          'AUTH_ERROR',
          'X authentication failed',
          { originalError: errorMessage }
        );

      case 403:
        throw new PublisherError(
          'PERMISSION_DENIED',
          'Insufficient X API permissions',
          { originalError: errorMessage }
        );

      case 400:
        if (errorMessage.includes('duplicate')) {
          throw new PublisherError(
            'DUPLICATE_CONTENT',
            'Duplicate tweet detected',
            { originalError: errorMessage }
          );
        }
        throw new PublisherError(
          'INVALID_REQUEST',
          'Invalid X API request',
          { originalError: errorMessage }
        );

      default:
        throw new PublisherError(
          'API_ERROR',
          `X API error: ${errorMessage}`,
          { status, originalError: errorMessage }
        );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}