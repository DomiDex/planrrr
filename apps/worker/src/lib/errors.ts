import type { Platform } from '@repo/database';

export enum APIErrorCode {
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
  MISSING_REQUIRED_MEDIA = 'MISSING_REQUIRED_MEDIA',
  
  // Platform Specific
  PAGE_NOT_FOUND = 'PAGE_NOT_FOUND',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  DUPLICATE_CONTENT = 'DUPLICATE_CONTENT',
  PLATFORM_UNAVAILABLE = 'PLATFORM_UNAVAILABLE',
  
  // General
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export class PublisherError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'PublisherError';
    Object.setPrototypeOf(this, PublisherError.prototype);
  }
}


export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

export class APIError extends AppError {
  constructor(
    public code: APIErrorCode,
    public platform: Platform,
    message: string,
    public statusCode: number = 500,
    public retryable: boolean = false,
    public retryAfter?: number
  ) {
    super(statusCode, code, message);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }

  static fromAxiosError(error: unknown, platform: Platform): APIError {
    const axiosError = error as { response?: { status?: number; data?: unknown; headers?: Record<string, string> } };
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;
    
    // Rate limit errors
    if (status === 429) {
      const retryAfter = axiosError.response?.headers?.['x-ratelimit-reset'] || 
                        axiosError.response?.headers?.['retry-after'];
      
      return new APIError(
        APIErrorCode.RATE_LIMIT_EXCEEDED,
        platform,
        'Rate limit exceeded',
        429,
        true,
        retryAfter ? Number(retryAfter) : undefined
      );
    }

    // Authentication errors
    if (status === 401) {
      const errorData = data as ErrorData;
      const isExpired = errorData?.error?.code === 190 || // Facebook
                       (typeof data === 'object' && data && 'error' in data && (data as { error: string }).error === 'invalid_token') || // OAuth standard
                       (errorData?.errors?.[0] as { code: number } | undefined)?.code === 89; // Twitter
      
      return new APIError(
        isExpired ? APIErrorCode.TOKEN_EXPIRED : APIErrorCode.INVALID_TOKEN,
        platform,
        (data as ErrorData)?.error?.message || 'Authentication failed',
        401,
        false
      );
    }

    // Permission errors
    if (status === 403) {
      const errorData = data as ErrorData;
      const isDuplicate = errorData?.detail?.includes('already posted') || // Twitter
                         errorData?.error?.code === 506; // Facebook duplicate
      
      if (isDuplicate) {
        return new APIError(
          APIErrorCode.DUPLICATE_CONTENT,
          platform,
          'Duplicate content detected',
          403,
          false
        );
      }
      
      return new APIError(
        APIErrorCode.INSUFFICIENT_PERMISSIONS,
        platform,
        (data as ErrorData)?.error?.message || 'Insufficient permissions',
        403,
        false
      );
    }

    // Not found errors
    if (status === 404) {
      return new APIError(
        APIErrorCode.PAGE_NOT_FOUND,
        platform,
        'Resource not found',
        404,
        false
      );
    }

    // Server errors (retryable)
    if (status && status >= 500) {
      return new APIError(
        APIErrorCode.PLATFORM_UNAVAILABLE,
        platform,
        'Platform service unavailable',
        status,
        true
      );
    }

    // Network errors
    const errorWithCode = error as { code?: string };
    if (errorWithCode.code === 'ECONNREFUSED' || errorWithCode.code === 'ETIMEDOUT') {
      return new APIError(
        APIErrorCode.NETWORK_ERROR,
        platform,
        'Network connection failed',
        0,
        true
      );
    }

    // Default error
    return new APIError(
      APIErrorCode.UNKNOWN,
      platform,
      (error as { message?: string }).message || 'Unknown error occurred',
      status || 500,
      status ? status >= 500 : false
    );
  }

