# Social Media API Integration Reference

## Overview

This document provides detailed API integration specifications for each social media platform supported by the planrrr.io worker service. It includes authentication flows, endpoint documentation, rate limits, and platform-specific requirements.

## Table of Contents

1. [Facebook & Instagram (Meta)](#facebook--instagram-meta)
2. [Twitter/X](#twitterx)
3. [YouTube](#youtube)
4. [LinkedIn](#linkedin)
5. [Common Patterns](#common-patterns)
6. [Error Handling](#error-handling)
7. [Testing Strategies](#testing-strategies)

---

## Facebook & Instagram (Meta)

### Authentication

#### OAuth 2.0 Flow

```typescript
// Initial Authorization URL
const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
  `client_id=${FACEBOOK_APP_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish` +
  `&response_type=code`;

// Exchange code for token
async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const response = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
    params: {
      client_id: FACEBOOK_APP_ID,
      client_secret: FACEBOOK_APP_SECRET,
      redirect_uri: REDIRECT_URI,
      code
    }
  });
  
  return {
    accessToken: response.data.access_token,
    expiresIn: response.data.expires_in
  };
}

// Get long-lived token (60 days)
async function getLongLivedToken(shortToken: string): Promise<TokenResponse> {
  const response = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: FACEBOOK_APP_ID,
      client_secret: FACEBOOK_APP_SECRET,
      fb_exchange_token: shortToken
    }
  });
  
  return {
    accessToken: response.data.access_token,
    expiresIn: response.data.expires_in || 5183999 // ~60 days
  };
}
```

### Facebook Publishing

#### Text Post

```typescript
// POST /{page-id}/feed
const publishTextPost = async (pageId: string, content: string, accessToken: string) => {
  const response = await axios.post(
    `https://graph.facebook.com/v18.0/${pageId}/feed`,
    {
      message: content,
      access_token: accessToken,
      published: true // Set to false for drafts
    }
  );
  
  return response.data.id; // Returns post ID
};
```

#### Photo Post

```typescript
// Single photo
const publishPhotoPost = async (
  pageId: string,
  caption: string,
  imageUrl: string,
  accessToken: string
) => {
  const response = await axios.post(
    `https://graph.facebook.com/v18.0/${pageId}/photos`,
    {
      message: caption,
      url: imageUrl, // Must be publicly accessible URL
      access_token: accessToken,
      published: true
    }
  );
  
  return response.data.post_id;
};

// Multiple photos (up to 10)
const publishMultiPhotoPost = async (
  pageId: string,
  caption: string,
  imageUrls: string[],
  accessToken: string
) => {
  // Step 1: Upload each photo without publishing
  const photoIds = await Promise.all(
    imageUrls.map(async (url) => {
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${pageId}/photos`,
        {
          url,
          access_token: accessToken,
          published: false
        }
      );
      return { media_fbid: response.data.id };
    })
  );
  
  // Step 2: Create post with attached media
  const response = await axios.post(
    `https://graph.facebook.com/v18.0/${pageId}/feed`,
    {
      message: caption,
      attached_media: photoIds,
      access_token: accessToken,
      published: true
    }
  );
  
  return response.data.id;
};
```

#### Video Post

```typescript
const publishVideoPost = async (
  pageId: string,
  caption: string,
  videoUrl: string,
  accessToken: string
) => {
  // For videos < 1GB and < 20 minutes
  const response = await axios.post(
    `https://graph.facebook.com/v18.0/${pageId}/videos`,
    {
      description: caption,
      file_url: videoUrl, // Must be publicly accessible
      access_token: accessToken
    }
  );
  
  return response.data.id;
};

// For large videos, use resumable upload
const uploadLargeVideo = async (
  pageId: string,
  videoSize: number,
  accessToken: string
) => {
  // Step 1: Initialize upload session
  const initResponse = await axios.post(
    `https://graph.facebook.com/v18.0/${pageId}/videos`,
    {
      upload_phase: 'start',
      file_size: videoSize,
      access_token: accessToken
    }
  );
  
  const uploadSessionId = initResponse.data.upload_session_id;
  
  // Step 2: Upload chunks (implement chunking logic)
  // Step 3: Finish upload
  const finishResponse = await axios.post(
    `https://graph.facebook.com/v18.0/${pageId}/videos`,
    {
      upload_phase: 'finish',
      upload_session_id: uploadSessionId,
      access_token: accessToken
    }
  );
  
  return finishResponse.data.success;
};
```

### Instagram Publishing

#### Requirements
- Instagram Business or Creator Account
- Connected to Facebook Page
- Media must meet Instagram specifications

#### Content Publishing Flow

```typescript
// Step 1: Create media container
const createMediaContainer = async (
  instagramAccountId: string,
  imageUrl: string,
  caption: string,
  accessToken: string
) => {
  const response = await axios.post(
    `https://graph.facebook.com/v18.0/${instagramAccountId}/media`,
    {
      image_url: imageUrl, // Must be publicly accessible
      caption,
      access_token: accessToken
    }
  );
  
  return response.data.id; // Container ID
};

// Step 2: Check container status
const checkContainerStatus = async (
  containerId: string,
  accessToken: string
): Promise<'IN_PROGRESS' | 'FINISHED' | 'ERROR'> => {
  const response = await axios.get(
    `https://graph.facebook.com/v18.0/${containerId}`,
    {
      params: {
        fields: 'status_code',
        access_token: accessToken
      }
    }
  );
  
  return response.data.status_code;
};

// Step 3: Publish when ready
const publishContainer = async (
  instagramAccountId: string,
  containerId: string,
  accessToken: string
) => {
  // Wait for container to be ready
  let status = await checkContainerStatus(containerId, accessToken);
  let attempts = 0;
  
  while (status === 'IN_PROGRESS' && attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    status = await checkContainerStatus(containerId, accessToken);
    attempts++;
  }
  
  if (status !== 'FINISHED') {
    throw new Error(`Container processing failed: ${status}`);
  }
  
  // Publish the container
  const response = await axios.post(
    `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`,
    {
      creation_id: containerId,
      access_token: accessToken
    }
  );
  
  return response.data.id; // Instagram Media ID
};
```

#### Carousel Posts

```typescript
const publishCarousel = async (
  instagramAccountId: string,
  imageUrls: string[], // 2-10 images
  caption: string,
  accessToken: string
) => {
  // Step 1: Create containers for each image
  const containerIds = await Promise.all(
    imageUrls.map(url =>
      axios.post(
        `https://graph.facebook.com/v18.0/${instagramAccountId}/media`,
        {
          image_url: url,
          is_carousel_item: true,
          access_token: accessToken
        }
      ).then(res => res.data.id)
    )
  );
  
  // Step 2: Create carousel container
  const carouselResponse = await axios.post(
    `https://graph.facebook.com/v18.0/${instagramAccountId}/media`,
    {
      caption,
      media_type: 'CAROUSEL',
      children: containerIds,
      access_token: accessToken
    }
  );
  
  const carouselId = carouselResponse.data.id;
  
  // Step 3: Publish carousel
  return publishContainer(instagramAccountId, carouselId, accessToken);
};
```

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Page Posts | 200 | 1 hour |
| Photo Uploads | 100 | 1 hour |
| Video Uploads | 50 | 1 hour |
| Instagram Media | 200 | 1 hour |
| API Calls (General) | 200 | 1 hour |

---

## Twitter/X

### Authentication

#### OAuth 2.0 with PKCE

```typescript
// Step 1: Generate PKCE challenge
import crypto from 'crypto';

const generatePKCE = () => {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  
  return { verifier, challenge };
};

// Step 2: Build authorization URL
const buildAuthUrl = (challenge: string) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: TWITTER_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'tweet.read tweet.write users.read offline.access',
    state: crypto.randomBytes(16).toString('hex'),
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });
  
  return `https://twitter.com/i/oauth2/authorize?${params}`;
};

// Step 3: Exchange code for tokens
const exchangeCode = async (code: string, verifier: string) => {
  const response = await axios.post(
    'https://api.twitter.com/2/oauth2/token',
    new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: TWITTER_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`
        ).toString('base64')}`
      }
    }
  );
  
  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresIn: response.data.expires_in
  };
};
```

### Tweet Publishing

#### Text Tweet

```typescript
const publishTweet = async (text: string, accessToken: string) => {
  const response = await axios.post(
    'https://api.twitter.com/2/tweets',
    { text },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data.data.id;
};
```

#### Tweet with Media

```typescript
// Step 1: Upload media (using v1.1 API)
const uploadMedia = async (
  mediaBuffer: Buffer,
  mediaType: string,
  accessToken: string
) => {
  // Initialize upload
  const initResponse = await axios.post(
    'https://upload.twitter.com/1.1/media/upload.json',
    {
      command: 'INIT',
      total_bytes: mediaBuffer.length,
      media_type: mediaType,
      media_category: 'tweet_image'
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  const mediaId = initResponse.data.media_id_string;
  
  // Append media data
  await axios.post(
    'https://upload.twitter.com/1.1/media/upload.json',
    {
      command: 'APPEND',
      media_id: mediaId,
      segment_index: 0,
      media_data: mediaBuffer.toString('base64')
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  // Finalize upload
  await axios.post(
    'https://upload.twitter.com/1.1/media/upload.json',
    {
      command: 'FINALIZE',
      media_id: mediaId
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  return mediaId;
};

// Step 2: Create tweet with media
const publishTweetWithMedia = async (
  text: string,
  mediaIds: string[],
  accessToken: string
) => {
  const response = await axios.post(
    'https://api.twitter.com/2/tweets',
    {
      text,
      media: {
        media_ids: mediaIds // Max 4 images, 1 video, or 1 GIF
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data.data.id;
};
```

#### Thread Publishing

```typescript
const publishThread = async (
  tweets: string[],
  accessToken: string
): Promise<string[]> => {
  const tweetIds: string[] = [];
  let replyToId: string | undefined;
  
  for (const text of tweets) {
    const body: any = { text };
    
    if (replyToId) {
      body.reply = {
        in_reply_to_tweet_id: replyToId
      };
    }
    
    const response = await axios.post(
      'https://api.twitter.com/2/tweets',
      body,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const tweetId = response.data.data.id;
    tweetIds.push(tweetId);
    replyToId = tweetId;
    
    // Rate limit: wait between tweets
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return tweetIds;
};
```

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /2/tweets | 200 | 15 min |
| Media upload | 100 | 15 min |
| User timeline | 180 | 15 min |
| GET requests | 300 | 15 min |

---

## YouTube

### Authentication

#### OAuth 2.0 Flow

```typescript
// Authorization URL
const getAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: YOUTUBE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtubepartner'
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent'
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};

// Token exchange
const exchangeCode = async (code: string) => {
  const response = await axios.post(
    'https://oauth2.googleapis.com/token',
    {
      code,
      client_id: YOUTUBE_CLIENT_ID,
      client_secret: YOUTUBE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    }
  );
  
  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresIn: response.data.expires_in
  };
};
```

### Video Upload

```typescript
// Resumable upload for large videos
const uploadVideo = async (
  videoPath: string,
  metadata: VideoMetadata,
  accessToken: string
) => {
  // Step 1: Initialize resumable upload
  const initResponse = await axios.post(
    'https://www.googleapis.com/upload/youtube/v3/videos',
    {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        categoryId: metadata.categoryId || '22' // People & Blogs
      },
      status: {
        privacyStatus: metadata.privacyStatus || 'private',
        publishAt: metadata.scheduledAt?.toISOString()
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/*'
      },
      params: {
        uploadType: 'resumable',
        part: 'snippet,status'
      }
    }
  );
  
  const uploadUrl = initResponse.headers.location;
  
  // Step 2: Upload video file
  const videoBuffer = await fs.readFile(videoPath);
  
  const uploadResponse = await axios.put(
    uploadUrl,
    videoBuffer,
    {
      headers: {
        'Content-Type': 'video/*'
      }
    }
  );
  
  return uploadResponse.data.id;
};

// Upload thumbnail
const uploadThumbnail = async (
  videoId: string,
  thumbnailPath: string,
  accessToken: string
) => {
  const thumbnailBuffer = await fs.readFile(thumbnailPath);
  
  const response = await axios.post(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set`,
    thumbnailBuffer,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'image/jpeg'
      },
      params: {
        videoId
      }
    }
  );
  
  return response.data.items[0].default.url;
};
```

### Community Posts

```typescript
// Text post to community tab
const createCommunityPost = async (
  channelId: string,
  text: string,
  accessToken: string
) => {
  // Note: Community tab API is limited
  // Consider using YouTube Studio API or web scraping
  const response = await axios.post(
    'https://www.googleapis.com/youtube/v3/activities',
    {
      snippet: {
        description: text
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  return response.data.id;
};
```

### Rate Limits

| Resource | Daily Quota Cost | Daily Limit |
|----------|-----------------|-------------|
| Video upload | 1600 | ~6 videos |
| Thumbnail set | 50 | 200 |
| Video update | 50 | 200 |
| List videos | 1 | 10,000 |

---

## LinkedIn

### Authentication

#### OAuth 2.0 Flow

```typescript
// Authorization URL
const getAuthUrl = () => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINKEDIN_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: [
      'r_liteprofile',
      'r_emailaddress',
      'w_member_social',
      'r_organization_social',
      'w_organization_social'
    ].join(' ')
  });
  
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
};

// Token exchange
const exchangeCode = async (code: string) => {
  const response = await axios.post(
    'https://www.linkedin.com/oauth/v2/accessToken',
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  
  return {
    accessToken: response.data.access_token,
    expiresIn: response.data.expires_in
  };
};
```

### Content Publishing

#### Text Post

```typescript
const publishPost = async (
  authorUrn: string, // e.g., 'urn:li:person:123' or 'urn:li:organization:456'
  text: string,
  accessToken: string
) => {
  const response = await axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    }
  );
  
  return response.data.id;
};
```

#### Post with Image

```typescript
// Step 1: Register image upload
const registerImageUpload = async (
  authorUrn: string,
  accessToken: string
) => {
  const response = await axios.post(
    'https://api.linkedin.com/v2/assets?action=registerUpload',
    {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: authorUrn,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent'
          }
        ]
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return {
    uploadUrl: response.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl,
    assetId: response.data.value.asset
  };
};

// Step 2: Upload image
const uploadImage = async (
  uploadUrl: string,
  imageBuffer: Buffer,
  accessToken: string
) => {
  await axios.put(
    uploadUrl,
    imageBuffer,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'image/jpeg'
      }
    }
  );
};

// Step 3: Create post with image
const publishImagePost = async (
  authorUrn: string,
  text: string,
  assetId: string,
  accessToken: string
) => {
  const response = await axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text
          },
          shareMediaCategory: 'IMAGE',
          media: [
            {
              status: 'READY',
              media: assetId
            }
          ]
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    }
  );
  
  return response.data.id;
};
```

### Rate Limits

| Endpoint | Daily Limit | Notes |
|----------|------------|-------|
| Share Creation | 100 | Per user/organization |
| Media Upload | 100 | Per day |
| General API | 1000 | Per day per app |

---

## Common Patterns

### Retry Strategy Implementation

```typescript
class RetryableAPIClient {
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: {
      maxAttempts?: number;
      backoff?: 'linear' | 'exponential';
      initialDelay?: number;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      backoff = 'exponential',
      initialDelay = 1000
    } = options;
    
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on non-retryable errors
        if (
          error.response?.status === 400 || // Bad request
          error.response?.status === 401 || // Unauthorized
          error.response?.status === 403 || // Forbidden
          error.response?.status === 404    // Not found
        ) {
          throw error;
        }
        
        // Calculate delay
        const delay = backoff === 'exponential'
          ? initialDelay * Math.pow(2, attempt)
          : initialDelay * (attempt + 1);
        
        // Check if rate limited
        if (error.response?.status === 429) {
          const resetTime = error.response.headers['x-ratelimit-reset'];
          if (resetTime) {
            const waitTime = (Number(resetTime) * 1000) - Date.now();
            await new Promise(resolve => setTimeout(resolve, Math.max(waitTime, 0)));
            continue;
          }
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}
```

### Rate Limit Tracking

```typescript
class RateLimiter {
  private buckets = new Map<string, {
    tokens: number;
    lastRefill: number;
    limit: number;
    window: number;
  }>();
  
  constructor(private limits: Record<string, { limit: number; window: number }>) {
    for (const [key, config] of Object.entries(limits)) {
      this.buckets.set(key, {
        tokens: config.limit,
        lastRefill: Date.now(),
        ...config
      });
    }
  }
  
  async acquire(platform: string): Promise<void> {
    const bucket = this.buckets.get(platform);
    if (!bucket) throw new Error(`Unknown platform: ${platform}`);
    
    // Refill tokens
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed / bucket.window * bucket.limit);
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(bucket.limit, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
    
    // Check if token available
    if (bucket.tokens <= 0) {
      const waitTime = bucket.window - (now - bucket.lastRefill);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.acquire(platform);
    }
    
    bucket.tokens--;
  }
  
  getStatus(platform: string) {
    const bucket = this.buckets.get(platform);
    if (!bucket) return null;
    
    return {
      available: bucket.tokens,
      limit: bucket.limit,
      resetIn: bucket.window - (Date.now() - bucket.lastRefill)
    };
  }
}

// Usage
const rateLimiter = new RateLimiter({
  facebook: { limit: 200, window: 3600000 },
  twitter: { limit: 300, window: 900000 },
  instagram: { limit: 200, window: 3600000 },
  youtube: { limit: 10000, window: 86400000 },
  linkedin: { limit: 100, window: 86400000 }
});
```

### Media Validation

```typescript
interface MediaValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

class MediaValidator {
  static validate(
    platform: string,
    mediaUrl: string,
    mediaType: 'image' | 'video'
  ): MediaValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Platform-specific validation
    switch (platform) {
      case 'FACEBOOK':
        if (mediaType === 'image') {
          // Max 30MB for images
          // Formats: JPEG, PNG, GIF, WEBP
        } else {
          // Max 4GB for videos
          // Max 240 minutes duration
        }
        break;
        
      case 'TWITTER':
        if (mediaType === 'image') {
          // Max 5MB for images
          // Formats: JPEG, PNG, GIF, WEBP
        } else {
          // Max 512MB for videos
          // Max 140 seconds duration
        }
        break;
        
      case 'INSTAGRAM':
        if (mediaType === 'image') {
          // Aspect ratio: 1.91:1 to 4:5
          // Min 320px, Max 1080px width
        } else {
          // Max 60 seconds for feed
          // Max 15 minutes for IGTV
        }
        break;
        
      case 'YOUTUBE':
        // Max 128GB or 12 hours
        // Formats: MOV, MPEG4, MP4, AVI, WMV, FLV, 3GPP, WebM
        break;
        
      case 'LINKEDIN':
        if (mediaType === 'image') {
          // Max 10MB
          // Formats: JPEG, PNG
        } else {
          // Max 5GB
          // Max 10 minutes
        }
        break;
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
```

---

## Error Handling

### Common Error Codes

```typescript
enum APIErrorCode {
  // Authentication
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  DAILY_LIMIT_REACHED = 'DAILY_LIMIT_REACHED',
  
  // Content
  CONTENT_TOO_LONG = 'CONTENT_TOO_LONG',
  INVALID_MEDIA_FORMAT = 'INVALID_MEDIA_FORMAT',
  MEDIA_TOO_LARGE = 'MEDIA_TOO_LARGE',
  
  // Platform Specific
  PAGE_NOT_FOUND = 'PAGE_NOT_FOUND',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  DUPLICATE_CONTENT = 'DUPLICATE_CONTENT'
}

class APIError extends Error {
  constructor(
    public code: APIErrorCode,
    public platform: string,
    message: string,
    public statusCode?: number,
    public retryable: boolean = false,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Error handler
function handleAPIError(error: any, platform: string): never {
  // Rate limit errors
  if (error.response?.status === 429) {
    throw new APIError(
      APIErrorCode.RATE_LIMIT_EXCEEDED,
      platform,
      'Rate limit exceeded',
      429,
      true,
      error.response.headers['x-ratelimit-reset']
    );
  }
  
  // Auth errors
  if (error.response?.status === 401) {
    throw new APIError(
      APIErrorCode.INVALID_TOKEN,
      platform,
      'Invalid or expired token',
      401,
      false
    );
  }
  
  // Platform-specific errors
  if (platform === 'FACEBOOK') {
    const fbError = error.response?.data?.error;
    if (fbError?.code === 190) {
      throw new APIError(
        APIErrorCode.TOKEN_EXPIRED,
        platform,
        fbError.message,
        401,
        false
      );
    }
  }
  
  // Generic error
  throw new APIError(
    APIErrorCode.UNKNOWN,
    platform,
    error.message || 'Unknown error',
    error.response?.status,
    error.response?.status >= 500
  );
}
```

---

## Testing Strategies

### Mock API Responses

```typescript
// Test fixtures for each platform
export const mockResponses = {
  facebook: {
    success: {
      textPost: { id: 'fb_123456789', post_id: 'page_987654321' },
      photoPost: { id: 'fb_photo_123', post_id: 'page_photo_456' },
      token: { access_token: 'mock_token', expires_in: 5183999 }
    },
    errors: {
      rateLimit: {
        response: { status: 429, headers: { 'x-ratelimit-reset': '1234567890' } }
      },
      invalidToken: {
        response: {
          status: 401,
          data: { error: { code: 190, message: 'Invalid OAuth access token' } }
        }
      }
    }
  },
  
  twitter: {
    success: {
      tweet: { data: { id: 'tweet_123', text: 'Test tweet' } },
      media: { media_id_string: 'media_456' }
    },
    errors: {
      duplicate: {
        response: {
          status: 403,
          data: { detail: 'You have already posted this exact text' }
        }
      }
    }
  }
};
```

### Integration Test Setup

```typescript
import nock from 'nock';

describe('Platform Integration Tests', () => {
  beforeEach(() => {
    // Mock Facebook API
    nock('https://graph.facebook.com')
      .post(/\/v\d+\.\d+\/\d+\/feed/)
      .reply(200, mockResponses.facebook.success.textPost);
    
    // Mock Twitter API
    nock('https://api.twitter.com')
      .post('/2/tweets')
      .reply(200, mockResponses.twitter.success.tweet);
  });
  
  afterEach(() => {
    nock.cleanAll();
  });
  
  it('should handle Facebook post creation', async () => {
    const publisher = new FacebookPublisher();
    const result = await publisher.publish(mockPost, mockConnection);
    expect(result.externalId).toBe('fb_123456789');
  });
});
```

### Load Testing

```typescript
import autocannon from 'autocannon';

async function loadTest() {
  const result = await autocannon({
    url: 'http://localhost:3001/health',
    connections: 10,
    duration: 10,
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  console.log('Load test results:', {
    requests: result.requests,
    latency: result.latency,
    throughput: result.throughput,
    errors: result.errors
  });
}
```

---

## Appendix: Environment Variables

```env
# Facebook/Instagram
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_API_VERSION=v18.0
FACEBOOK_VERIFY_TOKEN=webhook_verify_token

# Twitter/X
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_BEARER_TOKEN=your_bearer_token
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret

# YouTube
YOUTUBE_API_KEY=your_api_key
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret

# LinkedIn
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret

# OAuth
OAUTH_REDIRECT_URI=https://your-domain.com/auth/callback

# Rate Limiting
RATE_LIMIT_REDIS_URL=redis://localhost:6379
RATE_LIMIT_ENABLED=true

# Error Tracking
SENTRY_DSN=your_sentry_dsn
ERROR_WEBHOOK_URL=https://your-webhook.com/errors
```

## Resources

### Official Documentation
- [Facebook Graph API](https://developers.facebook.com/docs/graph-api)
- [Instagram Basic Display API](https://developers.facebook.com/docs/instagram-basic-display-api)
- [Twitter API v2](https://developer.twitter.com/en/docs/twitter-api)
- [YouTube Data API](https://developers.google.com/youtube/v3)
- [LinkedIn API](https://docs.microsoft.com/en-us/linkedin/)

### Testing Tools
- [Facebook Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Twitter API Playground](https://oauth-playground.glitch.me/)
- [YouTube API Explorer](https://developers.google.com/youtube/v3/docs)
- [LinkedIn API Console](https://www.linkedin.com/developers/tools/api-console)

### Rate Limit Calculators
- [Facebook Rate Limit Calculator](https://developers.facebook.com/docs/graph-api/overview/rate-limiting)
- [Twitter Rate Limit Status](https://developer.twitter.com/en/docs/twitter-api/rate-limits)

---

This reference guide provides comprehensive API integration details for all supported social media platforms. Use it alongside the implementation guide to build robust, production-ready integrations.