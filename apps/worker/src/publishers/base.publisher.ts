import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../lib/logger.js';
import type { Post, Connection, Platform } from '@repo/database';
import { prisma } from '@repo/database';
import { ERROR_TYPES } from '../config/constants.js';

export interface ValidationResult {
  valid: boolean;
  characterCount: number;
  characterLimit: number;
  errors?: string[];
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

export interface PublishResult {
  success?: boolean;
  externalId?: string;
  platformPostId?: string;
  url?: string;
  publishedAt?: Date;
  error?: {
    code: string;
    message: string;
    retryAfter?: number;
    details?: unknown;
  };
  metrics?: Record<string, unknown>;
}

export abstract class BasePublisher {
  protected logger;
  protected httpClient: AxiosInstance;
  
  constructor(protected platform: Platform) {
    this.logger = createLogger(`${platform}Publisher`);
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'planrrr.io/1.0'
      }
    });
    
    this.setupInterceptors();
  }
  
  abstract publish(post: Post, connection: Connection): Promise<PublishResult>;
  abstract validate(content: string): ValidationResult;
  abstract getCharacterLimit(): number;
  
  protected abstract refreshToken(connection: Connection): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }>;
  
  protected handleError(error: unknown): PublishResult {
    this.logger.error('Publishing failed', { error, platform: this.platform });
    
    return {
      success: false,
      error: {
        code: 'PUBLISH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    };
  }
  
  protected async refreshTokenIfNeeded(
    connection: Connection
  ): Promise<Connection> {
    if (!connection.expiresAt || connection.expiresAt > new Date()) {
      return connection;
    }
    
    this.logger.info('Token expired, refreshing', { 
      connectionId: connection.id,
      platform: this.platform 
    });
    
    try {
      const newTokenData = await this.refreshToken(connection);
      
      const updated = await prisma.connection.update({
        where: { id: connection.id },
        data: {
          accessToken: newTokenData.accessToken,
          refreshToken: newTokenData.refreshToken || connection.refreshToken,
          expiresAt: new Date(Date.now() + newTokenData.expiresIn * 1000)
        }
      });
      
      this.logger.info('Token refreshed successfully', { 
        connectionId: connection.id 
      });
      
      return updated;
    } catch (error) {
      this.logger.error('Token refresh failed', { 
        error, 
        connectionId: connection.id 
      });
      throw new TokenExpiredError(this.platform);
    }
  }
  
  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug('API Request', {
          method: config.method,
          url: config.url,
          platform: this.platform
        });
        return config;
      },
      (error) => {
        this.logger.error('Request Error', { error });
        return Promise.reject(error);
      }
    );
    
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug('API Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        if (error.response?.status === 429) {
          const resetTime = error.response.headers['x-ratelimit-reset'];
          throw new RateLimitError(this.platform, resetTime);
        }
        
        if (error.response?.status === 401) {
          throw new AuthenticationError(this.platform);
        }
        
        this.logger.error('Response Error', {
          status: error.response?.status,
          data: error.response?.data,
          platform: this.platform
        });
        
        throw error;
      }
    );
  }
}

/**
 * Custom Error Classes for Platform-specific errors
 */
export class PlatformError extends Error {
  constructor(
    public platform: Platform,
    message: string,
    public errorType: string,
    public isRetryable: boolean = true
  ) {
    super(`[${platform}] ${message}`);
    this.name = 'PlatformError';
  }
}

export class RateLimitError extends PlatformError {
  constructor(platform: Platform, public resetTime?: number) {
    super(platform, 'Rate limit exceeded', ERROR_TYPES.RATE_LIMIT, true);
    this.resetTime = resetTime ? Number(resetTime) * 1000 : Date.now() + 900000;
  }
}

export class AuthenticationError extends PlatformError {
  constructor(platform: Platform) {
    super(
      platform, 
      'Authentication failed', 
      ERROR_TYPES.AUTH_FAILED, 
      false
    );
  }
}

export class TokenExpiredError extends PlatformError {
  constructor(platform: Platform) {
    super(
      platform, 
      'Token expired and refresh failed', 
      ERROR_TYPES.TOKEN_EXPIRED, 
      false
    );
  }
}

export class ValidationError extends PlatformError {
  constructor(platform: Platform, message: string) {
    super(
      platform,
      message,
      ERROR_TYPES.VALIDATION,
      false
    );
  }
}

export class MediaUploadError extends PlatformError {
  constructor(platform: Platform, message: string) {
    super(
      platform,
      message,
      ERROR_TYPES.MEDIA_UPLOAD,
      true
    );
  }
}