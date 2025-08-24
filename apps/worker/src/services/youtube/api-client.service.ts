// Package: @repo/worker
// Path: apps/worker/src/services/youtube/api-client.service.ts
// Dependencies: googleapis

import { google, youtube_v3 } from 'googleapis';
import { PublisherError, RateLimitError } from '../../lib/errors.js';

export interface ChannelInfo {
  id: string;
  title: string;
  description: string;
  customUrl?: string;
}

export interface VideoCategory {
  id: string;
  title: string;
}

export interface PlaylistInfo {
  id: string;
  title: string;
  description: string;
  itemCount: number;
}

export class YouTubeApiClient {
  private youtube: youtube_v3.Youtube;
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    this.youtube = google.youtube({ version: 'v3', auth });
  }

  async getChannelInfo(): Promise<ChannelInfo> {
    try {
      const response = await this.youtube.channels.list({
        part: ['snippet', 'contentDetails'],
        mine: true
      });

      const channel = response.data.items?.[0];
      if (!channel) {
        throw new PublisherError(
          'NO_CHANNEL',
          'No YouTube channel found for this account'
        );
      }

      return {
        id: channel.id!,
        title: channel.snippet?.title || '',
        description: channel.snippet?.description || '',
        customUrl: channel.snippet?.customUrl || undefined
      };
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  async getVideoCategories(regionCode = 'US'): Promise<VideoCategory[]> {
    try {
      const response = await this.youtube.videoCategories.list({
        part: ['snippet'],
        regionCode
      });

      return (response.data.items || [])
        .filter((item) => item.snippet?.assignable)
        .map((item) => ({
          id: item.id!,
          title: item.snippet?.title || ''
        }));
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  async getPlaylists(): Promise<PlaylistInfo[]> {
    try {
      const response = await this.youtube.playlists.list({
        part: ['snippet', 'contentDetails'],
        mine: true,
        maxResults: 50
      });

      return (response.data.items || []).map((item) => ({
        id: item.id!,
        title: item.snippet?.title || '',
        description: item.snippet?.description || '',
        itemCount: item.contentDetails?.itemCount || 0
      }));
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  async addVideoToPlaylist(videoId: string, playlistId: string): Promise<void> {
    try {
      await this.youtube.playlistItems.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            playlistId,
            resourceId: {
              kind: 'youtube#video',
              videoId
            }
          }
        }
      });
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  async deleteVideo(videoId: string): Promise<void> {
    try {
      await this.youtube.videos.delete({ id: videoId });
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const auth = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET
    );

    auth.setCredentials({ refresh_token: refreshToken });

    try {
      const { credentials } = await auth.refreshAccessToken();
      return credentials.access_token!;
    } catch (error) {
      throw new PublisherError(
        'TOKEN_REFRESH_FAILED',
        'Failed to refresh YouTube access token',
        { originalError: error }
      );
    }
  }

  private handleApiError(error: unknown): void {
    if (error && typeof error === 'object' && 'code' in error) {
      const errorCode = (error as { code: number }).code;
      const errorMessage = (error as { message?: string }).message || 'Unknown error';

      switch (errorCode) {
        case 403:
          if (errorMessage.includes('quota')) {
            throw new RateLimitError(
              3600,
              'YOUTUBE'
            );
          }
          throw new PublisherError(
            'PERMISSION_DENIED',
            'Insufficient YouTube API permissions',
            { originalError: errorMessage }
          );

        case 401:
          throw new PublisherError(
            'AUTH_ERROR',
            'YouTube authentication failed',
            { originalError: errorMessage }
          );

        case 404:
          throw new PublisherError(
            'NOT_FOUND',
            'YouTube resource not found',
            { originalError: errorMessage }
          );

        case 400:
          throw new PublisherError(
            'INVALID_REQUEST',
            'Invalid YouTube API request',
            { originalError: errorMessage }
          );

        default:
          throw new PublisherError(
            'API_ERROR',
            `YouTube API error: ${errorMessage}`,
            { code: errorCode, originalError: errorMessage }
          );
      }
    }
  }
}