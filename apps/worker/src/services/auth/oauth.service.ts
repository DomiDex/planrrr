import crypto from 'crypto';
import axios, { AxiosError } from 'axios';
import { z } from 'zod';
import type { Connection, Platform } from '@repo/database';
import { prisma } from '@repo/database';
import { AppError, AuthenticationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

// Token response schemas
const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
});

const FacebookTokenResponseSchema = TokenResponseSchema.extend({
  token_type: z.literal('bearer').optional(),
});

const TwitterTokenResponseSchema = TokenResponseSchema.extend({
  scope: z.string(),
  token_type: z.literal('bearer'),
});

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}
export type PKCEChallenge = {
  verifier: string;
  challenge: string;
  state: string;
};

export class OAuthService {
  private readonly config = {
    facebook: {
      authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
      scopes: [
        'pages_show_list',
        'pages_read_engagement', 
        'pages_manage_posts',
        'instagram_basic',
        'instagram_content_publish',
      ],
    },
    twitter: {
      authUrl: 'https://twitter.com/i/oauth2/authorize',
      tokenUrl: 'https://api.twitter.com/2/oauth2/token',
      scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    },
    youtube: {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtubepartner',
      ],
    },
    linkedin: {
      authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      scopes: [
        'r_liteprofile',
        'r_emailaddress',
        'w_member_social',
        'r_organization_social',
        'w_organization_social',
      ],
    },
  };

  generatePKCEChallenge(): PKCEChallenge {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
    const state = crypto.randomBytes(16).toString('hex');

    return { verifier, challenge, state };
  }

  getAuthorizationUrl(
    platform: Platform,
    redirectUri: string,
    challenge?: string
  ): string {
    const config = this.config[platform.toLowerCase() as keyof typeof this.config];
    if (!config) {
      throw new AppError(400, 'INVALID_PLATFORM', `Unsupported platform: ${platform}`);
    }

    const params = new URLSearchParams({
      client_id: this.getClientId(platform),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
    });

    // Platform-specific parameters
    if (platform === 'TWITTER' && challenge) {
      params.append('code_challenge', challenge);
      params.append('code_challenge_method', 'S256');
    } else if (platform === 'YOUTUBE') {
      params.append('access_type', 'offline');
      params.append('prompt', 'consent');
    }

    return `${config.authUrl}?${params}`;
  }

  async exchangeCodeForToken(
    platform: Platform,
    code: string,
    redirectUri: string,
    verifier?: string
  ): Promise<TokenResponse> {
    const config = this.config[platform.toLowerCase() as keyof typeof this.config];
    if (!config) {
      throw new AppError(400, 'INVALID_PLATFORM', `Unsupported platform: ${platform}`);
    }

    try {
      const params = this.buildTokenExchangeParams(platform, code, redirectUri, verifier);
      const headers = this.buildTokenExchangeHeaders(platform);

      const response = await axios.post(config.tokenUrl, params, { headers });

      // Validate response based on platform
      const validatedResponse = this.validateTokenResponse(platform, response.data);

      return {
        accessToken: validatedResponse.access_token,
        refreshToken: validatedResponse.refresh_token,
        expiresIn: validatedResponse.expires_in,
      };
    } catch (error) {
      logger.error(`Token exchange failed for ${platform}:`, error);
      
      if (error instanceof AxiosError) {
        throw new AuthenticationError(
          `Failed to exchange code: ${error.response?.data?.error_description || error.message}`
        );
      }
      
      throw error;
    }
  }

  async refreshAccessToken(
    platform: Platform,
    refreshToken: string
  ): Promise<TokenResponse> {
    const config = this.config[platform.toLowerCase() as keyof typeof this.config];
    if (!config) {
      throw new AppError(400, 'INVALID_PLATFORM', `Unsupported platform: ${platform}`);
    }

    try {
      const params = this.buildRefreshTokenParams(platform, refreshToken);
      const headers = this.buildTokenExchangeHeaders(platform);

      const response = await axios.post(config.tokenUrl, params, { headers });

      const validatedResponse = this.validateTokenResponse(platform, response.data);

      return {
        accessToken: validatedResponse.access_token,
        refreshToken: validatedResponse.refresh_token || refreshToken,
        expiresIn: validatedResponse.expires_in,
      };
    } catch (error) {
      logger.error(`Token refresh failed for ${platform}:`, error);
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new AuthenticationError('Refresh token expired or invalid');
        }
        throw new AppError(
          error.response?.status || 500,
          'TOKEN_REFRESH_FAILED',
          error.response?.data?.error_description || 'Failed to refresh token'
        );
      }
      
      throw error;
    }
  }

  async getLongLivedToken(
    platform: Platform,
    shortLivedToken: string
  ): Promise<TokenResponse> {
    if (platform !== 'FACEBOOK' && platform !== 'INSTAGRAM') {
      throw new AppError(400, 'INVALID_PLATFORM', 'Long-lived tokens only available for Meta platforms');
    }

    try {
      const response = await axios.get(
        'https://graph.facebook.com/v18.0/oauth/access_token',
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: process.env.FACEBOOK_APP_ID,
            client_secret: process.env.FACEBOOK_APP_SECRET,
            fb_exchange_token: shortLivedToken,
          },
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: undefined,
        expiresIn: response.data.expires_in || 5183999, // ~60 days
      };
    } catch (error) {
      logger.error('Failed to get long-lived token:', error);
      
      if (error instanceof AxiosError) {
        throw new AppError(
          error.response?.status || 500,
          'LONG_TOKEN_FAILED',
          'Failed to get long-lived token'
        );
      }
      
      throw error;
    }
  }

  async refreshTokenIfNeeded(connection: Connection): Promise<Connection> {
    if (!connection.expiresAt) {
      return connection;
    }

    // Refresh if token expires in less than 5 minutes
    const expiryThreshold = new Date(Date.now() + 5 * 60 * 1000);
    
    if (connection.expiresAt > expiryThreshold) {
      return connection;
    }

    if (!connection.refreshToken) {
      throw new AuthenticationError('No refresh token available');
    }

    logger.info(`Refreshing token for connection ${connection.id}`);

    const newTokens = await this.refreshAccessToken(
      connection.platform,
      connection.refreshToken
    );

    const updatedConnection = await prisma.connection.update({
      where: { id: connection.id },
      data: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken || connection.refreshToken,
        expiresAt: new Date(Date.now() + newTokens.expiresIn * 1000),
      },
    });

    return updatedConnection;
  }

  private getClientId(platform: Platform): string {
    const clientIds: Record<Platform, string | undefined> = {
      FACEBOOK: process.env.FACEBOOK_APP_ID,
      INSTAGRAM: process.env.FACEBOOK_APP_ID,
      TWITTER: process.env.TWITTER_CLIENT_ID,
      YOUTUBE: process.env.YOUTUBE_CLIENT_ID,
      LINKEDIN: process.env.LINKEDIN_CLIENT_ID,
      TIKTOK: process.env.TIKTOK_CLIENT_KEY,
    };

    const clientId = clientIds[platform];
    
    if (!clientId) {
      throw new AppError(500, 'MISSING_CONFIG', `Missing client ID for ${platform}`);
    }

    return clientId;
  }

  private getClientSecret(platform: Platform): string {
    const secrets: Record<Platform, string | undefined> = {
      FACEBOOK: process.env.FACEBOOK_APP_SECRET,
      INSTAGRAM: process.env.FACEBOOK_APP_SECRET,
      TWITTER: process.env.TWITTER_CLIENT_SECRET,
      YOUTUBE: process.env.YOUTUBE_CLIENT_SECRET,
      LINKEDIN: process.env.LINKEDIN_CLIENT_SECRET,
      TIKTOK: process.env.TIKTOK_CLIENT_SECRET,
    };

    const secret = secrets[platform];
    
    if (!secret) {
      throw new AppError(500, 'MISSING_CONFIG', `Missing client secret for ${platform}`);
    }

    return secret;
  }

  private buildTokenExchangeParams(
    platform: Platform,
    code: string,
    redirectUri: string,
    verifier?: string
  ): URLSearchParams | Record<string, string> {
    const baseParams = {
      code,
      client_id: this.getClientId(platform),
      client_secret: this.getClientSecret(platform),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    };

    if (platform === 'TWITTER') {
      const params = new URLSearchParams({
        ...baseParams,
        ...(verifier && { code_verifier: verifier }),
      });
      return params;
    }

    if (platform === 'LINKEDIN') {
      return new URLSearchParams(baseParams);
    }

    return baseParams;
  }

  private buildRefreshTokenParams(
    platform: Platform,
    refreshToken: string
  ): URLSearchParams | Record<string, string> {
    const baseParams = {
      refresh_token: refreshToken,
      client_id: this.getClientId(platform),
      client_secret: this.getClientSecret(platform),
      grant_type: 'refresh_token',
    };

    if (platform === 'TWITTER' || platform === 'LINKEDIN') {
      return new URLSearchParams(baseParams);
    }

    return baseParams;
  }

  private buildTokenExchangeHeaders(platform: Platform): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (platform === 'TWITTER') {
      const credentials = Buffer.from(
        `${this.getClientId(platform)}:${this.getClientSecret(platform)}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    return headers;
  }

  private validateTokenResponse(platform: Platform, data: unknown): z.infer<typeof TokenResponseSchema> {
    let schema: z.ZodSchema = TokenResponseSchema;

    if (platform === 'FACEBOOK' || platform === 'INSTAGRAM') {
      schema = FacebookTokenResponseSchema;
    } else if (platform === 'TWITTER') {
      schema = TwitterTokenResponseSchema;
    }

    const result = schema.safeParse(data);
    
    if (!result.success) {
      logger.error('Invalid token response:', result.error);
      throw new AppError(500, 'INVALID_RESPONSE', 'Invalid token response from platform');
    }

    return result.data as z.infer<typeof TokenResponseSchema>;
  }
}

export const oauthService = new OAuthService();