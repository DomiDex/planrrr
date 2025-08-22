// Package: @repo/api
// Path: apps/api/src/middleware/versioning.ts
// Dependencies: hono

import { Context, Next } from 'hono';
import { logger } from '../lib/logger.js';
import type { AppContext } from '../types/index.js';

// API version configuration
const API_VERSIONS = ['v1', 'v2'] as const;
const DEFAULT_VERSION = 'v1';
const DEPRECATED_VERSIONS = ['v1'] as const;

export type ApiVersion = typeof API_VERSIONS[number];

// Version deprecation dates
const DEPRECATION_DATES: Record<string, string> = {
  v1: '2025-12-31'
};

// API versioning middleware
export function apiVersioning() {
  return async (c: Context<{ Variables: AppContext }>, next: Next) => {
    // Skip versioning for non-API routes
    if (!c.req.path.startsWith('/api') && !c.req.path.startsWith('/v')) {
      return next();
    }
    
    // Extract version from URL path (e.g., /api/v1/posts or /v1/posts)
    const urlMatch = c.req.path.match(/^\/(api\/)?(v\d+)/);
    const urlVersion = urlMatch?.[2];
    
    // Extract version from header
    const headerVersion = c.req.header('X-API-Version');
    
    // Determine final version (URL takes precedence)
    const version = urlVersion || headerVersion || DEFAULT_VERSION;
    
    // Validate version
    if (!API_VERSIONS.includes(version as ApiVersion)) {
      logger.warn('Invalid API version requested', {
        version,
        path: c.req.path,
        validVersions: API_VERSIONS
      });
      
      return c.json({
        success: false,
        error: {
          code: 'INVALID_API_VERSION',
          message: `Invalid API version: ${version}`,
          details: {
            requested: version,
            supported: API_VERSIONS,
            default: DEFAULT_VERSION
          }
        }
      }, 400);
    }
    
    // Store version in context
    c.set('apiVersion', version as ApiVersion);
    
    // Add version to response headers
    c.header('X-API-Version', version);
    
    // Add deprecation warning if applicable
    if (DEPRECATED_VERSIONS.includes(version as typeof DEPRECATED_VERSIONS[number])) {
      const deprecationDate = DEPRECATION_DATES[version];
      c.header('X-API-Deprecation', `true`);
      c.header('X-API-Deprecation-Date', deprecationDate);
      c.header('Sunset', new Date(deprecationDate).toUTCString());
      c.header('Link', `</api/v2>; rel="successor-version"`);
      
      logger.info('Deprecated API version used', {
        version,
        deprecationDate,
        path: c.req.path
      });
    }
    
    // Rewrite path if version is in URL to remove version prefix
    // This allows handlers to be version-agnostic
    if (urlVersion) {
      const pathWithoutVersion = c.req.path.replace(/^\/(api\/)?(v\d+)/, '/api');
      // Store original path for logging
      c.set('originalPath', c.req.path);
      // Update the path for routing
      Object.defineProperty(c.req, 'path', {
        value: pathWithoutVersion,
        writable: false,
        configurable: true
      });
    }
    
    return next();
  };
}

// Version-specific route handler wrapper
export function versionedRoute<T extends ApiVersion>(
  versions: T[],
  handlers: Record<T, (c: Context) => Response | Promise<Response>>
) {
  return async (c: Context<{ Variables: AppContext }>) => {
    const version = c.get('apiVersion') as T;
    
    if (!versions.includes(version)) {
      return c.json({
        success: false,
        error: {
          code: 'VERSION_NOT_SUPPORTED',
          message: `This endpoint is not available in API version ${version}`,
          details: {
            currentVersion: version,
            supportedVersions: versions
          }
        }
      }, 404);
    }
    
    const handler = handlers[version];
    if (!handler) {
      logger.error('No handler found for version', {
        version,
        path: c.req.path,
        availableVersions: Object.keys(handlers)
      });
      
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Handler not implemented for this version'
        }
      }, 500);
    }
    
    return handler(c);
  };
}

// Helper to check if a feature is available in a version
export function isFeatureAvailable(version: ApiVersion, feature: string): boolean {
  const featureMatrix: Record<string, ApiVersion[]> = {
    'ai-generation': ['v2'],
    'batch-operations': ['v2'],
    'webhooks': ['v2'],
    'analytics': ['v1', 'v2'],
    'basic-crud': ['v1', 'v2']
  };
  
  return featureMatrix[feature]?.includes(version) ?? false;
}

// Version migration helper
export function migrateRequest(fromVersion: ApiVersion, toVersion: ApiVersion, data: unknown): unknown {
  // Handle version-specific data transformations
  if (fromVersion === 'v1' && toVersion === 'v2') {
    // Example: v1 to v2 migration
    if (typeof data === 'object' && data !== null) {
      const migrated = { ...data };
      
      // Rename fields, transform structures, etc.
      // This is where you'd handle breaking changes between versions
      
      return migrated;
    }
  }
  
  return data;
}

// API version documentation
export const versionInfo = {
  current: 'v2',
  supported: API_VERSIONS,
  deprecated: DEPRECATED_VERSIONS,
  deprecationDates: DEPRECATION_DATES,
  changelog: {
    v2: {
      released: '2024-06-01',
      changes: [
        'Added AI content generation endpoints',
        'Batch operations support',
        'Webhook integrations',
        'Improved error responses'
      ]
    },
    v1: {
      released: '2024-01-01',
      deprecated: '2025-12-31',
      changes: [
        'Initial API release',
        'Basic CRUD operations',
        'Authentication',
        'Team management'
      ]
    }
  }
};