// Package: @repo/worker
// Path: apps/worker/src/services/linkedin/api-client.service.ts
// Dependencies: axios

import axios, { AxiosInstance, AxiosError } from 'axios';
import { PublisherError, RateLimitError } from '../../lib/errors.js';

export interface LinkedInProfile {
  id: string;
  localizedFirstName?: string;
  localizedLastName?: string;
  vanityName?: string;
}

export interface LinkedInOrganization {
  id: string;
  localizedName: string;
  vanityName?: string;
  logoV2?: {
    original: string;
  };
}

export interface LinkedInMediaAsset {
  asset: string;
  mediaArtifact: string;
}

export interface LinkedInPostResponse {
  id: string;
  createdAt: number;
}

export interface LinkedInShareContent {
  shareCommentary: {
    text: string;
  };
  shareMediaCategory: 'NONE' | 'IMAGE' | 'VIDEO' | 'ARTICLE';
  media?: Array<{
    status: 'READY';
    description?: {
      text: string;
    };
    media: string;
    title?: {
      text: string;
    };
  }>;
}

export class LinkedInApiClient {
  private readonly baseUrl = 'https://api.linkedin.com';
  private readonly restApiUrl = `${this.baseUrl}/rest`;
  private readonly v2ApiUrl = `${this.baseUrl}/v2`;
  private client: AxiosInstance;
  private readonly apiVersion: string;

  constructor(apiVersion = '202411') {
    this.apiVersion = apiVersion;
    this.client = axios.create({
      timeout: 30000
    });

    this.client.interceptors.response.use(
      response => response,
      error => this.handleApiError(error)
    );
  }

  async getUserProfile(accessToken: string): Promise<LinkedInProfile> {
    const response = await this.client.get(
      `${this.v2ApiUrl}/userinfo`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    return response.data;
  }

  async getOrganizations(accessToken: string): Promise<LinkedInOrganization[]> {
    const response = await this.client.get(
      `${this.v2ApiUrl}/organizationalEntityAcls`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        },
        params: {
          q: 'roleAssignee',
          role: 'ADMINISTRATOR',
          projection: '(elements*(organizationalTarget~(id,localizedName,vanityName,logoV2)))'
        }
      }
    );

    interface OrganizationElement {
      organizationalTarget: LinkedInOrganization;
    }
    
    return response.data.elements.map((element: OrganizationElement) => 
      element.organizationalTarget
    );
  }

  async createPost(
    authorUrn: string,
    content: LinkedInShareContent,
    accessToken: string
  ): Promise<LinkedInPostResponse> {
    const postData = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': content
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    const response = await this.client.post(
      `${this.restApiUrl}/posts`,
      postData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': this.apiVersion,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      id: response.headers['x-restli-id'] || response.data.id,
      createdAt: Date.now()
    };
  }

  async createUgcPost(
    authorUrn: string,
    content: LinkedInShareContent,
    accessToken: string
  ): Promise<LinkedInPostResponse> {
    const postData = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': content
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    const response = await this.client.post(
      `${this.v2ApiUrl}/ugcPosts`,
      postData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      id: response.headers['x-restli-id'] || response.data.id,
      createdAt: Date.now()
    };
  }

  async registerUpload(
    ownerUrn: string,
    accessToken: string,
    mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  ): Promise<{ uploadUrl: string; asset: string }> {
    const recipes = {
      IMAGE: 'urn:li:digitalmediaRecipe:feedshare-image',
      VIDEO: 'urn:li:digitalmediaRecipe:feedshare-video',
      DOCUMENT: 'urn:li:digitalmediaRecipe:feedshare-document'
    };

    const requestData = {
      registerUploadRequest: {
        recipes: [recipes[mediaType]],
        owner: ownerUrn,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent'
          }
        ]
      }
    };

    const response = await this.client.post(
      `${this.v2ApiUrl}/assets?action=registerUpload`,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      uploadUrl: response.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl,
      asset: response.data.value.asset
    };
  }

  async checkAssetStatus(
    assetId: string,
    accessToken: string
  ): Promise<{ status: string; downloadUrl?: string }> {
    const response = await this.client.get(
      `${this.v2ApiUrl}/assets/${assetId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );

    const recipe = response.data.recipes?.[0];
    return {
      status: recipe?.status || 'UNKNOWN',
      downloadUrl: recipe?.downloadUrl
    };
  }

  async deletePost(postId: string, accessToken: string): Promise<void> {
    await this.client.delete(
      `${this.restApiUrl}/posts/${postId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': this.apiVersion,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );
  }

  private handleApiError(error: unknown): never {
    if (!axios.isAxiosError(error)) {
      throw error;
    }

    const axiosError = error as AxiosError<{ 
      status?: number;
      message?: string;
      serviceErrorCode?: number;
    }>;
    
    const status = axiosError.response?.status;
    const errorMessage = axiosError.response?.data?.message || 'Unknown error';
    const serviceErrorCode = axiosError.response?.data?.serviceErrorCode;

    switch (status) {
      case 429:
        throw new RateLimitError(
          parseInt(axiosError.response?.headers['retry-after'] || '60'),
          'LINKEDIN'
        );

      case 401:
        throw new PublisherError(
          'AUTH_ERROR',
          'LinkedIn authentication failed',
          { originalError: errorMessage }
        );

      case 403:
        throw new PublisherError(
          'PERMISSION_DENIED',
          'Insufficient LinkedIn permissions',
          { originalError: errorMessage, serviceErrorCode }
        );

      case 422:
        throw new PublisherError(
          'VALIDATION_ERROR',
          'LinkedIn validation error',
          { originalError: errorMessage, serviceErrorCode }
        );

      case 400:
        throw new PublisherError(
          'INVALID_REQUEST',
          'Invalid LinkedIn API request',
          { originalError: errorMessage, serviceErrorCode }
        );

      default:
        throw new PublisherError(
          'API_ERROR',
          `LinkedIn API error: ${errorMessage}`,
          { status, originalError: errorMessage, serviceErrorCode }
        );
    }
  }
}