  toJSON() {
    return {
      ...super.toJSON(),
      platform: this.platform,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'AUTH_REQUIRED', message);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class RateLimitError extends PublisherError {
  constructor(
    public retryAfter: number,
    public platform?: Platform
  ) {
    super('RATE_LIMIT', 'Too many requests', { retryAfter, platform });
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class MediaError extends AppError {
  constructor(
    code: APIErrorCode,
    message: string,
    public mediaUrl?: string,
    details?: unknown
  ) {
    super(400, code, message, details);
    this.name = 'MediaError';
    Object.setPrototypeOf(this, MediaError.prototype);
  }
}

// Error handler for job processing
export function handleJobError(error: unknown, platform?: Platform): APIError {
  if (error instanceof APIError) {
    return error;
  }

  if (error instanceof AppError) {
    return new APIError(
      APIErrorCode.INTERNAL_ERROR,
      platform || 'FACEBOOK',
      error.message,
      error.statusCode,
      false
    );
  }

  if (error instanceof Error) {
    return new APIError(
      APIErrorCode.UNKNOWN,
      platform || 'FACEBOOK',
      error.message,
      500,
      false
    );
  }

  return new APIError(
    APIErrorCode.UNKNOWN,
    platform || 'FACEBOOK',
    'An unexpected error occurred',
    500,
    false
  );
}

// Platform-specific error mappers
type ErrorData = {
  error?: { code?: number; message?: string };
  errors?: Array<{ code: number; message?: string }>;
  detail?: string;
  status?: number;
  message?: string;
};

type ErrorResponse = {
  response?: {
    status?: number;
    data?: ErrorData;
    headers?: Record<string, string>;
  };
  code?: string;
  message?: string;
};

export const platformErrorMappers = {
  FACEBOOK: (error: unknown): Partial<APIError> => {
    const errorResponse = error as ErrorResponse;
    const fbError = errorResponse.response?.data?.error;
    
    if (!fbError) return {};

    const errorMap: Record<number, { code: APIErrorCode; message?: string }> = {
      190: { code: APIErrorCode.TOKEN_EXPIRED, message: 'Token has expired' },
      200: { code: APIErrorCode.INSUFFICIENT_PERMISSIONS },
      368: { code: APIErrorCode.ACCOUNT_SUSPENDED, message: 'Account temporarily blocked' },
      506: { code: APIErrorCode.DUPLICATE_CONTENT },
      1609005: { code: APIErrorCode.CONTENT_TOO_LONG, message: 'Content exceeds limit' },
    };

    const mapped = fbError?.code ? errorMap[fbError.code] : undefined;
    
    return mapped ? {
      code: mapped.code,
      message: mapped.message || fbError.message,
    } : {};
  },

  TWITTER: (error: unknown): Partial<APIError> => {
    const errorResponse = error as ErrorResponse;
    const twitterError = errorResponse.response?.data;
    
    if (!twitterError) return {};

    if (twitterError.errors?.[0]) {
      const errorCode = twitterError.errors[0].code;
      
      const errorMap: Record<number, { code: APIErrorCode; message?: string }> = {
        32: { code: APIErrorCode.INVALID_TOKEN },
        89: { code: APIErrorCode.TOKEN_EXPIRED },
        187: { code: APIErrorCode.DUPLICATE_CONTENT },
        186: { code: APIErrorCode.CONTENT_TOO_LONG },
        64: { code: APIErrorCode.ACCOUNT_SUSPENDED },
        261: { code: APIErrorCode.INSUFFICIENT_PERMISSIONS },
      };

      const mapped = errorMap[errorCode];
      
      return mapped ? {
        code: mapped.code,
        message: mapped.message || twitterError.errors[0].message,
      } : {};
    }

    return {};
  },

  YOUTUBE: (error: unknown): Partial<APIError> => {
    const errorResponse = error as ErrorResponse;
    const ytError = errorResponse.response?.data?.error;
    
    if (!ytError) return {};

    const reasonMap: Record<string, { code: APIErrorCode; message?: string }> = {
      quotaExceeded: { code: APIErrorCode.DAILY_LIMIT_REACHED },
      forbidden: { code: APIErrorCode.INSUFFICIENT_PERMISSIONS },
      videoNotFound: { code: APIErrorCode.PAGE_NOT_FOUND },
      invalidVideoMetadata: { code: APIErrorCode.VALIDATION_ERROR },
      uploadLimitExceeded: { code: APIErrorCode.DAILY_LIMIT_REACHED },
    };

    const reason = (ytError as { errors?: Array<{ reason?: string }> })?.errors?.[0]?.reason;
    const mapped = reason ? reasonMap[reason] : undefined;
    
    return mapped ? {
      code: mapped.code,
      message: mapped.message || ytError.message,
    } : {};
  },

  INSTAGRAM: (error: unknown): Partial<APIError> => {
    // Instagram uses Facebook Graph API, so same error handling
    return platformErrorMappers.FACEBOOK(error);
  },

  LINKEDIN: (error: unknown): Partial<APIError> => {
    const errorResponse = error as ErrorResponse;
    const linkedinError = errorResponse.response?.data;
    
    if (!linkedinError) return {};

    if (linkedinError.status === 429) {
      return {
        code: APIErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'LinkedIn API rate limit exceeded',
      };
    }

    if (linkedinError.message?.includes('duplicate')) {
      return {
        code: APIErrorCode.DUPLICATE_CONTENT,
        message: 'Duplicate content detected',
      };
    }

    return {};
  },
};