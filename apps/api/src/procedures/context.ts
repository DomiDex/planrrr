// Package: @repo/api
// Path: apps/api/src/procedures/context.ts
// Dependencies: @orpc/server, @repo/database

import { os } from '@orpc/server';
import type { User, Team } from '@repo/database';

// ORPC context type - standalone, not extending AppContext
export interface ORPCContext {
  requestId: string;
  headers: Record<string, string | undefined>;
  user?: (User & { team?: Team | null }) | null;
  apiVersion?: string;
  rateLimit?: {
    remaining: number;
    reset: Date;
    limit: number;
  };
}

// Create base procedure without initial context typing
export const publicProcedure = os
  .use(async ({ next }) => {
    // Initialize with request ID
    return next({
      context: {
        requestId: `req_${Date.now()}`,
        headers: {}
      } as ORPCContext
    });
  });

// Create a contract-first approach helper
export function createProcedure() {
  return publicProcedure;
}