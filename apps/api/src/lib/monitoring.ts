// Package: @repo/api
// Path: apps/api/src/lib/monitoring.ts
// Dependencies: @sentry/node

import * as Sentry from '@sentry/node';

export function initializeSentry() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
      ],
    });
    
    console.log('Sentry initialized');
  } else {
    console.log('Sentry DSN not configured, monitoring disabled');
  }
}

export { Sentry };