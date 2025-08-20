// Package: @repo/shared
// Path: packages/shared/src/constants/index.ts
// Dependencies: none

// Platform character limits
export const PLATFORM_LIMITS = {
  TWITTER: 280,
  FACEBOOK: 63206,
  INSTAGRAM: 2200,
  YOUTUBE: 5000
} as const;

// Platform hashtag limits
export const PLATFORM_HASHTAG_LIMITS = {
  TWITTER: 30,
  FACEBOOK: 30,
  INSTAGRAM: 30,
  YOUTUBE: 15
} as const;

// File upload limits
export const FILE_LIMITS = {
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_IMAGES_PER_POST: 10,
  MAX_VIDEOS_PER_POST: 1
} as const;

// Allowed file types
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
] as const;

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo'
] as const;

// Rate limits (requests per minute)
export const RATE_LIMITS = {
  AUTH: 5,
  API: 100,
  CREATE_POST: 30,
  UPLOAD: 10
} as const;

// Time constants
export const TIME = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  YEAR: 365 * 24 * 60 * 60 * 1000
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
} as const;

// Job queue settings
export const QUEUE = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  JOB_TIMEOUT: 30000,
  CLEANUP_AGE: 24 * 60 * 60 * 1000 // 24 hours
} as const;

// API versions
export const API_VERSION = 'v1' as const;
export const API_BASE_PATH = '/api' as const;

// Default values
export const DEFAULTS = {
  TEAM_NAME: 'My Team',
  POST_STATUS: 'DRAFT',
  USER_ROLE: 'MEMBER',
  TIMEZONE: 'UTC'
} as const;

// Social media endpoints
export const SOCIAL_ENDPOINTS = {
  FACEBOOK: {
    BASE_URL: 'https://graph.facebook.com/v18.0',
    AUTH_URL: 'https://www.facebook.com/v18.0/dialog/oauth'
  },
  INSTAGRAM: {
    BASE_URL: 'https://graph.instagram.com/v18.0',
    AUTH_URL: 'https://api.instagram.com/oauth/authorize'
  },
  TWITTER: {
    BASE_URL: 'https://api.twitter.com/2',
    AUTH_URL: 'https://twitter.com/i/oauth2/authorize'
  },
  YOUTUBE: {
    BASE_URL: 'https://www.googleapis.com/youtube/v3',
    AUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth'
  }
} as const;