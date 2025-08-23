import { http, HttpResponse } from 'msw';
import { faker } from '@faker-js/faker';

// Facebook/Meta API handlers
export const metaHandlers = [
  // Facebook Graph API - Post creation
  http.post('https://graph.facebook.com/:version/:pageId/feed', async ({ params, request }) => {
    const body = await request.formData();
    const message = body.get('message');
    
    if (!message) {
      return HttpResponse.json(
        { error: { message: 'Message is required', code: 100 } },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      id: `${params.pageId}_${faker.string.alphanumeric(15)}`,
      post_id: faker.string.alphanumeric(20),
    });
  }),

  // Instagram API - Post creation
  http.post('https://graph.facebook.com/:version/:accountId/media', async ({ request }) => {
    const body = await request.formData();
    const caption = body.get('caption');
    const imageUrl = body.get('image_url');
    
    if (!caption || !imageUrl) {
      return HttpResponse.json(
        { error: { message: 'Caption and image_url are required', code: 100 } },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      id: faker.string.alphanumeric(17),
    });
  }),

  // Instagram API - Publish media
  http.post('https://graph.facebook.com/:version/:accountId/media_publish', async ({ request }) => {
    const body = await request.formData();
    const creationId = body.get('creation_id');
    
    if (!creationId) {
      return HttpResponse.json(
        { error: { message: 'creation_id is required', code: 100 } },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      id: faker.string.alphanumeric(17),
    });
  }),

  // Token refresh
  http.get('https://graph.facebook.com/:version/oauth/access_token', () => {
    return HttpResponse.json({
      access_token: `mock_refreshed_token_${faker.string.alphanumeric(40)}`,
      token_type: 'bearer',
      expires_in: 5184000, // 60 days
    });
  }),

  // Get page/account info
  http.get('https://graph.facebook.com/:version/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: faker.company.name(),
      picture: {
        data: {
          url: faker.image.avatar(),
        },
      },
    });
  }),
];

// X (Twitter) API handlers
export const xHandlers = [
  // Tweet creation
  http.post('https://api.twitter.com/2/tweets', async ({ request }) => {
    const body = await request.json() as { text?: string; media?: { media_ids?: string[] } };
    
    if (!body.text) {
      return HttpResponse.json(
        {
          errors: [{
            message: 'Text is required',
            code: 'INVALID_REQUEST',
          }],
        },
        { status: 400 }
      );
    }
    
    if (body.text.length > 280) {
      return HttpResponse.json(
        {
          errors: [{
            message: 'Tweet exceeds character limit',
            code: 'INVALID_REQUEST',
          }],
        },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      data: {
        id: faker.string.numeric(19),
        text: body.text,
        created_at: new Date().toISOString(),
      },
    });
  }),

  // Media upload
  http.post('https://upload.twitter.com/1.1/media/upload.json', async ({ request }) => {
    const body = await request.formData();
    const media = body.get('media');
    
    if (!media) {
      return HttpResponse.json(
        { errors: [{ message: 'Media is required' }] },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      media_id_string: faker.string.numeric(18),
      size: faker.number.int({ min: 1000, max: 5000000 }),
      expires_after_secs: 86400,
    });
  }),

  // User info
  http.get('https://api.twitter.com/2/users/me', () => {
    return HttpResponse.json({
      data: {
        id: faker.string.numeric(10),
        name: faker.person.fullName(),
        username: faker.internet.username(),
        profile_image_url: faker.image.avatar(),
      },
    });
  }),
];

// YouTube API handlers
export const youtubeHandlers = [
  // Video upload initialization
  http.post('https://www.googleapis.com/upload/youtube/v3/videos', async ({ request }) => {
    const url = new URL(request.url);
    const uploadType = url.searchParams.get('uploadType');
    
    if (uploadType === 'resumable') {
      return new HttpResponse(null, {
        status: 200,
        headers: {
          'Location': `https://www.googleapis.com/upload/youtube/v3/videos?upload_id=${faker.string.alphanumeric(20)}`,
        },
      });
    }
    
    return HttpResponse.json({
      id: faker.string.alphanumeric(11),
      snippet: {
        title: 'Test Video',
        description: 'Test Description',
        publishedAt: new Date().toISOString(),
      },
      status: {
        uploadStatus: 'uploaded',
        privacyStatus: 'public',
      },
    });
  }),

  // Video metadata update
  http.put('https://www.googleapis.com/youtube/v3/videos', async ({ request }) => {
    const body = await request.json() as { id?: string; snippet?: unknown; status?: unknown };
    
    return HttpResponse.json({
      id: body.id || faker.string.alphanumeric(11),
      snippet: body.snippet,
      status: body.status,
    });
  }),

  // Channel info
  http.get('https://www.googleapis.com/youtube/v3/channels', () => {
    return HttpResponse.json({
      items: [{
        id: faker.string.alphanumeric(24),
        snippet: {
          title: faker.company.name(),
          description: faker.lorem.paragraph(),
          thumbnails: {
            default: {
              url: faker.image.avatar(),
            },
          },
        },
      }],
    });
  }),
];

// Rate limit simulation handlers
export const rateLimitHandlers = [
  http.post('*/api/*', () => {
    // Simulate rate limiting occasionally
    if (Math.random() < 0.1) {
      return HttpResponse.json(
        {
          error: {
            message: 'Rate limit exceeded',
            code: 'RATE_LIMIT',
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Date.now() + 60000),
          },
        }
      );
    }
    
    // Pass through
    return undefined;
  }),
];

// Error simulation handlers
export const errorHandlers = [
  // Simulate network errors
  http.post('*/error/network', () => {
    return HttpResponse.error();
  }),

  // Simulate timeout
  http.post('*/error/timeout', async () => {
    await new Promise(resolve => setTimeout(resolve, 60000));
    return HttpResponse.json({});
  }),

  // Simulate server error
  http.post('*/error/server', () => {
    return HttpResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }),

  // Simulate unauthorized
  http.post('*/error/unauthorized', () => {
    return HttpResponse.json(
      { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
      { status: 401 }
    );
  }),
];

// Combine all handlers
export const handlers = [
  ...metaHandlers,
  ...xHandlers,
  ...youtubeHandlers,
];

// Handlers with errors for testing error cases
export const errorTestHandlers = [
  ...handlers,
  ...rateLimitHandlers,
  ...errorHandlers,
];