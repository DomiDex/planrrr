import { z } from 'zod';
import { 
  BasePublisher, 
  type PublishResult, 
  type ValidationResult,
  ValidationError,
  MediaUploadError 
} from './base.publisher.js';
import type { Post, Connection } from '@repo/database';
import { PLATFORM_CONFIG } from '../config/constants.js';
import { env } from '../config/env.js';

const FacebookMetadataSchema = z.object({
  pageId: z.string(),
  pageName: z.string().optional()
});

const FacebookResponseSchema = z.object({
  id: z.string(),
  post_id: z.string().optional()
});

export class FacebookPublisher extends BasePublisher {
  private readonly apiVersion = env.FACEBOOK_API_VERSION;
  private readonly baseUrl = env.META_GRAPH_API_URL;
  
  constructor() {
    super('FACEBOOK');
  }
  
  async publish(
    post: Post, 
    connection: Connection
  ): Promise<PublishResult> {
    const conn = await this.refreshTokenIfNeeded(connection);
    
    const metadata = FacebookMetadataSchema.parse(conn.metadata);
    
    try {
      let externalId: string;
      
      if (post.mediaUrls && post.mediaUrls.length > 0) {
        externalId = await this.publishWithMedia(
          post, 
          conn, 
          metadata.pageId
        );
      } else {
        externalId = await this.publishTextPost(
          post, 
          conn, 
          metadata.pageId
        );
      }
      
      const postUrl = `https://www.facebook.com/${metadata.pageId}/posts/${externalId}`;
      
      this.logger.info('Post published successfully', {
        postId: post.id,
        externalId,
        url: postUrl
      });
      
      return {
        success: true,
        externalId,
        platformPostId: externalId,
        url: postUrl,
        publishedAt: new Date()
      };
    } catch (error) {
      this.logger.error('Facebook publish failed', { 
        error, 
        postId: post.id 
      });
      throw error;
    }
  }
  
  private async publishTextPost(
    post: Post,
    connection: Connection,
    pageId: string
  ): Promise<string> {
    const endpoint = `${this.baseUrl}/${this.apiVersion}/${pageId}/feed`;
    
    const response = await this.httpClient.post(endpoint, {
      message: post.content,
      access_token: connection.accessToken,
      published: true
    });
    
    const data = FacebookResponseSchema.parse(response.data);
    return data.id;
  }
  
  private async publishWithMedia(
    post: Post,
    connection: Connection,
    pageId: string
  ): Promise<string> {
    const mediaUrls = post.mediaUrls!.slice(
      0, 
      PLATFORM_CONFIG.FACEBOOK.MEDIA_LIMIT
    );
    
    const firstMediaUrl = mediaUrls[0];
    if (mediaUrls.length === 1 && firstMediaUrl && this.isImageUrl(firstMediaUrl)) {
      const endpoint = `${this.baseUrl}/${this.apiVersion}/${pageId}/photos`;
      
      const response = await this.httpClient.post(endpoint, {
        message: post.content,
        url: firstMediaUrl,
        access_token: connection.accessToken,
        published: true
      });
      
      const data = FacebookResponseSchema.parse(response.data);
      return data.post_id || data.id;
    }
    
    const attachedMedia = await this.uploadMultipleMedia(
      mediaUrls, 
      connection, 
      pageId
    );
    
    const endpoint = `${this.baseUrl}/${this.apiVersion}/${pageId}/feed`;
    const response = await this.httpClient.post(endpoint, {
      message: post.content,
      attached_media: attachedMedia,
      access_token: connection.accessToken,
      published: true
    });
    
    const data = FacebookResponseSchema.parse(response.data);
    return data.id;
  }
  
  private async uploadMultipleMedia(
    mediaUrls: string[],
    connection: Connection,
    pageId: string
  ): Promise<string[]> {
    try {
      const uploadPromises = mediaUrls.map(async (url) => {
        const endpoint = `${this.baseUrl}/${this.apiVersion}/${pageId}/photos`;
        
        const response = await this.httpClient.post(endpoint, {
          url,
          access_token: connection.accessToken,
          published: false
        });
        
        return response.data.id;
      });
      
      return await Promise.all(uploadPromises);
    } catch {
      throw new MediaUploadError(
        'FACEBOOK',
        'Failed to upload media to Facebook'
      );
    }
  }
  
  validate(content: string): ValidationResult {
    const limit = PLATFORM_CONFIG.FACEBOOK.CHAR_LIMIT;
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (content.length > limit) {
      errors.push(`Content exceeds Facebook character limit of ${limit}`);
    }
    
    if (content.length === 0) {
      errors.push('Content cannot be empty');
    }
    
    // Count URLs in content
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = content.match(urlRegex) || [];
    
    // Count hashtags
    const hashtagRegex = /#\w+/g;
    const hashtags = content.match(hashtagRegex) || [];
    
    if (hashtags.length > 30) {
      warnings.push('Consider using fewer hashtags for better engagement');
    }
    
    return {
      valid: errors.length === 0,
      characterCount: content.length,
      characterLimit: limit,
      errors,
      warnings,
      metadata: {
        characterCount: content.length,
        characterLimit: limit,
        urlCount: urls.length,
        hashtagCount: hashtags.length
      }
    };
  }
  
  formatContent(content: string): string {
    // Facebook preserves formatting, just return as-is
    return content;
  }
  
  getMediaRequirements(type: 'image' | 'video') {
    if (type === 'image') {
      return {
        maxSize: 4 * 1024 * 1024, // 4MB
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        maxDimensions: { width: 2048, height: 2048 },
        minDimensions: { width: 200, height: 200 },
        aspectRatios: {
          square: { width: 1, height: 1 },
          landscape: { width: 1.91, height: 1 },
          portrait: { width: 4, height: 5 },
        },
      };
    } else {
      return {
        maxSize: 4 * 1024 * 1024 * 1024, // 4GB
        supportedFormats: ['mp4', 'mov'],
        maxDuration: 240 * 60, // 240 minutes
        minDuration: 1,
        aspectRatios: {
          square: { width: 1, height: 1 },
          landscape: { width: 16, height: 9 },
          portrait: { width: 9, height: 16 },
        },
      };
    }
  }
  
  getCharacterLimit(): number {
    return PLATFORM_CONFIG.FACEBOOK.CHAR_LIMIT;
  }
  
  protected async refreshToken(connection: Connection): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }> {
    if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) {
      throw new ValidationError(
        'FACEBOOK',
        'Facebook API credentials not configured'
      );
    }
    
    const endpoint = `${this.baseUrl}/${this.apiVersion}/oauth/access_token`;
    
    const response = await this.httpClient.get(endpoint, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: env.FACEBOOK_APP_ID,
        client_secret: env.FACEBOOK_APP_SECRET,
        fb_exchange_token: connection.refreshToken || connection.accessToken
      }
    });
    
    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in || 5183999
    };
  }
  
  private isImageUrl(url: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext));
  }
}