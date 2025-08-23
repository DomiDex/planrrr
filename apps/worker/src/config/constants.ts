/**
 * Queue Names
 */
export const QUEUE_NAMES = {
  PUBLISH_POSTS: 'publish-posts',
  RETRY_FAILED: 'retry-failed-posts',
  ANALYTICS_SYNC: 'analytics-sync',
  MEDIA_UPLOAD: 'media-upload',
  TOKEN_REFRESH: 'token-refresh'
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

/**
 * Platform Configuration
 */
export const PLATFORM_CONFIG = {
  FACEBOOK: {
    NAME: 'Facebook',
    CHAR_LIMIT: 63206,
    MEDIA_LIMIT: 10,
    VIDEO_SIZE_LIMIT: 4_000_000_000, // 4GB
    IMAGE_SIZE_LIMIT: 10_000_000, // 10MB
    API_VERSION: 'v18.0',
    RATE_LIMIT: { 
      requests: 200, 
      window: 3600000 // 200 per hour
    },
    SUPPORTED_MEDIA_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
      'video/quicktime'
    ]
  },
  TWITTER: {
    NAME: 'Twitter/X',
    CHAR_LIMIT: 280,
    MEDIA_LIMIT: 4,
    VIDEO_SIZE_LIMIT: 512_000_000, // 512MB
    IMAGE_SIZE_LIMIT: 5_000_000, // 5MB
    GIF_SIZE_LIMIT: 15_000_000, // 15MB
    API_VERSION: '2',
    RATE_LIMIT: { 
      requests: 300, 
      window: 900000 // 300 per 15 min
    },
    SUPPORTED_MEDIA_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4'
    ]
  },
  INSTAGRAM: {
    NAME: 'Instagram',
    CHAR_LIMIT: 2200,
    HASHTAG_LIMIT: 30,
    MENTION_LIMIT: 20,
    MEDIA_REQUIRED: true,
    IMAGE_SIZE_LIMIT: 8_000_000, // 8MB
    VIDEO_SIZE_LIMIT: 100_000_000, // 100MB
    API_VERSION: 'v18.0',
    RATE_LIMIT: { 
      requests: 200, 
      window: 3600000 // 200 per hour
    },
    SUPPORTED_MEDIA_TYPES: [
      'image/jpeg',
      'image/png',
      'video/mp4',
      'video/mov'
    ],
    ASPECT_RATIO: {
      MIN: 0.8,
      MAX: 1.91
    }
  },
  YOUTUBE: {
    NAME: 'YouTube',
    TITLE_LIMIT: 100,
    DESCRIPTION_LIMIT: 5000,
    TAGS_LIMIT: 500,
    TAGS_CHAR_LIMIT: 500,
    VIDEO_SIZE_LIMIT: 128_000_000_000, // 128GB
    API_VERSION: 'v3',
    RATE_LIMIT: { 
      requests: 10000, 
      window: 86400000 // 10k per day
    },
    SUPPORTED_MEDIA_TYPES: [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-ms-wmv',
      'video/x-flv',
      'video/webm',
      'video/3gpp',
      'video/mpeg'
    ],
    PRIVACY_STATUS: {
      PRIVATE: 'private',
      UNLISTED: 'unlisted',
      PUBLIC: 'public'
    }
  },
  LINKEDIN: {
    NAME: 'LinkedIn',
    CHAR_LIMIT: 3000,
    ARTICLE_CHAR_LIMIT: 110000,
    MEDIA_LIMIT: 20,
    VIDEO_SIZE_LIMIT: 5_000_000_000, // 5GB
    IMAGE_SIZE_LIMIT: 10_000_000, // 10MB
    API_VERSION: 'v2',
    RATE_LIMIT: { 
      requests: 100, 
      window: 86400000 // 100 per day
    },
    SUPPORTED_MEDIA_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
      'video/quicktime'
    ],
    POST_VISIBILITY: {
      ANYONE: 'anyone',
      CONNECTIONS: 'connections-only'
    }
  }
} as const;

export type Platform = keyof typeof PLATFORM_CONFIG;
export type PlatformConfig = typeof PLATFORM_CONFIG[Platform];

/**
 * Job Options for BullMQ
 */
export const JOB_OPTIONS = {
  DEFAULT_ATTEMPTS: 3,
  BACKOFF_TYPE: 'exponential' as const,
  BACKOFF_DELAY: 2000,
  REMOVE_ON_COMPLETE: {
    age: 24 * 3600, // 24 hours in seconds
    count: 100
  },
  REMOVE_ON_FAIL: {
    age: 7 * 24 * 3600, // 7 days in seconds
    count: 500
  },
  STALLED_INTERVAL: 30000, // 30 seconds
  MAX_STALLED_COUNT: 3
} as const;

/**
 * Error Types
 */
export const ERROR_TYPES = {
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  AUTH_FAILED: 'AUTH_FAILED_ERROR',
  NETWORK: 'NETWORK_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  PLATFORM_API: 'PLATFORM_API_ERROR',
  MEDIA_UPLOAD: 'MEDIA_UPLOAD_ERROR',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED_ERROR',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS_ERROR',
  CONTENT_POLICY_VIOLATION: 'CONTENT_POLICY_VIOLATION_ERROR',
  DUPLICATE_POST: 'DUPLICATE_POST_ERROR',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED_ERROR'
} as const;

export type ErrorType = typeof ERROR_TYPES[keyof typeof ERROR_TYPES];

/**
 * Job Status
 */
export const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying',
  CANCELLED: 'cancelled'
} as const;

export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];

/**
 * Worker Events
 */
export const WORKER_EVENTS = {
  STARTED: 'worker:started',
  STOPPED: 'worker:stopped',
  ERROR: 'worker:error',
  STALLED: 'worker:stalled',
  COMPLETED: 'worker:completed',
  FAILED: 'worker:failed',
  PAUSED: 'worker:paused',
  RESUMED: 'worker:resumed'
} as const;

export type WorkerEvent = typeof WORKER_EVENTS[keyof typeof WORKER_EVENTS];

/**
 * Metrics Names
 */
export const METRICS = {
  JOBS_PROCESSED: 'jobs_processed_total',
  JOBS_FAILED: 'jobs_failed_total',
  JOBS_DURATION: 'job_duration_seconds',
  QUEUE_SIZE: 'queue_size',
  QUEUE_LATENCY: 'queue_latency_seconds',
  API_CALLS: 'api_calls_total',
  API_ERRORS: 'api_errors_total',
  API_LATENCY: 'api_latency_seconds',
  RATE_LIMIT_HITS: 'rate_limit_hits_total'
} as const;

export type MetricName = typeof METRICS[keyof typeof METRICS];

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];

/**
 * Time Constants (in milliseconds)
 */
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000
} as const;

/**
 * Retry Strategies
 */
export const RETRY_STRATEGY = {
  EXPONENTIAL: {
    type: 'exponential' as const,
    delay: 2000,
    maxDelay: 60000,
    factor: 2
  },
  LINEAR: {
    type: 'fixed' as const,
    delay: 5000
  },
  CUSTOM_RATE_LIMIT: {
    type: 'custom' as const,
    delay: (attemptsMade: number, error: Error) => {
      if (error.message.includes('rate limit')) {
        return 60000; // Wait 1 minute for rate limits
      }
      return Math.min(1000 * Math.pow(2, attemptsMade), 30000);
    }
  }
} as const;