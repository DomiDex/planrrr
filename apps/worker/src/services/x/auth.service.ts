// Package: @repo/worker
// Path: apps/worker/src/services/x/auth.service.ts
// Dependencies: crypto, oauth-1.0a

import crypto from 'crypto';
import { PublisherError } from '../../lib/errors.js';

export interface OAuth1Credentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface OAuth2Token {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export class XAuthService {
  private consumerKey: string;
  private consumerSecret: string;

  constructor() {
    this.consumerKey = process.env.X_API_KEY || process.env.TWITTER_API_KEY || '';
    this.consumerSecret = process.env.X_API_SECRET || process.env.TWITTER_API_SECRET || '';

    if (!this.consumerKey || !this.consumerSecret) {
      throw new PublisherError(
        'CONFIG_ERROR',
        'X API credentials not configured'
      );
    }
  }

  generateOAuth1Header(
    method: string,
    url: string,
    accessToken: string,
    accessTokenSecret: string,
    data?: Record<string, string>
  ): string {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.consumerKey,
      oauth_token: accessToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: this.generateTimestamp(),
      oauth_nonce: this.generateNonce(),
      oauth_version: '1.0'
    };

    const allParams = { ...oauthParams, ...(data || {}) };
    
    const baseString = this.buildSignatureBaseString(method, url, allParams);
    const signature = this.generateSignature(
      baseString,
      this.consumerSecret,
      accessTokenSecret
    );
    
    oauthParams.oauth_signature = signature;
    
    const headerParts = Object.keys(oauthParams)
      .sort()
      .map(key => {
        const value = oauthParams[key];
        if (!value) return '';
        return `${this.percentEncode(key)}="${this.percentEncode(value)}"`;
      })
      .filter(part => part !== '')
      .join(', ');
    
    return `OAuth ${headerParts}`;
  }

  async getBearerToken(): Promise<string> {
    const credentials = Buffer.from(
      `${this.consumerKey}:${this.consumerSecret}`
    ).toString('base64');

    const response = await fetch('https://api.twitter.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new PublisherError(
        'AUTH_ERROR',
        'Failed to obtain bearer token'
      );
    }

    const data = await response.json() as OAuth2Token;
    return data.access_token;
  }

  async refreshOAuth2Token(refreshToken: string): Promise<OAuth2Token> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.consumerKey
    });

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new PublisherError(
        'TOKEN_REFRESH_FAILED',
        'Failed to refresh OAuth2 token'
      );
    }

    return await response.json() as OAuth2Token;
  }

  generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  generateTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/!/g, '%21')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\*/g, '%2A');
  }

  buildSignatureBaseString(
    method: string,
    url: string,
    params: Record<string, string>
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => {
        const value = params[key];
        if (value === undefined || value === null) {
          return '';
        }
        return `${this.percentEncode(key)}=${this.percentEncode(value)}`;
      })
      .filter(param => param !== '')
      .join('&');

    return [
      method.toUpperCase(),
      this.percentEncode(url),
      this.percentEncode(sortedParams)
    ].join('&');
  }

  generateSignature(
    baseString: string,
    consumerSecret: string,
    tokenSecret: string
  ): string {
    const signingKey = `${this.percentEncode(consumerSecret)}&${this.percentEncode(tokenSecret)}`;
    return crypto
      .createHmac('sha1', signingKey)
      .update(baseString)
      .digest('base64');
  }

  validateWebhookSignature(
    signature: string,
    token: string,
    payload: string
  ): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.consumerSecret)
      .update(token + payload)
      .digest('base64');

    return signature === `sha256=${expectedSignature}`;
  }

  extractRateLimitInfo(headers: Record<string, string>): {
    limit: number;
    remaining: number;
    reset: Date;
  } {
    return {
      limit: parseInt(headers['x-rate-limit-limit'] || '0'),
      remaining: parseInt(headers['x-rate-limit-remaining'] || '0'),
      reset: new Date(parseInt(headers['x-rate-limit-reset'] || '0') * 1000)
    };
  }
}